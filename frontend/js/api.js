// Thin wrapper around the FocusNext REST API.

export function localDay(d = new Date()) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

async function req(method, path, body) {
  const res = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  tasks: {
    list: (status = "all") => req("GET", `/tasks?status=${status}`),
    create: (b) => req("POST", "/tasks", b),
    update: (id, b) => req("PATCH", `/tasks/${id}`, b),
    remove: (id) => req("DELETE", `/tasks/${id}`),
  },
  goals: {
    list: (day) => req("GET", `/goals?day=${day}`),
    create: (b) => req("POST", "/goals", b),
    update: (id, b) => req("PATCH", `/goals/${id}`, b),
    remove: (id) => req("DELETE", `/goals/${id}`),
  },
  sessions: {
    list: (day) => req("GET", `/sessions?day=${day}`),
    log: (b) => req("POST", "/sessions", b),
  },
  distractions: {
    list: (day) => req("GET", `/distractions?day=${day}`),
    create: (b) => req("POST", "/distractions", b),
    remove: (id) => req("DELETE", `/distractions/${id}`),
  },
  settings: {
    get: () => req("GET", "/settings"),
    save: (b) => req("PUT", "/settings", b),
  },
  stats: (today) => req("GET", `/stats?today=${today}`),
};