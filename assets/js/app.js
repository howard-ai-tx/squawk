'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────

let currentEA = null;

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
    a.classList.toggle('active', a.dataset.target === name);
  });

  if (name === 'home')          renderHome();
  if (name === 'feedback')      renderFeedback();
  if (name === 'bug')           renderBug();
  if (name === 'contact')       renderContact();
  if (name === 'representing')  renderRepresenting();
  if (name === 'refer')         renderRefer();
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
    showView('home');
  }
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
      showView('home');
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

function renderHome() {
  const view = document.querySelector('[data-view="home"]');
  const label = currentEA.installStatus === 'installed' ? 'Installed' : 'Scheduled';
  view.innerHTML = `
    <div class="page-header">
      <p class="page-eyebrow">Welcome back</p>
      <h1 class="h1">${escHtml(currentEA.name.split(' ')[0])}</h1>
    </div>
    <div class="card">
      <p class="field-label mb-2">Install status</p>
      <span class="status-pill ${currentEA.installStatus === 'installed' ? 'is-installed' : 'is-scheduled'}">
        <span class="status-dot"></span> ${label}
      </span>
    </div>
  `;
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

// ─── CONTACT US ───────────────────────────────────────────────────────────────

function renderContact() {
  const view = document.querySelector('[data-view="contact"]');
  view.innerHTML = `
    <div class="page-header">
      <h1 class="h1 mb-2">Contact Us</h1>
      <p class="body text-secondary">This goes directly to Hendrik and Tucker.</p>
    </div>
    <form id="contact-form" novalidate>
      <div class="form-section">
        <div class="field">
          <label class="field-label" for="contact-message">Message</label>
          <textarea class="input" id="contact-message"></textarea>
        </div>
      </div>
      <div id="contact-error" class="field-error hidden mb-4">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="contact-error-text"></span>
      </div>
      <button type="submit" class="btn btn-primary" id="contact-btn">Send</button>
    </form>
  `;

  document.getElementById('contact-form').addEventListener('submit', async e => {
    e.preventDefault();
    const message = document.getElementById('contact-message').value.trim();
    const errEl = document.getElementById('contact-error');
    errEl.classList.add('hidden');
    if (!message) {
      document.getElementById('contact-error-text').textContent = 'Please enter a message.';
      errEl.classList.remove('hidden');
      return;
    }
    const btn = document.getElementById('contact-btn');
    btn.disabled = true;
    try {
      await DB.Contact.send(message);
      toast('Message sent.');
      document.getElementById('contact-message').value = '';
    } catch (err) {
      document.getElementById('contact-error-text').textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── REPRESENTING HOWARDAI ────────────────────────────────────────────────────

function renderRepresenting() {
  const view = document.querySelector('[data-view="representing"]');
  const acked = !!currentEA.representingAckAt;
  view.innerHTML = `
    <div class="page-header">
      <h1 class="h1">Representing HowardAI</h1>
    </div>
    <div class="form-section">
      <p class="body mb-6">As an Early Adopter, you may be asked about Howard by people around you. This page outlines what to share and how.</p>

      <h3 class="h3 mb-2">What you may discuss</h3>
      <p class="body text-secondary mb-6">Howard is a locally hosted AI assistant that operates entirely on dedicated hardware, with no cloud dependency. You may describe your own experience using it — what it handles for you, and that you are among its first users.</p>

      <h3 class="h3 mb-2">What to avoid</h3>
      <p class="body text-secondary mb-6">Do not speak to anything beyond your own direct experience. Technical specifics, product roadmap, or details you have not personally observed should not be discussed. If a question falls outside what you know, direct the person to howardai.us rather than speculating.</p>

      <h3 class="h3 mb-2">Tone</h3>
      <p class="body text-secondary">Represent Howard the way it represents itself: plainly, and without embellishment. Understatement carries more weight than enthusiasm.</p>
    </div>

    <button class="btn ${acked ? 'btn-secondary' : 'btn-primary'}" id="ack-btn" ${acked ? 'disabled' : ''}>
      ${acked ? `Acknowledged on ${formatDate(currentEA.representingAckAt)}` : "I've read this"}
    </button>
  `;

  document.getElementById('ack-btn').addEventListener('click', async () => {
    currentEA = await DB.Representing.acknowledge();
    toast('Acknowledged.');
    renderRepresenting();
  });
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
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.app-nav-link[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.target);
      closeMobileNav();
    });
  });

  document.getElementById('app-nav-toggle')?.addEventListener('click', () => {
    const shell = document.getElementById('app-shell');
    const open = shell.classList.toggle('nav-open');
    const toggle = document.getElementById('app-nav-toggle');
    toggle.innerHTML = `<i class="ti ${open ? 'ti-x' : 'ti-menu-2'}" style="font-size:20px"></i>`;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    closeMobileNav();
    await DB.Auth.logout();
    currentEA = null;
    renderLoginView();
    showView('login');
  });

  init();
});
