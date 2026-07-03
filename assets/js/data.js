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

// ─── ROUTING LOGIC ───────────────────────────────────────────────────────────

function getRoutedRep(category) {
  if (['hardware', 'software', 'speed', 'bugs'].includes(category)) return 'tucker';
  if (['usability', 'features', 'security'].includes(category))    return 'hendrik';
  return null;
}

// ─── CRYPTO ──────────────────────────────────────────────────────────────────

function hashPassword(str) {
  // Simple deterministic obfuscation for localStorage-only tool
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return btoa(str + ':sq:' + h.toString(16));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function genOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── RAW STORAGE ─────────────────────────────────────────────────────────────

const KEY_USERS       = 'squawk_users';
const KEY_SUBMISSIONS = 'squawk_submissions';
const KEY_DRAFTS      = 'squawk_drafts';
const KEY_EVENTS      = 'squawk_events';
const KEY_SESSION     = 'squawk_session';
const KEY_INIT        = 'squawk_initialized_v5';

function load(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function sessionLoad(key, fallback = null) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function sessionSave(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function defaultSettings() {
  return {
    emailNotifications: true,
    primaryColor: '#0F7A6C',
    theme: 'light',
    textSize: 'regular'
  };
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────

function seed() {
  if (localStorage.getItem(KEY_INIT)) { patchSeed(); return; }

  const now = Date.now();

  const users = [
    {
      id: 'admin_hendrik', name: 'Hendrik Van Geertruyden',
      email: 'hvangeertruyden@howardai.us',
      passwordHash: hashPassword('20265657'), role: 'admin',
      otp: null, otpUsed: true, devices: [], avatarDataUrl: null,
      settings: defaultSettings(),
      createdAt: new Date(now - 30*86400000).toISOString()
    },
    {
      id: 'admin_tucker', name: 'Tucker Pate',
      email: 'tpate@howardai.us',
      passwordHash: hashPassword('20266759'), role: 'admin',
      otp: null, otpUsed: true, devices: [], avatarDataUrl: null,
      settings: defaultSettings(),
      createdAt: new Date(now - 30*86400000).toISOString()
    },
    {
      id: 'admin_jane', name: 'Jane Doe',
      email: 'jdoe@howardai.us',
      passwordHash: hashPassword('test'), role: 'admin',
      otp: null, otpUsed: true, devices: [], avatarDataUrl: null,
      settings: defaultSettings(),
      createdAt: new Date(now - 30*86400000).toISOString()
    },
    {
      id: 'bt_alice', name: 'Alice Chen',
      email: 'alice@example.com',
      passwordHash: hashPassword('alicepass'), role: 'bt',
      otp: null, otpUsed: true, avatarDataUrl: null,
      devices: [
        { id: 'dev_' + genId(), name: "Alice's Arken", serialNumber: 'ARK-10293', model: 'Arken One', dateAdded: new Date(now - 14*86400000).toISOString() }
      ],
      settings: defaultSettings(),
      createdAt: new Date(now - 14*86400000).toISOString()
    },
    {
      id: 'bt_marcus', name: 'Marcus Webb',
      email: 'marcus@example.com',
      passwordHash: hashPassword('marcuspass'), role: 'bt',
      otp: null, otpUsed: true, avatarDataUrl: null,
      devices: [
        { id: 'dev_' + genId(), name: 'Home Unit',   serialNumber: 'ARK-20194', model: 'Arken One',  dateAdded: new Date(now - 10*86400000).toISOString() },
        { id: 'dev_' + genId(), name: 'Office Unit', serialNumber: 'ARK-20551', model: 'Arken Mini', dateAdded: new Date(now - 3*86400000).toISOString() }
      ],
      settings: defaultSettings(),
      createdAt: new Date(now - 10*86400000).toISOString()
    },
    {
      id: 'bt_priya', name: 'Priya Nair',
      email: 'priya@example.com',
      passwordHash: hashPassword('priyapass'), role: 'bt',
      otp: null, otpUsed: true, avatarDataUrl: null,
      devices: [
        { id: 'dev_' + genId(), name: "Priya's Arken", serialNumber: 'ARK-30871', model: 'Arken Pro', dateAdded: new Date(now - 7*86400000).toISOString() }
      ],
      settings: defaultSettings(),
      createdAt: new Date(now - 7*86400000).toISOString()
    },
    {
      id: 'bt_test1', name: 'Test User One',
      email: 'testbt1@example.com',
      passwordHash: null, role: 'bt',
      otp: '482751', otpUsed: false, avatarDataUrl: null,
      devices: [
        { id: 'dev_' + genId(), name: 'Test Unit', serialNumber: 'ARK-TEST01', model: 'Arken One', dateAdded: new Date(now - 1*86400000).toISOString() }
      ],
      settings: defaultSettings(),
      createdAt: new Date(now - 1*86400000).toISOString()
    },
    {
      id: 'bt_test2', name: 'Test User Two',
      email: 'testbt2@example.com',
      passwordHash: null, role: 'bt',
      otp: '639204', otpUsed: false, avatarDataUrl: null,
      devices: [
        { id: 'dev_' + genId(), name: 'Test Unit', serialNumber: 'ARK-TEST02', model: 'Arken One', dateAdded: new Date(now - 1*86400000).toISOString() }
      ],
      settings: defaultSettings(),
      createdAt: new Date(now - 1*86400000).toISOString()
    },
    {
      // Pre-activated on purpose (unlike bt_test1/bt_test2) so it logs in
      // identically on any device without an OTP first-login step — useful
      // for cross-device testing.
      id: 'bt_test3', name: 'Test User Three',
      email: 'testbt3@example.com',
      passwordHash: hashPassword('testbt3pass'), role: 'bt',
      otp: null, otpUsed: true, avatarDataUrl: null,
      devices: [
        { id: 'dev_' + genId(), name: 'Test Unit', serialNumber: 'ARK-TEST03', model: 'Arken One', dateAdded: new Date(now - 1*86400000).toISOString() }
      ],
      settings: defaultSettings(),
      createdAt: new Date(now - 1*86400000).toISOString()
    }
  ];

  save(KEY_USERS,       users);
  save(KEY_SUBMISSIONS, []);
  save(KEY_DRAFTS,      []);
  save(KEY_EVENTS,      []);
  localStorage.setItem(KEY_INIT, '1');
}

// Adds new fixed-credential seed accounts to already-initialized browsers
// without touching real submissions/drafts/events already stored there.
function patchSeed() {
  const users = load(KEY_USERS);
  if (users.some(u => u.id === 'bt_test3')) return;

  users.push({
    id: 'bt_test3', name: 'Test User Three',
    email: 'testbt3@example.com',
    passwordHash: hashPassword('testbt3pass'), role: 'bt',
    otp: null, otpUsed: true, avatarDataUrl: null,
    devices: [
      { id: 'dev_' + genId(), name: 'Test Unit', serialNumber: 'ARK-TEST03', model: 'Arken One', dateAdded: new Date().toISOString() }
    ],
    settings: defaultSettings(),
    createdAt: new Date().toISOString()
  });
  save(KEY_USERS, users);
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

const Auth = {
  login(email, password) {
    const hash  = hashPassword(password);
    const users = load(KEY_USERS);
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash && u.otpUsed);
    if (!user) return null;
    const session = { userId: user.id, role: user.role, expiresAt: Date.now() + 86400000 };
    sessionSave(KEY_SESSION, session);
    return user;
  },

  firstLogin(email, otp, newPassword) {
    const users = load(KEY_USERS);
    const idx   = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase() && u.otp === otp && !u.otpUsed);
    if (idx === -1) return null;
    users[idx].passwordHash = hashPassword(newPassword);
    users[idx].otp          = null;
    users[idx].otpUsed      = true;
    save(KEY_USERS, users);
    const session = { userId: users[idx].id, role: users[idx].role, expiresAt: Date.now() + 86400000 };
    sessionSave(KEY_SESSION, session);
    return users[idx];
  },

  checkFirstLogin(email) {
    const users = load(KEY_USERS);
    return users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.otp && !u.otpUsed) || null;
  },

  logout() {
    sessionStorage.removeItem(KEY_SESSION);
  },

  currentUser() {
    const session = sessionLoad(KEY_SESSION, null);
    if (!session || Date.now() > session.expiresAt) return null;
    const users = load(KEY_USERS);
    return users.find(u => u.id === session.userId) || null;
  },

  currentSession() {
    return sessionLoad(KEY_SESSION, null);
  }
};

// ─── USERS ────────────────────────────────────────────────────────────────────

const Users = {
  getAll()       { return load(KEY_USERS); },
  getBTs()       { return load(KEY_USERS).filter(u => u.role === 'bt'); },
  getAdmins()    { return load(KEY_USERS).filter(u => u.role === 'admin'); },
  getById(id)    { return load(KEY_USERS).find(u => u.id === id) || null; },

  update(id, patch) {
    const users = load(KEY_USERS);
    const idx   = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...patch };
    save(KEY_USERS, users);
    return users[idx];
  },

  updateSettings(id, patch) {
    const users = load(KEY_USERS);
    const idx   = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx].settings = { ...defaultSettings(), ...users[idx].settings, ...patch };
    save(KEY_USERS, users);
    return users[idx];
  },

  addDevice(userId, device) {
    const users = load(KEY_USERS);
    const idx   = users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    const dev = { id: 'dev_' + genId(), ...device };
    users[idx].devices = users[idx].devices || [];
    users[idx].devices.push(dev);
    save(KEY_USERS, users);
    return dev;
  },

  removeDevice(userId, deviceId) {
    const users = load(KEY_USERS);
    const idx   = users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    users[idx].devices = (users[idx].devices || []).filter(d => d.id !== deviceId);
    save(KEY_USERS, users);
    return users[idx];
  },

  deleteAccount(id) {
    const users = load(KEY_USERS).filter(u => u.id !== id);
    save(KEY_USERS, users);
  },

  create({ name, email }) {
    const users = load(KEY_USERS);
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { error: 'An account with that email already exists.' };
    }
    const otp  = genOTP();
    const user = {
      id: 'bt_' + genId(),
      name, email,
      passwordHash: null,
      role: 'bt',
      otp,
      otpUsed: false,
      devices: [],
      avatarDataUrl: null,
      settings: defaultSettings(),
      createdAt: new Date().toISOString(),
      createdBy: Auth.currentSession()?.userId || null
    };
    users.push(user);
    save(KEY_USERS, users);
    return { user, otp };
  }
};

// ─── DRAFTS ───────────────────────────────────────────────────────────────────

const Drafts = {
  getByBT(id) {
    return load(KEY_DRAFTS).filter(d => d.btId === id)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  getById(id) { return load(KEY_DRAFTS).find(d => d.id === id) || null; },

  save(draft) {
    const drafts = load(KEY_DRAFTS);
    const now    = new Date().toISOString();
    if (draft.id) {
      const idx = drafts.findIndex(d => d.id === draft.id);
      if (idx !== -1) {
        drafts[idx] = { ...drafts[idx], ...draft, updatedAt: now };
        save(KEY_DRAFTS, drafts);
        return drafts[idx];
      }
    }
    const newDraft = { ...draft, id: 'draft_' + genId(), updatedAt: now, createdAt: now };
    drafts.push(newDraft);
    save(KEY_DRAFTS, drafts);
    return newDraft;
  },

  delete(id) {
    save(KEY_DRAFTS, load(KEY_DRAFTS).filter(d => d.id !== id));
  }
};

// ─── SUBMISSIONS ──────────────────────────────────────────────────────────────

const Submissions = {
  getAll()     { return load(KEY_SUBMISSIONS); },
  getByBT(id)  { return load(KEY_SUBMISSIONS).filter(s => s.btId === id); },
  getById(id)  { return load(KEY_SUBMISSIONS).find(s => s.id === id) || null; },

  create({ btId, title, category, subcategory, description, deviceId, model, eventTimestamp, timestampPrecision, attachmentData }) {
    const sub = {
      id:             'sub_' + genId(),
      btId,
      submittedAt:    new Date().toISOString(),
      title, category, subcategory, description,
      deviceId: deviceId || null,
      model:    model || null,
      eventTimestamp:     eventTimestamp || null,
      timestampPrecision: timestampPrecision || null,
      attachmentData: attachmentData || null
    };
    const subs = load(KEY_SUBMISSIONS);
    subs.push(sub);
    save(KEY_SUBMISSIONS, subs);

    const routedTo = getRoutedRep(category);
    const events   = load(KEY_EVENTS);
    events.push({ id: genId(), submissionId: sub.id, type: 'submission',  timestamp: sub.submittedAt, repId: null, data: {} });
    events.push({ id: genId(), submissionId: sub.id, type: 'auto_triage', timestamp: sub.submittedAt, repId: null,
      data: { routedTo, reason: routedTo ? `${CATEGORIES[category]?.label} — routed to ${REPS[routedTo]?.name}` : `${CATEGORIES[category]?.label} — review for routing` }
    });
    save(KEY_EVENTS, events);

    return sub;
  },

  // Derived status from events
  getStatus(submissionId) {
    const evts = load(KEY_EVENTS).filter(e => e.submissionId === submissionId);
    if (evts.some(e => e.type === 'close'))  return 'closed';
    if (evts.some(e => e.type === 'claim'))  return 'in-review';
    return 'new';
  },

  // Derived current owner (null if unclaimed or just reassigned)
  getOwner(submissionId) {
    const evts = load(KEY_EVENTS)
      .filter(e => e.submissionId === submissionId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    let owner = null;
    for (const e of evts) {
      if (e.type === 'claim')    owner = e.repId;
      if (e.type === 'reassign') owner = null;
    }
    return owner ? Users.getById(owner) : null;
  },

  withMeta(sub) {
    const bt     = Users.getById(sub.btId);
    const status = Submissions.getStatus(sub.id);
    const owner  = Submissions.getOwner(sub.id);
    return { ...sub, bt, status, owner };
  },

  getAllWithMeta() {
    return Submissions.getAll().map(Submissions.withMeta)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }
};

// ─── EVENTS ──────────────────────────────────────────────────────────────────

const Events = {
  getBySubmission(submissionId) {
    return load(KEY_EVENTS)
      .filter(e => e.submissionId === submissionId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  },

  claim(submissionId, repId) {
    const evts = load(KEY_EVENTS);
    evts.push({ id: genId(), submissionId, type: 'claim', timestamp: new Date().toISOString(), repId, data: {} });
    save(KEY_EVENTS, evts);
  },

  reassign(submissionId, fromRepId, toRepId, reason = '') {
    const evts = load(KEY_EVENTS);
    evts.push({ id: genId(), submissionId, type: 'reassign', timestamp: new Date().toISOString(), repId: fromRepId,
      data: { fromRepId, toRepId, reason }
    });
    save(KEY_EVENTS, evts);
  },

  addNote(submissionId, repId, content) {
    const evts = load(KEY_EVENTS);
    evts.push({ id: genId(), submissionId, type: 'note', timestamp: new Date().toISOString(), repId, data: { content } });
    save(KEY_EVENTS, evts);
  },

  close(submissionId, repId, note = '') {
    const evts = load(KEY_EVENTS);
    evts.push({ id: genId(), submissionId, type: 'close', timestamp: new Date().toISOString(), repId, data: { note } });
    save(KEY_EVENTS, evts);
  }
};

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

const Dashboard = {
  stats() {
    const all    = Submissions.getAll();
    const open   = all.filter(s => Submissions.getStatus(s.id) !== 'closed');
    const week   = new Date(Date.now() - 7*86400000);
    const recent = all.filter(s => new Date(s.submittedAt) > week);
    const closedWeek = recent.filter(s => Submissions.getStatus(s.id) === 'closed');

    return {
      total:       all.length,
      open:        open.length,
      thisWeek:    recent.length,
      closedWeek:  closedWeek.length
    };
  },

  categoryBreakdown() {
    const subs = Submissions.getAll();
    const map  = {};
    for (const s of subs) {
      const key = `${s.category}|${s.subcategory}`;
      map[key]  = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .map(([key, count]) => {
        const [cat, sub] = key.split('|');
        return {
          category:    cat,
          subcategory: sub,
          catLabel:    CATEGORIES[cat]?.label || cat,
          subLabel:    CATEGORIES[cat]?.subcategories[sub] || sub,
          count
        };
      })
      .sort((a, b) => b.count - a.count);
  },

  // Subcategories with 3+ submissions in last 7 days
  trendAlerts() {
    const since = new Date(Date.now() - 7*86400000);
    const subs  = Submissions.getAll().filter(s => new Date(s.submittedAt) > since);
    const map   = {};
    for (const s of subs) {
      const key = `${s.category}|${s.subcategory}`;
      map[key]  = (map[key] || 0) + 1;
    }
    return Object.entries(map)
      .filter(([, count]) => count >= 3)
      .map(([key, count]) => {
        const [cat, sub] = key.split('|');
        return { category: cat, subcategory: sub, count,
          catLabel: CATEGORIES[cat]?.label || cat,
          subLabel: CATEGORIES[cat]?.subcategories[sub] || sub,
          routedTo: getRoutedRep(cat) };
      });
  }
};

// ─── GLOBAL EXPORT ────────────────────────────────────────────────────────────

window.DB = { Auth, Users, Drafts, Submissions, Events, Dashboard, CATEGORIES, HOWARD_MODELS, SEVERITIES, REPS, seed };
