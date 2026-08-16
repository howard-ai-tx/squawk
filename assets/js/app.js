'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────

let currentEA = null;
// Notification ids we've told the server to mark read, kept client-side so a
// re-fetch shortly after (e.g. navigating back to Notifications) can't show
// them as unread again if the write hasn't fully propagated yet.
let locallyReadNotifIds = new Set();

// ─── ROUTER ───────────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('[data-view]').forEach(el => el.classList.add('hidden'));
  const el = document.querySelector(`[data-view="${name}"]`);
  if (el) el.classList.remove('hidden');

  const shell = document.getElementById('app-shell');
  if (name === 'login' || name === 'activate') {
    shell.classList.add('hidden');
  } else {
    shell.classList.remove('hidden');
  }

  document.querySelectorAll('.app-nav-link[data-target]').forEach(a => {
    a.classList.toggle('active', a.dataset.target === name || (a.dataset.target === 'admin-contact' && name === 'admin-conversation'));
  });
  document.getElementById('resources-trigger')?.classList.toggle('active', name === 'representing' || name === 'refer');
  document.querySelectorAll('.app-avatar-trigger').forEach(t => {
    t.classList.toggle('active', ['profile', 'notifications', 'settings'].includes(name));
  });

  if (name === 'home')          renderHome();
  if (name === 'feedback')      renderFeedback();
  if (name === 'bug')           renderBug();
  if (name === 'contact')       renderContact();
  if (name === 'representing')  renderRepresenting();
  if (name === 'refer')         renderRefer();
  if (name === 'profile')       renderProfile();
  if (name === 'notifications') renderNotifications();
  if (name === 'settings')      renderSettings();
  if (name === 'admin-overview') renderAdminOverview();
  if (name === 'admin-eas')      renderAdminEAs();
  if (name === 'admin-feedback') renderAdminFeedback();
  if (name === 'admin-bugs')     renderAdminBugs();
  if (name === 'admin-contact')  renderAdminContact();
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function toast(message, type = 'success') {
  const icons  = { success: 'ti-circle-check', error: 'ti-circle-x' };
  const colors = { success: '#34C759', error: '#FF3B30' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<i class="ti ${icons[type] || icons.success}" style="color:${colors[type] || colors.success};flex-shrink:0;font-size:18px"></i><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 4000);
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

async function init() {
  const activationToken = new URLSearchParams(window.location.search).get('activate');
  if (activationToken) {
    const { valid, name } = await DB.Auth.checkActivation(activationToken);
    if (valid) {
      renderActivateView(activationToken, name);
      showView('activate');
      return;
    }
    // Invalid/used token — drop the query param and fall through to normal login.
    window.history.replaceState({}, '', window.location.pathname);
  }

  currentEA = await DB.Auth.currentEarlyAdopter();
  if (!currentEA) {
    renderLoginView();
    showView('login');
  } else {
    applyRoleShell();
    updateAvatarDisplay();
    applyReducedMotionSetting();
    refreshNotifBadge();
    refreshMessagesBadge();
    showView(currentEA.isAdmin ? 'admin-overview' : 'home');
  }
}

function applyRoleShell() {
  document.getElementById('app-shell').classList.toggle('is-admin', !!(currentEA && currentEA.isAdmin));
}

function initials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

function updateAvatarDisplay() {
  if (!currentEA) return;
  document.querySelectorAll('.app-avatar').forEach(el => {
    if (currentEA.avatar) {
      el.style.backgroundImage = `url(${currentEA.avatar})`;
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = initials(currentEA.name);
    }
  });
}

async function refreshNotifBadge() {
  if (!currentEA) return;
  try {
    const { notifications } = await DB.Notifications.list();
    // Compute unread count from the raw list (and override with what we
    // know we've already marked read client-side) rather than trusting the
    // server's unreadCount, which can briefly lag a just-committed write.
    const unread = notifications.filter(n => !n.readAt && !locallyReadNotifIds.has(n.id)).length;
    setNotifBadgeCount(unread);
  } catch { /* best effort */ }
}

async function refreshMessagesBadge() {
  if (!currentEA) return;
  try {
    const unread = await DB.MyActivity.messageUnreadCount();
    document.querySelectorAll('.nav-msg-badge').forEach(el => {
      el.textContent = String(unread);
      el.classList.toggle('hidden', unread === 0);
    });
  } catch { /* best effort */ }
}

function setNotifBadgeCount(unreadCount) {
  document.querySelectorAll('.app-notif-badge').forEach(el => {
    el.textContent = String(unreadCount);
    el.classList.toggle('hidden', unreadCount === 0);
  });
  document.querySelectorAll('.app-avatar-notif-dot').forEach(el => {
    el.classList.toggle('hidden', unreadCount === 0);
  });
}

function currentNotifBadgeCount() {
  const el = document.querySelector('.app-notif-badge');
  const n = el ? parseInt(el.textContent, 10) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function wirePasswordToggle(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  btn.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.innerHTML = `<i class="ti ${showing ? 'ti-eye' : 'ti-eye-off'}" style="font-size:18px"></i>`;
  });
}

function renderActivateView(token, name) {
  const view = document.querySelector('[data-view="activate"]');
  view.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <img class="login-logo" src="logo-dark.png" alt="Howard AI">
        <h1 class="login-title">Welcome${name ? ', ' + escHtml(name.split(' ')[0]) : ''}</h1>
        <p class="login-subtitle">Set a password to activate your account.</p>
        <form class="login-form" id="activate-form" novalidate>
          <div class="field">
            <label class="field-label" for="activate-password">Password</label>
            <div class="input-group">
              <input class="input" type="password" id="activate-password" autocomplete="new-password" required>
              <button type="button" class="input-icon-btn" id="activate-toggle" aria-label="Show password">
                <i class="ti ti-eye" style="font-size:18px"></i>
              </button>
            </div>
            <p class="field-helper">At least 8 characters.</p>
          </div>
          <div id="activate-error" class="field-error hidden">
            <i class="ti ti-alert-circle" style="font-size:16px"></i>
            <span id="activate-error-text"></span>
          </div>
          <button type="submit" class="btn btn-primary w-full" id="activate-btn">Set Password &amp; Sign In</button>
        </form>
      </div>
    </div>
  `;

  wirePasswordToggle('activate-password', 'activate-toggle');

  document.getElementById('activate-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('activate-error');
    errEl.classList.add('hidden');
    const password = document.getElementById('activate-password').value;
    if (password.length < 8) {
      document.getElementById('activate-error-text').textContent = 'Password must be at least 8 characters.';
      errEl.classList.remove('hidden');
      return;
    }
    const btn = document.getElementById('activate-btn');
    btn.disabled = true;
    btn.textContent = 'Setting password...';
    try {
      currentEA = await DB.Auth.activate(token, password);
      window.history.replaceState({}, '', window.location.pathname);
      applyRoleShell();
      updateAvatarDisplay();
      applyReducedMotionSetting();
      refreshNotifBadge();
      refreshMessagesBadge();
      showView('home');
    } catch (err) {
      document.getElementById('activate-error-text').textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Set Password & Sign In';
    }
  });
}

function renderLoginView() {
  const view = document.querySelector('[data-view="login"]');
  view.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <img class="login-logo" src="logo-dark.png" alt="Howard AI">
        <h1 class="login-title">Sign In</h1>
        <p class="login-subtitle">Welcome back to the Early Adopter Platform.</p>
        <form class="login-form" id="login-form" novalidate>
          <div class="field">
            <label class="field-label" for="login-email">Email</label>
            <input class="input" type="email" id="login-email" autocomplete="email" required>
          </div>
          <div class="field">
            <label class="field-label" for="login-password">Password</label>
            <div class="input-group">
              <input class="input" type="password" id="login-password" autocomplete="current-password" required>
              <button type="button" class="input-icon-btn" id="login-toggle" aria-label="Show password">
                <i class="ti ti-eye" style="font-size:18px"></i>
              </button>
            </div>
          </div>
          <div id="login-error" class="field-error hidden">
            <i class="ti ti-alert-circle" style="font-size:16px"></i>
            <span id="login-error-text"></span>
          </div>
          <button type="submit" class="btn btn-primary w-full" id="login-btn">Sign In</button>
        </form>
      </div>
    </div>
  `;

  wirePasswordToggle('login-password', 'login-toggle');

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      currentEA = await DB.Auth.login(email, password);
      applyRoleShell();
      updateAvatarDisplay();
      applyReducedMotionSetting();
      refreshNotifBadge();
      refreshMessagesBadge();
      showView(currentEA.isAdmin ? 'admin-overview' : 'home');
    } catch (err) {
      document.getElementById('login-error-text').textContent = err.message || 'Email or password is incorrect.';
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

// ─── HOME ─────────────────────────────────────────────────────────────────────

const HOME_QUICK_LINKS = [
  { target: 'feedback',     icon: 'ti-message-2',    title: 'Feedback/Suggestions', body: 'Tell us what to change, add, or keep.' },
  { target: 'bug',          icon: 'ti-bug',           title: 'Report a Bug',         body: "Something not working as it should? Let us know." },
  { target: 'contact',      icon: 'ti-message-circle-2', title: 'Messages',          body: 'Chat directly with Hendrik and Tucker.' },
  { target: 'representing', icon: 'ti-shield-check',  title: 'Representing HowardAI',body: 'What to share when people ask about Howard.' },
  { target: 'refer',        icon: 'ti-user-plus',     title: 'Refer Someone',        body: 'Share your personal invite link.' }
];

function timeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function renderHome() {
  const view = document.querySelector('[data-view="home"]');
  const label = currentEA.installStatus === 'installed' ? 'Installed' : 'Scheduled';
  view.innerHTML = `
    <div class="page-header">
      <p class="page-eyebrow">${timeOfDayGreeting()}</p>
      <h1 class="h1">${escHtml(currentEA.name.split(' ')[0])}</h1>
    </div>

    <div class="card mb-8">
      <p class="field-label mb-2">Install status</p>
      <span class="status-pill ${currentEA.installStatus === 'installed' ? 'is-installed' : 'is-scheduled'}">
        <span class="status-dot"></span> ${label}
      </span>
    </div>

    <p class="form-section-title">Your activity</p>
    <div class="stat-grid mb-8" id="home-stats">
      <div class="admin-loading"><i class="ti ti-loader-2 spin" style="font-size:18px"></i> Loading…</div>
    </div>

    <p class="form-section-title">Quick links</p>
    <div class="home-links-grid">
      ${HOME_QUICK_LINKS.map(l => `
        <div class="card home-link-card" data-target="${l.target}">
          <i class="ti ${l.icon}" style="font-size:24px"></i>
          <h3 class="h3 home-link-title">${escHtml(l.title)}</h3>
          <p class="body text-secondary">${escHtml(l.body)}</p>
          <span class="home-link-action">Open <i class="ti ti-arrow-right" style="font-size:14px"></i></span>
        </div>
      `).join('')}
    </div>
  `;

  view.querySelectorAll('.home-link-card').forEach(card => {
    card.addEventListener('click', () => {
      showView(card.dataset.target);
      closeMobileNav();
    });
  });

  DB.MyActivity.stats().then(s => {
    const el = document.getElementById('home-stats');
    if (!el) return;
    el.innerHTML = `
      <div class="stat-card">
        <p class="stat-value">${s.feedbackCount}</p>
        <p class="stat-label">Feedback Submitted</p>
      </div>
      <div class="stat-card">
        <p class="stat-value">${s.bugCount}</p>
        <p class="stat-label">Bug Reports</p>
      </div>
      <div class="stat-card">
        <p class="stat-value">${s.contactCount}</p>
        <p class="stat-label">Messages Sent</p>
      </div>
    `;
  }).catch(() => {
    const el = document.getElementById('home-stats');
    if (el) el.innerHTML = '';
  });
}

// ─── FEEDBACK / SUGGESTIONS ───────────────────────────────────────────────────

const FEEDBACK_TYPES = [
  { value: 'suggestion', icon: 'ti-bulb',            label: 'Suggestion / idea' },
  { value: 'confusing',  icon: 'ti-help-circle',      label: 'Confusing / difficult to use' },
  { value: 'liked',      icon: 'ti-heart',            label: 'Something I really liked' },
  { value: 'disliked',   icon: 'ti-thumb-down',       label: "Something I didn't like" },
  { value: 'other',      icon: 'ti-message-circle',   label: 'Other' }
];

const IMPORTANCE_LEVELS = [
  { value: 'nice_to_have',      label: 'Nice to have' },
  { value: 'better_experience', label: 'Would make my experience better' },
  { value: 'important',         label: 'Pretty important' },
  { value: 'blocking',          label: 'Really important / blocking me' }
];

let feedbackState = {};

function renderFeedback() {
  feedbackState = {};
  const view = document.querySelector('[data-view="feedback"]');

  view.innerHTML = `
    <div class="page-header">
      <h1 class="h1">Feedback/Suggestions</h1>
    </div>
    <form id="feedback-form" novalidate>

      <div class="form-section">
        <p class="form-section-title">Overview</p>
        <div class="field mb-4">
          <label class="field-label">What type of feedback is this? <span class="field-required">Required</span></label>
          ${choiceGroupHtml('feedback-type-group', FEEDBACK_TYPES, { icon: true, grid: true })}
        </div>
        <div class="field">
          <label class="field-label">How important do you think this is? <span class="field-required">Required</span></label>
          ${choiceGroupHtml('feedback-importance-group', IMPORTANCE_LEVELS)}
          <div id="feedback-blocking-note" class="alert alert-info mt-2 hidden">
            <i class="ti ti-info-circle" style="font-size:18px;color:var(--action);flex-shrink:0"></i>
            <p class="body" style="font-size:14px">This sounds like it might be something broken rather than feedback. If Howard isn't working the way it should, a <a href="#" id="feedback-to-bug-link" style="color:var(--action);font-weight:700">Bug Report</a> gets it in front of us faster.</p>
          </div>
        </div>
      </div>

      <div class="form-section">
        <p class="form-section-title">Tell us about it</p>
        <div class="field">
          <label class="field-label" for="feedback-message">Details <span class="field-required">Required</span></label>
          <textarea class="input" id="feedback-message" style="min-height:120px"></textarea>
          <p class="field-helper">What happened, what did you notice, or what's your idea?</p>
        </div>
      </div>

      <div class="form-section">
        <div class="field mb-4">
          <label class="field-label" for="feedback-where">Where did you encounter this?</label>
          <input class="input" type="text" id="feedback-where" placeholder="e.g. a feature, page, or screen">
          <p class="field-helper">Optional.</p>
        </div>
        <div class="field">
          <label class="field-label" for="feedback-more">Anything else?</label>
          <textarea class="input" id="feedback-more" style="min-height:80px"></textarea>
          <p class="field-helper">Optional.</p>
        </div>
      </div>

      <div id="feedback-error" class="field-error hidden mb-4">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="feedback-error-text"></span>
      </div>
      <button type="submit" class="btn btn-primary" id="feedback-btn">Submit</button>
    </form>
  `;

  wireChoiceGroup('feedback-type-group', feedbackState, 'feedbackType');
  wireChoiceGroup('feedback-importance-group', feedbackState, 'importance');

  document.getElementById('feedback-importance-group').addEventListener('click', () => {
    document.getElementById('feedback-blocking-note').classList.toggle('hidden', feedbackState.importance !== 'blocking');
  });
  document.getElementById('feedback-to-bug-link').addEventListener('click', e => {
    e.preventDefault();
    showView('bug');
  });

  document.getElementById('feedback-form').addEventListener('submit', async e => {
    e.preventDefault();
    const message = document.getElementById('feedback-message').value.trim();
    const errEl = document.getElementById('feedback-error');
    errEl.classList.add('hidden');

    if (!feedbackState.feedbackType || !feedbackState.importance || !message) {
      document.getElementById('feedback-error-text').textContent = 'Please select a type, an importance level, and tell us about it.';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('feedback-btn');
    btn.disabled = true;
    try {
      await DB.Feedback.submit({
        feedbackType: feedbackState.feedbackType,
        importance: feedbackState.importance,
        message,
        whereEncountered: document.getElementById('feedback-where').value.trim(),
        additionalNotes: document.getElementById('feedback-more').value.trim()
      });
      toast('Feedback submitted.');
      renderFeedback();
    } catch (err) {
      document.getElementById('feedback-error-text').textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
    }
  });
}

// ─── REPORT A BUG ─────────────────────────────────────────────────────────────

const ISSUE_TYPES = [
  { value: 'hardware',    icon: 'ti-tool',           label: 'Hardware' },
  { value: 'software',    icon: 'ti-code',           label: 'Software' },
  { value: 'usability',   icon: 'ti-layout',         label: 'Usability' },
  { value: 'performance', icon: 'ti-gauge',          label: 'Performance' },
  { value: 'feature',     icon: 'ti-bulb',           label: 'Feature request' },
  { value: 'security',    icon: 'ti-shield-lock',    label: 'Security / Privacy' },
  { value: 'other',       icon: 'ti-help-circle',    label: 'Other / Question' }
];

const SEVERITIES = [
  { value: 'blocking', label: 'Blocking' },
  { value: 'high',     label: 'High' },
  { value: 'medium',   label: 'Medium' },
  { value: 'low',      label: 'Low' }
];

const FREQUENCIES = [
  { value: 'once',        label: 'Happened once' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'always',      label: 'Every time' }
];

const YES_NO_UNSURE = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' }
];

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' }
];

let bugState = {};
let bugAttachment = null;

function choiceGroupHtml(id, options, { icon = false, grid = false } = {}) {
  const cls = grid ? 'choice-grid' : 'choice-row';
  return `
    <div class="${cls}" id="${id}">
      ${options.map(o => `
        <button type="button" class="choice-chip" data-value="${o.value}">
          ${icon ? `<i class="ti ${o.icon}" style="font-size:18px"></i>` : ''}
          <span>${escHtml(o.label)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function wireChoiceGroup(id, stateObj, stateKey) {
  document.getElementById(id).querySelectorAll('.choice-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById(id).querySelectorAll('.choice-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      stateObj[stateKey] = chip.dataset.value;
    });
  });
}

function renderBug() {
  bugState = {};
  bugAttachment = null;
  const view = document.querySelector('[data-view="bug"]');

  view.innerHTML = `
    <div class="page-header">
      <h1 class="h1">Report a Bug</h1>
    </div>
    <form id="bug-form" novalidate>

      <div class="form-section">
        <p class="form-section-title">Overview</p>
        <div class="field mb-4">
          <label class="field-label" for="bug-title">Issue title <span class="field-required">Required</span></label>
          <input class="input" type="text" id="bug-title" placeholder="e.g. Arken stops responding after a long pause">
          <p class="field-helper">A short, descriptive title.</p>
        </div>
        <div class="field mb-4">
          <label class="field-label">Issue type <span class="field-required">Required</span></label>
          ${choiceGroupHtml('bug-type-group', ISSUE_TYPES, { icon: true, grid: true })}
        </div>
        <div class="field">
          <label class="field-label">Severity <span class="field-required">Required</span></label>
          ${choiceGroupHtml('bug-severity-group', SEVERITIES)}
        </div>
      </div>

      <div class="form-section">
        <p class="form-section-title">What happened</p>
        <div class="field mb-4">
          <label class="field-label" for="bug-happened">Describe what went wrong <span class="field-required">Required</span></label>
          <textarea class="input" id="bug-happened" style="min-height:100px"></textarea>
        </div>
        <div class="field mb-4">
          <label class="field-label" for="bug-steps">Steps to reproduce</label>
          <textarea class="input" id="bug-steps" placeholder="1. Go to...&#10;2. Click...&#10;3. ..." style="min-height:100px"></textarea>
        </div>
        <div class="field mb-4">
          <label class="field-label" for="bug-expected">What did you expect to happen? <span class="field-required">Required</span></label>
          <textarea class="input" id="bug-expected" style="min-height:80px"></textarea>
        </div>
        <div class="field">
          <label class="field-label" for="bug-actual">What actually happened?</label>
          <textarea class="input" id="bug-actual" style="min-height:80px"></textarea>
        </div>
      </div>

      <div class="form-section">
        <p class="form-section-title">Attachments</p>
        <div class="file-drop" id="bug-file-drop" tabindex="0" role="button" aria-label="Attach a file">
          <input type="file" id="bug-file-input" accept="image/*,video/*,.txt,.log">
          <i class="ti ti-paperclip" style="font-size:22px;color:var(--text-placeholder);margin-bottom:6px"></i>
          <p class="caption text-placeholder" id="bug-file-status">Click to attach a file</p>
        </div>
        <p class="field-helper mt-2">A screenshot, recording, or log file. Please don't include passwords or other sensitive information.</p>
      </div>

      <div class="form-section">
        <p class="form-section-title">Frequency &amp; reproducibility</p>
        <div class="field mb-4">
          <label class="field-label">How often does this happen?</label>
          ${choiceGroupHtml('bug-frequency-group', FREQUENCIES)}
        </div>
        <div class="field">
          <label class="field-label">Can you reproduce it?</label>
          ${choiceGroupHtml('bug-reproduce-group', YES_NO_UNSURE)}
        </div>
      </div>

      <div class="form-section">
        <p class="form-section-title">Diagnostic information</p>
        <div class="field">
          <label class="field-label" for="bug-diagnostics">Console output, error message, request ID, or timestamp <span style="color:var(--text-placeholder);font-size:13px">Optional</span></label>
          <textarea class="input" id="bug-diagnostics" style="min-height:80px;font-family:ui-monospace,monospace;font-size:13.5px"></textarea>
        </div>
      </div>

      <div class="form-section">
        <p class="form-section-title">About your experience</p>
        <div class="field mb-4">
          <label class="field-label" for="bug-context">What were you trying to accomplish?</label>
          <textarea class="input" id="bug-context" style="min-height:70px"></textarea>
        </div>
        <div class="field mb-4">
          <label class="field-label">Did this work correctly in an earlier version?</label>
          ${choiceGroupHtml('bug-regression-group', YES_NO_UNSURE)}
        </div>
        <div class="field mb-4">
          <label class="field-label">Is this blocking you from using a specific feature?</label>
          ${choiceGroupHtml('bug-blocking-group', YES_NO)}
        </div>
        <div class="field">
          <label class="field-label">Would you be willing to answer questions about this report?</label>
          ${choiceGroupHtml('bug-followup-group', YES_NO)}
        </div>
      </div>

      <div id="bug-error" class="field-error hidden mb-4">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="bug-error-text"></span>
      </div>
      <button type="submit" class="btn btn-primary" id="bug-btn">Submit Report</button>
    </form>
  `;

  wireChoiceGroup('bug-type-group', bugState, 'issueType');
  wireChoiceGroup('bug-severity-group', bugState, 'severity');
  wireChoiceGroup('bug-frequency-group', bugState, 'frequency');
  wireChoiceGroup('bug-reproduce-group', bugState, 'canReproduce');
  wireChoiceGroup('bug-regression-group', bugState, 'regression');
  wireChoiceGroup('bug-blocking-group', bugState, 'blockingFeature');
  wireChoiceGroup('bug-followup-group', bugState, 'followUpOk');

  const fileDrop = document.getElementById('bug-file-drop');
  const fileInput = document.getElementById('bug-file-input');
  fileDrop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('File must be under 8MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      bugAttachment = { name: file.name, type: file.type, dataUrl: ev.target.result };
      document.getElementById('bug-file-status').textContent = file.name;
      fileDrop.classList.add('has-file');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('bug-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('bug-error');
    errEl.classList.add('hidden');

    const title = document.getElementById('bug-title').value.trim();
    const whatHappened = document.getElementById('bug-happened').value.trim();
    const expected = document.getElementById('bug-expected').value.trim();

    if (!title || !bugState.issueType || !bugState.severity || !whatHappened || !expected) {
      document.getElementById('bug-error-text').textContent = 'Please fill in the title, issue type, severity, what happened, and what you expected.';
      errEl.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('bug-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';
    try {
      await DB.Bugs.submit({
        title,
        issueType: bugState.issueType,
        severity: bugState.severity,
        whatHappened,
        stepsToReproduce: document.getElementById('bug-steps').value.trim(),
        expected,
        actual: document.getElementById('bug-actual').value.trim(),
        attachment: bugAttachment,
        frequency: bugState.frequency || null,
        canReproduce: bugState.canReproduce || null,
        diagnostics: document.getElementById('bug-diagnostics').value.trim(),
        testerContext: document.getElementById('bug-context').value.trim(),
        regression: bugState.regression || null,
        blockingFeature: bugState.blockingFeature || null,
        followUpOk: bugState.followUpOk || null
      });
      toast('Bug report submitted.');
      renderBug();
    } catch (err) {
      document.getElementById('bug-error-text').textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Submit Report';
    }
  });
}

// ─── MESSAGES (chat) ────────────────────────────────────────────────────────
// Shared bubble-thread rendering used by both the EA's own conversation and
// each admin conversation thread. "mineSender" is whichever sender value
// should render as the blue/right-aligned bubbles for the current viewer.

function formatChatDay(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatChatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const REACTION_ICONS = {
  heart: 'ti-heart', thumbsup: 'ti-thumb-up', thumbsdown: 'ti-thumb-down',
  laugh: 'ti-mood-smile', exclaim: 'ti-exclamation-mark', question: 'ti-question-mark'
};
const REACTION_LIST = Object.keys(REACTION_ICONS);

function chatBubblesHtml(messages, mineSender, messagesById) {
  if (!messages.length) {
    return `
      <div class="chat-empty">
        <i class="ti ti-message-2" style="font-size:48px;color:var(--border-hover)"></i>
        <h3 class="h3 mt-4 mb-2">No messages yet.</h3>
        <p class="body text-secondary">Send a message to get the conversation started.</p>
      </div>
    `;
  }
  let lastDay = null;
  let html = '';
  messages.forEach(m => {
    const day = formatChatDay(m.createdAt);
    if (day !== lastDay) {
      html += `<div class="chat-timestamp">${day}</div>`;
      lastDay = day;
    }
    const mine = m.sender === mineSender;
    const myReactionKey = mineSender === 'ea' ? m.eaReaction : m.adminReaction;

    const original = m.replyToId ? messagesById[m.replyToId] : null;
    const replyQuote = original ? `
      <div class="chat-reply-quote">
        <i class="ti ti-corner-up-left" style="font-size:12px"></i>
        <span>${escHtml(original.message ? original.message : (original.attachment ? 'Photo' : ''))}</span>
      </div>
    ` : '';

    const chips = [];
    if (m.eaReaction) chips.push(`<span class="chat-reaction-chip" title="Reacted"><i class="ti ${REACTION_ICONS[m.eaReaction]}" style="font-size:11px"></i></span>`);
    if (m.adminReaction) chips.push(`<span class="chat-reaction-chip" title="Reacted"><i class="ti ${REACTION_ICONS[m.adminReaction]}" style="font-size:11px"></i></span>`);

    html += `
      <div class="chat-row-wrap ${mine ? 'mine' : 'theirs'}" data-msg-id="${m.id}">
        ${replyQuote}
        <div class="chat-row-inner">
          <div class="chat-row-actions">
            <button type="button" class="chat-action-btn chat-reply-btn" data-id="${m.id}" aria-label="Reply">
              <i class="ti ti-arrow-back-up" style="font-size:15px"></i>
            </button>
            <button type="button" class="chat-action-btn chat-react-btn" data-id="${m.id}" aria-label="React">
              <i class="ti ti-mood-plus" style="font-size:15px"></i>
            </button>
          </div>
          <div class="chat-bubble-col">
            ${m.attachment ? `<img class="chat-attachment-img" src="${m.attachment}" alt="Attachment">` : ''}
            ${m.message ? `<div class="chat-bubble">${escHtml(m.message)}</div>` : ''}
            ${chips.length ? `<div class="chat-reaction-row">${chips.join('')}</div>` : ''}
            <div class="chat-bubble-time">${formatChatTime(m.createdAt)}</div>
          </div>
        </div>
        <div class="chat-reaction-picker hidden" data-picker-for="${m.id}">
          ${REACTION_LIST.map(k => `
            <button type="button" class="chat-reaction-option ${myReactionKey === k ? 'active' : ''}" data-id="${m.id}" data-emoji="${k}" aria-label="${k}">
              <i class="ti ${REACTION_ICONS[k]}" style="font-size:16px"></i>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  });
  return html;
}

// Shared controller for a chat thread — used by both the EA's own
// conversation and each admin conversation thread. Handles loading,
// sending (with attachment/reply), reacting, and the reply-preview bar.
function initChatThread({ scrollId, formId, textareaId, sendBtnId, attachBtnId, fileInputId, previewId, replyBarId, mineSender, listFn, sendFn, reactFn, onLoaded }) {
  let messagesById = {};
  let replyTarget = null;

  function renderReplyBar() {
    const bar = document.getElementById(replyBarId);
    if (!bar) return;
    if (!replyTarget) {
      bar.classList.add('hidden');
      bar.innerHTML = '';
      return;
    }
    bar.classList.remove('hidden');
    bar.innerHTML = `
      <i class="ti ti-corner-up-left" style="font-size:15px"></i>
      <span class="chat-reply-bar-text">${escHtml(replyTarget.preview)}</span>
      <button type="button" class="chat-reply-bar-cancel" aria-label="Cancel reply"><i class="ti ti-x" style="font-size:14px"></i></button>
    `;
    bar.querySelector('.chat-reply-bar-cancel').addEventListener('click', () => {
      replyTarget = null;
      renderReplyBar();
    });
  }

  function wireBubbleActions() {
    const scroll = document.getElementById(scrollId);
    scroll.querySelectorAll('.chat-reply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = messagesById[btn.dataset.id];
        if (!m) return;
        replyTarget = { id: m.id, preview: m.message ? m.message : (m.attachment ? 'Photo' : '') };
        renderReplyBar();
        document.getElementById(textareaId).focus();
      });
    });
    scroll.querySelectorAll('.chat-react-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const picker = scroll.querySelector(`.chat-reaction-picker[data-picker-for="${btn.dataset.id}"]`);
        const wasOpen = !picker.classList.contains('hidden');
        scroll.querySelectorAll('.chat-reaction-picker').forEach(p => p.classList.add('hidden'));
        if (!wasOpen) picker.classList.remove('hidden');
      });
    });
    scroll.querySelectorAll('.chat-reaction-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const emoji = btn.dataset.emoji;
        const current = messagesById[id];
        const already = (mineSender === 'ea' ? current.eaReaction : current.adminReaction) === emoji;
        try {
          await reactFn(id, already ? null : emoji);
          await refresh();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }

  async function refresh() {
    const messages = await listFn();
    messagesById = Object.fromEntries(messages.map(m => [m.id, m]));
    document.getElementById(scrollId).innerHTML = chatBubblesHtml(messages, mineSender, messagesById);
    scrollChatToBottom(scrollId);
    wireBubbleActions();
    if (onLoaded) onLoaded(messages);
    return messages;
  }

  wireChatInput({
    formId, textareaId, sendBtnId, attachBtnId, fileInputId, previewId,
    onSend: async (message, attachment) => {
      const replyToId = replyTarget ? replyTarget.id : null;
      await sendFn(message, attachment, replyToId);
      replyTarget = null;
      renderReplyBar();
      await refresh();
    }
  });

  refresh().catch(err => {
    document.getElementById(scrollId).innerHTML = `<div class="field-error"><i class="ti ti-alert-circle" style="font-size:16px"></i><span>${escHtml(err.message)}</span></div>`;
  });

  return { refresh };
}

function wireChatInput({ formId, textareaId, sendBtnId, attachBtnId, fileInputId, previewId, onSend }) {
  const form = document.getElementById(formId);
  const textarea = document.getElementById(textareaId);
  const attachBtn = document.getElementById(attachBtnId);
  const fileInput = document.getElementById(fileInputId);
  const previewEl = document.getElementById(previewId);
  let pendingAttachment = null;

  const clearAttachment = () => {
    pendingAttachment = null;
    previewEl.innerHTML = '';
    previewEl.classList.add('hidden');
    fileInput.value = '';
  };

  const autoGrow = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };
  textarea.addEventListener('input', autoGrow);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      pendingAttachment = await resizeImageToDataUrl(file, 1024, 0.75);
      previewEl.classList.remove('hidden');
      previewEl.innerHTML = `
        <div class="chat-attach-preview">
          <img src="${pendingAttachment}" alt="">
          <button type="button" class="chat-attach-remove" aria-label="Remove photo"><i class="ti ti-x" style="font-size:14px"></i></button>
        </div>
      `;
      previewEl.querySelector('.chat-attach-remove').addEventListener('click', clearAttachment);
    } catch (err) {
      toast(err.message, 'error');
      clearAttachment();
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const message = textarea.value.trim();
    if (!message && !pendingAttachment) return;
    const btn = document.getElementById(sendBtnId);
    btn.disabled = true;
    textarea.disabled = true;
    try {
      await onSend(message, pendingAttachment);
      textarea.value = '';
      autoGrow();
      clearAttachment();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      textarea.disabled = false;
      textarea.focus();
    }
  });
}

function scrollChatToBottom(scrollId) {
  const el = document.getElementById(scrollId);
  if (el) el.scrollTop = el.scrollHeight;
}

function chatInputBarHtml(formId, textareaId, sendBtnId, attachBtnId, fileInputId, previewId) {
  return `
    <div class="chat-attach-preview-wrap hidden" id="${previewId}"></div>
    <form id="${formId}" class="chat-input-bar" novalidate>
      <button type="button" class="chat-attach-btn" id="${attachBtnId}" aria-label="Attach a photo">
        <i class="ti ti-paperclip" style="font-size:19px"></i>
      </button>
      <input type="file" accept="image/*" id="${fileInputId}" class="hidden">
      <textarea class="input" id="${textareaId}" placeholder="Message…" rows="1"></textarea>
      <button type="submit" class="btn btn-primary chat-send-btn" id="${sendBtnId}" aria-label="Send">
        <i class="ti ti-arrow-up" style="font-size:18px"></i>
      </button>
    </form>
  `;
}

// Same avatar+name header style used for every conversation thread, so the
// EA's own thread and an admin's view of it feel like the same product.
function chatHeaderHtml(name, subtitle, avatar, brand = false) {
  const avatarClass = brand ? 'convo-avatar convo-avatar-brand' : 'convo-avatar';
  return `
    <div class="page-header" style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-6)">
      <div class="${avatarClass}" style="${avatar ? `background-image:url(${avatar})` : ''}">${avatar ? '' : initials(name)}</div>
      <div>
        <h1 class="h1" style="font-size:22px">${escHtml(name)}</h1>
        <p class="text-muted">${escHtml(subtitle)}</p>
      </div>
    </div>
  `;
}

function renderContact() {
  const view = document.querySelector('[data-view="contact"]');
  view.innerHTML = `
    ${chatHeaderHtml('HowardAI Team', 'Hendrik & Tucker', 'favicon.png', true)}
    <div class="card chat-card">
      <div class="chat-scroll" id="contact-chat-scroll">
        <div class="admin-loading"><i class="ti ti-loader-2 spin" style="font-size:18px"></i> Loading…</div>
      </div>
      <div class="chat-reply-bar hidden" id="contact-reply-bar"></div>
      ${chatInputBarHtml('contact-form', 'contact-message', 'contact-send-btn', 'contact-attach-btn', 'contact-file-input', 'contact-attach-preview')}
    </div>
  `;

  initChatThread({
    scrollId: 'contact-chat-scroll',
    formId: 'contact-form',
    textareaId: 'contact-message',
    sendBtnId: 'contact-send-btn',
    attachBtnId: 'contact-attach-btn',
    fileInputId: 'contact-file-input',
    previewId: 'contact-attach-preview',
    replyBarId: 'contact-reply-bar',
    mineSender: 'ea',
    listFn: () => DB.Messages.thread(),
    sendFn: (message, attachment, replyToId) => DB.Messages.send(message, attachment, replyToId),
    reactFn: (id, emoji) => DB.Messages.react(id, emoji),
    onLoaded: () => refreshMessagesBadge()
  });
}

// ─── REPRESENTING HOWARDAI ────────────────────────────────────────────────────

function renderRepresenting() {
  const view = document.querySelector('[data-view="representing"]');
  view.innerHTML = `
    <div class="page-header">
      <h1 class="h1">Representing HowardAI</h1>
    </div>
    <div class="form-section">
      <p class="body mb-6">As an Early Adopter, you may be asked about Howard by people around you. This document outlines what may be shared publicly and how to handle common situations.</p>

      <h3 class="h3 mb-2">General discussion</h3>
      <p class="body text-secondary mb-4">Howard is a locally hosted AI assistant that operates entirely on dedicated hardware, with no cloud dependency. You may describe your own experience using it — what it handles for you, and that you are among its first users.</p>
      <p class="body text-secondary mb-6">Discussion should be limited to direct personal experience. Technical specifications, product roadmap, and any details not personally observed should not be shared. Questions outside this scope should be directed to howardai.us.</p>

      <h3 class="h3 mb-2">Pricing</h3>
      <p class="body text-secondary mb-6">Pricing under the Early Adopter Program is individually set and does not reflect standard pricing. Personal pricing should not be disclosed. Pricing questions should be directed to howardai.us or to HowardAI directly.</p>

      <h3 class="h3 mb-2">Demonstrations and media</h3>
      <p class="body text-secondary mb-6">In-person demonstrations of Howard are permitted. Public posting of photos, video, or screen recordings — including social media, forums, or group messaging intended for wide circulation — is not permitted while HowardAI remains pre-launch.</p>

      <h3 class="h3 mb-2">Referrals</h3>
      <p class="body text-secondary mb-6">Interested parties may be directed to howardai.us, or their information may be passed to HowardAI directly for follow-up.</p>

      <h3 class="h3 mb-2">Press and public inquiries</h3>
      <p class="body text-secondary mb-6">Early Adopters do not speak on behalf of HowardAI in any public or published capacity. Media, blogger, or public-account inquiries should be forwarded to HowardAI directly.</p>

      <h3 class="h3 mb-2">Tone</h3>
      <p class="body text-secondary">Howard is represented plainly and without embellishment, consistent with the brand it represents.</p>
    </div>
  `;
}

// ─── REFER SOMEONE ────────────────────────────────────────────────────────────

function renderRefer() {
  const view = document.querySelector('[data-view="refer"]');
  const link = `https://howardai.us/?ref=${currentEA.referralCode}`;
  const note = `I've been using Howard — a locally hosted AI assistant that runs entirely on its own hardware, no cloud. I'm one of the first people using it, and thought you might want to take a look: ${link}`;

  view.innerHTML = `
    <div class="page-header">
      <h1 class="h1">Refer Someone</h1>
    </div>

    <div class="form-section">
      <p class="field-label mb-2">Your referral link</p>
      <a class="referral-link-box" id="referral-link" href="${link}" target="_blank" rel="noopener">${link}</a>
      <button class="btn btn-secondary btn-sm mt-2" id="copy-link-btn">
        <i class="ti ti-copy" style="font-size:16px"></i> Copy Link
      </button>
    </div>

    <div class="form-section">
      <p class="field-label mb-2">A note you can forward</p>
      <p class="referral-note">${escHtml(note)}</p>
      <button class="btn btn-secondary btn-sm mt-4" id="copy-note-btn">
        <i class="ti ti-copy" style="font-size:16px"></i> Copy Note
      </button>
    </div>
  `;

  document.getElementById('copy-link-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(link).then(() => toast('Link copied.'));
  });
  document.getElementById('copy-note-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(note).then(() => toast('Note copied.'));
  });
}

// ─── CONFIRMATION MODAL ──────────────────────────────────────────────────────
// Reserved for irreversible actions, per the IDL — no dismissible overlay,
// the user must explicitly choose Cancel or the destructive action.

function showConfirmModal({ title, body, confirmLabel, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
      <p class="modal-title" id="modal-title">${escHtml(title)}</p>
      <p class="modal-body">${escHtml(body)}</p>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
        <button class="btn btn-destructive" id="modal-confirm">${escHtml(confirmLabel)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const close = () => {
    overlay.remove();
    document.body.style.overflow = '';
  };
  overlay.querySelector('#modal-cancel').addEventListener('click', close);
  overlay.querySelector('#modal-confirm').addEventListener('click', async () => {
    const btn = overlay.querySelector('#modal-confirm');
    btn.disabled = true;
    btn.textContent = 'Working…';
    try {
      await onConfirm();
      close();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = confirmLabel;
    }
  });
}

// ─── MY PROFILE ──────────────────────────────────────────────────────────────

function renderProfile() {
  const view = document.querySelector('[data-view="profile"]');
  view.innerHTML = `
    <div class="page-header"><h1 class="h1">My Profile</h1></div>

    <div class="form-section">
      <p class="form-section-title">Profile picture</p>
      <div class="profile-avatar-row">
        <div class="profile-avatar-large" id="profile-avatar-preview"></div>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="avatar-upload-btn">
            <i class="ti ti-upload" style="font-size:16px"></i> Upload Photo
          </button>
          ${currentEA.avatar ? '<button class="btn btn-secondary btn-sm" id="avatar-remove-btn">Remove Photo</button>' : ''}
          <input type="file" accept="image/*" id="avatar-file-input" class="hidden">
        </div>
      </div>
      <p class="field-helper">JPG or PNG, resized automatically. Max ~250KB after resizing.</p>
    </div>

    <form id="profile-form" class="form-section" novalidate>
      <p class="form-section-title">Account details</p>
      <div class="field mb-4">
        <label class="field-label" for="profile-name">Name</label>
        <input class="input" type="text" id="profile-name" autocomplete="name" value="${escHtml(currentEA.name)}">
      </div>
      <div class="field">
        <label class="field-label" for="profile-email">Email Address</label>
        <input class="input" type="email" id="profile-email" autocomplete="email" value="${escHtml(currentEA.email)}">
      </div>
      <div id="profile-error" class="field-error hidden mt-4">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="profile-error-text"></span>
      </div>
      <button type="submit" class="btn btn-primary mt-4" id="profile-save-btn">Save Changes</button>
    </form>

    <form id="password-form" class="form-section" novalidate>
      <p class="form-section-title">Change password</p>
      <div class="field mb-4">
        <label class="field-label" for="current-password">Current Password</label>
        <input class="input" type="password" id="current-password" autocomplete="current-password">
      </div>
      <div class="field mb-4">
        <label class="field-label" for="new-password">New Password</label>
        <input class="input" type="password" id="new-password" autocomplete="new-password">
        <p class="field-helper">Must be at least 8 characters.</p>
      </div>
      <div class="field">
        <label class="field-label" for="confirm-password">Confirm New Password</label>
        <input class="input" type="password" id="confirm-password" autocomplete="new-password">
      </div>
      <div id="password-error" class="field-error hidden mt-4">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="password-error-text"></span>
      </div>
      <button type="submit" class="btn btn-primary mt-4" id="password-save-btn">Update Password</button>
    </form>
  `;

  const setAvatarPreview = () => {
    const el = document.getElementById('profile-avatar-preview');
    if (currentEA.avatar) {
      el.style.backgroundImage = `url(${currentEA.avatar})`;
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.textContent = initials(currentEA.name);
    }
  };
  setAvatarPreview();

  document.getElementById('avatar-upload-btn').addEventListener('click', () => {
    document.getElementById('avatar-file-input').click();
  });

  document.getElementById('avatar-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 200);
      currentEA = await DB.Profile.setAvatar(dataUrl);
      updateAvatarDisplay();
      setAvatarPreview();
      renderProfile();
      toast('Profile picture updated.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  document.getElementById('avatar-remove-btn')?.addEventListener('click', async () => {
    try {
      currentEA = await DB.Profile.removeAvatar();
      updateAvatarDisplay();
      renderProfile();
      toast('Profile picture removed.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  document.getElementById('profile-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('profile-error');
    errEl.classList.add('hidden');
    const name = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const btn = document.getElementById('profile-save-btn');
    btn.disabled = true;
    try {
      currentEA = await DB.Profile.update(name, email);
      showView('home');
      toast('Changes saved.');
    } catch (err) {
      document.getElementById('profile-error-text').textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
    }
  });

  document.getElementById('password-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('password-error');
    errEl.classList.add('hidden');
    const current = document.getElementById('current-password').value;
    const next = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;
    if (next !== confirm) {
      document.getElementById('password-error-text').textContent = 'New password and confirmation do not match.';
      errEl.classList.remove('hidden');
      return;
    }
    const btn = document.getElementById('password-save-btn');
    btn.disabled = true;
    try {
      await DB.Profile.changePassword(current, next);
      toast('Password updated.');
      document.getElementById('password-form').reset();
    } catch (err) {
      document.getElementById('password-error-text').textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });
}

function resizeImageToDataUrl(file, maxDimension, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      img.onerror = () => reject(new Error('That file is not a readable image.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

const NOTIF_ICONS = { feedback: 'ti-message-2', bug: 'ti-bug', contact: 'ti-message-circle-2', system: 'ti-bell' };

function renderNotifications() {
  const view = document.querySelector('[data-view="notifications"]');
  withLoading(view, () => DB.Notifications.list(), ({ notifications }) => {
    // A locally-read id always renders as read, even if this fetch's data
    // hasn't caught up to the write yet — see locallyReadNotifIds above.
    notifications = notifications.map(n => locallyReadNotifIds.has(n.id) ? { ...n, readAt: n.readAt || 'local' } : n);
    view.innerHTML = `
      <div class="page-header" style="display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-4)">
        <h1 class="h1">Notifications</h1>
        <div style="display:flex;gap:var(--space-2)">
          ${notifications.some(n => !n.readAt) ? '<button class="btn btn-secondary btn-sm" id="mark-all-read-btn">Mark all read</button>' : ''}
          ${notifications.length ? '<button class="btn btn-secondary btn-sm" id="clear-notifications-btn">Clear All</button>' : ''}
        </div>
      </div>
      ${notifications.length ? `
        <div class="form-section">
          ${notifications.map(n => `
            <div class="notif-item ${n.readAt ? '' : 'unread'}" data-id="${n.id}" data-link="${n.link || ''}">
              <div class="notif-icon"><i class="ti ${NOTIF_ICONS[n.type] || 'ti-bell'}" style="font-size:18px"></i></div>
              <div style="flex:1">
                <p class="body font-bold">${escHtml(n.title)}</p>
                ${n.body ? `<p class="body text-secondary">${escHtml(n.body)}</p>` : ''}
                <p class="text-muted mt-1">${formatDate(n.createdAt)}</p>
              </div>
              ${n.readAt ? '' : '<span class="notif-dot-inline" aria-hidden="true"></span>'}
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="form-section" style="text-align:center;padding:var(--space-12) var(--space-6)">
          <i class="ti ti-bell" style="font-size:48px;color:var(--border-hover)"></i>
          <h3 class="h3 mt-4 mb-2">No notifications yet.</h3>
          <p class="body text-secondary">${currentEA.isAdmin ? "You'll hear about new feedback, bug reports, and messages here." : "We'll let you know when there's something new."}</p>
        </div>
      `}
    `;

    document.getElementById('mark-all-read-btn')?.addEventListener('click', async function() {
      // Optimistic + remembered locally: reflect "all read" immediately, and
      // keep it that way even if a re-fetch shortly after this still returns
      // stale unread data (D1 reads can briefly lag just-committed writes).
      this.remove();
      view.querySelectorAll('.notif-item.unread').forEach(item => {
        item.classList.remove('unread');
        item.querySelector('.notif-dot-inline')?.remove();
        locallyReadNotifIds.add(item.dataset.id);
      });
      setNotifBadgeCount(0);
      try {
        await DB.Notifications.markAllRead();
      } catch (err) {
        toast(err.message, 'error');
        renderNotifications();
      }
    });

    document.getElementById('clear-notifications-btn')?.addEventListener('click', () => {
      showConfirmModal({
        title: 'Clear all notifications?',
        body: 'This removes your notification history. This cannot be undone.',
        confirmLabel: 'Clear All',
        onConfirm: async () => {
          await DB.Notifications.clear();
          setNotifBadgeCount(0);
          renderNotifications();
        }
      });
    });

    view.querySelectorAll('.notif-item.unread').forEach(item => {
      item.addEventListener('click', async () => {
        // Optimistic + remembered locally (see locallyReadNotifIds above) —
        // this item stays "read" even if you navigate away and back before
        // the write has fully propagated.
        item.classList.remove('unread');
        item.querySelector('.notif-dot-inline')?.remove();
        locallyReadNotifIds.add(item.dataset.id);
        setNotifBadgeCount(Math.max(0, currentNotifBadgeCount() - 1));

        const link = item.dataset.link;
        try {
          await DB.Notifications.markRead(item.dataset.id);
        } catch (err) {
          toast(err.message, 'error');
        }
        if (link && link.startsWith('admin-conversation:')) {
          showAdminConversation(link.split(':')[1]);
        } else if (link && document.querySelector(`[data-view="${link}"]`)) {
          showView(link);
        }
      });
    });
  });
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────

function applyReducedMotionSetting() {
  document.documentElement.classList.toggle('force-reduced-motion', !!(currentEA && currentEA.reducedMotion));
}

function renderSettings() {
  const view = document.querySelector('[data-view="settings"]');
  view.innerHTML = `
    <div class="page-header"><h1 class="h1">Settings</h1></div>

    <div class="form-section">
      <p class="form-section-title">Accessibility</p>
      <div class="settings-toggle-row">
        <div>
          <p class="body font-bold">Reduce motion</p>
          <p class="text-muted">Turns off animations and transitions throughout the app, regardless of your device's setting.</p>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="reduced-motion-toggle" ${currentEA.reducedMotion ? 'checked' : ''}>
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>
    </div>

    <div class="form-section">
      <p class="form-section-title">Danger zone</p>
      <div class="settings-toggle-row">
        <div>
          <p class="body font-bold">Delete account</p>
          <p class="text-muted">Permanently removes your account and everything you've submitted. This cannot be undone.</p>
        </div>
        <button class="btn btn-destructive btn-sm" id="delete-account-btn">Delete Account</button>
      </div>
    </div>
  `;

  document.getElementById('reduced-motion-toggle').addEventListener('change', async e => {
    const reducedMotion = e.target.checked;
    document.documentElement.classList.toggle('force-reduced-motion', reducedMotion);
    try {
      currentEA = await DB.Settings.update({ reducedMotion });
      toast(reducedMotion ? 'Motion reduced.' : 'Motion restored.');
    } catch (err) {
      toast(err.message, 'error');
      e.target.checked = !reducedMotion;
      applyReducedMotionSetting();
    }
  });

  document.getElementById('delete-account-btn').addEventListener('click', () => {
    showConfirmModal({
      title: `Delete your account?`,
      body: `This action cannot be undone. Your profile and everything you've submitted — feedback, bug reports, and messages — will be permanently removed.`,
      confirmLabel: 'Delete Account',
      onConfirm: async () => {
        await DB.Settings.deleteAccount();
        DB.Auth.logout();
        currentEA = null;
        document.getElementById('app-shell').classList.remove('is-admin');
        renderLoginView();
        showView('login');
        toast('Your account has been deleted.');
      }
    });
  });
}

// ─── ADMINISTRATOR PLATFORM ─────────────────────────────────────────────────
// Read-only over Early Adopter data — admins view what EAs submit, they don't
// create EA accounts here (that stays a deliberate, off-platform step).

function findLabel(list, value) {
  const match = list.find(o => o.value === value);
  return match ? match.label : (value || '—');
}

function severityBadgeClass(sev) {
  return { blocking: 'badge-red', high: 'badge-orange', medium: 'badge-yellow', low: 'badge-gray' }[sev] || 'badge-gray';
}

function importanceBadgeClass(imp) {
  return { blocking: 'badge-red', important: 'badge-orange', better_experience: 'badge-blue', nice_to_have: 'badge-gray' }[imp] || 'badge-gray';
}

function statusBadgeClass(status) {
  return status === 'installed' ? 'badge-green' : 'badge-gray';
}

async function withLoading(view, loadFn, renderFn) {
  view.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin" style="font-size:20px"></i> Loading…</div>`;
  try {
    const data = await loadFn();
    renderFn(data);
  } catch (err) {
    view.innerHTML = `<div class="field-error"><i class="ti ti-alert-circle" style="font-size:16px"></i><span>${escHtml(err.message)}</span></div>`;
  }
}

function renderAdminOverview() {
  const view = document.querySelector('[data-view="admin-overview"]');
  withLoading(view, () => DB.Admin.overview(), o => {
    const installed = o.installStatusCounts.installed || 0;
    const scheduled = o.installStatusCounts.scheduled || 0;
    view.innerHTML = `
      <div class="page-header">
        <h1 class="h1">Overview</h1>
        <p class="body admin-page-subtitle">A snapshot of every Early Adopter and what they've told us.</p>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <p class="stat-value">${o.totalEarlyAdopters}</p>
          <p class="stat-label">Early Adopters</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">${installed}<span class="stat-value-of"> / ${o.totalEarlyAdopters}</span></p>
          <p class="stat-label">Installed</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">${o.pendingActivation}</p>
          <p class="stat-label">Awaiting Activation</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">${o.feedbackTotal}</p>
          <p class="stat-label">Feedback Submissions</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">${o.bugTotal}</p>
          <p class="stat-label">Bug Reports</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">${o.contactTotal}</p>
          <p class="stat-label">Messages</p>
        </div>
      </div>

      <div class="admin-split">
        <div class="form-section">
          <p class="form-section-title">Bug reports by severity</p>
          <div class="breakdown-list">
            ${SEVERITIES.map(s => `
              <div class="breakdown-row">
                <span class="badge ${severityBadgeClass(s.value)}">${s.label}</span>
                <span class="breakdown-count">${o.bugSeverityCounts[s.value] || 0}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="form-section">
          <p class="form-section-title">Feedback by importance</p>
          <div class="breakdown-list">
            ${IMPORTANCE_LEVELS.map(i => `
              <div class="breakdown-row">
                <span class="badge ${importanceBadgeClass(i.value)}">${i.label}</span>
                <span class="breakdown-count">${o.feedbackImportanceCounts[i.value] || 0}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  });
}

function renderAdminEAs() {
  const view = document.querySelector('[data-view="admin-eas"]');
  withLoading(view, () => DB.Admin.earlyAdopters(), eas => {
    view.innerHTML = `
      <div class="page-header">
        <h1 class="h1">Early Adopters</h1>
        <p class="body admin-page-subtitle">${eas.length} account${eas.length === 1 ? '' : 's'}.</p>
      </div>
      <div class="field mb-4">
        <input class="input" type="text" id="admin-ea-search" placeholder="Search by name or email…">
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Status</th>
              <th>Feedback</th><th>Bugs</th><th>Messages</th><th>Enrolled</th>
            </tr>
          </thead>
          <tbody id="admin-ea-tbody">
            ${eas.map(ea => adminEaRow(ea)).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.admin-table [data-ea-id]').forEach(row => {
      row.addEventListener('click', () => {
        showAdminEADetail(row.dataset.eaId);
      });
    });

    document.getElementById('admin-ea-search').addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      const filtered = eas.filter(ea => ea.name.toLowerCase().includes(q) || ea.email.toLowerCase().includes(q));
      document.getElementById('admin-ea-tbody').innerHTML = filtered.map(ea => adminEaRow(ea)).join('');
      document.querySelectorAll('.admin-table [data-ea-id]').forEach(row => {
        row.addEventListener('click', () => showAdminEADetail(row.dataset.eaId));
      });
    });
  });
}

function adminEaRow(ea) {
  return `
    <tr data-ea-id="${ea.id}" class="admin-table-row">
      <td>${escHtml(ea.name)}</td>
      <td>${escHtml(ea.email)}</td>
      <td>
        <span class="badge ${statusBadgeClass(ea.installStatus)}">${ea.installStatus === 'installed' ? 'Installed' : 'Scheduled'}</span>
        ${ea.pendingActivation ? '<span class="badge badge-yellow ml-1">Pending activation</span>' : ''}
      </td>
      <td>${ea.feedbackCount}</td>
      <td>${ea.bugCount}</td>
      <td>${ea.messageCount}</td>
      <td>${formatDate(ea.createdAt)}</td>
    </tr>
  `;
}

function showAdminEADetail(id) {
  showView('admin-ea-detail');
  renderAdminEADetail(id);
}

function renderAdminEADetail(id) {
  const view = document.querySelector('[data-view="admin-ea-detail"]');
  withLoading(view, () => DB.Admin.earlyAdopter(id), data => {
    const ea = data.earlyAdopter;
    view.innerHTML = `
      <button class="btn btn-secondary btn-sm mb-4" id="admin-back-btn">
        <i class="ti ti-arrow-left" style="font-size:16px"></i> Back to Early Adopters
      </button>

      <div class="page-header">
        <h1 class="h1">${escHtml(ea.name)}</h1>
        <p class="body admin-page-subtitle">${escHtml(ea.email)}</p>
      </div>

      <div class="form-section">
        <p class="form-section-title">Profile</p>
        <div class="admin-kv-grid">
          <div><p class="field-label">Enrolled</p><p class="body">${formatDate(ea.enrollmentDate)}</p></div>
          <div><p class="field-label">Referral source</p><p class="body">${escHtml(ea.referralSource) || '—'}</p></div>
          <div><p class="field-label">Referral code</p><p class="body">${escHtml(ea.referralCode)}</p></div>
          <div><p class="field-label">Account</p><p class="body">${ea.pendingActivation ? 'Awaiting activation' : 'Active'}</p></div>
        </div>
        <div class="field mt-4">
          <label class="field-label">Install status</label>
          <div class="choice-row" id="admin-status-group">
            <button type="button" class="choice-chip ${ea.installStatus === 'scheduled' ? 'active' : ''}" data-value="scheduled"><span>Scheduled</span></button>
            <button type="button" class="choice-chip ${ea.installStatus === 'installed' ? 'active' : ''}" data-value="installed"><span>Installed</span></button>
          </div>
        </div>
      </div>

      <div class="form-section">
        <p class="form-section-title">Feedback (${data.feedback.length})</p>
        ${data.feedback.length ? data.feedback.map(f => `
          <div class="admin-record">
            <div class="admin-record-head">
              <span class="badge ${importanceBadgeClass(f.importance)}">${findLabel(IMPORTANCE_LEVELS, f.importance)}</span>
              <span class="text-muted">${findLabel(FEEDBACK_TYPES, f.feedbackType)}</span>
              <span class="text-muted ml-auto">${formatDate(f.createdAt)}</span>
            </div>
            <p class="body">${escHtml(f.message)}</p>
            ${f.whereEncountered ? `<p class="admin-record-meta">Where: ${escHtml(f.whereEncountered)}</p>` : ''}
            ${f.additionalNotes ? `<p class="admin-record-meta">${escHtml(f.additionalNotes)}</p>` : ''}
          </div>
        `).join('') : '<p class="text-muted">None yet.</p>'}
      </div>

      <div class="form-section">
        <p class="form-section-title">Bug Reports (${data.bugs.length})</p>
        ${data.bugs.length ? data.bugs.map(b => `
          <div class="admin-record">
            <div class="admin-record-head">
              <span class="badge ${severityBadgeClass(b.severity)}">${findLabel(SEVERITIES, b.severity)}</span>
              <span class="text-muted">${findLabel(ISSUE_TYPES, b.issueType)}</span>
              <span class="text-muted ml-auto">${formatDate(b.createdAt)}</span>
            </div>
            <p class="body admin-record-title">${escHtml(b.title)}</p>
            <p class="admin-record-meta">${escHtml(b.whatHappened)}</p>
          </div>
        `).join('') : '<p class="text-muted">None yet.</p>'}
      </div>

      <div class="form-section">
        <p class="form-section-title">Messages (${ea.messageCount ?? 0})</p>
        <button class="btn btn-secondary btn-sm" id="admin-view-conversation-btn">
          <i class="ti ti-message-2" style="font-size:16px"></i> View Conversation
        </button>
      </div>
    `;

    document.getElementById('admin-view-conversation-btn').addEventListener('click', () => showAdminConversation(ea.id));
    document.getElementById('admin-back-btn').addEventListener('click', () => showView('admin-eas'));
    document.getElementById('admin-status-group').querySelectorAll('.choice-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        document.getElementById('admin-status-group').querySelectorAll('.choice-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        try {
          await DB.Admin.setInstallStatus(id, chip.dataset.value);
          toast('Install status updated.');
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  });
}

function renderAdminFeedback() {
  const view = document.querySelector('[data-view="admin-feedback"]');
  withLoading(view, () => DB.Admin.feedback(), items => {
    view.innerHTML = `
      <div class="page-header">
        <h1 class="h1">Feedback</h1>
        <p class="body admin-page-subtitle">${items.length} submission${items.length === 1 ? '' : 's'}, most recent first.</p>
      </div>
      ${items.length ? items.map(f => `
        <div class="admin-record admin-record-link" data-ea-id="${f.eaId}">
          <div class="admin-record-head">
            <span class="badge ${importanceBadgeClass(f.importance)}">${findLabel(IMPORTANCE_LEVELS, f.importance)}</span>
            <span class="text-muted">${findLabel(FEEDBACK_TYPES, f.feedbackType)}</span>
            <span class="text-muted ml-auto">${formatDate(f.createdAt)}</span>
          </div>
          <p class="body">${escHtml(f.message)}</p>
          ${f.whereEncountered ? `<p class="admin-record-meta">Where: ${escHtml(f.whereEncountered)}</p>` : ''}
          <p class="admin-record-meta">${escHtml(f.eaName)} · ${escHtml(f.eaEmail)}</p>
        </div>
      `).join('') : '<p class="text-muted">No feedback yet.</p>'}
    `;
    view.querySelectorAll('[data-ea-id]').forEach(el => el.addEventListener('click', () => showAdminEADetail(el.dataset.eaId)));
  });
}

function renderAdminBugs() {
  const view = document.querySelector('[data-view="admin-bugs"]');
  withLoading(view, () => DB.Admin.bugs(), items => {
    view.innerHTML = `
      <div class="page-header">
        <h1 class="h1">Bug Reports</h1>
        <p class="body admin-page-subtitle">${items.length} report${items.length === 1 ? '' : 's'}, most recent first.</p>
      </div>
      ${items.length ? items.map(b => `
        <div class="admin-record admin-record-link" data-ea-id="${b.eaId}">
          <div class="admin-record-head">
            <span class="badge ${severityBadgeClass(b.severity)}">${findLabel(SEVERITIES, b.severity)}</span>
            <span class="text-muted">${findLabel(ISSUE_TYPES, b.issueType)}</span>
            <span class="text-muted ml-auto">${formatDate(b.createdAt)}</span>
          </div>
          <p class="body admin-record-title">${escHtml(b.title)}</p>
          <p class="admin-record-meta">${escHtml(b.whatHappened)}</p>
          <p class="admin-record-meta">${escHtml(b.eaName)} · ${escHtml(b.eaEmail)}</p>
        </div>
      `).join('') : '<p class="text-muted">No bug reports yet.</p>'}
    `;
    view.querySelectorAll('[data-ea-id]').forEach(el => el.addEventListener('click', () => showAdminEADetail(el.dataset.eaId)));
  });
}

function renderAdminContact() {
  const view = document.querySelector('[data-view="admin-contact"]');
  withLoading(view, () => DB.Admin.conversations(), conversations => {
    view.innerHTML = `
      <div class="page-header">
        <h1 class="h1">Messages</h1>
        <p class="body admin-page-subtitle">${conversations.length} conversation${conversations.length === 1 ? '' : 's'}.</p>
      </div>
      ${conversations.length ? `
        <div class="form-section">
          ${conversations.map(c => `
            <div class="convo-item ${c.unreadCount ? 'unread' : ''}" data-ea-id="${c.eaId}">
              <div class="convo-avatar" style="${c.eaAvatar ? `background-image:url(${c.eaAvatar})` : ''}">${c.eaAvatar ? '' : initials(c.eaName)}</div>
              <div class="convo-preview">
                <div class="convo-name-row">
                  <span class="convo-name">${escHtml(c.eaName)}</span>
                  <span class="convo-time">${formatDate(c.lastAt)}</span>
                </div>
                <p class="convo-snippet">${c.lastSender === 'admin' ? 'You: ' : ''}${escHtml(c.lastMessage)}</p>
              </div>
              ${c.unreadCount ? `<span class="convo-unread-badge">${c.unreadCount}</span>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="form-section" style="text-align:center;padding:var(--space-12) var(--space-6)">
          <i class="ti ti-message-2" style="font-size:48px;color:var(--border-hover)"></i>
          <h3 class="h3 mt-4 mb-2">No conversations yet.</h3>
          <p class="body text-secondary">Messages from Early Adopters will show up here.</p>
        </div>
      `}
    `;
    view.querySelectorAll('.convo-item').forEach(el => {
      el.addEventListener('click', () => showAdminConversation(el.dataset.eaId));
    });
  });
}

function showAdminConversation(eaId) {
  showView('admin-conversation');
  renderAdminConversation(eaId);
}

function renderAdminConversation(eaId) {
  const view = document.querySelector('[data-view="admin-conversation"]');
  view.innerHTML = `<div class="admin-loading"><i class="ti ti-loader-2 spin" style="font-size:18px"></i> Loading…</div>`;

  DB.Admin.conversation(eaId).then(({ earlyAdopter, messages }) => {
    view.innerHTML = `
      <div class="mb-4" style="display:flex;justify-content:space-between;align-items:center">
        <button class="btn btn-secondary btn-sm" id="admin-convo-back-btn">
          <i class="ti ti-arrow-left" style="font-size:16px"></i> Back to Messages
        </button>
        ${messages.length ? `
          <button class="btn btn-secondary btn-sm" id="admin-clear-chat-btn">
            <i class="ti ti-trash" style="font-size:16px"></i> Clear Chat
          </button>
        ` : ''}
      </div>
      ${chatHeaderHtml(earlyAdopter.name, earlyAdopter.email, earlyAdopter.avatar)}
      <div class="card chat-card">
        <div class="chat-scroll" id="admin-chat-scroll"></div>
        <div class="chat-reply-bar hidden" id="admin-reply-bar"></div>
        ${chatInputBarHtml('admin-reply-form', 'admin-reply-message', 'admin-reply-send-btn', 'admin-reply-attach-btn', 'admin-reply-file-input', 'admin-reply-attach-preview')}
      </div>
    `;

    document.getElementById('admin-convo-back-btn').addEventListener('click', () => showView('admin-contact'));

    document.getElementById('admin-clear-chat-btn')?.addEventListener('click', () => {
      showConfirmModal({
        title: `Clear chat with ${earlyAdopter.name}?`,
        body: 'This permanently deletes every message in this conversation for both sides. This cannot be undone.',
        confirmLabel: 'Clear Chat',
        onConfirm: async () => {
          await DB.Admin.clearConversation(eaId);
          renderAdminConversation(eaId);
        }
      });
    });

    initChatThread({
      scrollId: 'admin-chat-scroll',
      formId: 'admin-reply-form',
      textareaId: 'admin-reply-message',
      sendBtnId: 'admin-reply-send-btn',
      attachBtnId: 'admin-reply-attach-btn',
      fileInputId: 'admin-reply-file-input',
      previewId: 'admin-reply-attach-preview',
      replyBarId: 'admin-reply-bar',
      mineSender: 'admin',
      listFn: () => DB.Admin.conversation(eaId).then(r => r.messages),
      sendFn: (message, attachment, replyToId) => DB.Admin.reply(eaId, message, attachment, replyToId),
      reactFn: (id, emoji) => DB.Admin.react(eaId, id, emoji),
      onLoaded: () => refreshMessagesBadge()
    });
  }).catch(err => {
    view.innerHTML = `<div class="field-error"><i class="ti ti-alert-circle" style="font-size:16px"></i><span>${escHtml(err.message)}</span></div>`;
  });
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────

function closeMobileNav() {
  document.getElementById('app-shell').classList.remove('nav-open');
  const toggle = document.getElementById('app-nav-toggle');
  toggle.innerHTML = '<i class="ti ti-menu-2" style="font-size:20px"></i>';
  toggle.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  closeResourcesDropdown();
  document.querySelectorAll('.app-avatar-wrap.open').forEach(wrap => {
    wrap.classList.remove('open');
    wrap.querySelector('.app-avatar-trigger')?.setAttribute('aria-expanded', 'false');
  });
}

function closeResourcesDropdown() {
  const wrap = document.getElementById('resources-dropdown-wrap');
  if (!wrap) return;
  wrap.classList.remove('open');
  document.getElementById('resources-trigger')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.app-nav-link[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.target);
      closeMobileNav();
    });
  });

  document.getElementById('resources-trigger')?.addEventListener('click', e => {
    e.stopPropagation();
    const wrap = document.getElementById('resources-dropdown-wrap');
    const open = wrap.classList.toggle('open');
    document.getElementById('resources-trigger').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    const wrap = document.getElementById('resources-dropdown-wrap');
    if (wrap && wrap.classList.contains('open') && !wrap.contains(e.target)) closeResourcesDropdown();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeResourcesDropdown();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.chat-react-btn') && !e.target.closest('.chat-reaction-picker')) {
      document.querySelectorAll('.chat-reaction-picker').forEach(p => p.classList.add('hidden'));
    }
  });

  document.querySelectorAll('.app-avatar-trigger').forEach(trigger => {
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      const wrap = trigger.closest('.app-avatar-wrap');
      const open = wrap.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', e => {
    document.querySelectorAll('.app-avatar-wrap.open').forEach(wrap => {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove('open');
        wrap.querySelector('.app-avatar-trigger')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.app-avatar-wrap.open').forEach(wrap => {
        wrap.classList.remove('open');
        wrap.querySelector('.app-avatar-trigger')?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  document.getElementById('app-nav-toggle')?.addEventListener('click', () => {
    const shell = document.getElementById('app-shell');
    const open = shell.classList.toggle('nav-open');
    const toggle = document.getElementById('app-nav-toggle');
    toggle.innerHTML = `<i class="ti ${open ? 'ti-x' : 'ti-menu-2'}" style="font-size:20px"></i>`;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  document.querySelectorAll('.app-nav-close').forEach(btn => {
    btn.addEventListener('click', closeMobileNav);
  });

  const signOut = async () => {
    closeMobileNav();
    await DB.Auth.logout();
    currentEA = null;
    document.getElementById('app-shell').classList.remove('is-admin');
    renderLoginView();
    showView('login');
  };
  document.getElementById('btn-signout')?.addEventListener('click', signOut);
  document.getElementById('btn-signout-admin')?.addEventListener('click', signOut);

  init();
});
