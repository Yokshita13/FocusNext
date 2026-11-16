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


## Known limitations

- Single-user app with no login, so all visitors share the same data
- The free hosting tier resets the SQLite database on restart

## Roadmap

- User accounts and per-user data
- Installable PWA and Android app
- Task categories and study-time reports

## Author

Built by [Yokshita](https://github.com/Yokshita13).
