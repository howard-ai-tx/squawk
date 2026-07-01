'use strict';

// ─── TAXONOMY ────────────────────────────────────────────────────────────────

const CATEGORIES = {
  hardware: {
    label: 'Hardware',
    icon: 'ti-cpu',
    subcategories: {
      malfunction:      'Malfunction',
      wont_power_on:    "Won't Power On",
      overheating:      'Overheating',
      physical_damage:  'Physical Damage',
      connectivity:     'Connectivity Issue',
      other:            'Other'
    }
  },
  software: {
    label: 'Software / Arken',
    icon: 'ti-code',
    subcategories: {
      crash:              'Crash',
      sluggish:           'Sluggish Performance',
      cache:              'Cache Issue',
      unexpected_behavior:'Unexpected Behavior',
      feature_broken:     'Feature Not Working',
      update_issue:       'Update Issue',
      other:              'Other'
    }
  },
  ux: {
    label: 'UX / Confusion',
    icon: 'ti-layout',
    subcategories: {
      unclear_instructions: 'Unclear Instructions',
      confusing_flow:       'Confusing Flow',
      feature_avoidance:    'Feature Avoidance',
      missing_feature:      'Missing Feature',
      unexpected_ui:        'Unexpected UI Behavior',
      other:                'Other'
    }
  },
  setup: {
    label: 'Installation / Setup',
    icon: 'ti-settings',
    subcategories: {
      setup_failure:     'Setup Failure',
      step_unclear:      'Step Unclear',
      connection_problem:'Connection Problem',
      config_error:      'Configuration Error',
      other:             'Other'
    }
  },
  voice: {
    label: 'Voice Recognition',
    icon: 'ti-microphone',
    subcategories: {
      misrecognition: 'Misrecognition',
      no_response:    'No Response',
      slow_response:  'Slow Response',
      accent_issue:   'Language / Accent Issue',
      other:          'Other'
    }
  },
  suggestion: {
    label: 'Feature Suggestion',
    icon: 'ti-bulb',
    subcategories: {
      new_feature:  'New Feature Request',
      enhancement:  'Enhancement Request',
      other:        'Other'
    }
  },
  other: {
    label: 'Other',
    icon: 'ti-dots-circle-horizontal',
    subcategories: {
      general:  'General Feedback',
      positive: 'Positive Feedback',
      other:    'Other'
    }
  }
};

const INTERFACES = {
  website:          'Website',
  arken:            'Arken',
  howard_messaging: 'Howard via Text / Messaging',
  other:            'Other'
};

const SEVERITIES = {
  low:    'Low',
  medium: 'Medium',
  high:   'High'
};

const REPS = {
  tucker:  { name: 'Tucker',  categories: ['hardware', 'software'] },
  hendrik: { name: 'Hendrik', categories: ['ux', 'suggestion']     }
};

// ─── ROUTING LOGIC ───────────────────────────────────────────────────────────

function getRoutedRep(category) {
  if (['hardware', 'software'].includes(category)) return 'tucker';
  if (['ux', 'suggestion'].includes(category))     return 'hendrik';
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
const KEY_EVENTS      = 'squawk_events';
const KEY_SESSION     = 'squawk_session';
const KEY_INIT        = 'squawk_initialized_v4';

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

// ─── SEED DATA ────────────────────────────────────────────────────────────────

function seed() {
  if (localStorage.getItem(KEY_INIT)) return;

  const now = Date.now();

  const users = [
    {
      id: 'admin_hendrik', name: 'Hendrik Van Geertruyden',
      email: 'hvangeertruyden@howardai.us',
      passwordHash: hashPassword('20265657'), role: 'admin',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 30*86400000).toISOString()
    },
    {
      id: 'admin_tucker', name: 'Tucker Pate',
      email: 'tpate@howardai.us',
      passwordHash: hashPassword('20266759'), role: 'admin',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 30*86400000).toISOString()
    },
    {
      id: 'admin_jane', name: 'Jane Doe',
      email: 'jdoe@howardai.us',
      passwordHash: hashPassword('test'), role: 'admin',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 30*86400000).toISOString()
    },
    {
      id: 'bt_alice', name: 'Alice Chen',
      email: 'alice@example.com',
      passwordHash: hashPassword('alicepass'), role: 'bt',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 14*86400000).toISOString()
    },
    {
      id: 'bt_marcus', name: 'Marcus Webb',
      email: 'marcus@example.com',
      passwordHash: hashPassword('marcuspass'), role: 'bt',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 10*86400000).toISOString()
    },
    {
      id: 'bt_priya', name: 'Priya Nair',
      email: 'priya@example.com',
      passwordHash: hashPassword('priyapass'), role: 'bt',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 7*86400000).toISOString()
    },
    {
      id: 'bt_test1', name: 'Test User One',
      email: 'testbt1@example.com',
      passwordHash: null, role: 'bt',
      otp: '482751', otpUsed: false, serialNumber: null,
      createdAt: new Date(now - 1*86400000).toISOString()
    },
    {
      id: 'bt_test2', name: 'Test User Two',
      email: 'testbt2@example.com',
      passwordHash: null, role: 'bt',
      otp: '639204', otpUsed: false, serialNumber: null,
      createdAt: new Date(now - 1*86400000).toISOString()
    }
  ];

  save(KEY_USERS,       users);
  save(KEY_SUBMISSIONS, []);
  save(KEY_EVENTS,      []);
  localStorage.setItem(KEY_INIT, '1');
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
      serialNumber: null,
      createdAt: new Date().toISOString(),
      createdBy: Auth.currentSession()?.userId || null
    };
    users.push(user);
    save(KEY_USERS, users);
    return { user, otp };
  }
};

// ─── SUBMISSIONS ──────────────────────────────────────────────────────────────

const Submissions = {
  getAll()     { return load(KEY_SUBMISSIONS); },
  getByBT(id)  { return load(KEY_SUBMISSIONS).filter(s => s.btId === id); },
  getById(id)  { return load(KEY_SUBMISSIONS).find(s => s.id === id) || null; },

  create({ btId, category, subcategory, interface: iface, severity, message, attachmentData }) {
    const sub = {
      id:             'sub_' + genId(),
      btId,
      submittedAt:    new Date().toISOString(),
      category, subcategory,
      interface:      iface,
      severity, message,
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

window.DB = { Auth, Users, Submissions, Events, Dashboard, CATEGORIES, INTERFACES, SEVERITIES, REPS, seed };
