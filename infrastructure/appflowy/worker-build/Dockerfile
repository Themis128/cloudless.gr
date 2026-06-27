# Rebuilds appflowy_worker from source with two fixes for the cloudless.gr cluster:
#
#   1. JEMALLOC_SYS_WITH_LG_PAGE=14  — matches the Pi 5's 16 KiB kernel page size
#      (upstream ships with --with-lg-page=12 / 4 KiB, which aborts on Pi 5 with
#      "<jemalloc>: Unsupported system page size")
#
#   2. RUSTFLAGS baseline-CPU pin  — compiles for Cortex-A53 (omv-ha / Pi 3),
#      disabling LSE atomics, crypto, and SVE extensions that are absent on the A53
#      but present on the A76 (omv / Pi 5) build host. The resulting binary runs
#      on BOTH nodes; the ~5-10% slowdown on A76 is acceptable for snapshot workloads.
#
# Build (on Pi 5 native runner — fastest; no QEMU needed):
#   docker buildx build \
#     --platform linux/arm64 \
#     --build-arg APPFLOWY_VERSION=<commit-or-tag> \
#     -t ghcr.io/themis128/appflowy-worker:lg-page-14-a53 \
#     --push \
#     infrastructure/appflowy/worker-build/
#
# The CI workflow .github/workflows/build-appflowy-worker.yml automates this.

ARG APPFLOWY_VERSION=main

# ── Stage 1: fetch source ─────────────────────────────────────────────────────
FROM rust:1.78-slim-bookworm AS source

RUN apt-get update && apt-get install -y --no-install-recommends \
      git ca-certificates pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

ARG APPFLOWY_VERSION
RUN git clone --depth 1 --branch "${APPFLOWY_VERSION}" \
      https://github.com/AppFlowy-IO/AppFlowy-Cloud /src || \
    git clone --depth 1 https://github.com/AppFlowy-IO/AppFlowy-Cloud /src

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM rust:1.78-slim-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
      pkg-config libssl-dev libpq-dev protobuf-compiler libprotobuf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=source /src /src
WORKDIR /src/services/appflowy-worker

# Fix 1: tell jemalloc-sys to compile jemalloc for 16 KiB pages (lg-page = log2(16384) = 14)
ENV JEMALLOC_SYS_WITH_LG_PAGE=14

# Fix 2: compile for A53 baseline; disable LSE atomics, crypto, SVE
#   -C target-cpu=cortex-a53   → conservative instruction selection
#   -C target-feature=-lse     → no Large System Extensions (atomics)
#   -C target-feature=-crypto  → no ARMv8 crypto extensions
#   -C target-feature=-sve     → no Scalable Vector Extension
ENV RUSTFLAGS="-C target-cpu=cortex-a53 -C target-feature=-lse,-crypto,-sve"

RUN cargo build --release --bin appflowy_worker

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      libssl3 libpq5 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /src/target/release/appflowy_worker /usr/local/bin/appflowy_worker

ENTRYPOINT ["/usr/local/bin/appflowy_worker"]
