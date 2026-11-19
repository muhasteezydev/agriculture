"""
Local SQLite offline-first storage for AgroGuard Edge.
Persists telemetry ring-buffer, actuator actions, and CV disease detections.
"""

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import List, Dict, Any


DB_PATH = os.path.join(os.path.dirname(__file__), "agroguard_local.db")


class LocalEdgeDB:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    title_ru TEXT NOT NULL,
                    title_kg TEXT NOT NULL,
                    body_ru TEXT NOT NULL,
                    body_kg TEXT NOT NULL,
                    meta_json TEXT
                )
                """
            )
            conn.commit()

    def log_event(
        self,
        event_type: str,
        severity: str,
        title_ru: str,
        title_kg: str,
        body_ru: str,
        body_kg: str,
        meta: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        meta_json = json.dumps(meta or {}, ensure_ascii=False)
        with self._lock, self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO events (ts, event_type, severity, title_ru, title_kg, body_ru, body_kg, meta_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (ts, event_type, severity, title_ru, title_kg, body_ru, body_kg, meta_json),
            )
            conn.commit()
            event_id = cur.lastrowid

            # Keep ring buffer tidy (latest 80 events)
            conn.execute(
                """
                DELETE FROM events WHERE id NOT IN (
                    SELECT id FROM events ORDER BY id DESC LIMIT 80
                )
                """
            )
            conn.commit()

        return {
            "id": event_id,
            "ts": ts,
            "event_type": event_type,
            "severity": severity,
            "title_ru": title_ru,
            "title_kg": title_kg,
            "body_ru": body_ru,
            "body_kg": body_kg,
            "meta": meta or {},
        }

    def get_recent_events(self, limit: int = 25) -> List[Dict[str, Any]]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        out = []
        for r in rows:
            out.append({
                "id": r["id"],
                "ts": r["ts"],
                "event_type": r["event_type"],
                "severity": r["severity"],
                "title_ru": r["title_ru"],
                "title_kg": r["title_kg"],
                "body_ru": r["body_ru"],
                "body_kg": r["body_kg"],
                "meta": json.loads(r["meta_json"] or "{}"),
            })
        return out
