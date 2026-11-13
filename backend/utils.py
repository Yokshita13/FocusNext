import re
from datetime import date, timedelta
from flask import jsonify

DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def error(message, status=400):
    return jsonify({"error": message}), status


def valid_day(value):
    if not isinstance(value, str) or not DAY_RE.match(value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def today_str():
    return date.today().isoformat()


def day_offset(day, delta):
    return (date.fromisoformat(day) + timedelta(days=delta)).isoformat()


def clean_text(value, max_len=200):
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_len]


def to_int(value, default, lo=None, hi=None):
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    if lo is not None:
        n = max(lo, n)
    if hi is not None:
        n = min(hi, n)
    return n