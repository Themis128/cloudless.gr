#!/usr/bin/env bash
# Install a `kubectl` shim that forwards to omv's k3s over Tailscale+SSH.
#
# Why: the KUBECONFIG_B64 secret points at localhost:8080 — a proxy that
# nothing ever establishes, so every kubectl call in CI hit
# "connection refused" while workflows reported success. This shim routes
# kubectl through SSH to omv instead (sudo kubectl, remote kubeconfig).
#
# Needs: secrets.OMV_SSH_KEY (ed25519 for tbaltzakis@100.74.191.58),
#        Tailscale already joined (tailscale/github-action step).
set -euo pipefail
mkdir -p ~/.ssh ~/bin
printf '%s\n' "${OMV_SSH_KEY:?missing OMV_SSH_KEY}" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan -H 100.74.191.58 >> ~/.ssh/known_hosts 2>/dev/null || true
cat > ~/bin/kubectl <<'EOF'
#!/usr/bin/env bash
# kubectl runs on omv, so runner-local files must be streamed over stdin:
#  - `-f <file|dir>` (repeatable, -R honoured) -> concatenated YAML as `-f -`
#  - `cp <local> <pod>:<path>` / `cp <pod>:<path> <local>` -> exec + cat
# Each arg is %q-quoted so jsonpath={...}, -p '{...}' survive SSH.
set -euo pipefail
remote() {
  exec ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    -i ~/.ssh/id_ed25519 tbaltzakis@100.74.191.58 \
    "sudo kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml $(printf '%q ' "$@")"
}
die() { echo "kubectl-shim: $*" >&2; exit 1; }

# --- kubectl cp (single files; dirs unsupported) ---
if [ "${1:-}" = cp ]; then
  shift; pos=(); opts=()
  while [ $# -gt 0 ]; do
    case "$1" in
      -n|--namespace|-c|--container) opts+=("$1" "$2"); shift 2 ;;
      -*) opts+=("$1"); shift ;;
      *) pos+=("$1"); shift ;;
    esac
  done
  [ ${#pos[@]} -eq 2 ] || die "cp needs <src> <dst>"
  src=${pos[0]} dst=${pos[1]}
  if [[ "$dst" == *:* && -e "$src" ]]; then
    [ -f "$src" ] || die "cp of local directory '$src' not supported"
    ns_pod=${dst%%:*} path=${dst#*:}
    pod=${ns_pod##*/}; [[ "$ns_pod" == */* ]] && opts+=(-n "${ns_pod%%/*}")
    # shellcheck disable=SC2016 # $1 expands in the pod shell
    remote exec -i "${opts[@]}" "$pod" -- sh -c 'cat > "$1"' sh "$path" < "$src"
  elif [[ "$src" == *:* && "$dst" != *:* ]]; then
    ns_pod=${src%%:*} path=${src#*:}
    pod=${ns_pod##*/}; [[ "$ns_pod" == */* ]] && opts+=(-n "${ns_pod%%/*}")
    ( remote exec -i "${opts[@]}" "$pod" -- cat "$path" ) > "$dst"
    exit $?
  fi
  remote cp "${opts[@]}" "$src" "$dst"
fi

# --- -f/--filename local files -> stdin ---
args=(); files=(); recursive=0
for a in "$@"; do case "$a" in -R|--recursive|--recursive=true) recursive=1 ;; esac; done
while [ $# -gt 0 ]; do
  f=""
  case "$1" in
    -f|--filename) f=${2-}; shift 2 || die "$1 needs a value" ;;
    --filename=*) f=${1#--filename=}; shift ;;
    -f?*) f=${1#-f}; shift ;;
    *) args+=("$1"); shift; continue ;;
  esac
  if [ "$f" = - ] || [[ "$f" =~ ^https?:// ]]; then args+=(-f "$f"); continue; fi
  if [ -d "$f" ]; then
    depth=(-maxdepth 1); [ $recursive = 1 ] && depth=()
    while IFS= read -r x; do files+=("$x"); done < <(
      find "$f" "${depth[@]}" -type f \( -name '*.yaml' -o -name '*.yml' -o -name '*.json' \) | LC_ALL=C sort)
  elif [ -f "$f" ]; then files+=("$f")
  else die "path \"$f\" does not exist on the runner"
  fi
done
if [ ${#files[@]} -gt 0 ]; then
  for a in "${args[@]}"; do [ "$a" = - ] && die "cannot mix local -f with -f -"; done
  for x in "${files[@]}"; do printf -- '---\n'; cat "$x"; printf '\n'; done \
    | remote "${args[@]}" -f -
  exit "${PIPESTATUS[1]}"
fi
remote "${args[@]}"
EOF
chmod +x ~/bin/kubectl
echo "$HOME/bin" >> "$GITHUB_PATH"
~/bin/kubectl version 2>&1 | tail -2
