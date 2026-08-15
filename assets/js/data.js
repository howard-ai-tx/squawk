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

const MyActivity = {
  stats() { return api('/me/stats'); }
};

const Profile = {
  update(name, email) { return api('/me/profile', { method: 'PATCH', body: { name, email } }).then(r => r.earlyAdopter); },
  changePassword(currentPassword, newPassword) { return api('/me/password', { method: 'PATCH', body: { currentPassword, newPassword } }); },
  setAvatar(dataUrl) { return api('/me/avatar', { method: 'POST', body: { dataUrl } }).then(r => r.earlyAdopter); },
  removeAvatar() { return api('/me/avatar', { method: 'POST', body: { dataUrl: null } }).then(r => r.earlyAdopter); }
};

const Settings = {
  update(fields) { return api('/me/settings', { method: 'PATCH', body: fields }).then(r => r.earlyAdopter); },
  deleteAccount() { return api('/me', { method: 'DELETE' }); }
};

const Notifications = {
  list() { return api('/me/notifications'); },
  markRead(id) { return api(`/me/notifications/${id}/read`, { method: 'POST' }); },
  markAllRead() { return api('/me/notifications/read-all', { method: 'POST' }); },
  clear() { return api('/me/notifications', { method: 'DELETE' }); }
};

const Feedback = {
  submit(fields) { return api('/feedback', { method: 'POST', body: fields }); }
};

const Bugs = {
  submit(fields) {
    return api('/bugs', { method: 'POST', body: fields });
  }
};

// The EA's single conversation thread with HowardAI.
const Messages = {
  thread() { return api('/messages').then(r => r.messages); },
  send(message, attachment) { return api('/messages', { method: 'POST', body: { message, attachment } }); }
};

// ─── ADMIN (read-only over Early Adopter data, except conversation replies) ──

const Admin = {
  overview() { return api('/admin/overview'); },
  earlyAdopters() { return api('/admin/early-adopters').then(r => r.earlyAdopters); },
  earlyAdopter(id) { return api(`/admin/early-adopters/${id}`); },
  setInstallStatus(id, installStatus) {
    return api(`/admin/early-adopters/${id}/status`, { method: 'PATCH', body: { installStatus } }).then(r => r.earlyAdopter);
  },
  feedback() { return api('/admin/feedback').then(r => r.feedback); },
  bugs() { return api('/admin/bugs').then(r => r.bugs); },
  conversations() { return api('/admin/conversations').then(r => r.conversations); },
  conversation(eaId) { return api(`/admin/conversations/${eaId}`); },
  reply(eaId, message, attachment) { return api(`/admin/conversations/${eaId}/messages`, { method: 'POST', body: { message, attachment } }); }
};

// ─── GLOBAL EXPORT ────────────────────────────────────────────────────────────

window.DB = { Auth, MyActivity, Profile, Settings, Notifications, Messages, Feedback, Bugs, Admin };
