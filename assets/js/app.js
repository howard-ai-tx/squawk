'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────

let currentEA = null;

// ─── ROUTER ───────────────────────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('[data-view]').forEach(el => el.classList.add('hidden'));
  const el = document.querySelector(`[data-view="${name}"]`);
  if (el) el.classList.remove('hidden');

  const shell = document.getElementById('app-shell');
  if (name === 'login') {
    shell.classList.add('hidden');
  } else {
    shell.classList.remove('hidden');
  }

  document.querySelectorAll('.app-nav-link[data-target]').forEach(a => {
    a.classList.toggle('active', a.dataset.target === name);
  });

  if (name === 'home')          renderHome();
  if (name === 'status')        renderStatus();
  if (name === 'feedback')      renderFeedback();
  if (name === 'bug')           renderBug();
  if (name === 'contact')       renderContact();
  if (name === 'representing')  renderRepresenting();
  if (name === 'refer')         renderRefer();
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function toast(message, type = 'success') {
  const colors = { success: '#34C759', error: '#FF3B30' };
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<i class="ti ti-circle-check" style="color:${colors[type] || colors.success};flex-shrink:0"></i><span>${message}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 4000);
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

async function init() {
  currentEA = await DB.Auth.currentEarlyAdopter();
  if (!currentEA) {
    renderLoginView();
    showView('login');
  } else {
    showView('home');
  }
}

function renderLoginView() {
  const view = document.querySelector('[data-view="login"]');
  view.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <p class="login-wordmark">Howard AI</p>
        <h1 class="login-title">Early Adopters</h1>
        <p class="login-subtitle">Sign in to your account.</p>
        <form class="login-form" id="login-form" novalidate>
          <div class="field">
            <label class="field-label" for="login-email">Email address</label>
            <input class="input" type="email" id="login-email" autocomplete="email" required>
          </div>
          <div class="field">
            <label class="field-label" for="login-password">Password</label>
            <input class="input" type="password" id="login-password" autocomplete="current-password" required>
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
    <h1 class="h1 mb-6">${escHtml(currentEA.name.split(' ')[0])}</h1>
    <span class="status-pill ${currentEA.installStatus === 'installed' ? 'is-installed' : 'is-scheduled'}">
      <span class="status-dot"></span> Install status: ${label}
    </span>
  `;
}

// ─── STATUS ───────────────────────────────────────────────────────────────────

function renderStatus() {
  const view = document.querySelector('[data-view="status"]');
  const isInstalled = currentEA.installStatus === 'installed';
  view.innerHTML = `
    <h1 class="h1 mb-6">Status</h1>
    <span class="status-pill ${isInstalled ? 'is-installed' : 'is-scheduled'}" style="font-size:16px;padding:10px 20px">
      <span class="status-dot"></span> ${isInstalled ? 'Installed' : 'Scheduled'}
    </span>
  `;
}

// ─── SUBMIT FEEDBACK ──────────────────────────────────────────────────────────

function renderFeedback() {
  const view = document.querySelector('[data-view="feedback"]');
  view.innerHTML = `
    <h1 class="h1 mb-6">Submit Feedback</h1>
    <form id="feedback-form" novalidate>
      <div class="field mb-6">
        <label class="field-label" for="feedback-message">Your feedback</label>
        <textarea class="input" id="feedback-message" placeholder="Share anything — a request, a reaction, a thought."></textarea>
      </div>
      <div id="feedback-error" class="field-error hidden mb-4">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="feedback-error-text"></span>
      </div>
      <button type="submit" class="btn btn-primary" id="feedback-btn">Submit</button>
    </form>
  `;

  document.getElementById('feedback-form').addEventListener('submit', async e => {
    e.preventDefault();
    const message = document.getElementById('feedback-message').value.trim();
    const errEl = document.getElementById('feedback-error');
    errEl.classList.add('hidden');
    if (!message) {
      document.getElementById('feedback-error-text').textContent = 'Please enter your feedback.';
      errEl.classList.remove('hidden');
      return;
    }
    const btn = document.getElementById('feedback-btn');
    btn.disabled = true;
    try {
      await DB.Feedback.submit(message);
      toast('Feedback submitted.');
      document.getElementById('feedback-message').value = '';
    } catch (err) {
      document.getElementById('feedback-error-text').textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── REPORT A BUG ─────────────────────────────────────────────────────────────

function renderBug() {
  const view = document.querySelector('[data-view="bug"]');
  view.innerHTML = `
    <h1 class="h1 mb-6">Report a Bug</h1>
    <form id="bug-form" novalidate>
      <div class="field mb-4">
        <label class="field-label" for="bug-happened">What happened</label>
        <textarea class="input" id="bug-happened" style="min-height:100px"></textarea>
      </div>
      <div class="field mb-4">
        <label class="field-label" for="bug-expected">What you expected</label>
        <textarea class="input" id="bug-expected" style="min-height:100px"></textarea>
      </div>
      <div class="field mb-6">
        <label class="field-label" for="bug-urgency">Urgency</label>
        <div class="select-wrapper">
          <select class="input" id="bug-urgency">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
          <span class="select-chevron"><i class="ti ti-chevron-down" style="font-size:20px"></i></span>
        </div>
      </div>
      <div id="bug-error" class="field-error hidden mb-4">
        <i class="ti ti-alert-circle" style="font-size:16px"></i>
        <span id="bug-error-text"></span>
      </div>
      <button type="submit" class="btn btn-primary" id="bug-btn">Submit</button>
    </form>
  `;

  document.getElementById('bug-form').addEventListener('submit', async e => {
    e.preventDefault();
    const whatHappened = document.getElementById('bug-happened').value.trim();
    const expected = document.getElementById('bug-expected').value.trim();
    const urgency = document.getElementById('bug-urgency').value;
    const errEl = document.getElementById('bug-error');
    errEl.classList.add('hidden');
    if (!whatHappened || !expected) {
      document.getElementById('bug-error-text').textContent = 'Please fill in both fields.';
      errEl.classList.remove('hidden');
      return;
    }
    const btn = document.getElementById('bug-btn');
    btn.disabled = true;
    try {
      await DB.Bugs.submit({ whatHappened, expected, urgency });
      toast('Bug report submitted.');
      document.getElementById('bug-happened').value = '';
      document.getElementById('bug-expected').value = '';
    } catch (err) {
      document.getElementById('bug-error-text').textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── CONTACT US ───────────────────────────────────────────────────────────────

function renderContact() {
  const view = document.querySelector('[data-view="contact"]');
  view.innerHTML = `
    <h1 class="h1 mb-2">Contact Us</h1>
    <p class="body text-secondary mb-6">This goes directly to Hendrik and Tucker.</p>
    <form id="contact-form" novalidate>
      <div class="field mb-6">
        <label class="field-label" for="contact-message">Message</label>
        <textarea class="input" id="contact-message"></textarea>
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
    <h1 class="h1 mb-6">Representing HowardAI</h1>
    <p class="body mb-6">As an Early Adopter, you may be asked about Howard by people around you. This page outlines what to share and how.</p>

    <h3 class="h3 mb-2">What you may discuss</h3>
    <p class="body text-secondary mb-6">Howard is a locally hosted AI assistant that operates entirely on dedicated hardware, with no cloud dependency. You may describe your own experience using it — what it handles for you, and that you are among its first users.</p>

    <h3 class="h3 mb-2">What to avoid</h3>
    <p class="body text-secondary mb-6">Do not speak to anything beyond your own direct experience. Technical specifics, product roadmap, or details you have not personally observed should not be discussed. If a question falls outside what you know, direct the person to howardai.us rather than speculating.</p>

    <h3 class="h3 mb-2">Tone</h3>
    <p class="body text-secondary mb-8">Represent Howard the way it represents itself: plainly, and without embellishment. Understatement carries more weight than enthusiasm.</p>

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
    <h1 class="h1 mb-6">Refer Someone</h1>

    <div class="field mb-6">
      <label class="field-label mb-2">Your referral link</label>
      <div class="referral-link-box" id="referral-link">${link}</div>
      <button class="btn btn-secondary btn-sm mt-2" id="copy-link-btn">
        <i class="ti ti-copy" style="font-size:16px"></i> Copy Link
      </button>
    </div>

    <div class="field">
      <label class="field-label mb-2">A note you can forward</label>
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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.app-nav-link[data-target]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.target));
  });

  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await DB.Auth.logout();
    currentEA = null;
    renderLoginView();
    showView('login');
  });

  init();
});
