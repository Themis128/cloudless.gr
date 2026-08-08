# Cluster hardware list — improve reliability & headroom

> **⚠️ Topology note (2026-08-08):** references to a 2-node cluster or `omv-ha`
> as a k3s worker below are **historical**. The cluster is now single-node
> (`omv` only, running a 4K-page kernel); `omv-ha` was drained + removed from
> k3s and repurposed as the dedicated mail host. See `CLAUDE.md` "Cluster
> Topology" for current state.
Living inventory + prioritized buy / swap list for the cloudless.gr Pi
k3s fabric (`omv` + `omv-ha`). Written after the **2026-07-30** hard-reboot
storm (four abrupt omv resets the same day: USB-SSD I/O stall → OMV
`RuntimeWatchdogSec=15` → silent reset; mass Kuma `EAI_AGAIN`).

Software mitigations already on omv (do not undo):

- `/etc/udev/rules.d/60-ssd-rotational.rules` — `sd[ab]` → non-rotational,
  `nr_requests=256`, `read_ahead_kb=128`
- `/etc/systemd/system.conf.d/zz-cloudless-watchdog.conf` —
  `RuntimeWatchdogSec=60` (overrides OMV’s 15s; filename must sort after
  `openmediavault-watchdog.conf`)

Related: [cluster-overload-runbook.md](cluster-overload-runbook.md),
[cluster-capacity-audit-2026-06-21.md](cluster-capacity-audit-2026-06-21.md),
[TAILSCALE-FABRIC.md](TAILSCALE-FABRIC.md), storage notes in `CLAUDE.md`
(omv-main layout).

---

## Current inventory (verified 2026-07-30)

### `omv` — control plane (LAN `192.168.1.128`, keepalived VIP `192.168.1.200`)

| Item | What we have | Role / notes |
|------|----------------|--------------|
| Board | **Raspberry Pi 5 Model B Rev 1.0**, 8 GiB | k3s server, GH runners, most workloads |
| OS root | microSD **~59 GB** (`mmcblk0`, ~81% full) | OS only — keep under ~75% |
| k3s data SSD | **SanDisk SDSSDP128G** 119 GB via **ICY BOX IB-AC603b-U3** (JMicron **JMS578**, UAS, USB3) | `/var/lib/rancher/k3s` + local-path PVs — **critical path** |
| User-data SSD | **Samsung SSD 860 EVO 1 TB** via **ASMedia ASM1153 / AS2115** (USB3, currently **`usb-storage` not UAS**) | Backups / media share — must not host k3s |
| NIC | Onboard GbE `eth0` | Primary LAN |
| Power | USB-C PD (confirm official **27 W** brick on-site) | `EXT5V` ~5.10 V idle; no logged under-voltage across last 5 boots — resets still happened |
| USB topology | Both SSDs **direct on Pi USB3** (no powered hub) | Highest hardware risk |

### `omv-ha` — worker / standby (LAN `192.168.1.130`)

| Item | What we have | Role / notes |
|------|----------------|--------------|
| Board | **Raspberry Pi 3 Model B Rev 1.2**, **~1 GiB** RAM | k3s agent; AppFlowy worker pin (4 KiB pages); keepalived peer |
| Storage | microSD **~30 GB** only | No dedicated SSD |
| NIC | Onboard Fast Ethernet (SMSC) | Fine for standby / light pods |

Docs historically said “Pi 4 1 GB”; live `device-tree` is **Pi 3 B**. Treat capacity accordingly — effectively saturated for anything >~100 Mi.

### Shared / network

| Item | What we have |
|------|----------------|
| Keepalived VIP | `192.168.1.200/24` on `eth0` |
| Tailscale | Host mesh — see [TAILSCALE-FABRIC.md](TAILSCALE-FABRIC.md) |
| Office LAN | `192.168.1.0/24` |

---

## Pain points the HW should fix

1. **Bus-powered dual USB3 SSD on Pi 5** — peak I/O can freeze the box hard enough that journals end mid-flight with **no** under-voltage sticky bit.
2. **ASMedia bridge on `usb-storage`** — higher latency / stall risk than UAS (SanDisk/JMicron path).
3. **k3s on USB-SATA** — etcd fsync latency; already tuned (udev + etcd intervals); still weaker than NVMe.
4. **omv-ha is a Pi 3 / 1 GiB** — cannot absorb failover of heavy pods; Raft HA needs a **third** capable node anyway.
5. **Root SD 81%** on omv — unrelated to USB stalls but next disk-pressure landmine.
6. **RAM on omv ~2.5 GiB available** under load — post-reboot image/page storms amplify USB stalls.

---

## Prioritized shopping list

Priority: **P0** = stops silent reboots / data risk · **P1** = real HA / headroom · **P2** = nice quality-of-life.

### P0 — power & USB (do first, at the box)

| # | Buy / do | Why | Approx. target |
|---|----------|-----|----------------|
| 1 | Confirm / replace with **official Raspberry Pi 27 W USB-C PD** PSU + short known-good PD cable | Weak chargers brown out without clean logs | Official Pi PSU |
| 2 | **Powered USB 3.0/3.1 hub** (self-powered, ≥2 A hub supply, UASP-friendly) — move **both** SSD enclosures onto the hub; one uplink to Pi USB3 | Removes dual bus-powered SSD load from the SoC | Quality powered hub (e.g. UGREEN / Anker with external brick — verify UASP) |
| 3 | Optional: replace ASMedia enclosure with a **JMicron JMS578 / ASM235CM** enclosure known-good for **UAS** on Pi | Drop `usb-storage`-only path on the 1 TB disk | USB3-SATA enclosure w/ UAS |

### P0 — storage hygiene (cheap / free)

| # | Buy / do | Why |
|---|----------|-----|
| 4 | Larger / healthier **microSD** for omv root (A2, endurance), or free SD to &lt;70% | 81% root invites unrelated failures |
| 5 | Keep **k3s only on SanDisk (`sda`)** — never remount k3s onto the Samsung share | Already policy; re-check after any OMV UI change |

### P1 — control-plane storage upgrade

| # | Buy / do | Why | Approx. target |
|---|----------|-----|----------------|
| 6 | **Pi 5 PCIe / NVMe HAT** + **NVMe SSD ≥256 GB** (DRAM or HMB, not QLC-trash) for k3s data | Cuts USB-SATA from the etcd path; biggest reliability win after powered hub | Official or Pineboards/Pimoroni-class HAT + 256–512 GB NVMe |
| 7 | Retire SanDisk USB stick from k3s once NVMe proven; reuse as cold backup | Simplifies USB bus | — |

### P1 — second capable node (real worker, not Pi 3)

| # | Buy / do | Why | Approx. target |
|---|----------|-----|----------------|
| 8 | **Raspberry Pi 5 8 GB** (or 16 GB) as new `omv-ha` / worker | Current Pi 3 cannot take Postiz/Prometheus/AppFlowy spill | Pi 5 8 GB + case + 27 W PSU |
| 9 | NVMe or USB3 SSD (≥128 GB) for the new worker | local-path + image layers | Same as omv pattern |
| 10 | Keep Pi 3 as optional IoT / MQTT edge **outside** critical scheduling | Avoid pretending it is HA capacity | — |

### P1 — true k3s HA (when 3 servers exist)

| # | Buy / do | Why |
|---|----------|-----|
| 11 | **Third Pi 5** (or x86 mini PC) as odd-numbered etcd member | 2-node Raft = quorum 2 = zero failure tolerance; see Notion k3s runbook |
| 12 | Dedicated small UPS for omv (+ hub + switch) | Silent power blips look like “watchdog reboots” |

### P2 — niceties

| # | Buy / do | Why |
|---|----------|-----|
| 13 | Gigabit switch port quality / short Cat6 to omv | Reduce spurious VIP / Tailscale flapping noise |
| 14 | Active cooler / case airflow check on Pi 5 | Thermal OK today (~55 °C); keep headroom under image builds |
| 15 | Label cables: `k3s-ssd`, `userdata-ssd`, `hub-uplink`, `PD-in` | Faster incident response at the desk |

---

## Suggested buy order (minimal spend → max stability)

```text
1. Verify 27W PD PSU + cable
2. Powered USB3 hub → both SSDs off the Pi ports
3. Free omv root SD (or replace card)
4. NVMe HAT + SSD for k3s on omv
5. Replace omv-ha Pi 3 with Pi 5 8GB (+ disk + PSU)
6. UPS
7. Third server node for etcd HA
```

---

## At-the-box verification (after P0)

```bash
# On omv — SSDs should sit behind a hub (extra USB level in tree)
lsusb -t

# Still non-rotational / deep queue after reboot
cat /sys/block/sd{a,b}/queue/rotational
cat /sys/block/sd{a,b}/queue/nr_requests

# Watchdog still 60s (zz- drop-in wins over OMV)
systemctl show -p RuntimeWatchdogUSec

# Prefer UAS on both mass-storage devices
dmesg -T | grep -iE 'uas|usb-storage|JMicron|ASMedia' | tail -20

# Power sticky bits (should stay 0x0)
vcgencmd get_throttled
```

Expect: hub in the USB tree; both disks `rota=0` `nr_requests=256`;
`RuntimeWatchdogUSec=1min`; fewer or zero hard boots in `journalctl --list-boots`.

---

## Out of scope / do not buy for this cluster

| Idea | Why not |
|------|---------|
| Self-hosted Sentry / full ELK on Pis | RAM — keep SaaS (see capacity audit) |
| Second spinning HDD on USB for k3s | Latency / stalls worse than today |
| Relying on omv-ha Pi 3 for control-plane failover | Insufficient RAM/CPU; wrong page size for some images |

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-30 | Initial list from live inventory + reboot-storm RCA (`omv-ha` corrected to Pi 3 B). |
