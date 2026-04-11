#!/usr/bin/env bash
set -euo pipefail

# Stop/remove dev containers created for this workspace root.
workspace_folder="$(pwd -P)"
workspace_label="devcontainer.local_folder=${workspace_folder}"

container_ids="$(docker ps -aq --filter "label=${workspace_label}")"
if [[ -z "${container_ids}" ]]; then
  echo "No matching devcontainer found for ${workspace_folder}."
  exit 0
fi

echo "Removing devcontainer(s):"
echo "${container_ids}"
docker rm -f ${container_ids}
echo "Devcontainer cleanup complete."
