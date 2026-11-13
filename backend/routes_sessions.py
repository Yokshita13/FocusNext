from flask import Blueprint, jsonify, request
from db import get_db, rows, DEFAULT_SETTINGS
from utils import error, clean_text, to_int, valid_day, today_str

bp = Blueprint("sessions", __name__, url_prefix="/api")


# ---------- Pomodoro sessions ----------
@bp.get("/sessions")
def list_sessions():
    day = request.args.get("day") or today_str()
    if not valid_day(day):
        return error("day must be YYYY-MM-DD")
    cur = get_db().execute(
        """SELECT s.*, t.title AS task_title FROM sessions s
           LEFT JOIN tasks t ON t.id = s.task_id
           WHERE s.day = ? ORDER BY s.id DESC""",
        (day,),
    )
    return jsonify(rows(cur))


@bp.post("/sessions")
def log_session():
    data = request.get_json(silent=True) or {}
    kind = data.get("kind", "focus")
    if kind not in ("focus", "break"):
        return error("kind must be focus or break")
    day = data.get("day") or today_str()
    if not valid_day(day):
        return error("day must be YYYY-MM-DD")
    minutes = to_int(data.get("minutes"), 0, 0, 240)
    if minutes < 1:
        return error("minutes must be at least 1")
    completed = 1 if data.get("completed", True) else 0
    task_id = data.get("task_id")

    db = get_db()
    if task_id is not None:
        if not db.execute("SELECT 1 FROM tasks WHERE id = ?", (task_id,)).fetchone():
            task_id = None

    cur = db.execute(
        "INSERT INTO sessions(task_id, kind, minutes, completed, day) VALUES (?,?,?,?,?)",
        (task_id, kind, minutes, completed, day),
    )
    if kind == "focus" and completed and task_id is not None:
        db.execute("UPDATE tasks SET done_pomodoros = done_pomodoros + 1 WHERE id = ?", (task_id,))
    db.commit()
    row = db.execute("SELECT * FROM sessions WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


# ---------- Distraction parking lot ----------
@bp.get("/distractions")
def list_distractions():
    day = request.args.get("day") or today_str()
    if not valid_day(day):
        return error("day must be YYYY-MM-DD")
    cur = get_db().execute("SELECT * FROM distractions WHERE day = ? ORDER BY id DESC", (day,))
    return jsonify(rows(cur))


@bp.post("/distractions")
def add_distraction():
    data = request.get_json(silent=True) or {}
    note = clean_text(data.get("note"))
    day = data.get("day") or today_str()
    if not note:
        return error("note is required")
    if not valid_day(day):
        return error("day must be YYYY-MM-DD")
    db = get_db()
    cur = db.execute("INSERT INTO distractions(note, day) VALUES (?, ?)", (note, day))
    db.commit()
    row = db.execute("SELECT * FROM distractions WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@bp.delete("/distractions/<int:d_id>")
def delete_distraction(d_id):
    db = get_db()
    db.execute("DELETE FROM distractions WHERE id = ?", (d_id,))
    db.commit()
    return "", 204


# ---------- Settings ----------
LIMITS = {
    "focus_min": (1, 120),
    "short_break_min": (1, 60),
    "long_break_min": (1, 120),
    "long_break_every": (2, 12),
    "daily_target": (1, 24),
}


@bp.get("/settings")
def get_settings():
    cur = get_db().execute("SELECT key, value FROM settings")
    return jsonify({r["key"]: r["value"] for r in cur.fetchall()})


@bp.put("/settings")
def put_settings():
    data = request.get_json(silent=True) or {}
    db = get_db()
    for key, (lo, hi) in LIMITS.items():
        if key in data:
            val = to_int(data[key], DEFAULT_SETTINGS[key], lo, hi)
            db.execute("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (key, val))
    db.commit()
    return get_settings()