#!/usr/bin/env python3
"""
FLUXS Zeit - Absence Records Backend
Stores absence/vacation requests in SQLite as local cache.
"""
import json, os, sqlite3, sys
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'fluxs_zeit.db')

def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("""
        CREATE TABLE IF NOT EXISTS absences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            absence_id TEXT UNIQUE,
            employee_id INTEGER,
            type TEXT NOT NULL,
            label TEXT,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            half_day INTEGER DEFAULT 0,
            comment TEXT,
            status TEXT DEFAULT 'pending',
            personio_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.execute("""
        CREATE INDEX IF NOT EXISTS idx_absences_emp
        ON absences(employee_id)
    """)
    db.commit()
    return db

def send_response(status, data):
    print(f"Status: {status}")
    print("Content-Type: application/json")
    print("Access-Control-Allow-Origin: *")
    print("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS")
    print("Access-Control-Allow-Headers: Content-Type")
    print()
    print(json.dumps(data))

method = os.environ.get("REQUEST_METHOD", "GET")
query = os.environ.get("QUERY_STRING", "")

if method == "OPTIONS":
    print("Status: 204")
    print("Access-Control-Allow-Origin: *")
    print("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS")
    print("Access-Control-Allow-Headers: Content-Type")
    print()
    sys.exit(0)

try:
    db = get_db()

    if method == "GET":
        params = dict(p.split('=', 1) for p in query.split('&') if '=' in p)
        emp_id = params.get('employee_id')

        if emp_id:
            rows = db.execute(
                "SELECT * FROM absences WHERE employee_id = ? ORDER BY start_date DESC",
                [emp_id]
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM absences ORDER BY start_date DESC LIMIT 100"
            ).fetchall()

        send_response(200, [dict(r) for r in rows])

    elif method == "POST":
        content_length = int(os.environ.get("CONTENT_LENGTH", 0))
        body = sys.stdin.read(content_length) if content_length > 0 else "{}"

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            send_response(400, {"error": "Invalid JSON"})
            sys.exit(1)

        now = datetime.utcnow().isoformat()
        absence_id = data.get('id', f"abs-{int(datetime.utcnow().timestamp())}")

        cursor = db.execute("""
            INSERT OR REPLACE INTO absences
                (absence_id, employee_id, type, label, start_date, end_date,
                 half_day, comment, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            absence_id,
            data.get('employee_id'),
            data.get('type', 'sonstige'),
            data.get('label', 'Abwesenheit'),
            data.get('start'),
            data.get('end'),
            1 if data.get('halfDay') else 0,
            data.get('comment', ''),
            data.get('status', 'pending'),
            now, now,
        ])
        db.commit()
        send_response(201, {"id": cursor.lastrowid, "absence_id": absence_id, "created": True})

    elif method == "PUT":
        # Update status (e.g., after Personio approval webhook)
        params = dict(p.split('=', 1) for p in query.split('&') if '=' in p)
        absence_id = params.get('id')
        content_length = int(os.environ.get("CONTENT_LENGTH", 0))
        body = sys.stdin.read(content_length) if content_length > 0 else "{}"
        data = json.loads(body)

        if absence_id:
            db.execute(
                "UPDATE absences SET status=?, updated_at=? WHERE absence_id=?",
                [data.get('status', 'pending'), datetime.utcnow().isoformat(), absence_id]
            )
            db.commit()
            send_response(200, {"updated": True})
        else:
            send_response(400, {"error": "Missing id"})

    else:
        send_response(405, {"error": "Method not allowed"})

except Exception as e:
    send_response(500, {"error": str(e)})
