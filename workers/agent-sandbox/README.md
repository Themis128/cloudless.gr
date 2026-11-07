# agent-sandbox

Dynamic Workers (`worker_loaders`) spike — proves isolated per-task worker
execution for per-client automations.

- `POST /run {module, input}` — `module` is one of `lead-score` / `template-fill`
  (hard allowlist; arbitrary user code is never loaded). Loaded workers are
  binding-less: no env, no bindings, no fs/net egress — fetch-only sandbox.
- `GET /health` lists modules. Bearer `SANDBOX_TOKEN`
  (`wrangler secret put SANDBOX_TOKEN`).

Cost model: each `LOADER.get` spins an isolated worker — billed per invocation
like a normal worker plus loader overhead. Spike-only until a BACKLOG decision
approves production modules; do not expose publicly.
