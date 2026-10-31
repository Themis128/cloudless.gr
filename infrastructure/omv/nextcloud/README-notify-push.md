# nextcloud-notify-push (2026-10-31)
Crash-loop "failed to lookup address information" for DB host `nextcloud-db`: the old container had lost its attachment to
`workspace_default` (inspect showed the network with no IP), so Docker DNS could not resolve service names.
Fix: `docker compose up -d --no-deps --force-recreate notify-push` (no compose change needed; dbhost=nextcloud-db and
redis host=redis come from config.php and resolve on workspace_default). Self-test passes 6/6.
If it recurs after network changes, recreate notify-push (not just restart).
