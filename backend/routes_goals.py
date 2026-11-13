from flask import Blueprint, jsonify, request
from db import get_db, rows
from utils import error, clean_text, valid_day, today_str

bp = Blueprint("goals", __name__, url_prefix="/api/goals")


def _get(goal_id):
    r = get_db().execute("SELECT * FROM goals WHERE id = ?", (goal_id,)).fetchone()
    return dict(r) if r else None


@bp.get("")
def list_goals():
    day = request.args.get("day") or today_str()
    if not valid_day(day):
        return error("day must be YYYY-MM-DD")
    cur = get_db().execute("SELECT * FROM goals WHERE day = ? ORDER BY completed, id", (day,))
    return jsonify(rows(cur))


@bp.post("")
def create_goal():
    data = request.get_json(silent=True) or {}
    title = clean_text(data.get("title"))
    day = data.get("day") or today_str()
    if not title:
        return error("Title is required")
    if not valid_day(day):
        return error("day must be YYYY-MM-DD")
    db = get_db()
    cur = db.execute("INSERT INTO goals(day, title) VALUES (?, ?)", (day, title))
    db.commit()
    return jsonify(_get(cur.lastrowid)), 201


@bp.patch("/<int:goal_id>")
def update_goal(goal_id):
    if not _get(goal_id):
        return error("Goal not found", 404)
    data = request.get_json(silent=True) or {}
    fields, values = [], []
    if "title" in data:
        title = clean_text(data["title"])
        if not title:
            return error("Title cannot be empty")
        fields.append("title = ?"); values.append(title)
    if "completed" in data:
        fields.append("completed = ?"); values.append(1 if data["completed"] else 0)
    if fields:
        db = get_db()
        db.execute(f"UPDATE goals SET {', '.join(fields)} WHERE id = ?", (*values, goal_id))
        db.commit()
    return jsonify(_get(goal_id))


@bp.delete("/<int:goal_id>")
def delete_goal(goal_id):
    if not _get(goal_id):
        return error("Goal not found", 404)
    db = get_db()
    db.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
    db.commit()
    return "", 204