# Pi 5 (omv) host tuning

Durable Raspberry Pi 5 (8 GB) knobs for the single-node k3s control plane.

## Why

2026-08-26: BCM2835 hardware watchdog + boot storm (k3s + mailcow/clamd +
GHA runners) caused a ~4 minute reboot loop. `cloudless-app` showed
`Unknown` / high restart counts even though the app itself was fine.

## Install (on omv)

```bash
# from laptop (LAN)
scp -r infrastructure/omv/pi5-tuning omv-lan:/tmp/
ssh omv-lan 'sudo bash /tmp/pi5-tuning/install-pi5-tuning.sh'

# skip k3s restart if you only want sysctl/watchdog:
ssh omv-lan 'sudo K3S_RESTART=0 bash /tmp/pi5-tuning/install-pi5-tuning.sh'
```

Note: the k3s unit on this host is **`k3s-k3s-omv.service`** (not `k3s.service`).
The installer detects it automatically.

## What it sets

| Knob | Value | Purpose |
| --- | --- | --- |
| `RuntimeWatchdogSec` | 3 min | Survive USB-SSD / boot load spikes |
| `vm.swappiness` | 10 | Prefer reclaim; swap last resort |
| `vm.dirty_*` | modest | Avoid flush storms on USB SATA |
| journald `SystemMaxUse` | 512M | Protect SD card root |
| docker `After=k3s` | — | Control plane before containers |
| GHA runner `ExecStartPre` sleep | 120s | CI after kubelet settles |
| `cloudless-boot-stagger` | mailcow delayed | Stop/start mailcow until load < 8 |
| kubelet reserved | 768Mi+512Mi | Keep host/etcd from starving |

## Verify

```bash
systemctl show -p RuntimeWatchdogUSec
sysctl vm.swappiness vm.dirty_ratio
sudo k3s kubectl describe node omv | grep -A25 Allocatable
uptime; free -h
```
