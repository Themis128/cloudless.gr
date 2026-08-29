# ComfyUI - Cloud-First (remote API) image for WSL2 / host port 8000
# NOTE: 'yanwk/comfyui:latest' (from the original task) was REMOVED from
# Docker Hub, so this deterministic image builds the official ComfyUI source.
# CPU-only torch is intentional: this deployment is cloud-first (Replicate/fal)
# and keeps no local weights, so a CUDA stack would only waste disk.

FROM python:3.11-slim-bookworm

# System deps: git (custom nodes), ffmpeg (video nodes), libgl (PIL/numpy)
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        git ffmpeg libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

# App code lives OUTSIDE the data mount so the mounted storage stays clean
WORKDIR /opt/ComfyUI
RUN git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git .

# Python deps - CPU-only torch first, then ComfyUI requirements and the
# cloud bridge client used by custom_nodes/ComfyUI-Replicate
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir replicate

# soundfile is required by custom_nodes/ComfyUI-Replicate (node.py imports it)
RUN pip install --no-cache-dir soundfile

# Data-directory infrastructure:
# compose bind-mounts ./storage onto /home/user/ComfyUI; symlinks point the
# ComfyUI workdir at that mount so models/output/input/custom_nodes persist
# on the host.
RUN mkdir -p /home/user/ComfyUI/{custom_nodes,models,output,input} \
    && rm -rf /opt/ComfyUI/custom_nodes \
    && ln -s /home/user/ComfyUI/models /opt/ComfyUI/models \
    && ln -s /home/user/ComfyUI/output /opt/ComfyUI/output \
    && ln -s /home/user/ComfyUI/input /opt/ComfyUI/input \
    && ln -s /home/user/ComfyUI/custom_nodes /opt/ComfyUI/custom_nodes

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# CLI_ARGS is provided by docker-compose: " --listen 0.0.0.0 --port 8000"
CMD ["/bin/bash", "-c", "python main.py ${CLI_ARGS:---listen 0.0.0.0 --port 8000}"]