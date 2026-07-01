'use strict';

// ─── VIEW ROUTER ─────────────────────────────────────────────────────────────

let currentView = null;
let currentUser = null;

function showView(name, params = {}) {
  document.querySelectorAll('[data-view]').forEach(el => el.classList.add('hidden'));
  const el = document.querySelector(`[data-view="${name}"]`);
  if (el) el.classList.remove('hidden');
  currentView = name;

  const nav = document.getElementById('bt-nav');
  if (name === 'login' || name === 'first-login') {
    nav.classList.add('hidden');
  } else {
    nav.classList.remove('hidden');
  }

  // Highlight active nav link
  document.querySelectorAll('.bt-nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.target === name);
  });

  if (name === 'submit')          renderSubmitForm();
  if (name === 'my-submissions')  renderMySubmissions();
  if (name === 'submission-detail') renderSubmissionDetail(params.id);
  if (name === 'confirm')          renderConfirm();
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function toast(message, type = 'success') {
  const icons = { success: 'ti-circle-check', error: 'ti-circle-x', info: 'ti-info-circle' };
  const colors = { success: '#34C759', error: '#FF3B30', info: '#0EA5E9' };
  const container = document.getElementById('toast-container');

  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<i class="ti ${icons[type] || icons.info}" style="color:${colors[type]};flex-shrink:0"></i>
    <span class="toast-message">${message}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 4000);
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

function init() {
  DB.seed();
  currentUser = DB.Auth.currentUser();

  if (currentUser) {
    if (currentUser.role !== 'bt') {
      DB.Auth.logout();
      currentUser = null;
    }
  }

  if (!currentUser) {
    renderLoginView();
    showView('login');
  } else {
    showView('submit');
  }
}

function renderLoginView() {
  const view = document.querySelector('[data-view="login"]');
  view.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <img src="Squawk-logo.png" alt="Squawk">
        </div>
        <h3 class="login-title">Welcome back</h3>
        <p class="login-subtitle">Sign in to submit feedback.</p>
        <form class="login-form" id="login-form" novalidate>
          <div class="field">
            <label class="field-label" for="login-email">Email address</label>
            <input class="input" type="email" id="login-email" autocomplete="email" placeholder="your@email.com" required>
          </div>
          <div class="field" id="password-field">
            <label class="field-label" for="login-password">Password</label>
            <input class="input" type="password" id="login-password" autocomplete="current-password" placeholder="••••••••" required>
          </div>
          <div class="field hidden" id="otp-field">
            <label class="field-label" for="login-otp">One-time code <span class="field-required">Required</span></label>
            <input class="input" type="text" id="login-otp" autocomplete="one-time-code" placeholder="123456" maxlength="6">
            <p class="field-helper">Enter the code provided by your Howard AI contact.</p>
          </div>
          <div class="field hidden" id="new-password-field">
            <label class="field-label" for="login-new-password">Set your password <span class="field-required">Required</span></label>
            <input class="input" type="password" id="login-new-password" autocomplete="new-password" placeholder="At least 8 characters">
            <p class="field-helper">Choose a password you'll use to sign in from now on.</p>
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

  const emailInput = document.getElementById('login-email');
  const form = document.getElementById('login-form');
  let isFirstLogin = false;

  emailInput.addEventListener('blur', () => {
    const email = emailInput.value.trim();
    if (!email) return;
    const pending = DB.Auth.checkFirstLogin(email);
    isFirstLogin  = !!pending;

    document.getElementById('password-field').classList.toggle('hidden', isFirstLogin);
    document.getElementById('otp-field').classList.toggle('hidden', !isFirstLogin);
    document.getElementById('new-password-field').classList.toggle('hidden', !isFirstLogin);
    document.getElementById('login-btn').textContent = isFirstLogin ? 'Set Password & Sign In' : 'Sign In';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearLoginError();
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      if (isFirstLogin) {
        const otp  = document.getElementById('login-otp').value.trim();
        const pass = document.getElementById('login-new-password').value;
        if (!otp || !pass) { showLoginError('Please enter your code and set a password.'); return; }
        if (pass.length < 8) { showLoginError('Password must be at least 8 characters.'); return; }
        const user = DB.Auth.firstLogin(emailInput.value.trim(), otp, pass);
        if (!user) { showLoginError('That code is incorrect. Check with your Howard AI contact.'); return; }
        currentUser = user;
      } else {
        const pass = document.getElementById('login-password').value;
        const user = DB.Auth.login(emailInput.value.trim(), pass);
        if (!user) { showLoginError('Email or password is incorrect.'); return; }
        if (user.role === 'admin') { window.location.href = 'admin.html'; return; }
        if (user.role !== 'bt') { showLoginError('Email or password is incorrect.'); return; }
        currentUser = user;
      }
      showView('submit');
    } finally {
      btn.disabled = false;
      btn.textContent = isFirstLogin ? 'Set Password & Sign In' : 'Sign In';
    }
  });
}

function showLoginError(msg) {
  const err = document.getElementById('login-error');
  document.getElementById('login-error-text').textContent = msg;
  err.classList.remove('hidden');
  const btn = document.getElementById('login-btn');
  btn.disabled = false;
  btn.textContent = 'Sign In';
}

function clearLoginError() {
  document.getElementById('login-error')?.classList.add('hidden');
}

// ─── SUBMIT FORM ──────────────────────────────────────────────────────────────

let attachmentData = null;

function renderSubmitForm() {
  attachmentData = null;
  const view = document.querySelector('[data-view="submit"]');

  const catOptions  = Object.entries(DB.CATEGORIES)
    .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  const ifaceOptions = Object.entries(DB.INTERFACES)
    .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  const sevOptions  = Object.entries(DB.SEVERITIES)
    .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  view.innerHTML = `
    <h2 class="h2 mb-6">Submit Feedback</h2>
    <form class="submission-form" id="submit-form" novalidate>
      <div class="form-row">
        <div class="field">
          <label class="field-label" for="sub-category">Category <span class="field-required">Required</span></label>
          <div class="select-wrapper">
            <select class="input" id="sub-category" required>
              <option value="">Select a category</option>
              ${catOptions}
            </select>
            <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="sub-subcategory">Subcategory <span class="field-required">Required</span></label>
          <div class="select-wrapper">
            <select class="input" id="sub-subcategory" required disabled>
              <option value="">Select a category first</option>
            </select>
            <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label class="field-label" for="sub-interface">Interface <span class="field-required">Required</span></label>
          <div class="select-wrapper">
            <select class="input" id="sub-interface" required>
              <option value="">Select interface</option>
              ${ifaceOptions}
            </select>
            <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="sub-severity">Severity <span class="field-required">Required</span></label>
          <div class="select-wrapper">
            <select class="input" id="sub-severity" required>
              <option value="">How severe is this?</option>
              ${sevOptions}
            </select>
            <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
          </div>
        </div>
      </div>
      <div class="field">
        <label class="field-label" for="sub-message">Your feedback <span class="field-required">Required</span></label>
        <textarea class="input" id="sub-message" placeholder="Describe what happened, what you expected, or what you'd like to see improved..." required></textarea>
      </div>
      <div class="field">
        <label class="field-label">Attachment <span style="color:var(--text-placeholder);font-size:13px;margin-left:4px">Optional</span></label>
        <div class="file-drop" id="file-drop" tabindex="0" role="button" aria-label="Attach a screenshot or photo">
          <input type="file" id="file-input" accept="image/*,.png,.jpg,.jpeg,.gif,.webp">
          <i class="ti ti-photo-up" style="font-size:24px;color:var(--text-placeholder);margin-bottom:8px"></i>
          <p class="caption text-placeholder">Click to attach a screenshot or photo</p>
          <p class="caption text-placeholder" id="file-name" style="margin-top:4px"></p>
        </div>
      </div>
      <div id="submit-error" class="alert alert-error hidden">
        <span class="alert-icon"><i class="ti ti-circle-x" style="color:var(--error);font-size:20px"></i></span>
        <div class="alert-body">
          <p class="alert-message" id="submit-error-text"></p>
        </div>
      </div>
      <div>
        <button type="submit" class="btn btn-primary" id="submit-btn">Submit Feedback</button>
      </div>
    </form>
  `;

  // Category → subcategory cascade
  const catSel = document.getElementById('sub-category');
  const subSel = document.getElementById('sub-subcategory');

  catSel.addEventListener('change', () => {
    const cat  = catSel.value;
    const subs = DB.CATEGORIES[cat]?.subcategories || {};
    subSel.innerHTML = `<option value="">Select a subcategory</option>` +
      Object.entries(subs).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
    subSel.disabled = !cat;
  });

  // File attachment
  const fileDrop  = document.getElementById('file-drop');
  const fileInput = document.getElementById('file-input');

  fileDrop.addEventListener('click', () => fileInput.click());
  fileDrop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('File must be under 5MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      attachmentData = { name: file.name, type: file.type, dataUrl: ev.target.result };
      document.getElementById('file-name').textContent = file.name;
      fileDrop.classList.add('has-file');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('submit-form').addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  const errEl   = document.getElementById('submit-error');
  const errText = document.getElementById('submit-error-text');
  errEl.classList.add('hidden');

  const category    = document.getElementById('sub-category').value;
  const subcategory = document.getElementById('sub-subcategory').value;
  const iface       = document.getElementById('sub-interface').value;
  const severity    = document.getElementById('sub-severity').value;
  const message     = document.getElementById('sub-message').value.trim();

  if (!category || !subcategory || !iface || !severity || !message) {
    errText.textContent = 'Please complete all required fields before submitting.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    DB.Submissions.create({
      btId: currentUser.id,
      category, subcategory,
      interface: iface,
      severity, message,
      attachmentData
    });
    showView('confirm');
  } catch (err) {
    errText.textContent = 'Something went wrong. Try again.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Submit Feedback';
  }
}

// ─── CONFIRM ──────────────────────────────────────────────────────────────────

function renderConfirm() {
  const view = document.querySelector('[data-view="confirm"]');
  view.innerHTML = `
    <div class="confirm-page">
      <div class="confirm-icon">
        <i class="ti ti-circle-check" style="font-size:36px"></i>
      </div>
      <h2 class="h2">Feedback received.</h2>
      <p class="body text-secondary" style="max-width:420px">Your submission has been logged. The Howard AI team reviews all feedback — if follow-up is needed, they'll reach out directly.</p>
      <div class="flex gap-3 mt-6">
        <button class="btn btn-secondary" onclick="showView('submit')">Submit another</button>
        <button class="btn btn-primary" onclick="showView('my-submissions')">View my submissions</button>
      </div>
    </div>
  `;
}

// ─── MY SUBMISSIONS ───────────────────────────────────────────────────────────

function renderMySubmissions() {
  const view = document.querySelector('[data-view="my-submissions"]');
  const subs = DB.Submissions.getByBT(currentUser.id)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  if (subs.length === 0) {
    view.innerHTML = `
      <h2 class="h2 mb-6">My Submissions</h2>
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ti ti-message-circle" style="font-size:48px"></i></div>
        <p class="empty-state-title">No submissions yet.</p>
        <p class="empty-state-body">Your feedback submissions will appear here after you send them in.</p>
        <button class="btn btn-primary" onclick="showView('submit')">Submit Feedback</button>
      </div>
    `;
    return;
  }

  const items = subs.map(s => {
    const catLabel = DB.CATEGORIES[s.category]?.label || s.category;
    const subLabel = DB.CATEGORIES[s.category]?.subcategories[s.subcategory] || s.subcategory;
    const date     = formatDate(s.submittedAt);
    return `
      <div class="submission-item" onclick="showView('submission-detail', { id: '${s.id}' })" tabindex="0"
           role="button" aria-label="${catLabel} — ${subLabel}, ${date}"
           onkeydown="if(event.key==='Enter')showView('submission-detail',{id:'${s.id}'})">
        <div class="submission-item-info">
          <p class="submission-item-title">${catLabel} — ${subLabel}</p>
          <p class="submission-item-meta">${date} · ${DB.INTERFACES[s.interface] || s.interface} · ${DB.SEVERITIES[s.severity] || s.severity} severity</p>
        </div>
        <span class="submission-item-arrow"><i class="ti ti-chevron-right" style="font-size:20px"></i></span>
      </div>
    `;
  }).join('');

  view.innerHTML = `
    <h2 class="h2 mb-6">My Submissions</h2>
    <p class="body text-secondary mb-6">A record of everything you've submitted. This view shows only your original submissions — no internal status or notes.</p>
    ${items}
  `;
}

// ─── SUBMISSION DETAIL ────────────────────────────────────────────────────────

function renderSubmissionDetail(id) {
  const view = document.querySelector('[data-view="submission-detail"]');
  const sub  = DB.Submissions.getById(id);

  if (!sub || sub.btId !== currentUser.id) {
    view.innerHTML = `<div class="empty-state"><p class="empty-state-title">Submission not found.</p></div>`;
    return;
  }

  const catLabel = DB.CATEGORIES[sub.category]?.label || sub.category;
  const subLabel = DB.CATEGORIES[sub.category]?.subcategories[sub.subcategory] || sub.subcategory;

  view.innerHTML = `
    <button class="back-btn" onclick="showView('my-submissions')">
      <i class="ti ti-arrow-left" style="font-size:16px"></i> Back to My Submissions
    </button>
    <h2 class="h2 mb-2">${catLabel}</h2>
    <p class="body text-secondary mb-8">${subLabel}</p>

    <div class="card" style="max-width:640px">
      <div class="ticket-meta-grid" style="margin-bottom:var(--space-6)">
        <div class="ticket-meta-item">
          <p class="ticket-meta-label">Submitted</p>
          <p class="ticket-meta-value">${formatDate(sub.submittedAt)}</p>
        </div>
        <div class="ticket-meta-item">
          <p class="ticket-meta-label">Interface</p>
          <p class="ticket-meta-value">${DB.INTERFACES[sub.interface] || sub.interface}</p>
        </div>
        <div class="ticket-meta-item">
          <p class="ticket-meta-label">Severity</p>
          <p class="ticket-meta-value">${DB.SEVERITIES[sub.severity] || sub.severity}</p>
        </div>
      </div>
      <hr class="divider" style="margin-bottom:var(--space-6)">
      <h4 class="h4 mb-4">Your message</h4>
      <p class="body" style="white-space:pre-wrap;color:var(--text-secondary)">${escHtml(sub.message)}</p>
      ${sub.attachmentData ? `
        <hr class="divider" style="margin:var(--space-6) 0">
        <h4 class="h4 mb-4">Attachment</h4>
        <img src="${sub.attachmentData.dataUrl}" alt="${escHtml(sub.attachmentData.name)}"
          style="max-width:100%;border-radius:var(--radius-md);border:1px solid var(--border)">
      ` : ''}
    </div>
  `;
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Nav link clicks
  document.querySelectorAll('.bt-nav-links a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      if (!currentUser) return;
      showView(a.dataset.target);
    });
  });

  // Sign out
  document.getElementById('btn-signout')?.addEventListener('click', () => {
    DB.Auth.logout();
    currentUser = null;
    renderLoginView();
    showView('login');
  });

  init();
});
