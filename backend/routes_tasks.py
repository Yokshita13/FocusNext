from flask import Blueprint, jsonify, request
from db import get_db, rows
from utils import error, clean_text, to_int, valid_day, today_str

bp = Blueprint("tasks", __name__, url_prefix="/api/tasks")


def _get(task_id):
    r = get_db().execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return dict(r) if r else None


@bp.get("")
def list_tasks():
    status = request.args.get("status")  # active | done | all
    sql = "SELECT * FROM tasks"
    if status == "active":
        sql += " WHERE completed = 0"
    elif status == "done":
        sql += " WHERE completed = 1"
    sql += " ORDER BY completed, priority, COALESCE(due_date, '9999-12-31'), id"
    return jsonify(rows(get_db().execute(sql)))


@bp.post("")
def create_task():
    data = request.get_json(silent=True) or {}
    title = clean_text(data.get("title"))
    if not title:
        return error("Title is required")
    due = data.get("due_date") or None
    if due and not valid_day(due):
        return error("due_date must be YYYY-MM-DD")
    db = get_db()
    cur = db.execute(
        "INSERT INTO tasks(title, notes, priority, due_date, est_pomodoros) VALUES (?,?,?,?,?)",
        (
            title,
            clean_text(data.get("notes"), 1000),
            to_int(data.get("priority"), 2, 1, 3),
            due,
            to_int(data.get("est_pomodoros"), 1, 1, 50),
        ),
    )
    db.commit()
    return jsonify(_get(cur.lastrowid)), 201


@bp.patch("/<int:task_id>")
def update_task(task_id):
    task = _get(task_id)
    if not task:
        return error("Task not found", 404)
    data = request.get_json(silent=True) or {}
    fields, values = [], []

    if "title" in data:
        title = clean_text(data["title"])
        if not title:
            return error("Title cannot be empty")
        fields.append("title = ?"); values.append(title)
    if "notes" in data:
        fields.append("notes = ?"); values.append(clean_text(data["notes"], 1000))
    if "priority" in data:
        fields.append("priority = ?"); values.append(to_int(data["priority"], 2, 1, 3))
    if "est_pomodoros" in data:
        fields.append("est_pomodoros = ?"); values.append(to_int(data["est_pomodoros"], 1, 1, 50))
    if "due_date" in data:
        due = data["due_date"] or None
        if due and not valid_day(due):
            return error("due_date must be YYYY-MM-DD")
        fields.append("due_date = ?"); values.append(due)
    if "completed" in data:
        done = 1 if data["completed"] else 0
        day = data.get("day") if valid_day(data.get("day")) else today_str()
        fields.append("completed = ?"); values.append(done)
        fields.append("completed_day = ?"); values.append(day if done else None)

    if fields:
        db = get_db()
        db.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", (*values, task_id))
        db.commit()
    return jsonify(_get(task_id))


@bp.delete("/<int:task_id>")
def delete_task(task_id):
    if not _get(task_id):
        return error("Task not found", 404)
    db = get_db()
    db.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    db.commit()
    return "", 204