from flask import Blueprint, jsonify, request
from db import get_db
from utils import error, valid_day, today_str, day_offset

bp = Blueprint("stats", __name__, url_prefix="/api/stats")


def _active_days(db):
    """Days where the user did at least one completed focus session."""
    cur = db.execute("SELECT DISTINCT day FROM sessions WHERE kind='focus' AND completed=1")
    return {r["day"] for r in cur.fetchall()}


def compute_streak(days, today):
    """Consecutive active days ending today (or yesterday if today isn't done yet)."""
    cursor = today if today in days else day_offset(today, -1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor = day_offset(cursor, -1)
    return streak


def compute_best_streak(days):
    best = run = 0
    prev = None
    for d in sorted(days):
        run = run + 1 if prev and day_offset(prev, 1) == d else 1
        best = max(best, run)
        prev = d
    return best


@bp.get("")
def stats():
    today = request.args.get("today") or today_str()
    if not valid_day(today):
        return error("today must be YYYY-MM-DD")
    db = get_db()

    focus_today = db.execute(
        "SELECT COUNT(*) c, COALESCE(SUM(minutes),0) m FROM sessions "
        "WHERE day=? AND kind='focus' AND completed=1", (today,)).fetchone()
    tasks_today = db.execute(
        "SELECT COUNT(*) c FROM tasks WHERE completed=1 AND completed_day=?", (today,)).fetchone()["c"]
    goals = db.execute(
        "SELECT COUNT(*) total, COALESCE(SUM(completed),0) done FROM goals WHERE day=?", (today,)).fetchone()
    distractions_today = db.execute(
        "SELECT COUNT(*) c FROM distractions WHERE day=?", (today,)).fetchone()["c"]
    target = db.execute("SELECT value FROM settings WHERE key='daily_target'").fetchone()["value"]

    # Last 7 days (oldest first)
    week = []
    for i in range(6, -1, -1):
        d = day_offset(today, -i)
        r = db.execute(
            "SELECT COUNT(*) c, COALESCE(SUM(minutes),0) m FROM sessions "
            "WHERE day=? AND kind='focus' AND completed=1", (d,)).fetchone()
        week.append({"day": d, "sessions": r["c"], "minutes": r["m"]})

    totals = db.execute(
        "SELECT COUNT(*) c, COALESCE(SUM(minutes),0) m FROM sessions WHERE kind='focus' AND completed=1").fetchone()
    tasks_total = db.execute("SELECT COUNT(*) c FROM tasks WHERE completed=1").fetchone()["c"]

    days = _active_days(db)
    return jsonify({
        "today": {
            "sessions": focus_today["c"],
            "minutes": focus_today["m"],
            "target": target,
            "tasks_completed": tasks_today,
            "goals_done": goals["done"],
            "goals_total": goals["total"],
            "distractions": distractions_today,
        },
        "streak": compute_streak(days, today),
        "best_streak": compute_best_streak(days),
        "week": week,
        "all_time": {
            "sessions": totals["c"],
            "minutes": totals["m"],
            "tasks_completed": tasks_total,
        },
    })