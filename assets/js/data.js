'use strict';

const API_BASE = 'https://earlyadopter-api.hvangeertruyden.workers.dev';
const KEY_TOKEN = 'ea_session_token';

function getToken() { return sessionStorage.getItem(KEY_TOKEN); }
function setToken(t) { sessionStorage.setItem(KEY_TOKEN, t); }
function clearToken() { sessionStorage.removeItem(KEY_TOKEN); }

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

const Auth = {
  async login(email, password) {
    const { token, earlyAdopter } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(token);
    return earlyAdopter;
  },

  async logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
    clearToken();
  },

  async currentEarlyAdopter() {
    if (!getToken()) return null;
    try {
      const { earlyAdopter } = await api('/auth/me');
      return earlyAdopter;
    } catch {
      clearToken();
      return null;
    }
  }
};

// ─── ACTIONS ──────────────────────────────────────────────────────────────────

const Representing = {
  acknowledge() { return api('/representing/ack', { method: 'POST' }).then(r => r.earlyAdopter); }
};

const Feedback = {
  submit(message) { return api('/feedback', { method: 'POST', body: { message } }); }
};

const Bugs = {
  submit({ whatHappened, expected, urgency }) {
    return api('/bugs', { method: 'POST', body: { whatHappened, expected, urgency } });
  }
};

const Contact = {
  send(message) { return api('/contact', { method: 'POST', body: { message } }); }
};

// ─── GLOBAL EXPORT ────────────────────────────────────────────────────────────

window.DB = { Auth, Representing, Feedback, Bugs, Contact };
