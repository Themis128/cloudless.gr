"""
Alert database — aiosqlite async SQLite.
Tables:
  alerts        — UNIQUE(code), current state (UPSERT on conflict)
  alert_history — append-only event log
  esp32_logs    — verbose log lines pushed by the ESP32
  esp32_status  — singleton row: last-known ESP32 hardware state
"""
import aiosqlite
import logging
from datetime import datetime, timezone
from typing import Optional

DB_PATH = "/data/alerts.db"
log = logging.getLogger("database")


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        # ── Alerts ────────────────────────────────────────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                code        TEXT PRIMARY KEY,
                host        TEXT NOT NULL,
                service     TEXT NOT NULL,
                severity    TEXT NOT NULL,
                message     TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'FIRING',
                count       INTEGER NOT NULL DEFAULT 1,
                first_seen  TEXT NOT NULL,
                last_seen   TEXT NOT NULL,
                resolved_at TEXT,
                resolved_by TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS alert_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                code        TEXT NOT NULL,
                host        TEXT NOT NULL,
                service     TEXT NOT NULL,
                severity    TEXT NOT NULL,
                message     TEXT NOT NULL,
                status      TEXT NOT NULL,
                count       INTEGER NOT NULL DEFAULT 1,
                ts          TEXT NOT NULL,
                resolved_by TEXT
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_history_code ON alert_history(code)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_history_ts   ON alert_history(ts)")

        # ── ESP32 logs ────────────────────────────────────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS esp32_logs (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                ts      TEXT    NOT NULL,
                level   TEXT    NOT NULL DEFAULT 'INFO',
                message TEXT    NOT NULL
            )
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_logs_ts ON esp32_logs(ts)")

        # ── ESP32 hardware status (singleton, id = 1) ─────────────────────────
        await db.execute("""
            CREATE TABLE IF NOT EXISTS esp32_status (
                id             INTEGER PRIMARY KEY DEFAULT 1,
                ip             TEXT,
                rssi           INTEGER,
                firmware_ver   TEXT,
                uptime_s       INTEGER,
                free_ram_bytes INTEGER,
                last_heartbeat TEXT,
                started_at     TEXT
            )
        """)
        # Ensure the singleton row exists
        await db.execute("""
            INSERT OR IGNORE INTO esp32_status (id) VALUES (1)
        """)

        await db.commit()
    log.info("Database initialised at %s", DB_PATH)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Alerts ─────────────────────────────────────────────────────────────────────

async def upsert_alert(alert: dict) -> dict:
    code     = alert["code"]
    host     = alert["host"]
    service  = alert["service"]
    severity = alert["severity"]
    message  = alert["message"]
    status   = alert["status"]
    count    = alert.get("count", 1)
    now      = _now()

    async with aiosqlite.connect(DB_PATH) as db:
        if status in ("FIRING", "INFO"):
            await db.execute("""
                INSERT INTO alerts
                    (code, host, service, severity, message, status, count, first_seen, last_seen)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(code) DO UPDATE SET
                    status      = excluded.status,
                    message     = excluded.message,
                    count       = excluded.count,
                    last_seen   = excluded.last_seen,
                    resolved_at = NULL,
                    resolved_by = NULL
            """, (code, host, service, severity, message, status, count, now, now))

        elif status == "ONGOING":
            await db.execute("""
                UPDATE alerts
                SET status = 'ONGOING', count = ?, last_seen = ?
                WHERE code = ?
            """, (count, now, code))

        elif status == "RESOLVED":
            await db.execute("""
                UPDATE alerts
                SET status = 'RESOLVED', resolved_at = ?, resolved_by = ?, last_seen = ?
                WHERE code = ?
            """, (now, alert.get("resolved_by", "esp32"), now, code))

        # Always append to history
        await db.execute("""
            INSERT INTO alert_history
                (code, host, service, severity, message, status, count, ts, resolved_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (code, host, service, severity, message, status, count, now,
              alert.get("resolved_by")))

        await db.commit()

    return await get_alert(code) or {}


async def get_alert(code: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM alerts WHERE code = ?", (code,)) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def get_active_alerts() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM alerts
            WHERE status NOT IN ('RESOLVED')
            ORDER BY
                CASE severity
                    WHEN 'critical' THEN 0
                    WHEN 'high'     THEN 1
                    WHEN 'medium'   THEN 2
                    WHEN 'low'      THEN 3
                    ELSE 4
                END,
                last_seen DESC
        """) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def get_alert_history(limit: int = 100) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM alert_history ORDER BY ts DESC LIMIT ?", (limit,)
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]


async def get_alert_stats() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        stats: dict = {"total": 0, "active": 0, "resolved": 0, "by_severity": {}}
        async with db.execute("SELECT COUNT(*) FROM alerts") as cur:
            stats["total"] = (await cur.fetchone())[0]
        async with db.execute(
            "SELECT COUNT(*) FROM alerts WHERE status NOT IN ('RESOLVED')"
        ) as cur:
            stats["active"] = (await cur.fetchone())[0]
        async with db.execute(
            "SELECT COUNT(*) FROM alerts WHERE status = 'RESOLVED'"
        ) as cur:
            stats["resolved"] = (await cur.fetchone())[0]
        async with db.execute(
            "SELECT severity, COUNT(*) FROM alerts GROUP BY severity"
        ) as cur:
            async for row in cur:
                stats["by_severity"][row[0]] = row[1]
    return stats


async def resolve_alert(code: str, resolved_by: str = "manual") -> bool:
    now = _now()
    async with aiosqlite.connect(DB_PATH) as db:
        result = await db.execute("""
            UPDATE alerts
            SET status = 'RESOLVED', resolved_at = ?, resolved_by = ?, last_seen = ?
            WHERE code = ? AND status NOT IN ('RESOLVED')
        """, (now, resolved_by, now, code))
        if result.rowcount == 0:
            return False
        await db.execute("""
            INSERT INTO alert_history
                (code, host, service, severity, message, status, count, ts, resolved_by)
            SELECT code, host, service, severity, message, 'RESOLVED', count, ?, ?
            FROM alerts WHERE code = ?
        """, (now, resolved_by, code))
        await db.commit()
    return True


# ── ESP32 Logs ─────────────────────────────────────────────────────────────────

async def insert_log(level: str, message: str) -> dict:
    now = _now()
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO esp32_logs (ts, level, message) VALUES (?, ?, ?)",
            (now, level.upper(), message),
        )
        row_id = cur.lastrowid
        await db.commit()
        # Trim old logs — keep last 5000 lines
        await db.execute("""
            DELETE FROM esp32_logs
            WHERE id NOT IN (
                SELECT id FROM esp32_logs ORDER BY id DESC LIMIT 5000
            )
        """)
        await db.commit()
    return {"id": row_id, "ts": now, "level": level.upper(), "message": message}


async def get_logs(limit: int = 200, offset: int = 0) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM esp32_logs ORDER BY id DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
    rows.reverse()  # oldest first for display
    return rows


# ── ESP32 Status ───────────────────────────────────────────────────────────────

async def upsert_esp32_status(data: dict) -> dict:
    now = _now()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE esp32_status SET
                ip             = COALESCE(?, ip),
                rssi           = COALESCE(?, rssi),
                firmware_ver   = COALESCE(?, firmware_ver),
                uptime_s       = COALESCE(?, uptime_s),
                free_ram_bytes = COALESCE(?, free_ram_bytes),
                last_heartbeat = ?,
                started_at     = COALESCE(started_at, ?)
            WHERE id = 1
        """, (
            data.get("ip"),
            data.get("rssi"),
            data.get("firmware_ver"),
            data.get("uptime_s"),
            data.get("free_ram_bytes"),
            now,
            now,
        ))
        await db.commit()
    return await get_esp32_status()


async def get_esp32_status() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM esp32_status WHERE id = 1") as cur:
            row = await cur.fetchone()
            return dict(row) if row else {}
