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

  checkActivation(token) {
    return api('/auth/check-activation', { method: 'POST', body: { token } });
  },

  async activate(token, password) {
    const { token: sessToken, earlyAdopter } = await api('/auth/activate', { method: 'POST', body: { token, password } });
    setToken(sessToken);
    return earlyAdopter;
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

const Feedback = {
  submit(fields) { return api('/feedback', { method: 'POST', body: fields }); }
};

const Bugs = {
  submit(fields) {
    return api('/bugs', { method: 'POST', body: fields });
  }
};

const Contact = {
  send(message) { return api('/contact', { method: 'POST', body: { message } }); }
};

// ─── ADMIN (read-only over Early Adopter data) ─────────────────────────────

const Admin = {
  overview() { return api('/admin/overview'); },
  earlyAdopters() { return api('/admin/early-adopters').then(r => r.earlyAdopters); },
  earlyAdopter(id) { return api(`/admin/early-adopters/${id}`); },
  setInstallStatus(id, installStatus) {
    return api(`/admin/early-adopters/${id}/status`, { method: 'PATCH', body: { installStatus } }).then(r => r.earlyAdopter);
  },
  feedback() { return api('/admin/feedback').then(r => r.feedback); },
  bugs() { return api('/admin/bugs').then(r => r.bugs); },
  contact() { return api('/admin/contact').then(r => r.contact); }
};

// ─── GLOBAL EXPORT ────────────────────────────────────────────────────────────

window.DB = { Auth, Feedback, Bugs, Contact, Admin };
