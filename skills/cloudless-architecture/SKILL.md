# cloudless.gr architecture skill

Use this skill whenever answering architecture, deployment, failover, or infrastructure questions for cloudless.gr.

## Core architecture

- AWS Lambda/SST is the primary runtime for the public cloudless.gr web app.
- Pi k3s is warm-standby for the web app and primary host for self-hosted apps.
- Self-hosted apps live only on Pi:
  - AppFlowy
  - EspoCRM
  - Postiz
  - n8n
  - Mosquitto
  - Grafana
  - Uptime Kuma
  - ntfy

## Important constraints

- Do not assume Pi-hosted apps have AWS replicas.
- Do not propose architectures that require replacing the current AWS primary + Pi standby model unless explicitly asked.
- For production changes, prefer incremental roadmap-aligned work.
- Keep secrets out of responses and patches.
- Generated local AI data must not be committed:
  - `.deepagents/langchain_docs_chroma/`
  - `.deepagents/cloudless_repo_chroma/`
  - `.agent-memory/`

## Recommended reasoning

When suggesting changes:
1. Identify whether the change affects AWS primary, Pi standby, self-hosted apps, or both.
2. Check if the change touches persistent k3s storage.
3. Check if the change requires secret rotation or new environment variables.
4. Propose tests and rollback steps.
