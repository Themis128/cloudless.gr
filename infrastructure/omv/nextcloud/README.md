# Nextcloud on omv (192.168.1.128) - host-side config (applied 2026-10-31)

## compose-files/workspace/compose.yml - `nextcloud` service volumes

```yaml
      - ./php-conf.d/zz-jit-off.ini:/usr/local/etc/php/conf.d/zz-jit-off.ini:ro
      - ./apache-conf/zz-proxy.conf:/etc/apache2/conf-enabled/zz-proxy.conf:ro
      - ./apache-conf/substitute.load:/etc/apache2/mods-enabled/substitute.load:ro
```

`substitute.load` is required: the custom `.htaccess` uses the SUBSTITUTE filter; without it every request is 500 after a recreate.
(`zz-proxy.conf` is also mounted on nextcloud-cron / nextcloud-worker; harmless.)

## Tunnel reachability from OMV-HA (192.168.1.130, 2nd cloudflared connector)

Root cause of ~30% hangs (cloud.) and HPB 502 (signal.): Docker's per-container ACCEPT rules in the iptables
`DOCKER` chain were missing for the published ports (stale after firewall reloads). Recreating the container
(`docker compose up -d --no-deps --force-recreate <svc>`) regenerates them. Check:
`iptables -S DOCKER | grep -- '-j ACCEPT'` must list every published port.
ufw route rules also added (counters stayed at 0, i.e. not the deciding factor; kept as documentation):

```
ufw route allow proto tcp from 192.168.1.130 to any port 80   comment 'omv-ha cloudflared -> nextcloud 11000 (DNAT)'
ufw route allow proto tcp from 192.168.1.130 to any port 8081 comment 'omv-ha cloudflared -> talk-hpb 8090 (DNAT)'
```

## Nextcloud config (occ)

`trusted_proxies` must be **narrow**: a broad `172.16/12 192.168/16 10/8` lets any LAN device that talks
to Nextcloud directly (e.g. via `192.168.1.200`) spoof `CF-Connecting-IP` / `X-Forwarded-For`, which
bypasses the brute-force throttle and pollutes the audit/login logs. List only the actual proxy hops:
the omv-ha connector `192.168.1.130` plus the `workspace_default` bridge subnet - omv's own cloudflared
and in-stack callers (notify-push / talk-hpb / collabora) reach Apache NAT'd through that bridge
(gateway 172.18.0.1 - see `infrastructure/monitoring/blackbox-exporter.yaml`):

```bash
docker exec -u www-data nextcloud php occ config:system:set trusted_proxies 0 --value=192.168.1.130    # omv-ha cloudflared connector
docker exec -u www-data nextcloud php occ config:system:set trusted_proxies 1 --value=172.18.0.0/16   # workspace_default subnet
docker exec -u www-data nextcloud php occ config:system:delete trusted_proxies 2                      # drop the stale third RFC1918 entry
# confirm the subnet with: docker network inspect workspace_default -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}'
```

- forwarded_for_headers = [HTTP_CF_CONNECTING_IP, HTTP_X_FORWARDED_FOR]
- trusted_domains = localhost, cloud.cloudless.gr, 192.168.1.200 (duplicate removed)
- overwriteprotocol = https and overwrite.cli.url = https://cloud.cloudless.gr - Nextcloud generates
  https URLs itself, so Apache does not need to trust a client-supplied `X-Forwarded-Proto`:

```bash
docker exec -u www-data nextcloud php occ config:system:set overwriteprotocol --value=https
docker exec -u www-data nextcloud php occ config:system:set overwrite.cli.url --value=https://cloud.cloudless.gr
```

## Backup

`nextcloud-backup.sh` -> /usr/local/sbin (750); `.service`/`.timer` -> /etc/systemd/system; `systemctl enable --now nextcloud-backup.timer`.
Writes NAS-Backup/nextcloud/nightly/<ts>/ (pg_dump gz + config/), 14-day rotation, 03:15 nightly.

## Known integrity-check deviations (intentional, local customisations)

.htaccess, robots.txt modified; extra files skill.md, .well-known/oauth-protected-resource(.php), .well-known/agent-skills/index.json.
