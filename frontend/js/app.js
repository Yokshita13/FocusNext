import { api, localDay } from "./api.js";
import { el, toast, fmtTime, fmtMinutes, fmtDay } from "./ui.js";
import { createTimer, MODE_LABEL, getPrefs, setPrefs } from "./timer.js";

const $ = (id) => document.getElementById(id);
const RING_LEN = 2 * Math.PI * 90;
const PRIORITY = { 1: "High", 2: "Medium", 3: "Low" };

const app = {
  settings: { focus_min: 25, short_break_min: 5, long_break_min: 15, long_break_every: 4, daily_target: 6 },
  tasks: [],
  taskFilter: "active",
  stats: null,
};

// Wrap async handlers so a failed request shows a toast instead of failing silently.
const safe = (fn) => async (...args) => {
  try { await fn(...args); } catch (e) { toast(e.message || "Something went wrong", true); }
};

/* ---------------- Navigation ---------------- */
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  if (name === "progress") refreshStats();
  if (name === "tasks") refreshTasks();
}
$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-view]");
  if (b) showView(b.dataset.view);
});

/* ---------------- Timer ---------------- */
const timer = createTimer({
  onTick: renderTimer,
  onChange: renderTimerControls,
  onSessionLogged: () => { refreshStats(); refreshTasks(); },
  onError: (e) => toast(e.message, true),
});

function renderTimer(s) {
  $("time").textContent = fmtTime(s.remaining);
  const progress = s.total ? 1 - s.remaining / s.total : 0;
  const ring = $("ringFg");
  ring.style.strokeDasharray = RING_LEN;
  ring.style.strokeDashoffset = RING_LEN * (1 - progress);
  document.title = s.running ? `${fmtTime(s.remaining)} · ${MODE_LABEL[s.mode]} · FocusNext` : "FocusNext";
}

function renderTimerControls(s) {
  document.body.dataset.mode = s.mode;
  document.querySelectorAll("#modes button").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === s.mode);
    b.disabled = s.running && b.dataset.mode !== s.mode;
  });
  $("startBtn").textContent = s.running ? "Pause" : s.remaining < s.total ? "Resume" : "Start";
  $("taskSelect").disabled = s.running && s.mode === "focus";
  renderTimer(s);
}

$("modes").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mode]");
  if (b) timer.setMode(b.dataset.mode);
});
$("startBtn").addEventListener("click", () => timer.toggle());
$("resetBtn").addEventListener("click", safe(() => timer.reset()));
$("skipBtn").addEventListener("click", safe(() => timer.skip()));
$("taskSelect").addEventListener("change", (e) => timer.setTask(Number(e.target.value) || null));

document.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "").toLowerCase();
  if (e.code === "Space" && !["input", "textarea", "select", "button"].includes(tag)) {
    e.preventDefault();
    timer.toggle();
  }
});

function renderTaskSelect() {
  const sel = $("taskSelect");
  const current = timer.state.taskId;
  sel.replaceChildren(
    el("option", { value: "" }, "No specific task"),
    ...app.tasks
      .filter((t) => !t.completed)
      .map((t) => el("option", { value: t.id, selected: t.id === current }, t.title)),
  );
  if (current && !app.tasks.some((t) => t.id === current && !t.completed)) timer.setTask(null);
}

function renderDots() {
  const done = app.stats?.today.sessions ?? 0;
  const target = app.stats?.today.target ?? app.settings.daily_target;
  const total = Math.max(target, done);
  $("dots").replaceChildren(
    ...Array.from({ length: total }, (_, i) => el("span", { class: "dot" + (i < done ? " done" : "") })),
    el("span", { class: "dots-label" }, `${done}/${target} today`),
  );
}

/* ---------------- Goals ---------------- */
async function refreshGoals() {
  const goals = await api.goals.list(localDay());
  $("goalEmpty").hidden = goals.length > 0;
  $("goalList").replaceChildren(
    ...goals.map((g) =>
      el("li", { class: "item" + (g.completed ? " done" : "") },
        el("input", {
          type: "checkbox", checked: g.completed, "aria-label": "Mark goal complete",
          onchange: safe(async (e) => { await api.goals.update(g.id, { completed: e.target.checked }); await refreshGoals(); refreshStats(); }),
        }),
        el("span", { class: "grow" }, g.title),
        el("button", {
          class: "icon", title: "Delete goal", "aria-label": "Delete goal",
          onclick: safe(async () => { await api.goals.remove(g.id); await refreshGoals(); refreshStats(); }),
        }, "✕"),
      )),
  );
}

$("goalForm").addEventListener("submit", safe(async (e) => {
  e.preventDefault();
  const title = $("goalInput").value.trim();
  if (!title) return;
  await api.goals.create({ title, day: localDay() });
  $("goalInput").value = "";
  await refreshGoals();
  refreshStats();
}));

/* ---------------- Distractions ---------------- */
async function refreshDistractions() {
  const list = await api.distractions.list(localDay());
  $("distList").replaceChildren(
    ...list.map((d) =>
      el("li", { class: "item" },
        el("span", { class: "grow" }, d.note),
        el("button", {
          class: "icon", title: "Remove", "aria-label": "Remove",
          onclick: safe(async () => { await api.distractions.remove(d.id); await refreshDistractions(); refreshStats(); }),
        }, "✕"),
      )),
  );
}

$("distForm").addEventListener("submit", safe(async (e) => {
  e.preventDefault();
  const note = $("distInput").value.trim();
  if (!note) return;
  await api.distractions.create({ note, day: localDay() });
  $("distInput").value = "";
  await refreshDistractions();
  refreshStats();
  $("distInput").focus();
}));

/* ---------------- Tasks ---------------- */
async function refreshTasks() {
  app.tasks = await api.tasks.list("all");
  renderTaskList();
  renderTaskSelect();
}

function renderTaskList() {
  const f = app.taskFilter;
  const today = localDay();
  const visible = app.tasks.filter((t) => f === "all" || (f === "active" ? !t.completed : t.completed));
  $("taskEmpty").hidden = visible.length > 0;
  $("taskEmpty").textContent = f === "done" ? "No completed tasks yet." : "No tasks here. Add one above.";

  $("taskList").replaceChildren(
    ...visible.map((t) => {
      const overdue = !t.completed && t.due_date && t.due_date < today;
      return el("li", { class: "item task" + (t.completed ? " done" : "") },
        el("input", {
          type: "checkbox", checked: t.completed, "aria-label": "Mark task complete",
          onchange: safe(async (e) => {
            await api.tasks.update(t.id, { completed: e.target.checked, day: localDay() });
            await refreshTasks();
            refreshStats();
          }),
        }),
        el("div", { class: "grow" },
          el("div", { class: "task-title", title: "Double-click to rename", ondblclick: safe(() => renameTask(t)) }, t.title),
          el("div", { class: "meta" },
            el("span", { class: `badge p${t.priority}` }, PRIORITY[t.priority]),
            t.due_date && el("span", { class: "badge" + (overdue ? " overdue" : "") }, `${overdue ? "Overdue · " : "Due "}${fmtDay(t.due_date)}`),
            el("span", { class: "badge" }, `${t.done_pomodoros}/${t.est_pomodoros} sessions`),
          ),
        ),
        !t.completed && el("button", { class: "btn small", onclick: () => startFocusOn(t.id) }, "Focus"),
        el("button", {
          class: "icon", title: "Delete task", "aria-label": "Delete task",
          onclick: safe(async () => {
            if (!confirm(`Delete "${t.title}"?`)) return;
            await api.tasks.remove(t.id);
            await refreshTasks();
            refreshStats();
          }),
        }, "✕"),
      );
    }),
  );
}

async function renameTask(t) {
  const title = prompt("Rename task", t.title);
  if (title == null || !title.trim() || title.trim() === t.title) return;
  await api.tasks.update(t.id, { title: title.trim() });
  await refreshTasks();
}

function startFocusOn(id) {
  if (timer.state.running) { toast("Finish or pause the current session first", true); return; }
  timer.setMode("focus");
  timer.setTask(id);
  renderTaskSelect();
  $("taskSelect").value = String(id);
  showView("focus");
}

$("taskForm").addEventListener("submit", safe(async (e) => {
  e.preventDefault();
  await api.tasks.create({
    title: $("taskTitle").value,
    priority: Number($("taskPriority").value),
    due_date: $("taskDue").value || null,
    est_pomodoros: Number($("taskEst").value) || 1,
  });
  e.target.reset();
  $("taskEst").value = 1;
  $("taskPriority").value = "2";
  await refreshTasks();
  $("taskTitle").focus();
}));

$("taskFilter").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-f]");
  if (!b) return;
  app.taskFilter = b.dataset.f;
  document.querySelectorAll("#taskFilter button").forEach((x) => x.classList.toggle("active", x === b));
  renderTaskList();
});

/* ---------------- Progress ---------------- */
async function refreshStats() {
  app.stats = await api.stats(localDay());
  const s = app.stats;
  $("streakChip").textContent = `${s.streak} day streak`;
  $("streakChip").classList.toggle("on", s.streak > 0);
  renderDots();
  renderProgress();
}

function tile(label, value, sub) {
  return el("div", { class: "card tile" },
    el("div", { class: "tile-label" }, label),
    el("div", { class: "tile-value" }, value),
    sub && el("div", { class: "tile-sub" }, sub));
}

function renderProgress() {
  const s = app.stats;
  if (!s) return;
  const t = s.today;
  const pct = Math.min(100, Math.round((t.sessions / t.target) * 100));
  $("tiles").replaceChildren(
    tile("Daily target", `${t.sessions}/${t.target}`, `${pct}% of today's sessions`),
    tile("Focus time today", fmtMinutes(t.minutes), `${t.distractions} distraction${t.distractions === 1 ? "" : "s"} parked`),
    tile("Goals today", `${t.goals_done}/${t.goals_total}`, t.goals_total ? "completed" : "none set yet"),
    tile("Tasks done today", String(t.tasks_completed)),
    tile("Current streak", `${s.streak}`, `Best: ${s.best_streak} day${s.best_streak === 1 ? "" : "s"}`),
  );

  const max = Math.max(1, ...s.week.map((d) => d.minutes));
  $("bars").replaceChildren(
    ...s.week.map((d) =>
      el("div", { class: "bar-col", title: `${fmtDay(d.day)}: ${d.sessions} sessions, ${fmtMinutes(d.minutes)}` },
        el("div", { class: "bar-val" }, d.minutes ? fmtMinutes(d.minutes) : ""),
        el("div", { class: "bar-track" },
          el("div", { class: "bar-fill", style: `height:${Math.round((d.minutes / max) * 100)}%` })),
        el("div", { class: "bar-day" }, new Date(...d.day.split("-").map((v, i) => (i === 1 ? v - 1 : +v))).toLocaleDateString(undefined, { weekday: "short" })),
      )),
  );

  $("allTime").replaceChildren(
    ...[
      ["Focus sessions", s.all_time.sessions],
      ["Total focus time", fmtMinutes(s.all_time.minutes)],
      ["Tasks completed", s.all_time.tasks_completed],
      ["Best streak", `${s.best_streak} days`],
    ].flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, String(v))]),
  );
}

/* ---------------- Settings ---------------- */
function fillSettingsForm() {
  const form = $("settingsForm");
  for (const [k, v] of Object.entries(app.settings)) if (form.elements[k]) form.elements[k].value = v;
  const prefs = getPrefs();
  $("notifyToggle").checked = prefs.notify && "Notification" in window && Notification.permission === "granted";
  $("soundToggle").checked = prefs.sound;
}

$("settingsForm").addEventListener("submit", safe(async (e) => {
  e.preventDefault();
  const body = {};
  for (const k of Object.keys(app.settings)) body[k] = Number(e.target.elements[k].value);
  app.settings = await api.settings.save(body);
  timer.applySettings(app.settings);
  fillSettingsForm();
  refreshStats();
  toast("Settings saved");
}));

$("notifyToggle").addEventListener("change", async (e) => {
  const prefs = getPrefs();
  if (e.target.checked) {
    if (!("Notification" in window)) { e.target.checked = false; toast("Notifications aren't supported here", true); return; }
    const perm = await Notification.requestPermission();
    prefs.notify = perm === "granted";
    e.target.checked = prefs.notify;
    if (!prefs.notify) toast("Notification permission was denied", true);
  } else {
    prefs.notify = false;
  }
  setPrefs(prefs);
});
$("soundToggle").addEventListener("change", (e) => setPrefs({ ...getPrefs(), sound: e.target.checked }));

/* ---------------- Boot ---------------- */
async function boot() {
  try {
    app.settings = await api.settings.get();
  } catch (e) {
    toast("Can't reach the server. Is the backend running?", true);
  }
  timer.rollDay();
  timer.init(app.settings);
  fillSettingsForm();
  await Promise.allSettled([refreshTasks(), refreshGoals(), refreshDistractions(), refreshStats()]);
  renderTaskSelect();
  if (timer.state.taskId) $("taskSelect").value = String(timer.state.taskId);

  // Refresh "today" data if the tab stays open past midnight.
  let lastDay = localDay();
  setInterval(() => {
    if (localDay() !== lastDay) {
      lastDay = localDay();
      timer.rollDay();
      refreshGoals(); refreshDistractions(); refreshStats();
    }
  }, 60000);
}
boot();