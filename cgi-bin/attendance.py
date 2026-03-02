#!/usr/bin/env python3
"""
FLUXS Zeit - Attendance Records Backend
Stores time entries in SQLite as a local cache/backup.
"""
import json, os, sqlite3, sys
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'fluxs_zeit.db')

def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            employee_name TEXT,
            date TEXT NOT NULL,
            start_time TEXT,
            end_time TEXT,
            break_minutes INTEGER DEFAULT 0,
            smoke_break_minutes INTEGER DEFAULT 0,
            work_ms INTEGER DEFAULT 0,
            comment TEXT,
            synced_to_personio INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.execute("""
        CREATE INDEX IF NOT EXISTS idx_attendance_emp_date
        ON attendance(employee_id, date)
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

# Handle CORS preflight
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
        # Parse query params
        params = dict(p.split('=', 1) for p in query.split('&') if '=' in p)
        emp_id = params.get('employee_id')
        month = params.get('month')  # YYYY-MM
        date = params.get('date')

        if date:
            rows = db.execute(
                "SELECT * FROM attendance WHERE date = ? ORDER BY date",
                [date]
            ).fetchall()
        elif emp_id and month:
            rows = db.execute(
                "SELECT * FROM attendance WHERE employee_id = ? AND date LIKE ? ORDER BY date",
                [emp_id, f"{month}%"]
            ).fetchall()
        elif emp_id:
            rows = db.execute(
                "SELECT * FROM attendance WHERE employee_id = ? ORDER BY date DESC LIMIT 100",
                [emp_id]
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM attendance ORDER BY date DESC LIMIT 50"
            ).fetchall()

        result = [dict(r) for r in rows]
        send_response(200, result)

    elif method == "POST":
        content_length = int(os.environ.get("CONTENT_LENGTH", 0))
        body = sys.stdin.read(content_length) if content_length > 0 else "{}"

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            send_response(400, {"error": "Invalid JSON"})
            sys.exit(1)

        # Upsert: if same employee_id + date exists, update it
        existing = db.execute(
            "SELECT id FROM attendance WHERE employee_id = ? AND date = ?",
            [data.get('employee_id'), data.get('date')]
        ).fetchone()

        now = datetime.utcnow().isoformat()

        if existing:
            db.execute("""
                UPDATE attendance
                SET employee_name=?, start_time=?, end_time=?,
                    break_minutes=?, smoke_break_minutes=?, work_ms=?,
                    comment=?, updated_at=?
                WHERE id=?
            """, [
                data.get('employee_name'),
                data.get('start_time'),
                data.get('end_time'),
                data.get('break_minutes', 0),
                data.get('smoke_break_minutes', 0),
                data.get('work_ms', 0),
                data.get('comment', ''),
                now,
                existing['id'],
            ])
            db.commit()
            send_response(200, {"id": existing['id'], "updated": True})
        else:
            cursor = db.execute("""
                INSERT INTO attendance
                    (employee_id, employee_name, date, start_time, end_time,
                     break_minutes, smoke_break_minutes, work_ms, comment, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                data.get('employee_id'),
                data.get('employee_name'),
                data.get('date'),
                data.get('start_time'),
                data.get('end_time'),
                data.get('break_minutes', 0),
                data.get('smoke_break_minutes', 0),
                data.get('work_ms', 0),
                data.get('comment', ''),
                now, now,
            ])
            db.commit()
            send_response(201, {"id": cursor.lastrowid, "created": True})

    elif method == "DELETE":
        params = dict(p.split('=', 1) for p in query.split('&') if '=' in p)
        rec_id = params.get('id')
        if rec_id:
            db.execute("DELETE FROM attendance WHERE id = ?", [rec_id])
            db.commit()
            send_response(200, {"deleted": True, "id": rec_id})
        else:
            send_response(400, {"error": "Missing id parameter"})

    else:
        send_response(405, {"error": "Method not allowed"})

except Exception as e:
    send_response(500, {"error": str(e)})
