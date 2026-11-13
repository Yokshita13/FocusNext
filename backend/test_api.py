import os
import tempfile
import pytest
from app import create_app


@pytest.fixture
def client():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    app = create_app(path)
    yield app.test_client()
    os.unlink(path)


def test_task_lifecycle(client):
    r = client.post("/api/tasks", json={"title": "Read ch. 3", "priority": 1, "est_pomodoros": 3})
    assert r.status_code == 201
    tid = r.get_json()["id"]
    assert client.post("/api/tasks", json={"title": " "}).status_code == 400

    r = client.patch(f"/api/tasks/{tid}", json={"completed": True, "day": "2026-11-12"})
    assert r.get_json()["completed"] == 1
    assert r.get_json()["completed_day"] == "2026-11-12"
    assert client.delete(f"/api/tasks/{tid}").status_code == 204
    assert client.patch(f"/api/tasks/{tid}", json={}).status_code == 404


def test_goals(client):
    g = client.post("/api/goals", json={"title": "Finish essay", "day": "2026-11-12"}).get_json()
    client.patch(f"/api/goals/{g['id']}", json={"completed": True})
    assert client.get("/api/goals?day=2026-11-12").get_json()[0]["completed"] == 1
    assert client.get("/api/goals?day=bad").status_code == 400


def test_session_increments_task_and_stats_streak(client):
    tid = client.post("/api/tasks", json={"title": "Study"}).get_json()["id"]
    for day in ("2026-11-10", "2026-11-11", "2026-11-12"):
        r = client.post("/api/sessions", json={"task_id": tid, "minutes": 25, "day": day})
        assert r.status_code == 201
    assert client.get("/api/tasks").get_json()[0]["done_pomodoros"] == 3

    # abandoned sessions don't count
    client.post("/api/sessions", json={"minutes": 5, "completed": False, "day": "2026-11-12"})

    s = client.get("/api/stats?today=2026-11-12").get_json()
    assert s["today"]["sessions"] == 1
    assert s["streak"] == 3
    assert s["best_streak"] == 3
    assert len(s["week"]) == 7

    # streak survives until end of today if yesterday was active
    assert client.get("/api/stats?today=2026-11-13").get_json()["streak"] == 3
    assert client.get("/api/stats?today=2026-11-14").get_json()["streak"] == 0


def test_settings_and_distractions(client):
    s = client.put("/api/settings", json={"focus_min": 50, "daily_target": 999}).get_json()
    assert s["focus_min"] == 50 and s["daily_target"] == 24
    d = client.post("/api/distractions", json={"note": "check email", "day": "2026-11-12"}).get_json()
    assert len(client.get("/api/distractions?day=2026-11-12").get_json()) == 1
    assert client.delete(f"/api/distractions/{d['id']}").status_code == 204