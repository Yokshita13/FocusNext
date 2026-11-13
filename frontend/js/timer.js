// Pomodoro timer. Uses an absolute end timestamp (not a decrementing counter),
// so it stays accurate in background tabs and survives page reloads.
import { api, localDay } from "./api.js";

const KEY = "focusnext.timer.v1";
const PREFS_KEY = "focusnext.prefs.v1";

export const MODE_LABEL = { focus: "Focus", short: "Short break", long: "Long break" };

export function getPrefs() {
  try {
    return { notify: false, sound: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return { notify: false, sound: true };
  }
}
export function setPrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch { /* audio unavailable */ }
}

export function createTimer({ onTick, onChange, onSessionLogged, onError }) {
  let settings = { focus_min: 25, short_break_min: 5, long_break_min: 15, long_break_every: 4 };
  let s = {
    mode: "focus",
    running: false,
    endsAt: 0,
    remaining: 25 * 60 * 1000,
    total: 25 * 60 * 1000,
    taskId: null,
    completedFocus: 0,
    day: localDay(),
    cycleDay: localDay(),
  };
  let interval = null;

  const durationMs = (mode) =>
    (mode === "focus" ? settings.focus_min : mode === "short" ? settings.short_break_min : settings.long_break_min) * 60000;

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }

  function emit() {
    persist();
    onChange?.({ ...s });
    onTick?.({ ...s });
  }

  function startLoop() {
    stopLoop();
    interval = setInterval(tick, 250);
  }
  function stopLoop() {
    if (interval) clearInterval(interval);
    interval = null;
  }

  function tick() {
    if (!s.running) return;
    s.remaining = s.endsAt - Date.now();
    if (s.remaining <= 0) {
      complete();
    } else {
      onTick?.({ ...s });
    }
  }

  async function logSession(kind, minutes, completed) {
    if (minutes < 1) return;
    try {
      await api.sessions.log({ kind, minutes, completed, task_id: s.taskId, day: s.day });
      onSessionLogged?.();
    } catch (e) {
      onError?.(e);
    }
  }

  function notify(title, body) {
    const prefs = getPrefs();
    if (prefs.sound) beep();
    if (prefs.notify && "Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body }); } catch { /* ignore */ }
    }
  }

  function goToMode(mode) {
    s.mode = mode;
    s.running = false;
    s.total = durationMs(mode);
    s.remaining = s.total;
    s.endsAt = 0;
  }

  async function complete() {
    const finishedMode = s.mode;
    const minutes = Math.round(s.total / 60000);
    s.running = false;
    stopLoop();

    if (finishedMode === "focus") {
      s.completedFocus += 1;
      const next = s.completedFocus % settings.long_break_every === 0 ? "long" : "short";
      await logSession("focus", minutes, true);
      goToMode(next);
      notify("Focus session complete", `Nice work. Take a ${next === "long" ? "long" : "short"} break.`);
    } else {
      await logSession("break", minutes, true);
      goToMode("focus");
      notify("Break over", "Ready for the next focus session?");
    }
    emit();
  }

  return {
    get state() { return { ...s }; },

    init(newSettings) {
      settings = { ...settings, ...newSettings };
      let restored = false;
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "null");
        if (saved && saved.mode) {
          s = { ...s, ...saved };
          restored = true;
        }
      } catch { /* ignore corrupt state */ }

      if (!restored) goToMode("focus");
      if (s.running) {
        s.remaining = s.endsAt - Date.now();
        if (s.remaining <= 0) {
          complete(); // finished while the page was closed
          return;
        }
        startLoop();
      }
      emit();
    },

    applySettings(newSettings) {
      settings = { ...settings, ...newSettings };
      if (!s.running) {
        s.total = durationMs(s.mode);
        s.remaining = s.total;
        emit();
      }
    },

    setTask(id) {
      s.taskId = id || null;
      persist();
    },

    setMode(mode) {
      if (s.running) return;
      goToMode(mode);
      emit();
    },

    start() {
      if (s.running) return;
      if (s.remaining <= 0) s.remaining = s.total;
      s.day = localDay();
      s.endsAt = Date.now() + s.remaining;
      s.running = true;
      startLoop();
      emit();
    },

    pause() {
      if (!s.running) return;
      s.remaining = Math.max(0, s.endsAt - Date.now());
      s.running = false;
      stopLoop();
      emit();
    },

    toggle() { s.running ? this.pause() : this.start(); },

    async reset() {
      const elapsedMin = Math.floor((s.total - s.remaining) / 60000);
      const wasFocus = s.mode === "focus";
      stopLoop();
      s.running = false;
      if (wasFocus && elapsedMin >= 1) await logSession("focus", elapsedMin, false);
      goToMode(s.mode);
      emit();
    },

    async skip() {
      const elapsedMin = Math.floor((s.total - s.remaining) / 60000);
      const wasFocus = s.mode === "focus";
      stopLoop();
      s.running = false;
      if (wasFocus && elapsedMin >= 1) await logSession("focus", elapsedMin, false);
      goToMode(wasFocus ? "short" : "focus");
      emit();
    },

    // Reset the cycle counter when a new day starts.
    rollDay() {
      const d = localDay();
      if (s.cycleDay !== d) {
        s.cycleDay = d;
        s.completedFocus = 0;
        persist();
      }
    },
  };
}