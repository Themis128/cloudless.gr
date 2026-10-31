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
- forwarded_for_headers = [HTTP_CF_CONNECTING_IP, HTTP_X_FORWARDED_FOR]; trusted_proxies = 172.16.0.0/12 192.168.0.0/16 10.0.0.0/8
- trusted_domains = localhost, cloud.cloudless.gr, 192.168.1.200 (duplicate removed)

## Backup
`nextcloud-backup.sh` -> /usr/local/sbin (750); `.service`/`.timer` -> /etc/systemd/system; `systemctl enable --now nextcloud-backup.timer`.
Writes NAS-Backup/nextcloud/nightly/<ts>/ (pg_dump gz + config/), 14-day rotation, 03:15 nightly.

## Known integrity-check deviations (intentional, local customisations)
.htaccess, robots.txt modified; extra files skill.md, .well-known/oauth-protected-resource(.php), .well-known/agent-skills/index.json.
