# FocusNext

Stay focused while studying or working. FocusNext combines a Pomodoro timer with task management, daily goals and progress tracking, so you can cut down on procrastination and build consistent study habits.

**Live demo:** https://focusnext.onrender.com

> The demo runs on a free server. The first load can take about 30 seconds, and saved data may reset when the server restarts.

## Features

- **Pomodoro timer** with focus, short break and long break modes, a progress ring, and sound and desktop notifications
- **Task manager** with priorities, due dates, overdue highlighting and session estimates
- **Daily goals** checklist that resets each day
- **Distraction parking lot** to jot down stray thoughts without leaving your session
- **Progress dashboard** with daily target, focus time, a 7-day chart and study streaks
- **Customizable settings** for session lengths, long-break interval and daily target
- Light and dark mode, responsive layout, and keyboard shortcut (Space to start or pause)

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| Database | SQLite |
| Frontend | HTML, CSS, vanilla JavaScript (ES modules) |
| Hosting | Render |

## Project structure

```
FocusNext/
├── backend/
│   ├── app.py               # Flask app, serves the frontend
│   ├── db.py                # SQLite schema and helpers
│   ├── utils.py             # Validation helpers
│   ├── routes_tasks.py      # /api/tasks
│   ├── routes_goals.py      # /api/goals
│   ├── routes_sessions.py   # /api/sessions, /api/distractions, /api/settings
│   ├── routes_stats.py      # /api/stats
│   ├── test_api.py          # Backend tests
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── app.js           # Views and rendering
        ├── timer.js         # Pomodoro engine
        ├── api.js           # REST client
        └── ui.js            # DOM helpers
```

## Run locally

1. Clone the repository:
   ```bash
   git clone https://github.com/Yokshita13/FocusNext.git
   cd FocusNext/backend
   ```
2. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the app:
   ```bash
   python app.py
   ```
4. Open http://localhost:5000 in your browser.

To run the tests:

```bash
pip install pytest
pytest -q
```

## API overview

| Method | Endpoint | Description |
|---|---|---|
| GET, POST | `/api/tasks` | List or create tasks |
| PATCH, DELETE | `/api/tasks/<id>` | Update or delete a task |
| GET, POST | `/api/goals` | List or create goals for a day |
| PATCH, DELETE | `/api/goals/<id>` | Update or delete a goal |
| GET, POST | `/api/sessions` | List or log Pomodoro sessions |
| GET, POST, DELETE | `/api/distractions` | Manage the distraction list |
| GET, PUT | `/api/settings` | Read or update timer settings |
| GET | `/api/stats` | Today's numbers, 7-day chart and streaks |

## Known limitations

- Single-user app with no login, so all visitors share the same data
- The free hosting tier resets the SQLite database on restart

## Roadmap

- User accounts and per-user data
- Installable PWA and Android app
- Task categories and study-time reports

## Author

Built by [Yokshita](https://github.com/Yokshita13).
