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

  if (name === 'records')    renderRecords();
  if (name === 'dashboard')  renderDashboard();
  if (name === 'beta-testers') renderBetaTesters();
  if (name === 'ticket')     renderTicket(params.id);
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

// ─── AUTH ─────────────────────────────────────────────────────────────────────

function init() {
  DB.seed();
  currentUser = DB.Auth.currentUser();

  if (currentUser && currentUser.role !== 'admin') {
    DB.Auth.logout();
    currentUser = null;
  }

  if (!currentUser) {
    renderLoginView();
    showView('login');
  } else {
    showView('records');
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
    const user     = DB.Auth.login(email, password);

    if (!user || user.role !== 'admin') {
      document.getElementById('a-login-error-text').textContent = 'Email or password is incorrect.';
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In';
      return;
    }

    currentUser = user;
    showView('records');
  });
}

// ─── RECORDS ─────────────────────────────────────────────────────────────────

let recordFilters = { search: '', category: '', status: '', owner: '' };

function renderRecords() {
  const view = document.querySelector('[data-view="records"]');
  view.innerHTML = `
    <div class="admin-page-header">
      <div>
        <h1 class="admin-page-title">Records</h1>
        <p class="admin-page-subtitle">All beta tester submissions, open and closed.</p>
      </div>
    </div>

    <div class="filter-bar">
      <div class="input-wrapper" style="flex:1;min-width:200px">
        <span class="input-icon"><i class="ti ti-search" style="font-size:20px"></i></span>
        <input class="input" type="search" id="rec-search" placeholder="Search BT name, message, subcategory..." value="${escHtml(recordFilters.search)}">
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
          ${DB.Users.getAdmins().map(u => `<option value="${u.id}" ${recordFilters.owner===u.id?'selected':''}>${u.name}</option>`).join('')}
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

function renderRecordsTable() {
  let subs = DB.Submissions.getAllWithMeta();

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
        <p class="empty-state-body">${recordFilters.search || recordFilters.category || recordFilters.status || recordFilters.owner ? 'Try adjusting your filters.' : 'Submissions from beta testers will appear here.'}</p>
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
            <th>Date</th><th>Title</th><th>Beta Tester</th><th>Category</th><th>Subcategory</th>
            <th>Status</th><th>Assigned To</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ─── TICKET DETAIL ────────────────────────────────────────────────────────────

function renderTicket(id) {
  const view = document.querySelector('[data-view="ticket"]');
  const sub  = DB.Submissions.getById(id);
  if (!sub) { view.innerHTML = `<div class="empty-state"><p class="empty-state-title">Ticket not found.</p></div>`; return; }

  const meta   = DB.Submissions.withMeta(sub);
  const bt     = meta.bt;
  const status = meta.status;
  const owner  = meta.owner;
  const catLabel = DB.CATEGORIES[sub.category]?.label || sub.category;
  const subLabel = DB.CATEGORIES[sub.category]?.subcategories[sub.subcategory] || sub.subcategory;
  const events   = DB.Events.getBySubmission(id);

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
        <p class="ticket-meta-label">Beta Tester</p>
        <p class="ticket-meta-value">${escHtml(bt?.name || 'Unknown')} <span class="caption text-placeholder">${escHtml(bt?.email || '')}</span></p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 340px;gap:var(--space-8);align-items:start">
      <div>
        <h3 class="h3 mb-6">Event Log</h3>
        <div class="event-log" id="event-log">
          ${events.map(ev => renderEventItem(ev, sub)).join('')}
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

  document.getElementById('btn-claim')?.addEventListener('click', () => {
    DB.Events.claim(id, currentUser.id);
    toast('Ticket claimed.');
    renderTicket(id);
  });

  document.getElementById('btn-reassign')?.addEventListener('click', () => {
    const other = DB.Users.getAdmins().find(u => u.id !== currentUser.id);
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
    document.getElementById('confirm-reassign').addEventListener('click', () => {
      const reason = document.getElementById('reassign-reason').value.trim();
      DB.Events.reassign(id, currentUser.id, other.id, reason);
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
    document.getElementById('confirm-note').addEventListener('click', () => {
      const content = document.getElementById('note-content').value.trim();
      if (!content) { toast('Note cannot be empty.', 'error'); return; }
      DB.Events.addNote(id, currentUser.id, content);
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
    document.getElementById('confirm-close').addEventListener('click', () => {
      const note = document.getElementById('close-note')?.value.trim() || '';
      DB.Events.close(id, currentUser.id, note);
      closeModal();
      toast('Ticket closed.');
      renderTicket(id);
    });
  });
}

function renderEventItem(ev, sub) {
  const rep     = ev.repId ? DB.Users.getById(ev.repId) : null;
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
      const toRep = ev.data.toRepId ? DB.Users.getById(ev.data.toRepId) : null;
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

// ─── BETA TESTERS ─────────────────────────────────────────────────────────────

let lastCreatedOTP = null;

function renderBetaTesters() {
  const view = document.querySelector('[data-view="beta-testers"]');
  const bts  = DB.Users.getBTs().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const rows = bts.map(u => {
    const subCount = DB.Submissions.getByBT(u.id).length;
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
        <h1 class="admin-page-title">Beta Testers</h1>
        <p class="admin-page-subtitle">All BT accounts. New accounts are created here and activated manually.</p>
      </div>
      <button class="btn btn-primary" id="btn-add-bt">
        <i class="ti ti-user-plus" style="font-size:20px" aria-hidden="true"></i>
        Add Beta Tester
      </button>
    </div>

    ${lastCreatedOTP ? `
      <div class="alert alert-info mb-6" id="otp-alert">
        <span class="alert-icon"><i class="ti ti-info-circle" style="color:var(--action);font-size:20px"></i></span>
        <div class="alert-body">
          <p class="alert-title">Account created — share this one-time code</p>
          <p class="alert-message">The beta tester will use this code on their first sign-in to set their password. Share it directly (text, call, or in person).</p>
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

    ${bts.length > 0 ? `
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
        <p class="empty-state-title">No beta testers yet.</p>
        <p class="empty-state-body">Add your first beta tester to get started.</p>
      </div>
    `}
  `;

  document.getElementById('btn-add-bt').addEventListener('click', showAddBTModal);
}

function showAddBTModal() {
  openModal({
    title: 'Add beta tester',
    body: `
      <div class="field" style="margin-bottom:var(--space-4)">
        <label class="field-label" for="bt-name">Full name <span class="field-required">Required</span></label>
        <input class="input" type="text" id="bt-name" autocomplete="name" placeholder="First Last">
      </div>
      <div class="field">
        <label class="field-label" for="bt-email">Email address <span class="field-required">Required</span></label>
        <input class="input" type="email" id="bt-email" autocomplete="email" placeholder="tester@example.com">
        <p class="field-helper">They'll use this to sign in.</p>
      </div>
      <div id="add-bt-error" class="field-error hidden mt-2">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="add-bt-error-text"></span>
      </div>
    `,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
             <button class="btn btn-primary" id="confirm-add-bt">Create Account</button>`,
    onClose: () => {}
  });

  document.getElementById('confirm-add-bt').addEventListener('click', () => {
    const name  = document.getElementById('bt-name').value.trim();
    const email = document.getElementById('bt-email').value.trim();
    const errEl = document.getElementById('add-bt-error');
    errEl.classList.add('hidden');

    if (!name || !email) {
      document.getElementById('add-bt-error-text').textContent = 'Name and email are required.';
      errEl.classList.remove('hidden');
      return;
    }

    const result = DB.Users.create({ name, email });
    if (result.error) {
      document.getElementById('add-bt-error-text').textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }

    lastCreatedOTP = result.otp;
    closeModal();
    toast(`Account created for ${name}.`);
    renderBetaTesters();
  });
}

function copyOTP() {
  const code = document.getElementById('otp-value')?.textContent;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => toast('Code copied to clipboard.'));
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function renderDashboard() {
  const view     = document.querySelector('[data-view="dashboard"]');
  const stats    = DB.Dashboard.stats();
  const breakdown = DB.Dashboard.categoryBreakdown();
  const alerts   = DB.Dashboard.trendAlerts();
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

  const recentSubs = DB.Submissions.getAllWithMeta().slice(0, 8);
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

// ─── BOOT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.admin-nav-item[data-target]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.target));
  });

  document.getElementById('btn-admin-signout')?.addEventListener('click', () => {
    DB.Auth.logout();
    currentUser = null;
    renderLoginView();
    showView('login');
  });

  init();
});
