#!/usr/bin/env bash
# Tear down the Postiz release. Keeps PVCs by default so accidental runs
# don't nuke the database — pass --delete-pvcs to wipe state.

set -euo pipefail

NAMESPACE="${NAMESPACE:-postiz}"
RELEASE="${RELEASE:-postiz}"
DELETE_PVCS="false"
DELETE_NS="false"

for arg in "$@"; do
  case "$arg" in
    --delete-pvcs) DELETE_PVCS="true" ;;
    --delete-ns)   DELETE_NS="true" ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--delete-pvcs] [--delete-ns]

  --delete-pvcs   Delete all 3 PVCs (postgres, redis, uploads). DESTROYS DATA.
  --delete-ns     Delete the postiz namespace entirely (includes secrets).
EOF
      exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

echo "==> helm uninstall ${RELEASE} -n ${NAMESPACE}"
helm uninstall "${RELEASE}" -n "${NAMESPACE}" || true

if [ "${DELETE_PVCS}" = "true" ]; then
  echo "==> deleting PVCs"
  kubectl -n "${NAMESPACE}" delete pvc \
    postiz-postgres-data postiz-redis-data postiz-uploads --ignore-not-found
fi

if [ "${DELETE_NS}" = "true" ]; then
  echo "==> deleting namespace"
  kubectl delete namespace "${NAMESPACE}" --ignore-not-found
fi

echo "done."
