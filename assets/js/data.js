'use strict';

// ─── TAXONOMY ────────────────────────────────────────────────────────────────

const CATEGORIES = {
  hardware: {
    label: 'Hardware',
    icon: 'ti-cpu',
    subcategories: {
      wont_power_on:   "Won't power on",
      overheating:     'Overheating / thermal shutdown',
      physical_damage: 'Physical damage (port, casing, cable)',
      led_issue:       'LED / indicator light issue',
      connectivity:    'Network / ethernet connectivity',
      peripheral:      'Peripheral not recognized',
      restarts:        'Unit restarts unexpectedly',
      other:           'Other hardware'
    }
  },
  software: {
    label: 'Software / Arken',
    icon: 'ti-code',
    subcategories: {
      crash:              'Crash / fatal error',
      unexpected_behavior: 'Unexpected behavior',
      cache_memory:        'Cache / memory issue',
      sluggish:            'Sluggish performance',
      task_not_executing:  'Task not executing correctly',
      setup_failure:       'Arken setup failure',
      integration:         'Integration not working (calendar, email, etc.)',
      health_monitoring:   'Auto-repair / health monitoring issue',
      memory_loss:         'Memory / context loss (anti-amnesia)',
      trust_score:         'Trust score / permission scoping issue',
      other:               'Other software'
    }
  },
  usability: {
    label: 'Usability',
    icon: 'ti-layout',
    subcategories: {
      setup_unclear:      'Setup step unclear or confusing',
      instructions_vague: 'Instructions vague or missing',
      too_complex:        'Feature too complex to use',
      intimidating:       'Feature feels intimidating / avoided entirely',
      mobile_ui:          'Mobile app interface issue',
      onboarding:         'Onboarding flow confusion',
      terminology:        'Terminology unclear',
      other:              'Other usability'
    }
  },
  bugs: {
    label: 'Bugs',
    icon: 'ti-bug',
    subcategories: {
      repeated_incorrect: 'Repeated incorrect output',
      inconsistent:       'Feature works inconsistently',
      partial_completion: 'Task completes partially but not fully',
      incorrect_data:     'Incorrect data pulled or referenced',
      ui_broken:          'UI element broken or unresponsive',
      other:              'Other bug'
    }
  },
  speed: {
    label: 'Speed',
    icon: 'ti-gauge',
    subcategories: {
      response_slow: 'Response time too slow',
      task_delayed:  'Task execution delayed',
      app_slow_load: 'App / interface loads slowly',
      voice_lag:     'Voice response lag',
      other:         'Other speed'
    }
  },
  features: {
    label: 'Features',
    icon: 'ti-bulb',
    subcategories: {
      missing_entirely: 'Feature missing entirely',
      not_as_expected:  "Feature doesn't work as expected",
      suggestion:       'Feature request / suggestion',
      spending_limited: 'Spending controls too limited',
      plugin_issue:     'Skill or plugin issue',
      other:            'Other feature feedback'
    }
  },
  security: {
    label: 'Security',
    icon: 'ti-shield-lock',
    subcategories: {
      suspicious_activity: 'Suspicious activity detected',
      privacy_audit:       'Privacy audit concern',
      data_classification: 'Data classification concern (sensitive data routed unexpectedly)',
      unauthorized_access: 'Unauthorized access concern',
      threat_detection:    'Threat detection alert',
      other:               'Other security'
    }
  }
};

const HOWARD_MODELS = ['Arken One', 'Arken Mini', 'Arken Pro', 'Other'];

const SEVERITIES = {
  low:    'Low',
  medium: 'Medium',
  high:   'High'
};

const REPS = {
  tucker:  { name: 'Tucker',  categories: ['hardware', 'software', 'speed', 'bugs'] },
  hendrik: { name: 'Hendrik', categories: ['usability', 'features', 'security']     }
};

function getRoutedRep(category) {
  if (['hardware', 'software', 'speed', 'bugs'].includes(category)) return 'tucker';
  if (['usability', 'features', 'security'].includes(category))    return 'hendrik';
  return null;
}

// ─── API CLIENT ──────────────────────────────────────────────────────────────

const API_BASE   = 'https://squawk-api.hvangeertruyden.workers.dev';
const KEY_TOKEN  = 'squawk_session_token';
const KEY_LOCAL_MIGRATION_DONE = 'squawk_local_migration_done';

function getToken() {
  return sessionStorage.getItem(KEY_TOKEN);
}

function setToken(token) {
  if (token) sessionStorage.setItem(KEY_TOKEN, token);
  else sessionStorage.removeItem(KEY_TOKEN);
}

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─── SEED (no-op placeholder; data now lives in the Cloudflare backend) ─────

function seed() {
  migrateLocalDataIfPresent();
}

// One-time safety net: if this browser has real submissions/drafts left over
// from the old localStorage-only version of Squawk, push them to the new
// backend once (as the currently logged-in user), then clear them so they
// don't get re-offered. No-ops if there's nothing to migrate or no one is
// logged in yet — retried on next boot until it succeeds.
async function migrateLocalDataIfPresent() {
  if (localStorage.getItem(KEY_LOCAL_MIGRATION_DONE)) return;

  const oldSubs   = safeParse(localStorage.getItem('squawk_submissions'));
  const oldDrafts = safeParse(localStorage.getItem('squawk_drafts'));
  if ((!oldSubs || oldSubs.length === 0) && (!oldDrafts || oldDrafts.length === 0)) {
    localStorage.setItem(KEY_LOCAL_MIGRATION_DONE, '1');
    return;
  }

  const token = getToken();
  if (!token) return; // retry once someone is logged in

  try {
    for (const s of (oldSubs || [])) {
      await api('/submissions', { method: 'POST', body: {
        btId: s.btId, title: s.title, category: s.category, subcategory: s.subcategory,
        description: s.description, deviceId: s.deviceId, model: s.model,
        eventTimestamp: s.eventTimestamp, timestampPrecision: s.timestampPrecision,
        attachmentData: s.attachmentData
      }});
    }
    for (const d of (oldDrafts || [])) {
      await api('/drafts', { method: 'POST', body: {
        btId: d.btId, title: d.title, category: d.category, subcategory: d.subcategory,
        description: d.description, deviceId: d.deviceId, model: d.model,
        eventTimestamp: d.eventTimestamp, timestampPrecision: d.timestampPrecision,
        attachmentData: d.attachmentData
      }});
    }
    localStorage.removeItem('squawk_submissions');
    localStorage.removeItem('squawk_drafts');
    localStorage.setItem(KEY_LOCAL_MIGRATION_DONE, '1');
  } catch {
    // Leave the flag unset so this retries on next login.
  }
}

function safeParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

const Auth = {
  async login(email, password) {
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', auth: false, body: { email, password } });
      setToken(token);
      await migrateLocalDataIfPresent();
      return user;
    } catch {
      return null;
    }
  },

  async firstLogin(email, otp, newPassword) {
    try {
      const { token, user } = await api('/auth/first-login', { method: 'POST', auth: false, body: { email, otp, newPassword } });
      setToken(token);
      await migrateLocalDataIfPresent();
      return user;
    } catch {
      return null;
    }
  },

  async checkFirstLogin(email) {
    try {
      const { pending } = await api('/auth/check-first-login', { method: 'POST', auth: false, body: { email } });
      return pending ? { pending: true } : null;
    } catch {
      return null;
    }
  },

  async logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* best effort */ }
    setToken(null);
  },

  async currentUser() {
    if (!getToken()) return null;
    try {
      const { user } = await api('/auth/me');
      return user;
    } catch {
      setToken(null);
      return null;
    }
  },

  currentSession() {
    const token = getToken();
    return token ? { token } : null;
  }
};

// ─── USERS ────────────────────────────────────────────────────────────────────

const Users = {
  getAll()    { return api('/users'); },
  getBTs()    { return api('/users/bts'); },
  getAdmins() { return api('/users/admins'); },
  getById(id) { return api(`/users/${id}`); },

  update(id, patch) {
    // Server hashes passwords itself — translate the old passwordHash-style
    // patch used by callers into a plaintext newPassword field.
    const body = { ...patch };
    if ('passwordHash' in body) delete body.passwordHash;
    return api(`/users/${id}`, { method: 'PATCH', body });
  },

  updatePassword(id, newPassword) {
    return api(`/users/${id}`, { method: 'PATCH', body: { newPassword } });
  },

  updateSettings(id, patch) {
    return api(`/users/${id}/settings`, { method: 'PATCH', body: patch });
  },

  addDevice(userId, device) {
    return api(`/users/${userId}/devices`, { method: 'POST', body: device });
  },

  removeDevice(userId, deviceId) {
    return api(`/users/${userId}/devices/${deviceId}`, { method: 'DELETE' });
  },

  deleteAccount(id) {
    return api(`/users/${id}`, { method: 'DELETE' });
  },

  create({ name, email }) {
    return api('/users', { method: 'POST', body: { name, email } });
  }
};

// ─── DRAFTS ───────────────────────────────────────────────────────────────────

const Drafts = {
  getByBT(btId) { return api(`/drafts?btId=${encodeURIComponent(btId)}`); },
  getById(id)   { return api(`/drafts/${id}`); },
  save(draft)   { return api('/drafts', { method: 'POST', body: draft }); },
  delete(id)    { return api(`/drafts/${id}`, { method: 'DELETE' }); }
};

// ─── SUBMISSIONS ──────────────────────────────────────────────────────────────

const Submissions = {
  getAll()             { return api('/submissions'); },
  getByBT(btId)        { return api(`/submissions?btId=${encodeURIComponent(btId)}`); },
  getById(id)          { return api(`/submissions/${id}`); },
  create(fields)       { return api('/submissions', { method: 'POST', body: fields }); },
  getAllWithMeta()     { return api('/submissions/with-meta'); },

  // The server already returns bt/status/owner hydrated on getById() and
  // getAllWithMeta() — this is kept only so existing call sites that pass an
  // already-fetched submission through withMeta() keep working unchanged.
  withMeta(sub) { return sub; }
};

// ─── EVENTS ──────────────────────────────────────────────────────────────────

const Events = {
  getBySubmission(submissionId) { return api(`/events?submissionId=${encodeURIComponent(submissionId)}`); },
  claim(submissionId)                          { return api('/events/claim',    { method: 'POST', body: { submissionId } }); },
  reassign(submissionId, _fromRepId, toRepId, reason = '') {
    return api('/events/reassign', { method: 'POST', body: { submissionId, toRepId, reason } });
  },
  addNote(submissionId, _repId, content)       { return api('/events/note',     { method: 'POST', body: { submissionId, content } }); },
  close(submissionId, _repId, note = '')       { return api('/events/close',    { method: 'POST', body: { submissionId, note } }); }
};

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

const Dashboard = {
  stats() { return api('/dashboard/stats'); },

  async categoryBreakdown() {
    const rows = await api('/dashboard/category-breakdown');
    return rows.map(r => ({
      ...r,
      catLabel: CATEGORIES[r.category]?.label || r.category,
      subLabel: CATEGORIES[r.category]?.subcategories?.[r.subcategory] || r.subcategory
    }));
  },

  async trendAlerts() {
    const rows = await api('/dashboard/trend-alerts');
    return rows.map(r => ({
      ...r,
      catLabel: CATEGORIES[r.category]?.label || r.category,
      subLabel: CATEGORIES[r.category]?.subcategories?.[r.subcategory] || r.subcategory,
      routedTo: getRoutedRep(r.category)
    }));
  }
};

// ─── GLOBAL EXPORT ────────────────────────────────────────────────────────────

window.DB = { Auth, Users, Drafts, Submissions, Events, Dashboard, CATEGORIES, HOWARD_MODELS, SEVERITIES, REPS, seed };
