'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────

let currentView = null;
let currentUser = null;
let attachmentData = null;
let selectedTopic  = null; // { category, subcategory }
let editingDraftId = null;
let modalCloseCallback = null;

// ─── VIEW ROUTER ─────────────────────────────────────────────────────────────

function showView(name, params = {}) {
  document.querySelectorAll('[data-view]').forEach(el => el.classList.add('hidden'));
  const el = document.querySelector(`[data-view="${name}"]`);
  if (el) el.classList.remove('hidden');
  currentView = name;

  const shell = document.getElementById('bt-authenticated');
  if (name === 'login' || name === 'first-login') {
    shell.classList.add('hidden');
  } else {
    shell.classList.remove('hidden');
    closeSidebar();
  }

  document.querySelectorAll('.bt-nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.target === name);
  });

  if (name === 'dashboard')          renderDashboard();
  if (name === 'new')                renderNewSubmission(params.draftId || null);
  if (name === 'drafts')             renderDrafts();
  if (name === 'submitted')          renderSubmitted();
  if (name === 'submission-detail')  renderSubmissionDetail(params.id);
  if (name === 'messages')           renderMessages();
  if (name === 'news')               renderNews();
  if (name === 'settings')           renderSettings();
}

// ─── SIDEBAR (mobile) ────────────────────────────────────────────────────────

function openSidebar()  { document.getElementById('bt-authenticated').classList.add('sidebar-open'); }
function closeSidebar() { document.getElementById('bt-authenticated').classList.remove('sidebar-open'); }

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

// ─── MODAL ────────────────────────────────────────────────────────────────────

function openModal({ title, body, footer, onClose, noDismiss = false }) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal-overlay';
  overlay.innerHTML = `
    <div class="modal" id="active-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title">${title}</h3>
        ${noDismiss ? '' : `<button class="btn-icon" id="modal-close-btn" aria-label="Close modal"><i class="ti ti-x" style="font-size:20px"></i></button>`}
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">${footer}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  modalCloseCallback = onClose;
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  if (!noDismiss) {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  }
  document.addEventListener('keydown', escListener);
}

function escListener(e) { if (e.key === 'Escape') closeModal(); }

function closeModal() {
  const overlay = document.getElementById('active-modal-overlay');
  if (!overlay) return;
  overlay.classList.add('closing');
  overlay.addEventListener('animationend', () => {
    overlay.remove();
    document.removeEventListener('keydown', escListener);
    if (modalCloseCallback) { modalCloseCallback(); modalCloseCallback = null; }
  }, { once: true });
}

function confirmModal(title, message, confirmLabel = 'Confirm') {
  return new Promise(resolve => {
    openModal({
      title,
      body: `<p class="body">${message}</p>`,
      footer: `<button class="btn btn-secondary" id="cm-cancel">Cancel</button>
               <button class="btn btn-primary" id="cm-confirm">${confirmLabel}</button>`,
      onClose: () => resolve(false)
    });
    document.getElementById('cm-confirm').addEventListener('click', () => { modalCloseCallback = () => resolve(true); closeModal(); });
    document.getElementById('cm-cancel').addEventListener('click', () => closeModal());
  });
}

// IDL confirmation modal (7c.iii): used exclusively before destructive actions.
// No close button, no overlay dismissal — the user must choose Cancel or the
// named destructive action.
function confirmDestructive(title, message, destructiveLabel) {
  return new Promise(resolve => {
    openModal({
      title,
      body: `<p class="body">${message}</p>`,
      footer: `<button class="btn btn-secondary" id="cd-cancel">Cancel</button>
               <button class="btn btn-destructive" id="cd-confirm">${destructiveLabel}</button>`,
      onClose: () => resolve(false),
      noDismiss: true
    });
    document.getElementById('cd-confirm').addEventListener('click', () => { modalCloseCallback = () => resolve(true); closeModal(); });
    document.getElementById('cd-cancel').addEventListener('click', () => closeModal());
  });
}

// ─── APPEARANCE ──────────────────────────────────────────────────────────────

function shade(hex, percent) {
  const n = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  let r = (n >> 16) + amt, g = (n >> 8 & 0x00FF) + amt, b = (n & 0x0000FF) + amt;
  r = Math.max(Math.min(255, r), 0); g = Math.max(Math.min(255, g), 0); b = Math.max(Math.min(255, b), 0);
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

// Colors chosen for clear contrast against both a white surface and the
// dark-mode surface (#1C1C1E) — mid-saturation, mid-lightness only.
const COLOR_PALETTE = [
  { name: 'Teal',    hex: '#0F7A6C' },
  { name: 'Blue',    hex: '#2563EB' },
  { name: 'Indigo',  hex: '#4F46E5' },
  { name: 'Purple',  hex: '#9333EA' },
  { name: 'Pink',    hex: '#DB2777' },
  { name: 'Orange',  hex: '#EA580C' },
  { name: 'Amber',   hex: '#B45309' },
  { name: 'Emerald', hex: '#059669' }
];

function colorName(hex) {
  const match = COLOR_PALETTE.find(c => c.hex.toLowerCase() === (hex || '').toLowerCase());
  return match ? match.name : 'Custom';
}

const TEXT_SIZES = { small: 0.9, regular: 1, large: 1.15 };

function applyAppearance(user) {
  const settings = user?.settings || { primaryColor: '#0F7A6C', theme: 'light', textSize: 'regular' };
  const root = document.documentElement;
  root.style.setProperty('--brand', settings.primaryColor);
  root.style.setProperty('--brand-hover', shade(settings.primaryColor, -10));
  root.style.setProperty('--brand-active', shade(settings.primaryColor, -20));
  document.body.classList.toggle('dark-mode', settings.theme === 'dark');
  document.querySelectorAll('.bt-sidebar-logo img, .login-logo img').forEach(img => {
    img.src = settings.theme === 'dark' ? 'Squawk-logo-white-text.png' : 'Squawk-logo.png';
  });
  // Scales the whole rendered UI (not just a font-size) since most of the
  // app is laid out in fixed px rather than rem, so a font-size alone
  // wouldn't cascade into it.
  document.documentElement.style.zoom = TEXT_SIZES[settings.textSize] || 1;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

async function init() {
  DB.seed();
  currentUser = await DB.Auth.currentUser();

  if (currentUser && currentUser.role !== 'bt') {
    await DB.Auth.logout();
    currentUser = null;
  }

  if (!currentUser) {
    applyAppearance(null);
    renderLoginView();
    showView('login');
  } else {
    applyAppearance(currentUser);
    renderSidebarUser();
    showView('dashboard');
  }
}

function renderSidebarUser() {
  document.getElementById('bt-sidebar-username').textContent = currentUser.name;
  const avatar = document.getElementById('bt-sidebar-avatar');
  if (currentUser.avatarDataUrl) {
    avatar.innerHTML = `<img src="${currentUser.avatarDataUrl}" alt="">`;
  } else {
    avatar.textContent = (currentUser.name || '?').trim().charAt(0).toUpperCase();
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

  emailInput.addEventListener('blur', async () => {
    const email = emailInput.value.trim();
    if (!email) return;
    const pending = await DB.Auth.checkFirstLogin(email);
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
        const user = await DB.Auth.firstLogin(emailInput.value.trim(), otp, pass);
        if (!user) { showLoginError('That code is incorrect. Check with your Howard AI contact.'); return; }
        currentUser = user;
      } else {
        const pass = document.getElementById('login-password').value;
        const user = await DB.Auth.login(emailInput.value.trim(), pass);
        if (!user) { showLoginError('Email or password is incorrect.'); return; }
        if (user.role === 'admin') { window.location.href = 'admin.html'; return; }
        if (user.role !== 'bt') { showLoginError('Email or password is incorrect.'); return; }
        currentUser = user;
      }
      applyAppearance(currentUser);
      renderSidebarUser();
      showView('dashboard');
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

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function greeting() {
  const hour = new Date().getHours();
  if (Number.isNaN(hour)) return 'Hello';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

async function renderDashboard() {
  const view = document.querySelector('[data-view="dashboard"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  const firstName = (currentUser.name || '').split(' ')[0] || '';
  const since = Date.now() - 86400000;
  const allSubs = await DB.Submissions.getByBT(currentUser.id);
  const recent = allSubs
    .filter(s => new Date(s.submittedAt).getTime() > since)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const items = recent.map(s => {
    const catLabel = DB.CATEGORIES[s.category]?.label || s.category;
    const subLabel = DB.CATEGORIES[s.category]?.subcategories[s.subcategory] || s.subcategory;
    return `
      <div class="submission-item" onclick="showView('submission-detail',{id:'${s.id}'})" tabindex="0" role="button"
           onkeydown="if(event.key==='Enter')showView('submission-detail',{id:'${s.id}'})">
        <div class="submission-item-info">
          <p class="submission-item-title">${escHtml(s.title || catLabel)}</p>
          <p class="submission-item-meta">${catLabel}, ${subLabel} · ${formatDate(s.submittedAt)}</p>
        </div>
        <span class="submission-item-arrow"><i class="ti ti-chevron-right" style="font-size:20px"></i></span>
      </div>
    `;
  }).join('');

  view.innerHTML = `
    <h2 class="h2 mb-2">${greeting()}${firstName ? ', ' + escHtml(firstName) : ''}.</h2>
    <div class="mt-6 mb-6">
      <button class="btn btn-primary" onclick="showView('new')">
        <i class="ti ti-square-rounded-plus" style="font-size:20px" aria-hidden="true"></i>
        New Submission
      </button>
    </div>
    <hr class="divider mb-6">
    <h4 class="h4 mb-4">Submitted in the last 24 hours</h4>
    ${recent.length > 0 ? items : `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ti ti-clock" style="font-size:48px"></i></div>
        <p class="empty-state-title">Nothing in the last 24 hours.</p>
        <p class="empty-state-body">Submissions you send in the last day will show up here.</p>
      </div>
    `}
  `;
}

// ─── TOPIC PICKER ────────────────────────────────────────────────────────────

function renderTopicPicker(initial) {
  selectedTopic = initial || null;
  return `
    <div class="field">
      <label class="field-label" for="topic-picker-btn">Topic <span class="field-required">Required</span></label>
      <div class="topic-picker" id="topic-picker">
        <button type="button" class="input topic-picker-btn" id="topic-picker-btn">
          <span id="topic-picker-label">${initial ? topicLabel(initial) : 'Select a topic'}</span>
          <i class="ti ti-chevron-down" style="font-size:20px"></i>
        </button>
        <div class="topic-picker-panel hidden" id="topic-picker-panel">
          <div class="topic-picker-mains" id="topic-picker-mains">
            ${Object.entries(DB.CATEGORIES).map(([k, v]) => `
              <button type="button" class="topic-picker-main" data-cat="${k}">
                <span>${escHtml(v.label)}</span>
                <i class="ti ti-chevron-right" style="font-size:16px"></i>
              </button>
            `).join('')}
          </div>
          <div class="topic-picker-subs hidden" id="topic-picker-subs"></div>
        </div>
      </div>
    </div>
  `;
}

function topicLabel(topic) {
  if (!topic) return '';
  const cat = DB.CATEGORIES[topic.category];
  if (!cat) return '';
  const sub = cat.subcategories[topic.subcategory];
  return `${cat.label}, ${sub || ''}`;
}

function wireTopicPicker() {
  const btn   = document.getElementById('topic-picker-btn');
  const panel = document.getElementById('topic-picker-panel');
  const mains = document.getElementById('topic-picker-mains');
  const subs  = document.getElementById('topic-picker-subs');

  btn.addEventListener('click', () => panel.classList.toggle('hidden'));

  mains.querySelectorAll('.topic-picker-main').forEach(mainBtn => {
    mainBtn.addEventListener('click', () => {
      mains.querySelectorAll('.topic-picker-main').forEach(b => b.classList.remove('active'));
      mainBtn.classList.add('active');
      const cat = mainBtn.dataset.cat;
      const subEntries = Object.entries(DB.CATEGORIES[cat].subcategories);
      subs.innerHTML = subEntries.map(([k, v]) => `
        <button type="button" class="topic-picker-sub" data-cat="${cat}" data-sub="${k}">${escHtml(v)}</button>
      `).join('');
      subs.classList.remove('hidden');

      subs.querySelectorAll('.topic-picker-sub').forEach(subBtn => {
        subBtn.addEventListener('click', () => {
          selectedTopic = { category: subBtn.dataset.cat, subcategory: subBtn.dataset.sub };
          document.getElementById('topic-picker-label').textContent = topicLabel(selectedTopic);
          panel.classList.add('hidden');
          subs.classList.add('hidden');
        });
      });
    });
  });

  document.addEventListener('click', e => {
    if (!document.getElementById('topic-picker')?.contains(e.target)) panel.classList.add('hidden');
  }, { capture: true });
}

// ─── NEW SUBMISSION ──────────────────────────────────────────────────────────

async function renderNewSubmission(draftId) {
  attachmentData = null;
  editingDraftId = draftId || null;
  const view = document.querySelector('[data-view="new"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  const draft = draftId ? await DB.Drafts.getById(draftId) : null;
  const initialTopic = draft ? { category: draft.category, subcategory: draft.subcategory } : null;
  const devices = currentUser.devices || [];

  let modelFieldHtml = '';
  if (devices.length === 1) {
    modelFieldHtml = `
      <div class="field">
        <label class="field-label">Howard unit</label>
        <p class="body" style="padding:10px 0">${escHtml(devices[0].name)} — ${escHtml(devices[0].model)}</p>
        <input type="hidden" id="sub-device" value="${devices[0].id}">
      </div>
    `;
  } else if (devices.length > 1) {
    modelFieldHtml = `
      <div class="field">
        <label class="field-label" for="sub-device">Howard unit <span class="field-required">Required</span></label>
        <div class="select-wrapper">
          <select class="input" id="sub-device" required>
            <option value="">Select your Howard unit</option>
            ${devices.map(d => `<option value="${d.id}" ${draft?.deviceId === d.id ? 'selected' : ''}>${escHtml(d.name)} — ${escHtml(d.model)}</option>`).join('')}
          </select>
          <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
        </div>
      </div>
    `;
  } else {
    modelFieldHtml = `
      <div class="field">
        <label class="field-label">Howard unit</label>
        <p class="body text-tertiary" style="padding:10px 0">No Howard units linked to your account yet. You can add one in <a href="#" onclick="showView('settings');return false;">Settings</a>.</p>
        <input type="hidden" id="sub-device" value="">
      </div>
    `;
  }

  view.innerHTML = `
    <h2 class="h2 mb-6">${draft ? 'Edit Draft' : 'New Submission'}</h2>
    <form class="submission-form" id="new-form" novalidate>
      ${renderTopicPicker(initialTopic)}

      <div class="field">
        <label class="field-label" for="sub-title">Please provide a title for this submission <span class="field-required">Required</span></label>
        <input class="input" type="text" id="sub-title" placeholder="A short summary of the issue" value="${escHtml(draft?.title || '')}" required>
      </div>

      <div class="field">
        <label class="field-label" for="sub-description">Description <span class="field-required">Required</span></label>
        <p class="field-helper" style="margin-bottom:8px">Include a clear and detailed description of the problem, a step-by-step set of instructions to reproduce it if possible, what results you expected, and what results you actually saw.</p>
        <textarea class="input" id="sub-description" style="min-height:160px" required>${escHtml(draft?.description || '')}</textarea>
      </div>

      ${modelFieldHtml}

      <div class="form-row">
        <div class="field">
          <label class="field-label" for="sub-timestamp">When did this happen? <span style="color:var(--text-placeholder);font-size:13px">Optional</span></label>
          <input class="input" type="datetime-local" id="sub-timestamp" value="${draft?.eventTimestamp ? toLocalDatetimeValue(draft.eventTimestamp) : ''}">
          <p class="field-helper">Exact or approximate — whatever you remember.</p>
        </div>
        <div class="field">
          <label class="field-label" for="sub-precision">Precision</label>
          <div class="select-wrapper">
            <select class="input" id="sub-precision">
              <option value="exact" ${draft?.timestampPrecision === 'exact' ? 'selected' : ''}>Exact</option>
              <option value="approximate" ${draft?.timestampPrecision === 'approximate' ? 'selected' : ''}>Approximate</option>
            </select>
            <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="field-label">Attachment <span style="color:var(--text-placeholder);font-size:13px">Optional</span></label>
        <div class="file-drop" id="file-drop" tabindex="0" role="button" aria-label="Attach a screenshot or photo">
          <input type="file" id="file-input" accept="image/*,.png,.jpg,.jpeg,.gif,.webp">
          <i class="ti ti-photo-up" style="font-size:24px;color:var(--text-placeholder);margin-bottom:8px"></i>
          <p class="caption text-placeholder">Click to attach a screenshot or photo</p>
          <p class="caption text-placeholder" id="file-name"></p>
        </div>
      </div>

      <div id="new-error" class="alert alert-error hidden">
        <span class="alert-icon"><i class="ti ti-circle-x" style="color:var(--error);font-size:20px"></i></span>
        <div class="alert-body"><p class="alert-message" id="new-error-text"></p></div>
      </div>

      <div class="flex gap-3">
        <button type="submit" class="btn btn-primary" id="new-submit-btn">Submit</button>
        <button type="button" class="btn btn-secondary" id="new-save-btn">Save</button>
        <button type="button" class="btn btn-secondary" id="new-cancel-btn">Cancel</button>
      </div>
    </form>
  `;

  wireTopicPicker();
  attachmentData = draft?.attachmentData || null;
  if (attachmentData) {
    document.getElementById('file-name').textContent = attachmentData.name;
    document.getElementById('file-drop').classList.add('has-file');
  }

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

  document.getElementById('new-form').addEventListener('submit', handleNewSubmit);
  document.getElementById('new-save-btn').addEventListener('click', handleSaveDraft);
  document.getElementById('new-cancel-btn').addEventListener('click', handleCancelNew);
}

function toLocalDatetimeValue(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function collectNewFormFields() {
  const title       = document.getElementById('sub-title').value.trim();
  const description = document.getElementById('sub-description').value.trim();
  const deviceId    = document.getElementById('sub-device')?.value || '';
  const device      = (currentUser.devices || []).find(d => d.id === deviceId);
  const timestampVal = document.getElementById('sub-timestamp').value;
  const precision    = document.getElementById('sub-precision').value;

  return {
    title, description,
    category: selectedTopic?.category || '',
    subcategory: selectedTopic?.subcategory || '',
    deviceId: deviceId || null,
    model: device?.model || null,
    eventTimestamp: timestampVal ? new Date(timestampVal).toISOString() : null,
    timestampPrecision: timestampVal ? precision : null,
    attachmentData
  };
}

async function handleNewSubmit(e) {
  e.preventDefault();
  const errEl   = document.getElementById('new-error');
  const errText = document.getElementById('new-error-text');
  errEl.classList.add('hidden');

  const fields = collectNewFormFields();
  const devices = currentUser.devices || [];

  if (!fields.category || !fields.subcategory || !fields.title || !fields.description || (devices.length > 1 && !fields.deviceId)) {
    errText.textContent = 'Please complete all required fields before submitting.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('new-submit-btn');
  btn.disabled = true;
  try {
    await DB.Submissions.create({ btId: currentUser.id, ...fields });
    if (editingDraftId) await DB.Drafts.delete(editingDraftId);
    toast('Submission received.');
    showView('submitted');
  } catch {
    errText.textContent = 'Something went wrong submitting this. Please try again.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}

async function handleSaveDraft() {
  const fields = collectNewFormFields();
  const btn = document.getElementById('new-save-btn');
  btn.disabled = true;
  try {
    const draft = await DB.Drafts.save({
      id: editingDraftId || undefined,
      btId: currentUser.id,
      ...fields
    });
    editingDraftId = draft.id;
    toast('Saved. You can view and edit this in Drafts.');
    showView('drafts');
  } catch {
    toast('Could not save this draft. Please try again.', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function handleCancelNew() {
  const ok = await confirmModal('Discard this submission?', 'Anything you’ve entered on this form will be lost unless you save it as a draft first.', 'Discard');
  if (ok) showView('dashboard');
}

// ─── DRAFTS ───────────────────────────────────────────────────────────────────

async function renderDrafts() {
  const view = document.querySelector('[data-view="drafts"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  const drafts = await DB.Drafts.getByBT(currentUser.id);

  if (drafts.length === 0) {
    view.innerHTML = `
      <h2 class="h2 mb-6">Drafts</h2>
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ti ti-file-pencil" style="font-size:48px"></i></div>
        <p class="empty-state-title">No drafts yet.</p>
        <p class="empty-state-body">Save a submission in progress and it'll show up here.</p>
        <button class="btn btn-primary" onclick="showView('new')">New Submission</button>
      </div>
    `;
    return;
  }

  const items = drafts.map(d => {
    const catLabel = DB.CATEGORIES[d.category]?.label || d.category;
    const subLabel = DB.CATEGORIES[d.category]?.subcategories[d.subcategory] || d.subcategory;
    return `
      <div class="draft-item">
        <div class="draft-item-info">
          <p class="draft-item-title">${escHtml(d.title || '(untitled draft)')}</p>
          <p class="draft-item-meta">${formatDate(d.updatedAt)} · ${escHtml(catLabel)}${d.subcategory ? ', ' + escHtml(subLabel) : ''}</p>
        </div>
        <div class="draft-item-actions">
          <button class="btn-icon" aria-label="Edit draft" onclick="showView('new',{draftId:'${d.id}'})"><i class="ti ti-pencil" style="font-size:18px"></i></button>
          <button class="btn-icon" aria-label="Delete draft" onclick="handleDeleteDraft('${d.id}', '${escJs(d.title || 'this draft')}')"><i class="ti ti-trash" style="font-size:18px"></i></button>
        </div>
      </div>
    `;
  }).join('');

  view.innerHTML = `<h2 class="h2 mb-6">Drafts</h2>${items}`;
}

async function handleDeleteDraft(id, title) {
  const ok = await confirmDestructive(
    `Delete "${escHtml(title)}"?`,
    'This action cannot be undone. This draft will be permanently removed.',
    'Delete Draft'
  );
  if (!ok) return;
  await DB.Drafts.delete(id);
  toast('Draft deleted.');
  renderDrafts();
}

// ─── SUBMITTED ────────────────────────────────────────────────────────────────

async function renderSubmitted() {
  const view = document.querySelector('[data-view="submitted"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  const allSubs = await DB.Submissions.getByBT(currentUser.id);
  const subs = allSubs.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  if (subs.length === 0) {
    view.innerHTML = `
      <h2 class="h2 mb-6">Submitted</h2>
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ti ti-checklist" style="font-size:48px"></i></div>
        <p class="empty-state-title">No submissions yet.</p>
        <p class="empty-state-body">Your feedback submissions will appear here after you send them in.</p>
        <button class="btn btn-primary" onclick="showView('new')">New Submission</button>
      </div>
    `;
    return;
  }

  const items = subs.map(s => {
    const catLabel = DB.CATEGORIES[s.category]?.label || s.category;
    const subLabel = DB.CATEGORIES[s.category]?.subcategories[s.subcategory] || s.subcategory;
    return `
      <div class="submission-item" onclick="showView('submission-detail', { id: '${s.id}' })" tabindex="0"
           role="button" aria-label="${escHtml(s.title || catLabel)}"
           onkeydown="if(event.key==='Enter')showView('submission-detail',{id:'${s.id}'})">
        <div class="submission-item-info">
          <p class="submission-item-title">${escHtml(s.title || catLabel)}</p>
          <p class="submission-item-meta">${escHtml(catLabel)}, ${escHtml(subLabel)} · ${formatDate(s.submittedAt)}</p>
        </div>
        <span class="submission-item-arrow"><i class="ti ti-chevron-right" style="font-size:20px"></i></span>
      </div>
    `;
  }).join('');

  view.innerHTML = `
    <h2 class="h2 mb-6">Submitted</h2>
    <p class="body text-secondary mb-6">A read-only record of everything you've submitted.</p>
    ${items}
  `;
}

async function renderSubmissionDetail(id) {
  const view = document.querySelector('[data-view="submission-detail"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  let sub = null;
  try { sub = await DB.Submissions.getById(id); } catch { /* not found */ }

  if (!sub || sub.btId !== currentUser.id) {
    view.innerHTML = `<div class="empty-state"><p class="empty-state-title">Submission not found.</p></div>`;
    return;
  }

  const catLabel = DB.CATEGORIES[sub.category]?.label || sub.category;
  const subLabel = DB.CATEGORIES[sub.category]?.subcategories[sub.subcategory] || sub.subcategory;

  view.innerHTML = `
    <button class="back-btn" onclick="showView('submitted')">
      <i class="ti ti-arrow-left" style="font-size:16px"></i> Back to Submitted
    </button>
    <h2 class="h2 mb-2">${escHtml(sub.title || catLabel)}</h2>
    <p class="body text-secondary mb-8">${escHtml(catLabel)}, ${escHtml(subLabel)}</p>

    <div class="card" style="max-width:640px">
      <div class="ticket-meta-grid" style="margin-bottom:var(--space-6)">
        <div class="ticket-meta-item">
          <p class="ticket-meta-label">Submitted</p>
          <p class="ticket-meta-value">${formatDate(sub.submittedAt)}</p>
        </div>
        <div class="ticket-meta-item">
          <p class="ticket-meta-label">Howard Unit</p>
          <p class="ticket-meta-value">${escHtml(sub.model || 'Not specified')}</p>
        </div>
        <div class="ticket-meta-item">
          <p class="ticket-meta-label">Event Time</p>
          <p class="ticket-meta-value">${sub.eventTimestamp ? `${formatDate(sub.eventTimestamp)} (${sub.timestampPrecision})` : 'Not specified'}</p>
        </div>
      </div>
      <hr class="divider" style="margin-bottom:var(--space-6)">
      <h4 class="h4 mb-4">Description</h4>
      <p class="body" style="white-space:pre-wrap;color:var(--text-secondary)">${escHtml(sub.description)}</p>
      ${sub.attachmentData ? `
        <hr class="divider" style="margin:var(--space-6) 0">
        <h4 class="h4 mb-4">Attachment</h4>
        <img src="${sub.attachmentData.dataUrl}" alt="${escHtml(sub.attachmentData.name)}"
          style="max-width:100%;border-radius:var(--radius-md);border:1px solid var(--border)">
      ` : ''}
    </div>
  `;
}

// ─── MESSAGES / NEWS ─────────────────────────────────────────────────────────

function renderMessages() {
  const view = document.querySelector('[data-view="messages"]');
  view.innerHTML = `
    <h2 class="h2 mb-6">Messages</h2>
    <div class="empty-state">
      <div class="empty-state-icon"><i class="ti ti-message-2" style="font-size:48px"></i></div>
      <p class="empty-state-title">No new messages.</p>
    </div>
  `;
}

function renderNews() {
  const view = document.querySelector('[data-view="news"]');
  view.innerHTML = `
    <h2 class="h2 mb-6">News</h2>
    <div class="empty-state">
      <div class="empty-state-icon"><i class="ti ti-news" style="font-size:48px"></i></div>
      <p class="empty-state-title">No news.</p>
    </div>
  `;
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

function renderSettings() {
  const view = document.querySelector('[data-view="settings"]');
  const s = currentUser.settings || { emailNotifications: true, primaryColor: '#0F7A6C', theme: 'light', textScale: 1 };
  const devices = currentUser.devices || [];

  view.innerHTML = `
    <h2 class="h2 mb-6">Settings</h2>

    <div class="card mb-6">
      <h3 class="h3 mb-6">Account</h3>

      <div class="field mb-4">
        <label class="field-label" for="set-name">Username</label>
        <div class="flex gap-2">
          <input class="input" type="text" id="set-name" value="${escHtml(currentUser.name)}">
          <button class="btn btn-secondary" id="save-name-btn">Save</button>
        </div>
      </div>

      <div class="field mb-4">
        <label class="field-label" for="set-email">Email</label>
        <div class="flex gap-2">
          <input class="input" type="email" id="set-email" value="${escHtml(currentUser.email)}">
          <button class="btn btn-secondary" id="save-email-btn">Save</button>
        </div>
      </div>

      <div class="field mb-4">
        <label class="field-label" for="set-password">New password</label>
        <div class="flex gap-2">
          <input class="input" type="password" id="set-password" placeholder="At least 8 characters">
          <button class="btn btn-secondary" id="save-password-btn">Save</button>
        </div>
      </div>

      <div class="field mb-6">
        <label class="field-label">Profile picture</label>
        <div class="flex items-center gap-4">
          <div class="bt-avatar bt-avatar-lg" id="set-avatar-preview">${currentUser.avatarDataUrl ? `<img src="${currentUser.avatarDataUrl}" alt="">` : escHtml((currentUser.name||'?').charAt(0).toUpperCase())}</div>
          <input type="file" id="set-avatar-input" accept="image/*" style="display:none">
          <button class="btn btn-secondary" id="set-avatar-btn">Change Photo</button>
        </div>
      </div>

      <hr class="divider mb-6">

      <div class="flex items-center justify-between mb-4">
        <h4 class="h4">Howard products</h4>
        <button class="btn btn-secondary btn-sm" id="add-device-btn">
          <i class="ti ti-plus" style="font-size:16px"></i> Add Howard Unit
        </button>
      </div>

      ${devices.length > 0 ? devices.map(d => `
        <div class="draft-item">
          <div class="draft-item-info">
            <p class="draft-item-title">${escHtml(d.name)}</p>
            <p class="draft-item-meta">${escHtml(d.model)} · Serial ${escHtml(d.serialNumber)} · Added ${formatDate(d.dateAdded)}</p>
          </div>
          <div class="draft-item-actions">
            <button class="btn-icon" aria-label="Remove unit" onclick="handleRemoveDevice('${d.id}', '${escJs(d.name)}')"><i class="ti ti-trash" style="font-size:18px"></i></button>
          </div>
        </div>
      `).join('') : `<p class="body text-tertiary mb-4">No Howard units linked yet.</p>`}

      <hr class="divider mt-6 mb-6">

      <button class="btn btn-destructive" id="delete-account-btn">Delete Account</button>
    </div>

    <div class="card mb-6">
      <h3 class="h3 mb-6">Notifications</h3>
      <div class="flex items-center justify-between">
        <div>
          <p class="body font-bold">Email notifications</p>
          <p class="caption text-tertiary">Receive an email when there's activity on your submissions.</p>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="set-email-notif" ${s.emailNotifications ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <div class="card mb-6">
      <h3 class="h3 mb-6">Appearance</h3>

      <div class="field mb-6">
        <label class="field-label">Primary color <span class="caption text-tertiary" id="color-name-label">${colorName(s.primaryColor)}</span></label>
        <div class="color-swatch-grid">
          ${COLOR_PALETTE.map(c => `
            <button type="button" class="color-swatch ${s.primaryColor.toLowerCase() === c.hex.toLowerCase() ? 'active' : ''}"
              style="background:${c.hex}" data-hex="${c.hex}" data-name="${c.name}" aria-label="${c.name}" title="${c.name}">
              <i class="ti ti-check" style="font-size:16px"></i>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="field mb-6">
        <label class="field-label">Theme</label>
        <div class="flex gap-2">
          <button class="btn ${s.theme === 'light' ? 'btn-brand' : 'btn-secondary'}" id="theme-light-btn">
            <i class="ti ti-sun" style="font-size:18px"></i> Light
          </button>
          <button class="btn ${s.theme === 'dark' ? 'btn-brand' : 'btn-secondary'}" id="theme-dark-btn">
            <i class="ti ti-moon" style="font-size:18px"></i> Dark
          </button>
        </div>
      </div>

      <div class="field">
        <label class="field-label">Text size</label>
        <div class="flex gap-2">
          <button class="btn ${s.textSize === 'small' ? 'btn-brand' : 'btn-secondary'}" id="text-small-btn">Small</button>
          <button class="btn ${s.textSize === 'regular' ? 'btn-brand' : 'btn-secondary'}" id="text-regular-btn">Regular</button>
          <button class="btn ${s.textSize === 'large' ? 'btn-brand' : 'btn-secondary'}" id="text-large-btn">Large</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('save-name-btn').addEventListener('click', async () => {
    const name = document.getElementById('set-name').value.trim();
    if (!name) { toast('Username cannot be empty.', 'error'); return; }
    currentUser = await DB.Users.update(currentUser.id, { name });
    renderSidebarUser();
    toast('Username updated.');
  });

  document.getElementById('save-email-btn').addEventListener('click', async () => {
    const email = document.getElementById('set-email').value.trim();
    if (!email) { toast('Email cannot be empty.', 'error'); return; }
    currentUser = await DB.Users.update(currentUser.id, { email });
    toast('Email updated.');
  });

  document.getElementById('save-password-btn').addEventListener('click', async () => {
    const pass = document.getElementById('set-password').value;
    if (!pass || pass.length < 8) { toast('Password must be at least 8 characters.', 'error'); return; }
    currentUser = await DB.Users.updatePassword(currentUser.id, pass);
    document.getElementById('set-password').value = '';
    toast('Password updated.');
  });

  document.getElementById('set-avatar-btn').addEventListener('click', () => document.getElementById('set-avatar-input').click());
  document.getElementById('set-avatar-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      currentUser = await DB.Users.update(currentUser.id, { avatarDataUrl: ev.target.result });
      renderSidebarUser();
      renderSettings();
      toast('Profile picture updated.');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('add-device-btn').addEventListener('click', showAddDeviceModal);

  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    const ok = await confirmDestructive(
      `Delete your account, ${escHtml(currentUser.name)}?`,
      'This action cannot be undone. Your account will be permanently removed. Your past submissions will remain on record.',
      'Delete Account'
    );
    if (!ok) return;
    await DB.Users.deleteAccount(currentUser.id);
    await DB.Auth.logout();
    currentUser = null;
    renderLoginView();
    showView('login');
    toast('Account deleted.');
  });

  document.getElementById('set-email-notif').addEventListener('change', async e => {
    currentUser = await DB.Users.updateSettings(currentUser.id, { emailNotifications: e.target.checked });
    toast('Notification preferences saved.');
  });

  document.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentUser = await DB.Users.updateSettings(currentUser.id, { primaryColor: btn.dataset.hex });
      applyAppearance(currentUser);
      renderSettings();
    });
  });

  document.getElementById('theme-light-btn').addEventListener('click', async () => {
    currentUser = await DB.Users.updateSettings(currentUser.id, { theme: 'light' });
    applyAppearance(currentUser);
    renderSettings();
  });
  document.getElementById('theme-dark-btn').addEventListener('click', async () => {
    currentUser = await DB.Users.updateSettings(currentUser.id, { theme: 'dark' });
    applyAppearance(currentUser);
    renderSettings();
  });

  document.getElementById('text-small-btn').addEventListener('click', async () => {
    currentUser = await DB.Users.updateSettings(currentUser.id, { textSize: 'small' });
    applyAppearance(currentUser);
    renderSettings();
  });
  document.getElementById('text-regular-btn').addEventListener('click', async () => {
    currentUser = await DB.Users.updateSettings(currentUser.id, { textSize: 'regular' });
    applyAppearance(currentUser);
    renderSettings();
  });
  document.getElementById('text-large-btn').addEventListener('click', async () => {
    currentUser = await DB.Users.updateSettings(currentUser.id, { textSize: 'large' });
    applyAppearance(currentUser);
    renderSettings();
  });
}

function showAddDeviceModal() {
  openModal({
    title: 'Add Howard unit',
    body: `
      <div class="field mb-4">
        <label class="field-label" for="dev-name">Name <span class="field-required">Required</span></label>
        <input class="input" type="text" id="dev-name" placeholder="e.g. Home Unit">
      </div>
      <div class="field mb-4">
        <label class="field-label" for="dev-serial">Serial number <span class="field-required">Required</span></label>
        <input class="input" type="text" id="dev-serial" placeholder="ARK-XXXXX">
      </div>
      <div class="field mb-4">
        <label class="field-label" for="dev-date">Date added <span class="field-required">Required</span></label>
        <input class="input" type="date" id="dev-date" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="field">
        <label class="field-label" for="dev-model">Model <span class="field-required">Required</span></label>
        <div class="select-wrapper">
          <select class="input" id="dev-model">
            ${DB.HOWARD_MODELS.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
          <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
        </div>
      </div>
      <div id="dev-error" class="field-error hidden mt-2">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="dev-error-text"></span>
      </div>
    `,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
             <button class="btn btn-primary" id="confirm-add-device">Add Unit</button>`,
    onClose: () => {}
  });

  document.getElementById('confirm-add-device').addEventListener('click', async () => {
    const name   = document.getElementById('dev-name').value.trim();
    const serial = document.getElementById('dev-serial').value.trim();
    const date   = document.getElementById('dev-date').value;
    const model  = document.getElementById('dev-model').value;
    const errEl  = document.getElementById('dev-error');

    if (!name || !serial || !date) {
      document.getElementById('dev-error-text').textContent = 'All fields are required.';
      errEl.classList.remove('hidden');
      return;
    }

    await DB.Users.addDevice(currentUser.id, { name, serialNumber: serial, dateAdded: new Date(date).toISOString(), model });
    currentUser = await DB.Users.getById(currentUser.id);
    closeModal();
    toast('Howard unit added.');
    renderSettings();
  });
}

async function handleRemoveDevice(deviceId, deviceName) {
  const ok = await confirmDestructive(
    `Remove "${escHtml(deviceName)}"?`,
    'This action cannot be undone. This Howard unit will no longer be linked to your account.',
    'Remove Howard Unit'
  );
  if (!ok) return;
  await DB.Users.removeDevice(currentUser.id, deviceId);
  currentUser = await DB.Users.getById(currentUser.id);
  toast('Howard unit removed.');
  renderSettings();
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escJs(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.bt-nav-item[data-target]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.target));
  });

  document.getElementById('bt-sidebar-user-btn')?.addEventListener('click', () => showView('settings'));

  document.getElementById('bt-sidebar-toggle')?.addEventListener('click', openSidebar);
  document.getElementById('bt-sidebar-overlay')?.addEventListener('click', closeSidebar);

  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await DB.Auth.logout();
    currentUser = null;
    applyAppearance(null);
    renderLoginView();
    showView('login');
  });

  init();
});
