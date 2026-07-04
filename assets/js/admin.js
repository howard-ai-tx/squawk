'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────

let currentUser = null;
let activeView  = null;
let modalCloseCallback = null;

// ─── ROUTER ───────────────────────────────────────────────────────────────────

function showView(name, params = {}) {
  document.querySelectorAll('[data-view]').forEach(el => el.classList.add('hidden'));
  const el = document.querySelector(`[data-view="${name}"]`);
  if (el) el.classList.remove('hidden');
  activeView = name;

  const shell = document.getElementById('admin-shell');
  shell.classList.toggle('hidden', name === 'login');
  document.querySelector('[data-view="login"]')?.classList.toggle('hidden', name !== 'login');

  document.querySelectorAll('.admin-nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.target === name);
  });

  if (name === 'dashboard') renderDashboard();
  if (name === 'records')   renderRecords();
  if (name === 'users')     renderUsers();
  if (name === 'messages')  renderMessages();
  if (name === 'news')      renderNews();
  if (name === 'settings')  renderSettings();
  if (name === 'ticket')    renderTicket(params.id);
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function toast(message, type = 'success') {
  const icons  = { success: 'ti-circle-check', error: 'ti-circle-x', info: 'ti-info-circle', warning: 'ti-alert-triangle' };
  const colors = { success: '#34C759', error: '#FF3B30', info: '#0EA5E9', warning: '#FF9F0A' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<i class="ti ${icons[type]||icons.info}" style="color:${colors[type]};flex-shrink:0;font-size:20px"></i>
    <span class="toast-message">${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 4000);
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

function openModal({ title, body, footer, onClose, disableOverlay = false }) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'active-modal-overlay';

  overlay.innerHTML = `
    <div class="modal" id="active-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title">${title}</h3>
        ${!disableOverlay ? `<button class="btn-icon" id="modal-close-btn" aria-label="Close modal"><i class="ti ti-x" style="font-size:20px"></i></button>` : ''}
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">${footer}</div>
    </div>
  `;

  document.body.appendChild(overlay);
  modalCloseCallback = onClose;

  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  if (!disableOverlay) {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  }
  document.addEventListener('keydown', escListener);
}

function escListener(e) {
  if (e.key === 'Escape') closeModal();
}

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

function confirmDestructive(title, message, destructiveLabel) {
  return new Promise(resolve => {
    openModal({
      title,
      body: `<p class="body">${message}</p>`,
      footer: `<button class="btn btn-secondary" id="cd-cancel">Cancel</button>
               <button class="btn btn-destructive" id="cd-confirm">${destructiveLabel}</button>`,
      onClose: () => resolve(false),
      disableOverlay: true
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
  document.querySelectorAll('.login-logo img').forEach(img => {
    img.src = settings.theme === 'dark' ? 'Squawk-logo-white-text.png' : 'Squawk-logo.png';
  });
  document.documentElement.style.zoom = TEXT_SIZES[settings.textSize] || 1;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

async function init() {
  DB.seed();
  currentUser = await DB.Auth.currentUser();

  if (currentUser && currentUser.role !== 'admin') {
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
  document.getElementById('admin-sidebar-username').textContent = currentUser.name;
  const avatar = document.getElementById('admin-sidebar-avatar');
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
        <h3 class="login-title">Admin sign in</h3>
        <p class="login-subtitle">Howard AI internal access only.</p>
        <form class="login-form" id="admin-login-form" novalidate>
          <div class="field">
            <label class="field-label" for="a-email">Email address</label>
            <input class="input" type="email" id="a-email" autocomplete="email" placeholder="you@howardai.us" required>
          </div>
          <div class="field">
            <label class="field-label" for="a-password">Password</label>
            <input class="input" type="password" id="a-password" autocomplete="current-password" placeholder="••••••••" required>
          </div>
          <div id="a-login-error" class="field-error hidden">
            <i class="ti ti-alert-circle" style="font-size:16px"></i>
            <span id="a-login-error-text"></span>
          </div>
          <button type="submit" class="btn btn-primary w-full" id="a-login-btn">Sign In</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('admin-login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = document.getElementById('a-login-error');
    err.classList.add('hidden');
    const btn = document.getElementById('a-login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    const email    = document.getElementById('a-email').value.trim();
    const password = document.getElementById('a-password').value;
    const user     = await DB.Auth.login(email, password);

    if (!user || user.role !== 'admin') {
      document.getElementById('a-login-error-text').textContent = 'Email or password is incorrect.';
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }

    currentUser = user;
    applyAppearance(currentUser);
    renderSidebarUser();
    showView('dashboard');
  });
}

// ─── RECORDS ─────────────────────────────────────────────────────────────────

let recordFilters = { search: '', category: '', status: '', owner: '' };

async function renderRecords() {
  const view = document.querySelector('[data-view="records"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  const admins = await DB.Users.getAdmins();
  view.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1 class="admin-page-title">Records</h1>
        <p class="admin-page-subtitle">All user submissions, open and closed.</p>
      </div>
    </div>

    <div class="filter-bar">
      <div class="input-wrapper" style="flex:1;min-width:200px">
        <span class="input-icon"><i class="ti ti-search" style="font-size:20px"></i></span>
        <input class="input" type="search" id="rec-search" placeholder="Search user name, message, subcategory..." value="${escHtml(recordFilters.search)}">
      </div>
      <div class="select-wrapper">
        <select class="input" id="rec-cat" style="min-width:150px">
          <option value="">All categories</option>
          ${Object.entries(DB.CATEGORIES).map(([k,v]) => `<option value="${k}" ${recordFilters.category===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
        <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
      </div>
      <div class="select-wrapper">
        <select class="input" id="rec-status">
          <option value="">All statuses</option>
          <option value="new" ${recordFilters.status==='new'?'selected':''}>New</option>
          <option value="in-review" ${recordFilters.status==='in-review'?'selected':''}>In Review</option>
          <option value="closed" ${recordFilters.status==='closed'?'selected':''}>Closed</option>
        </select>
        <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
      </div>
      <div class="select-wrapper">
        <select class="input" id="rec-owner">
          <option value="">All owners</option>
          ${admins.map(u => `<option value="${u.id}" ${recordFilters.owner===u.id?'selected':''}>${u.name}</option>`).join('')}
          <option value="unassigned" ${recordFilters.owner==='unassigned'?'selected':''}>Unassigned</option>
        </select>
        <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
      </div>
    </div>

    <div id="records-table-wrap"></div>
  `;

  function applyFilters() {
    recordFilters.search   = document.getElementById('rec-search').value.trim().toLowerCase();
    recordFilters.category = document.getElementById('rec-cat').value;
    recordFilters.status   = document.getElementById('rec-status').value;
    recordFilters.owner    = document.getElementById('rec-owner').value;
    renderRecordsTable();
  }

  document.getElementById('rec-search').addEventListener('input', applyFilters);
  document.getElementById('rec-cat').addEventListener('change', applyFilters);
  document.getElementById('rec-status').addEventListener('change', applyFilters);
  document.getElementById('rec-owner').addEventListener('change', applyFilters);

  renderRecordsTable();
}

async function renderRecordsTable() {
  const wrapLoading = document.getElementById('records-table-wrap');
  wrapLoading.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  let subs = await DB.Submissions.getAllWithMeta();

  if (recordFilters.search) {
    const q = recordFilters.search;
    subs = subs.filter(s =>
      (s.bt?.name || '').toLowerCase().includes(q) ||
      (s.title || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (DB.CATEGORIES[s.category]?.subcategories[s.subcategory] || '').toLowerCase().includes(q) ||
      (DB.CATEGORIES[s.category]?.label || '').toLowerCase().includes(q)
    );
  }
  if (recordFilters.category) subs = subs.filter(s => s.category === recordFilters.category);
  if (recordFilters.status)   subs = subs.filter(s => s.status === recordFilters.status);
  if (recordFilters.owner === 'unassigned') subs = subs.filter(s => !s.owner);
  else if (recordFilters.owner) subs = subs.filter(s => s.owner?.id === recordFilters.owner);

  const wrap = document.getElementById('records-table-wrap');

  if (subs.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ti ti-files" style="font-size:48px"></i></div>
        <p class="empty-state-title">${recordFilters.search || recordFilters.category || recordFilters.status || recordFilters.owner ? 'No results for those filters.' : 'No submissions yet.'}</p>
        <p class="empty-state-body">${recordFilters.search || recordFilters.category || recordFilters.status || recordFilters.owner ? 'Try adjusting your filters.' : 'Submissions from users will appear here.'}</p>
      </div>
    `;
    return;
  }

  const rows = subs.map(s => {
    const catLabel = DB.CATEGORIES[s.category]?.label || s.category;
    const subLabel = DB.CATEGORIES[s.category]?.subcategories[s.subcategory] || s.subcategory;
    return `
      <tr onclick="showView('ticket',{id:'${s.id}'})" tabindex="0"
          onkeydown="if(event.key==='Enter')showView('ticket',{id:'${s.id}'})"
          role="button" aria-label="Open ticket: ${escHtml(catLabel)} — ${escHtml(subLabel)}">
        <td>${formatDate(s.submittedAt)}</td>
        <td class="font-bold">${escHtml(s.title || '(untitled)')}</td>
        <td class="text-secondary">${escHtml(s.bt?.name || 'Unknown')}</td>
        <td><span class="badge badge-cat">${escHtml(catLabel)}</span></td>
        <td class="text-secondary">${escHtml(subLabel)}</td>
        <td>${statusBadge(s.status)}</td>
        <td class="${s.owner ? '' : 'text-placeholder'}">${s.owner ? escHtml(s.owner.name) : 'Unassigned'}</td>
      </tr>
    `;
  }).join('');

  wrap.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Title</th><th>User</th><th>Category</th><th>Subcategory</th>
            <th>Status</th><th>Assigned To</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ─── TICKET DETAIL ────────────────────────────────────────────────────────────

async function renderTicket(id) {
  const view = document.querySelector('[data-view="ticket"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;

  let sub = null;
  try { sub = await DB.Submissions.getById(id); } catch { /* not found */ }
  if (!sub) { view.innerHTML = `<div class="empty-state"><p class="empty-state-title">Ticket not found.</p></div>`; return; }

  const meta   = DB.Submissions.withMeta(sub);
  const bt     = meta.bt;
  const status = meta.status;
  const owner  = meta.owner;
  const catLabel = DB.CATEGORIES[sub.category]?.label || sub.category;
  const subLabel = DB.CATEGORIES[sub.category]?.subcategories[sub.subcategory] || sub.subcategory;
  const [events, admins] = await Promise.all([DB.Events.getBySubmission(id), DB.Users.getAdmins()]);
  const adminsById = Object.fromEntries(admins.map(a => [a.id, a]));

  const canClaim    = status !== 'closed' && !owner;
  const canReassign = status === 'in-review' && owner?.id === currentUser.id;
  const canNote     = status !== 'closed' && owner?.id === currentUser.id;
  const canClose    = status !== 'closed' && owner?.id === currentUser.id;

  view.innerHTML = `
    <button class="back-btn" id="ticket-back-btn">
      <i class="ti ti-arrow-left" style="font-size:16px"></i> Back to Records
    </button>

    <div class="admin-page-header" style="align-items:flex-start">
      <div>
        <div class="flex items-center gap-3 mb-2">
          ${statusBadge(status)}
          <span class="caption text-placeholder">#${id}</span>
        </div>
        <h1 class="admin-page-title" style="font-size:28px">${escHtml(sub.title || catLabel)}</h1>
        <p class="admin-page-subtitle">${escHtml(catLabel)} — ${escHtml(subLabel)} · Submitted by ${escHtml(bt?.name || 'Unknown')} on ${formatDate(sub.submittedAt)}</p>
      </div>
      <div class="flex gap-2" id="ticket-actions"></div>
    </div>

    <div class="ticket-meta-grid mb-6">
      <div class="ticket-meta-item">
        <p class="ticket-meta-label">Howard Model</p>
        <p class="ticket-meta-value">${escHtml(sub.model || 'Not specified')}</p>
      </div>
      <div class="ticket-meta-item">
        <p class="ticket-meta-label">Event Timestamp</p>
        <p class="ticket-meta-value">${sub.eventTimestamp ? `${formatDateTime(sub.eventTimestamp)} (${sub.timestampPrecision || 'exact'})` : 'Not specified'}</p>
      </div>
      <div class="ticket-meta-item">
        <p class="ticket-meta-label">Assigned To</p>
        <p class="ticket-meta-value">${owner ? escHtml(owner.name) : '<span style="color:var(--text-placeholder)">Unassigned</span>'}</p>
      </div>
      <div class="ticket-meta-item">
        <p class="ticket-meta-label">User</p>
        <p class="ticket-meta-value">${escHtml(bt?.name || 'Unknown')} <span class="caption text-placeholder">${escHtml(bt?.email || '')}</span></p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 340px;gap:var(--space-8);align-items:start">
      <div>
        <h3 class="h3 mb-6">Event Log</h3>
        <div class="event-log" id="event-log">
          ${events.map(ev => renderEventItem(ev, sub, adminsById)).join('')}
        </div>
      </div>
      <div>
        <div class="card" style="position:sticky;top:var(--space-8)">
          <h4 class="h4 mb-4">Original Submission</h4>
          <p class="body" style="white-space:pre-wrap;color:var(--text-secondary);font-size:14px">${escHtml(sub.description || '')}</p>
          ${sub.attachmentData ? `
            <hr class="divider" style="margin:var(--space-4) 0">
            <p class="caption text-tertiary mb-2">Attachment</p>
            <img src="${sub.attachmentData.dataUrl}" alt="${escHtml(sub.attachmentData.name)}"
              style="max-width:100%;border-radius:var(--radius-md);border:1px solid var(--border)">
          ` : ''}
        </div>
      </div>
    </div>
  `;

  document.getElementById('ticket-back-btn').addEventListener('click', () => {
    showView('records');
  });

  // Render action buttons
  const actionsEl = document.getElementById('ticket-actions');
  if (canClose)    actionsEl.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary btn-sm" id="btn-close">Mark Closed</button>`);
  if (canNote)     actionsEl.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary btn-sm" id="btn-note">Add Note</button>`);
  if (canReassign) actionsEl.insertAdjacentHTML('beforeend', `<button class="btn btn-secondary btn-sm" id="btn-reassign">Reassign</button>`);
  if (canClaim)    actionsEl.insertAdjacentHTML('beforeend', `<button class="btn btn-primary btn-sm" id="btn-claim">Claim This Ticket</button>`);
  if (status === 'closed') actionsEl.insertAdjacentHTML('beforeend', `<span class="caption text-placeholder">Closed — permanently in records.</span>`);
  if (status === 'in-review' && owner && owner.id !== currentUser.id) {
    actionsEl.insertAdjacentHTML('beforeend', `<span class="caption text-placeholder">Claimed by ${escHtml(owner.name)}.</span>`);
  }

  document.getElementById('btn-claim')?.addEventListener('click', async () => {
    await DB.Events.claim(id, currentUser.id);
    toast('Ticket claimed.');
    renderTicket(id);
  });

  document.getElementById('btn-reassign')?.addEventListener('click', () => {
    const other = admins.find(u => u.id !== currentUser.id);
    if (!other) { toast('No other rep to reassign to.', 'error'); return; }
    openModal({
      title: 'Reassign ticket',
      body: `
        <div class="field" style="margin-bottom:var(--space-4)">
          <label class="field-label">Reassign to</label>
          <p class="body-lg" style="margin-top:4px;font-weight:700">${escHtml(other.name)}</p>
        </div>
        <div class="field">
          <label class="field-label" for="reassign-reason">Reason <span style="color:var(--text-placeholder);font-size:13px">(optional)</span></label>
          <input class="input" type="text" id="reassign-reason" placeholder="e.g. UX issue, better fit for Hendrik">
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" id="confirm-reassign">Reassign</button>`,
      onClose: () => {}
    });
    document.getElementById('confirm-reassign').addEventListener('click', async () => {
      const reason = document.getElementById('reassign-reason').value.trim();
      await DB.Events.reassign(id, currentUser.id, other.id, reason);
      closeModal();
      toast(`Ticket reassigned to ${other.name}.`);
      renderTicket(id);
    });
  });

  document.getElementById('btn-note')?.addEventListener('click', () => {
    openModal({
      title: 'Add a note',
      body: `
        <div class="field">
          <label class="field-label" for="note-content">Note <span class="field-required">Required</span></label>
          <textarea class="input" id="note-content" style="min-height:100px" placeholder="Add internal notes, observations, or corrected details..."></textarea>
        </div>
      `,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" id="confirm-note">Add Note</button>`,
      onClose: () => {}
    });
    document.getElementById('confirm-note').addEventListener('click', async () => {
      const content = document.getElementById('note-content').value.trim();
      if (!content) { toast('Note cannot be empty.', 'error'); return; }
      await DB.Events.addNote(id, currentUser.id, content);
      closeModal();
      toast('Note added.');
      renderTicket(id);
    });
  });

  document.getElementById('btn-close')?.addEventListener('click', () => {
    openModal({
      title: 'Mark ticket as closed?',
      body: `<p class="body">Closing signals this ticket has been acknowledged within SLA. It remains permanently searchable in records.</p>
        <div class="field" style="margin-top:var(--space-4)">
          <label class="field-label" for="close-note">Closure note <span style="color:var(--text-placeholder);font-size:13px">(optional)</span></label>
          <input class="input" type="text" id="close-note" placeholder="e.g. Acknowledged. Followed up via call.">
        </div>`,
      footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
               <button class="btn btn-primary" id="confirm-close">Mark Closed</button>`,
      disableOverlay: true,
      onClose: () => {}
    });
    document.getElementById('confirm-close').addEventListener('click', async () => {
      const note = document.getElementById('close-note')?.value.trim() || '';
      await DB.Events.close(id, currentUser.id, note);
      closeModal();
      toast('Ticket closed.');
      renderTicket(id);
    });
  });
}

function renderEventItem(ev, sub, adminsById) {
  const rep     = ev.repId ? adminsById[ev.repId] : null;
  const repName = rep?.name || 'System';
  const time    = formatDateTime(ev.timestamp);

  const configs = {
    submission:  { icon: 'ti-file-text',        label: 'Submission received',  cls: 'event-icon-submission' },
    auto_triage: { icon: 'ti-route',             label: 'Auto-triaged',         cls: 'event-icon-auto_triage' },
    claim:       { icon: 'ti-user-check',        label: 'Claimed',              cls: 'event-icon-claim' },
    reassign:    { icon: 'ti-arrows-exchange',   label: 'Reassigned',           cls: 'event-icon-reassign' },
    note:        { icon: 'ti-note',              label: 'Note added',           cls: 'event-icon-note' },
    close:       { icon: 'ti-circle-check',      label: 'Closed',               cls: 'event-icon-close' }
  };

  const cfg = configs[ev.type] || { icon: 'ti-dots', label: ev.type, cls: 'event-icon-note' };

  let bodyHtml = '';
  switch (ev.type) {
    case 'submission':
      bodyHtml = `Original submission logged. (See right panel for full message.)`;
      break;
    case 'auto_triage':
      bodyHtml = ev.data.reason || 'Triage completed.';
      if (ev.data.routedTo) {
        bodyHtml += ` <strong>Suggested assignee: ${DB.REPS[ev.data.routedTo]?.name || ev.data.routedTo}</strong>`;
      }
      break;
    case 'claim':
      bodyHtml = `<strong>${escHtml(repName)}</strong> claimed this ticket.`;
      break;
    case 'reassign': {
      const toRep = ev.data.toRepId ? adminsById[ev.data.toRepId] : null;
      bodyHtml = `<strong>${escHtml(repName)}</strong> reassigned to <strong>${escHtml(toRep?.name || 'Unknown')}</strong>.`;
      if (ev.data.reason) bodyHtml += ` Reason: ${escHtml(ev.data.reason)}`;
      break;
    }
    case 'note':
      bodyHtml = `<strong>${escHtml(repName)}</strong>: ${escHtml(ev.data.content || '')}`;
      break;
    case 'close':
      bodyHtml = `<strong>${escHtml(repName)}</strong> marked closed.`;
      if (ev.data.note) bodyHtml += ` ${escHtml(ev.data.note)}`;
      break;
  }

  return `
    <div class="event-item">
      <div class="event-icon-wrap ${cfg.cls}">
        <i class="ti ${cfg.icon}" style="font-size:18px"></i>
      </div>
      <div class="event-content">
        <div class="event-meta">
          <span class="event-type">${cfg.label}</span>
          <span class="event-time">${time}</span>
        </div>
        <p class="event-body">${bodyHtml}</p>
      </div>
    </div>
  `;
}

// ─── USERS ────────────────────────────────────────────────────────────────────

let lastCreatedOTP = null;

async function renderUsers() {
  const view = document.querySelector('[data-view="users"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  const [usersRaw, allSubs] = await Promise.all([DB.Users.getBTs(), DB.Submissions.getAll()]);
  const users = usersRaw.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const rows = users.map(u => {
    const subCount = allSubs.filter(s => s.btId === u.id).length;
    return `
      <tr>
        <td class="font-bold">${escHtml(u.name)}</td>
        <td>${escHtml(u.email)}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td>${subCount} submission${subCount !== 1 ? 's' : ''}</td>
        <td>
          ${u.otp && !u.otpUsed
            ? `<span class="badge badge-review">Pending first login</span>`
            : `<span class="badge badge-closed">Active</span>`}
        </td>
      </tr>
    `;
  }).join('');

  view.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1 class="admin-page-title">Users</h1>
        <p class="admin-page-subtitle">All user accounts. New accounts are created here and activated manually.</p>
      </div>
      <button class="btn btn-primary" id="btn-add-user">
        <i class="ti ti-user-plus" style="font-size:20px" aria-hidden="true"></i>
        Add User
      </button>
    </div>

    ${lastCreatedOTP ? `
      <div class="alert alert-info mb-6" id="otp-alert">
        <span class="alert-icon"><i class="ti ti-info-circle" style="color:var(--action);font-size:20px"></i></span>
        <div class="alert-body">
          <p class="alert-title">Account created — share this one-time code</p>
          <p class="alert-message">The user will use this code on their first sign-in to set their password. Share it directly (text, call, or in person).</p>
          <div class="otp-display" style="margin-top:var(--space-4);max-width:280px">
            <p class="caption text-tertiary">One-time code</p>
            <p class="otp-code" id="otp-value">${lastCreatedOTP}</p>
            <button class="btn btn-secondary btn-sm" onclick="copyOTP()">
              <i class="ti ti-copy" style="font-size:16px" aria-hidden="true"></i> Copy Code
            </button>
          </div>
        </div>
        <button class="btn-icon" onclick="document.getElementById('otp-alert').remove();lastCreatedOTP=null" aria-label="Dismiss">
          <i class="ti ti-x" style="font-size:16px"></i>
        </button>
      </div>
    ` : ''}

    ${users.length > 0 ? `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Added</th><th>Submissions</th><th>Status</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    ` : `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ti ti-users" style="font-size:48px"></i></div>
        <p class="empty-state-title">No users yet.</p>
        <p class="empty-state-body">Add your first user to get started.</p>
      </div>
    `}
  `;

  document.getElementById('btn-add-user').addEventListener('click', showAddUserModal);
}

function showAddUserModal() {
  openModal({
    title: 'Add user',
    body: `
      <div class="field" style="margin-bottom:var(--space-4)">
        <label class="field-label" for="new-user-name">Full name <span class="field-required">Required</span></label>
        <input class="input" type="text" id="new-user-name" autocomplete="name" placeholder="First Last">
      </div>
      <div class="field">
        <label class="field-label" for="new-user-email">Email address <span class="field-required">Required</span></label>
        <input class="input" type="email" id="new-user-email" autocomplete="email" placeholder="user@example.com">
        <p class="field-helper">They'll use this to sign in.</p>
      </div>
      <div id="add-user-error" class="field-error hidden mt-2">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="add-user-error-text"></span>
      </div>
    `,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
             <button class="btn btn-primary" id="confirm-add-user">Create Account</button>`,
    onClose: () => {}
  });

  document.getElementById('confirm-add-user').addEventListener('click', async () => {
    const name  = document.getElementById('new-user-name').value.trim();
    const email = document.getElementById('new-user-email').value.trim();
    const errEl = document.getElementById('add-user-error');
    errEl.classList.add('hidden');

    if (!name || !email) {
      document.getElementById('add-user-error-text').textContent = 'Name and email are required.';
      errEl.classList.remove('hidden');
      return;
    }

    const result = await DB.Users.create({ name, email });
    if (result.error) {
      document.getElementById('add-user-error-text').textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }

    lastCreatedOTP = result.otp;
    closeModal();
    toast(`Account created for ${name}.`);
    renderUsers();
  });
}

function copyOTP() {
  const code = document.getElementById('otp-value')?.textContent;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => toast('Code copied to clipboard.'));
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

async function renderDashboard() {
  const view     = document.querySelector('[data-view="dashboard"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  const [stats, breakdown, alerts, recentAll] = await Promise.all([
    DB.Dashboard.stats(), DB.Dashboard.categoryBreakdown(), DB.Dashboard.trendAlerts(), DB.Submissions.getAllWithMeta()
  ]);
  const maxCount = breakdown[0]?.count || 1;

  const alertsHtml = alerts.length > 0 ? `
    <div class="alert alert-warning mb-8">
      <span class="alert-icon"><i class="ti ti-alert-triangle" style="color:var(--warning);font-size:20px"></i></span>
      <div class="alert-body">
        <p class="alert-title">Trend alert — 3+ submissions in the last 7 days</p>
        ${alerts.map(a => `<p class="alert-message">
          <strong>${escHtml(a.catLabel)} — ${escHtml(a.subLabel)}:</strong> ${a.count} submissions.
          ${a.routedTo ? `Route to ${DB.REPS[a.routedTo]?.name || a.routedTo}.` : ''}
        </p>`).join('')}
      </div>
    </div>
  ` : '';

  const breakdownRows = breakdown.map(row => {
    const pct = Math.round((row.count / maxCount) * 100);
    return `
      <tr>
        <td><span class="badge badge-cat">${escHtml(row.catLabel)}</span></td>
        <td>${escHtml(row.subLabel)}</td>
        <td style="width:180px">
          <div class="trend-bar-wrap"><div class="trend-bar-fill" style="width:${pct}%"></div></div>
        </td>
        <td style="text-align:right;font-weight:700;padding-right:16px">${row.count}</td>
      </tr>
    `;
  }).join('');

  const recentSubs = recentAll.slice(0, 8);
  const recentHtml = recentSubs.map(s => {
    const catLabel = DB.CATEGORIES[s.category]?.label || s.category;
    const subLabel = DB.CATEGORIES[s.category]?.subcategories[s.subcategory] || s.subcategory;
    return `
      <div class="submission-item" onclick="showView('ticket',{id:'${s.id}'})" tabindex="0"
           role="button" onkeydown="if(event.key==='Enter')showView('ticket',{id:'${s.id}'})">
        <div class="submission-item-info">
          <p class="submission-item-title" style="font-size:14px">${escHtml(s.bt?.name || 'Unknown')} — ${escHtml(catLabel)}: ${escHtml(subLabel)}</p>
          <p class="submission-item-meta">${formatDate(s.submittedAt)} · ${statusBadge(s.status)}</p>
        </div>
        <span class="submission-item-arrow"><i class="ti ti-chevron-right" style="font-size:20px"></i></span>
      </div>
    `;
  }).join('');

  view.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1 class="admin-page-title">Dashboard</h1>
        <p class="admin-page-subtitle">Volume, trends, and patterns across all submissions.</p>
      </div>
    </div>

    ${alertsHtml}

    <div class="stat-grid mb-8">
      <div class="stat-card">
        <p class="stat-value">${stats.total}</p>
        <p class="stat-label">Total submissions</p>
      </div>
      <div class="stat-card">
        <p class="stat-value" style="color:var(--warning)">${stats.open}</p>
        <p class="stat-label">Open tickets</p>
      </div>
      <div class="stat-card">
        <p class="stat-value">${stats.thisWeek}</p>
        <p class="stat-label">Last 7 days</p>
      </div>
      <div class="stat-card">
        <p class="stat-value" style="color:var(--success)">${stats.closedWeek}</p>
        <p class="stat-label">Closed this week</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 380px;gap:var(--space-8);align-items:start">
      <div>
        <h3 class="h3 mb-4">Category breakdown</h3>
        <p class="caption text-tertiary mb-6">All time, sorted by volume.</p>
        ${breakdown.length > 0 ? `
          <div class="table-wrapper">
            <table><thead><tr><th>Category</th><th>Subcategory</th><th>Volume</th><th style="text-align:right;padding-right:16px">Count</th></tr></thead>
            <tbody>${breakdownRows}</tbody></table>
          </div>
        ` : `<p class="body text-placeholder">No submissions yet.</p>`}
      </div>
      <div>
        <h3 class="h3 mb-4">Recent activity</h3>
        <p class="caption text-tertiary mb-6">Latest 8 submissions.</p>
        ${recentHtml || `<p class="body text-placeholder">No submissions yet.</p>`}
      </div>
    </div>
  `;
}

// ─── MESSAGES ─────────────────────────────────────────────────────────────────

function renderMessages() {
  const view = document.querySelector('[data-view="messages"]');
  view.innerHTML = `
    <h2 class="h2 mb-6">Messages</h2>
    <div class="empty-state">
      <div class="empty-state-icon"><i class="ti ti-message-2" style="font-size:48px"></i></div>
      <p class="empty-state-title">No messages.</p>
    </div>
  `;
}

// ─── NEWS ─────────────────────────────────────────────────────────────────────

async function renderNews() {
  const view = document.querySelector('[data-view="news"]');
  view.innerHTML = `<p class="body text-tertiary">Loading…</p>`;
  const stories = await DB.News.getAll();

  view.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1 class="admin-page-title">News</h1>
        <p class="admin-page-subtitle">Publish product releases and feature updates to users.</p>
      </div>
      <button class="btn btn-primary" id="btn-new-story">
        <i class="ti ti-pencil" style="font-size:20px" aria-hidden="true"></i>
        New
      </button>
    </div>

    ${stories.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ti ti-news" style="font-size:48px"></i></div>
        <p class="empty-state-title">No News</p>
      </div>
    ` : stories.map(s => renderNewsCard(s, { deletable: true })).join('')}
  `;

  document.getElementById('btn-new-story').addEventListener('click', showComposeNewsModal);
}

function renderNewsCard(n, { deletable = false } = {}) {
  const tags = n.tags || [];
  return `
    <div class="news-card">
      ${n.image ? `<img class="news-card-image" src="${n.image.dataUrl}" alt="">` : ''}
      <div class="news-card-body">
        ${tags.length ? `<div class="news-card-tags">${tags.map(t => `<span class="badge badge-cat">${escHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="flex items-center justify-between gap-3">
          <h3 class="h3">${escHtml(n.title)}</h3>
          ${deletable ? `<button class="btn-icon" aria-label="Delete story" onclick="handleDeleteNews('${n.id}', '${escJs(n.title)}')"><i class="ti ti-trash" style="font-size:18px"></i></button>` : ''}
        </div>
        ${n.subtitle ? `<p class="body text-secondary mt-2">${escHtml(n.subtitle)}</p>` : ''}
        <div class="news-card-content mt-4">${n.bodyHtml}</div>
        <p class="caption text-tertiary mt-4">${formatDate(n.publishedAt)} · ${escHtml(n.authorName)}</p>
      </div>
    </div>
  `;
}

async function handleDeleteNews(id, title) {
  const ok = await confirmDestructive(
    `Delete "${escHtml(title)}"?`,
    'This action cannot be undone. This story will be permanently removed from News for everyone.',
    'Delete Story'
  );
  if (!ok) return;
  await DB.News.delete(id);
  toast('Story deleted.');
  renderNews();
}

let composeImage = null;
let composeTags = [];

function showComposeNewsModal(prefill = null) {
  if (!prefill) { composeImage = null; composeTags = []; }

  openModal({
    title: 'New story',
    body: `
      <div class="field mb-4">
        <label class="field-label" for="news-title">Title <span class="field-required">Required</span></label>
        <input class="input" type="text" id="news-title" placeholder="e.g. Howard Core 2.4 is here" value="${escHtml(prefill?.title || '')}">
      </div>
      <div class="field mb-4">
        <label class="field-label" for="news-subtitle">Subtitle <span style="color:var(--text-placeholder);font-size:13px">Optional</span></label>
        <input class="input" type="text" id="news-subtitle" placeholder="A one-line summary" value="${escHtml(prefill?.subtitle || '')}">
      </div>
      <div class="field mb-4">
        <label class="field-label" for="news-tag-input">Tags <span style="color:var(--text-placeholder);font-size:13px">Optional</span></label>
        <input class="input" type="text" id="news-tag-input" placeholder="Type a tag and press Enter">
        <div class="flex gap-2 mt-2" id="news-tags-list" style="flex-wrap:wrap"></div>
      </div>
      <div class="field mb-4">
        <label class="field-label">Image <span style="color:var(--text-placeholder);font-size:13px">Optional, roughly 12x8</span></label>
        <div class="file-drop ${composeImage ? 'has-file' : ''}" id="news-image-drop" tabindex="0" role="button" aria-label="Attach an image">
          <input type="file" id="news-image-input" accept="image/*" style="display:none">
          <i class="ti ti-photo-up" style="font-size:24px;color:var(--text-placeholder);margin-bottom:8px"></i>
          <p class="caption text-placeholder" id="news-image-status">${composeImage ? 'Image attached — click to replace' : 'Click to attach an image'}</p>
        </div>
      </div>
      <div class="field">
        <label class="field-label" for="news-body">Body <span class="field-required">Required</span></label>
        <div class="richtext-toolbar" id="news-toolbar">
          <button type="button" data-cmd="bold" aria-label="Bold"><i class="ti ti-bold" style="font-size:18px"></i></button>
          <button type="button" data-cmd="italic" aria-label="Italic"><i class="ti ti-italic" style="font-size:18px"></i></button>
          <button type="button" data-cmd="underline" aria-label="Underline"><i class="ti ti-underline" style="font-size:18px"></i></button>
          <button type="button" data-cmd="insertUnorderedList" aria-label="Bullet list"><i class="ti ti-list" style="font-size:18px"></i></button>
          <button type="button" data-cmd="insertOrderedList" aria-label="Numbered list"><i class="ti ti-list-numbers" style="font-size:18px"></i></button>
          <button type="button" data-cmd="formatBlock" data-value="h3" aria-label="Heading"><i class="ti ti-heading" style="font-size:18px"></i></button>
          <button type="button" data-cmd="formatBlock" data-value="p" aria-label="Paragraph"><i class="ti ti-letter-p" style="font-size:18px"></i></button>
        </div>
        <div class="richtext-editable" id="news-body" contenteditable="true" data-placeholder="Write the story...">${prefill?.bodyHtml || ''}</div>
      </div>
      <div id="news-error" class="field-error hidden mt-2">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="news-error-text"></span>
      </div>
    `,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
             <button class="btn btn-primary" id="confirm-publish">Publish</button>`,
    onClose: () => {}
  });

  wireRichTextToolbar(document.getElementById('news-toolbar'), document.getElementById('news-body'));

  const tagInput = document.getElementById('news-tag-input');
  tagInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const val = tagInput.value.trim();
    if (val && !composeTags.includes(val)) {
      composeTags.push(val);
      renderComposeTags();
    }
    tagInput.value = '';
  });
  renderComposeTags();

  const imageDrop  = document.getElementById('news-image-drop');
  const imageInput = document.getElementById('news-image-input');
  imageDrop.addEventListener('click', () => imageInput.click());
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    imageInput.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast('Image must be under 15MB.', 'error'); return; }
    // Opening the cropper's own modal would otherwise destroy this compose
    // modal (only one can be open at a time) — capture the in-progress
    // fields so the compose modal can be faithfully rebuilt afterward.
    const draft = {
      title: document.getElementById('news-title').value,
      subtitle: document.getElementById('news-subtitle').value,
      bodyHtml: document.getElementById('news-body').innerHTML
    };
    openRectCropper(file, { aspect: 3 / 2, outputW: 1200, outputH: 800 }, dataUrl => {
      composeImage = { dataUrl };
      showComposeNewsModal(draft);
    });
  });

  document.getElementById('confirm-publish').addEventListener('click', async () => {
    const title    = document.getElementById('news-title').value.trim();
    const subtitle = document.getElementById('news-subtitle').value.trim();
    const bodyHtml = document.getElementById('news-body').innerHTML.trim();
    const errEl    = document.getElementById('news-error');
    errEl.classList.add('hidden');

    if (!title || !bodyHtml) {
      document.getElementById('news-error-text').textContent = 'Title and body are required.';
      errEl.classList.remove('hidden');
      return;
    }

    await DB.News.create({ title, subtitle, tags: composeTags, image: composeImage, bodyHtml });
    closeModal();
    toast('Story published.');
    renderNews();
  });
}

function renderComposeTags() {
  const wrap = document.getElementById('news-tags-list');
  wrap.innerHTML = composeTags.map((t, i) => `
    <span class="news-tag-chip">${escHtml(t)}<button type="button" aria-label="Remove tag" data-idx="${i}"><i class="ti ti-x" style="font-size:14px"></i></button></span>
  `).join('');
  wrap.querySelectorAll('button[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      composeTags.splice(Number(btn.dataset.idx), 1);
      renderComposeTags();
    });
  });
}

function wireRichTextToolbar(toolbarEl, editableEl) {
  toolbarEl.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      editableEl.focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.value || undefined);
    });
  });
}

// ─── RECTANGULAR IMAGE CROPPER (used for News images) ───────────────────────

function openRectCropper(file, { aspect, outputW, outputH }, onSave) {
  const objectUrl = URL.createObjectURL(file);
  const editorW = 400, editorH = Math.round(400 / aspect);
  let naturalW = 0, naturalH = 0, baseScale = 1;
  const state = { zoom: 1, x: 0, y: 0 };
  let dragging = false, dragStartX = 0, dragStartY = 0, startX = 0, startY = 0;

  openModal({
    title: 'Adjust image',
    body: `
      <div class="avatar-cropper-wrap" id="rect-cropper-wrap" style="width:${editorW}px;height:${editorH}px;border-radius:var(--radius-md)">
        <img id="rect-cropper-img" src="${objectUrl}" alt="" draggable="false">
      </div>
      <div class="field mt-4">
        <label class="field-label" for="rect-zoom">Zoom</label>
        <input type="range" id="rect-zoom" min="1" max="3" step="0.01" value="1" style="width:100%">
      </div>
    `,
    footer: `<button class="btn btn-secondary" id="rect-cancel">Cancel</button>
             <button class="btn btn-primary" id="rect-save">Use Image</button>`,
    onClose: () => URL.revokeObjectURL(objectUrl)
  });

  const img  = document.getElementById('rect-cropper-img');
  const wrap = document.getElementById('rect-cropper-wrap');
  const zoomSlider = document.getElementById('rect-zoom');

  function clampAndApply() {
    const scale = baseScale * state.zoom;
    const w = naturalW * scale, h = naturalH * scale;
    const maxX = Math.max(0, (w - editorW) / 2);
    const maxY = Math.max(0, (h - editorH) / 2);
    state.x = Math.max(-maxX, Math.min(maxX, state.x));
    state.y = Math.max(-maxY, Math.min(maxY, state.y));
    img.style.width  = w + 'px';
    img.style.height = h + 'px';
    img.style.left = `calc(50% - ${w / 2 - state.x}px)`;
    img.style.top  = `calc(50% - ${h / 2 - state.y}px)`;
  }

  img.onload = () => {
    naturalW = img.naturalWidth;
    naturalH = img.naturalHeight;
    baseScale = Math.max(editorW / naturalW, editorH / naturalH);
    state.zoom = 1; state.x = 0; state.y = 0;
    clampAndApply();
  };

  zoomSlider.addEventListener('input', () => {
    state.zoom = parseFloat(zoomSlider.value);
    clampAndApply();
  });

  wrap.addEventListener('pointerdown', e => {
    dragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    startX = state.x; startY = state.y;
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener('pointermove', e => {
    if (!dragging) return;
    state.x = startX + (e.clientX - dragStartX);
    state.y = startY + (e.clientY - dragStartY);
    clampAndApply();
  });
  wrap.addEventListener('pointerup',     () => { dragging = false; });
  wrap.addEventListener('pointercancel', () => { dragging = false; });

  document.getElementById('rect-cancel').addEventListener('click', () => closeModal());

  document.getElementById('rect-save').addEventListener('click', () => {
    const scale = baseScale * state.zoom;
    const outRatio = outputW / editorW;
    const w = naturalW * scale * outRatio, h = naturalH * scale * outRatio;
    const drawX = (outputW - w) / 2 + state.x * outRatio;
    const drawY = (outputH - h) / 2 + state.y * outRatio;

    const canvas = document.createElement('canvas');
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, drawX, drawY, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    closeModal();
    onSave(dataUrl);
  });
}

// ─── AVATAR CROPPER (circular, used in Settings) ────────────────────────────

const AVATAR_EDITOR_SIZE = 280;
const AVATAR_OUTPUT_SIZE = 512;

function openAvatarCropper(file, onSave) {
  const objectUrl = URL.createObjectURL(file);
  let naturalW = 0, naturalH = 0, baseScale = 1;
  const state = { zoom: 1, x: 0, y: 0 };
  let dragging = false, dragStartX = 0, dragStartY = 0, startX = 0, startY = 0;

  openModal({
    title: 'Adjust your photo',
    body: `
      <div class="avatar-cropper-wrap" id="avatar-cropper-wrap">
        <img id="avatar-cropper-img" src="${objectUrl}" alt="" draggable="false">
        <div class="avatar-cropper-mask"></div>
      </div>
      <div class="field mt-4">
        <label class="field-label" for="avatar-zoom">Zoom</label>
        <input type="range" id="avatar-zoom" min="1" max="3" step="0.01" value="1" style="width:100%">
      </div>
    `,
    footer: `<button class="btn btn-secondary" id="avatar-cancel">Cancel</button>
             <button class="btn btn-primary" id="avatar-save">Save Photo</button>`,
    onClose: () => URL.revokeObjectURL(objectUrl)
  });

  const img  = document.getElementById('avatar-cropper-img');
  const wrap = document.getElementById('avatar-cropper-wrap');
  const zoomSlider = document.getElementById('avatar-zoom');

  function clampAndApply() {
    const scale = baseScale * state.zoom;
    const w = naturalW * scale, h = naturalH * scale;
    const maxX = Math.max(0, (w - AVATAR_EDITOR_SIZE) / 2);
    const maxY = Math.max(0, (h - AVATAR_EDITOR_SIZE) / 2);
    state.x = Math.max(-maxX, Math.min(maxX, state.x));
    state.y = Math.max(-maxY, Math.min(maxY, state.y));
    img.style.width  = w + 'px';
    img.style.height = h + 'px';
    img.style.left = `calc(50% - ${w / 2 - state.x}px)`;
    img.style.top  = `calc(50% - ${h / 2 - state.y}px)`;
  }

  img.onload = () => {
    naturalW = img.naturalWidth;
    naturalH = img.naturalHeight;
    baseScale = Math.max(AVATAR_EDITOR_SIZE / naturalW, AVATAR_EDITOR_SIZE / naturalH);
    state.zoom = 1; state.x = 0; state.y = 0;
    clampAndApply();
  };

  zoomSlider.addEventListener('input', () => {
    state.zoom = parseFloat(zoomSlider.value);
    clampAndApply();
  });

  wrap.addEventListener('pointerdown', e => {
    dragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    startX = state.x; startY = state.y;
    wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener('pointermove', e => {
    if (!dragging) return;
    state.x = startX + (e.clientX - dragStartX);
    state.y = startY + (e.clientY - dragStartY);
    clampAndApply();
  });
  wrap.addEventListener('pointerup',     () => { dragging = false; });
  wrap.addEventListener('pointercancel', () => { dragging = false; });

  document.getElementById('avatar-cancel').addEventListener('click', () => closeModal());

  document.getElementById('avatar-save').addEventListener('click', () => {
    const scale = baseScale * state.zoom;
    const outRatio = AVATAR_OUTPUT_SIZE / AVATAR_EDITOR_SIZE;
    const w = naturalW * scale * outRatio, h = naturalH * scale * outRatio;
    const drawX = (AVATAR_OUTPUT_SIZE - w) / 2 + state.x * outRatio;
    const drawY = (AVATAR_OUTPUT_SIZE - h) / 2 + state.y * outRatio;

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_OUTPUT_SIZE;
    canvas.height = AVATAR_OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, drawX, drawY, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    closeModal();
    onSave(dataUrl);
  });
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

function renderSettings() {
  const view = document.querySelector('[data-view="settings"]');
  const s = currentUser.settings || { emailNotifications: true, primaryColor: '#0F7A6C', theme: 'light', textSize: 'regular' };

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

      <hr class="divider mt-6 mb-6">

      <button class="btn btn-destructive" id="delete-account-btn">Delete Account</button>
    </div>

    <div class="card mb-6">
      <h3 class="h3 mb-6">Notifications</h3>
      <div class="flex items-center justify-between">
        <div>
          <p class="body font-bold">Email notifications</p>
          <p class="caption text-tertiary">Receive an email when there's activity on submissions.</p>
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
    e.target.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast('Image must be under 15MB.', 'error'); return; }
    openAvatarCropper(file, async dataUrl => {
      currentUser = await DB.Users.update(currentUser.id, { avatarDataUrl: dataUrl });
      renderSidebarUser();
      renderSettings();
      toast('Profile picture updated.');
    });
  });

  document.getElementById('delete-account-btn').addEventListener('click', async () => {
    const ok = await confirmDestructive(
      `Delete your account, ${escHtml(currentUser.name)}?`,
      'This action cannot be undone. Your account will be permanently removed.',
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function statusBadge(status) {
  const map = { new: ['badge-new','New'], 'in-review': ['badge-review','In Review'], closed: ['badge-closed','Closed'] };
  const [cls, label] = map[status] || ['badge-new', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
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
  document.querySelectorAll('.admin-nav-item[data-target]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.target));
  });

  document.getElementById('admin-sidebar-user-btn')?.addEventListener('click', () => showView('settings'));

  document.getElementById('btn-admin-signout')?.addEventListener('click', async () => {
    await DB.Auth.logout();
    currentUser = null;
    applyAppearance(null);
    renderLoginView();
    showView('login');
  });

  init();
});
