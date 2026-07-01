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

async function sha256(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
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
const KEY_INIT        = 'squawk_initialized';

function load(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────

async function seed() {
  if (localStorage.getItem(KEY_INIT)) return;

  const now = Date.now();

  const hHash = await sha256('20265657');
  const tHash = await sha256('20266759');
  const jHash = await sha256('test');

  const users = [
    {
      id: 'admin_hendrik', name: 'Hendrik Van Geertruyden',
      email: 'hvangeertruyden@howardai.us',
      passwordHash: hHash, role: 'admin',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 30*86400000).toISOString()
    },
    {
      id: 'admin_tucker', name: 'Tucker Pate',
      email: 'tpate@howardai.us',
      passwordHash: tHash, role: 'admin',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 30*86400000).toISOString()
    },
    {
      id: 'admin_jane', name: 'Jane Doe',
      email: 'jdoe@howardai.us',
      passwordHash: jHash, role: 'admin',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 30*86400000).toISOString()
    },
    {
      id: 'bt_alice', name: 'Alice Chen',
      email: 'alice@example.com',
      passwordHash: await sha256('alicepass'), role: 'bt',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 14*86400000).toISOString()
    },
    {
      id: 'bt_marcus', name: 'Marcus Webb',
      email: 'marcus@example.com',
      passwordHash: await sha256('marcuspass'), role: 'bt',
      otp: null, otpUsed: true, serialNumber: null,
      createdAt: new Date(now - 10*86400000).toISOString()
    },
    {
      id: 'bt_priya', name: 'Priya Nair',
      email: 'priya@example.com',
      passwordHash: await sha256('priyapass'), role: 'bt',
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

  const submissions = [
    {
      id: 'sub_001', btId: 'bt_alice',
      submittedAt: new Date(now - 12*86400000).toISOString(),
      category: 'software', subcategory: 'crash',
      interface: 'arken', severity: 'high',
      message: "Arken crashed completely during the initial setup on step 4. I had to restart the device. After restarting it got stuck on the loading screen for about 3 minutes before finally coming through. This happened twice in a row.",
      attachmentData: null
    },
    {
      id: 'sub_002', btId: 'bt_alice',
      submittedAt: new Date(now - 9*86400000).toISOString(),
      category: 'ux', subcategory: 'feature_avoidance',
      interface: 'arken', severity: 'medium',
      message: "I haven't been using the spending controls feature at all. Every time I open it the number of options feels overwhelming and I'm not sure what 'strict mode' does vs 'guided mode'. I don't want to set something wrong and have Howard start blocking things it shouldn't.",
      attachmentData: null
    },
    {
      id: 'sub_003', btId: 'bt_marcus',
      submittedAt: new Date(now - 8*86400000).toISOString(),
      category: 'hardware', subcategory: 'overheating',
      interface: 'other', severity: 'high',
      message: "The unit gets very warm to the touch after about 2 hours of running. Not hot enough that I'd call it dangerous but definitely uncomfortable. It's sitting on my desk with good airflow so I don't think placement is the issue. Should I be concerned?",
      attachmentData: null
    },
    {
      id: 'sub_004', btId: 'bt_marcus',
      submittedAt: new Date(now - 5*86400000).toISOString(),
      category: 'setup', subcategory: 'step_unclear',
      interface: 'arken', severity: 'low',
      message: "Step 4 of the Arken setup was a bit vague. It asked me to 'configure network preferences' but didn't explain what each option actually does. I guessed and it seems fine, but I wasn't confident I was making the right choice.",
      attachmentData: null
    },
    {
      id: 'sub_005', btId: 'bt_priya',
      submittedAt: new Date(now - 3*86400000).toISOString(),
      category: 'voice', subcategory: 'misrecognition',
      interface: 'howard_messaging', severity: 'medium',
      message: "Howard often mishears my name when I introduce context — it keeps transcribing 'Priya' as 'Priya' correctly but then substitutes wrong words in the same sentence. For example 'remind Priya about dentist' becomes 'remind Priya about tennis'. Happens maybe 1 in 4 times.",
      attachmentData: null
    }
  ];

  const events = [
    // sub_001 events
    { id: genId(), submissionId: 'sub_001', type: 'submission',  timestamp: submissions[0].submittedAt, repId: null, data: {} },
    { id: genId(), submissionId: 'sub_001', type: 'auto_triage', timestamp: submissions[0].submittedAt, repId: null, data: { routedTo: 'tucker', reason: 'Software crash — routed to Tucker' } },
    { id: genId(), submissionId: 'sub_001', type: 'claim',       timestamp: new Date(now - 11*86400000).toISOString(), repId: 'admin_tucker', data: {} },
    { id: genId(), submissionId: 'sub_001', type: 'note',        timestamp: new Date(now - 10*86400000).toISOString(), repId: 'admin_tucker', data: { content: "Reproduced internally on dev unit — step 4 triggers a memory flush that can race with the boot sequence. Fix in progress for next firmware push." } },
    { id: genId(), submissionId: 'sub_001', type: 'close',       timestamp: new Date(now - 9*86400000).toISOString(),  repId: 'admin_tucker', data: { note: 'Acknowledged. Fix queued for firmware v0.4.2.' } },

    // sub_002 events
    { id: genId(), submissionId: 'sub_002', type: 'submission',  timestamp: submissions[1].submittedAt, repId: null, data: {} },
    { id: genId(), submissionId: 'sub_002', type: 'auto_triage', timestamp: submissions[1].submittedAt, repId: null, data: { routedTo: 'hendrik', reason: 'UX / feature avoidance — routed to Hendrik' } },

    // sub_003 events
    { id: genId(), submissionId: 'sub_003', type: 'submission',  timestamp: submissions[2].submittedAt, repId: null, data: {} },
    { id: genId(), submissionId: 'sub_003', type: 'auto_triage', timestamp: submissions[2].submittedAt, repId: null, data: { routedTo: 'tucker', reason: 'Hardware overheating — routed to Tucker' } },
    { id: genId(), submissionId: 'sub_003', type: 'claim',       timestamp: new Date(now - 7*86400000).toISOString(), repId: 'admin_tucker', data: {} },

    // sub_004 events
    { id: genId(), submissionId: 'sub_004', type: 'submission',  timestamp: submissions[3].submittedAt, repId: null, data: {} },
    { id: genId(), submissionId: 'sub_004', type: 'auto_triage', timestamp: submissions[3].submittedAt, repId: null, data: { routedTo: null, reason: 'Installation / setup — review for routing' } },

    // sub_005 events
    { id: genId(), submissionId: 'sub_005', type: 'submission',  timestamp: submissions[4].submittedAt, repId: null, data: {} },
    { id: genId(), submissionId: 'sub_005', type: 'auto_triage', timestamp: submissions[4].submittedAt, repId: null, data: { routedTo: 'tucker', reason: 'Voice recognition — routed to Tucker' } }
  ];

  save(KEY_USERS,       users);
  save(KEY_SUBMISSIONS, submissions);
  save(KEY_EVENTS,      events);
  localStorage.setItem(KEY_INIT, '1');
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

const Auth = {
  async login(email, password) {
    const hash  = await sha256(password);
    const users = load(KEY_USERS);
    const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash && u.otpUsed);
    if (!user) return null;
    const session = { userId: user.id, role: user.role, expiresAt: Date.now() + 86400000 };
    save(KEY_SESSION, session);
    return user;
  },

  async firstLogin(email, otp, newPassword) {
    const users = load(KEY_USERS);
    const idx   = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase() && u.otp === otp && !u.otpUsed);
    if (idx === -1) return null;
    users[idx].passwordHash = await sha256(newPassword);
    users[idx].otp          = null;
    users[idx].otpUsed      = true;
    save(KEY_USERS, users);
    const session = { userId: users[idx].id, role: users[idx].role, expiresAt: Date.now() + 86400000 };
    save(KEY_SESSION, session);
    return users[idx];
  },

  checkFirstLogin(email) {
    const users = load(KEY_USERS);
    return users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.otp && !u.otpUsed) || null;
  },

  logout() {
    localStorage.removeItem(KEY_SESSION);
  },

  currentUser() {
    const session = load(KEY_SESSION, null);
    if (!session || Date.now() > session.expiresAt) return null;
    const users = load(KEY_USERS);
    return users.find(u => u.id === session.userId) || null;
  },

  currentSession() {
    return load(KEY_SESSION, null);
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
