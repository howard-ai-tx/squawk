import {
  json, error, genId, hashPassword, verifyPassword, corsHeaders,
  earlyAdopterToJson, earlyAdopterToAdminJson, notificationToJson,
  feedbackToJson, bugToJson, messageToJson,
  feedbackToAdminJson, bugToAdminJson
} from './util.js';

const SESSION_TTL_MS = 86400000; // 24h
const MAX_AVATAR_BYTES = 250000; // ~250KB data URL, keeps rows small
const MAX_ATTACHMENT_BYTES = 600000; // ~600KB data URL, client-resized before upload

async function getEARow(db, id) {
  return db.prepare('SELECT * FROM early_adopters WHERE id = ?').bind(id).first();
}

async function notifyAdmins(db, { type, title, body, link }) {
  await db.prepare('INSERT INTO notifications (id, audience, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(genId('note'), 'admin', type, title, body || null, link || null, new Date().toISOString()).run();
}

async function notifyEA(db, eaId, { type, title, body, link }) {
  await db.prepare('INSERT INTO notifications (id, ea_id, type, title, body, link, created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(genId('note'), eaId, type, title, body || null, link || null, new Date().toISOString()).run();
}

async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const session = await env.earlyadopter_db.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
  if (!session || session.expires_at < Date.now()) return null;
  const eaRow = await getEARow(env.earlyadopter_db, session.ea_id);
  if (!eaRow) return null;
  return { session, eaRow };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const db = env.earlyadopter_db;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const path = url.pathname.replace(/\/+$/, '') || '/';

    try {
      // ── AUTH ──────────────────────────────────────────────────────────────
      if (path === '/auth/login' && request.method === 'POST') {
        const { email, password } = await request.json();
        const row = await db.prepare('SELECT * FROM early_adopters WHERE lower(email) = lower(?)').bind(email).first();
        if (row && row.activation_token && !row.password_hash) {
          return error('This account hasn’t been activated yet. Check for your activation link, or ask Hendrik or Tucker to resend it.', 401, origin);
        }
        if (!row || !row.password_hash) return error('Email or password is incorrect.', 401, origin);
        const ok = await verifyPassword(password, row.password_salt, row.password_hash);
        if (!ok) return error('Email or password is incorrect.', 401, origin);
        const token = genId('sess');
        await db.prepare('INSERT INTO sessions (token, ea_id, expires_at) VALUES (?, ?, ?)')
          .bind(token, row.id, Date.now() + SESSION_TTL_MS).run();
        return json({ token, earlyAdopter: earlyAdopterToJson(row) }, 200, origin);
      }

      if (path === '/auth/check-activation' && request.method === 'POST') {
        const { token } = await request.json();
        const row = await db.prepare('SELECT id, name FROM early_adopters WHERE activation_token = ?').bind(token).first();
        return json({ valid: !!row, name: row?.name || null }, 200, origin);
      }

      if (path === '/auth/activate' && request.method === 'POST') {
        const { token, password } = await request.json();
        if (!password || password.length < 8) return error('Password must be at least 8 characters.', 400, origin);
        const row = await db.prepare('SELECT * FROM early_adopters WHERE activation_token = ?').bind(token).first();
        if (!row) return error('That link is invalid or has already been used.', 401, origin);
        const { hash, salt } = await hashPassword(password);
        await db.prepare('UPDATE early_adopters SET password_hash = ?, password_salt = ?, activation_token = NULL WHERE id = ?')
          .bind(hash, salt, row.id).run();
        const sessToken = genId('sess');
        await db.prepare('INSERT INTO sessions (token, ea_id, expires_at) VALUES (?, ?, ?)')
          .bind(sessToken, row.id, Date.now() + SESSION_TTL_MS).run();
        const updated = await getEARow(db, row.id);
        return json({ token: sessToken, earlyAdopter: earlyAdopterToJson(updated) }, 200, origin);
      }

      if (path === '/auth/logout' && request.method === 'POST') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === '/auth/me' && request.method === 'GET') {
        const auth = await requireAuth(request, env);
        if (!auth) return error('Not authenticated.', 401, origin);
        return json({ earlyAdopter: earlyAdopterToJson(auth.eaRow) }, 200, origin);
      }

      // Everything past this point requires a valid session.
      const auth = await requireAuth(request, env);
      if (!auth) return error('Not authenticated.', 401, origin);
      const { eaRow: me } = auth;

      // ── MY ACTIVITY (Home page summary) ─────────────────────────────────
      if (path === '/me/stats' && request.method === 'GET') {
        const [feedbackCount, bugCount, messageCount] = await Promise.all([
          db.prepare('SELECT COUNT(*) n FROM feedback WHERE ea_id = ?').bind(me.id).first(),
          db.prepare('SELECT COUNT(*) n FROM bug_reports WHERE ea_id = ?').bind(me.id).first(),
          db.prepare("SELECT COUNT(*) n FROM messages WHERE ea_id = ? AND sender = 'ea'").bind(me.id).first()
        ]);
        return json({
          feedbackCount: feedbackCount.n,
          bugCount: bugCount.n,
          contactCount: messageCount.n
        }, 200, origin);
      }

      // ── MY PROFILE ────────────────────────────────────────────────────────
      if (path === '/me/profile' && request.method === 'PATCH') {
        const { name, email } = await request.json();
        if (!name || !name.trim()) return error('Name is required.', 400, origin);
        if (!email || !email.trim()) return error('Email is required.', 400, origin);
        const existing = await db.prepare('SELECT id FROM early_adopters WHERE lower(email) = lower(?) AND id != ?')
          .bind(email.trim(), me.id).first();
        if (existing) return error('That email address is already in use.', 400, origin);
        await db.prepare('UPDATE early_adopters SET name = ?, email = ? WHERE id = ?')
          .bind(name.trim(), email.trim(), me.id).run();
        const updated = await getEARow(db, me.id);
        return json({ earlyAdopter: earlyAdopterToJson(updated) }, 200, origin);
      }

      if (path === '/me/password' && request.method === 'PATCH') {
        const { currentPassword, newPassword } = await request.json();
        if (!newPassword || newPassword.length < 8) return error('New password must be at least 8 characters.', 400, origin);
        const ok = await verifyPassword(currentPassword || '', me.password_salt, me.password_hash);
        if (!ok) return error('Current password is incorrect.', 401, origin);
        const { hash, salt } = await hashPassword(newPassword);
        await db.prepare('UPDATE early_adopters SET password_hash = ?, password_salt = ? WHERE id = ?')
          .bind(hash, salt, me.id).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === '/me/avatar' && request.method === 'POST') {
        const { dataUrl } = await request.json();
        if (dataUrl && dataUrl.length > MAX_AVATAR_BYTES) {
          return error('That image is too large. Try a smaller photo.', 400, origin);
        }
        await db.prepare('UPDATE early_adopters SET avatar = ? WHERE id = ?').bind(dataUrl || null, me.id).run();
        const updated = await getEARow(db, me.id);
        return json({ earlyAdopter: earlyAdopterToJson(updated) }, 200, origin);
      }

      if (path === '/me/settings' && request.method === 'PATCH') {
        const { reducedMotion } = await request.json();
        await db.prepare('UPDATE early_adopters SET reduced_motion = ? WHERE id = ?')
          .bind(reducedMotion ? 1 : 0, me.id).run();
        const updated = await getEARow(db, me.id);
        return json({ earlyAdopter: earlyAdopterToJson(updated) }, 200, origin);
      }

      if (path === '/me' && request.method === 'DELETE') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        await db.prepare('DELETE FROM early_adopters WHERE id = ?').bind(me.id).run();
        if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
        return json({ ok: true }, 200, origin);
      }

      // ── NOTIFICATIONS ─────────────────────────────────────────────────────
      if (path === '/me/notifications' && request.method === 'GET') {
        const rows = me.is_admin
          ? await db.prepare('SELECT * FROM notifications WHERE audience = ? OR ea_id = ? ORDER BY created_at DESC LIMIT 50').bind('admin', me.id).all()
          : await db.prepare('SELECT * FROM notifications WHERE ea_id = ? ORDER BY created_at DESC LIMIT 50').bind(me.id).all();
        const unread = me.is_admin
          ? await db.prepare('SELECT COUNT(*) n FROM notifications WHERE (audience = ? OR ea_id = ?) AND read_at IS NULL').bind('admin', me.id).first()
          : await db.prepare('SELECT COUNT(*) n FROM notifications WHERE ea_id = ? AND read_at IS NULL').bind(me.id).first();
        return json({ notifications: rows.results.map(notificationToJson), unreadCount: unread.n }, 200, origin);
      }

      if (path === '/me/notifications/read-all' && request.method === 'POST') {
        const now = new Date().toISOString();
        if (me.is_admin) {
          await db.prepare('UPDATE notifications SET read_at = ? WHERE (audience = ? OR ea_id = ?) AND read_at IS NULL').bind(now, 'admin', me.id).run();
        } else {
          await db.prepare('UPDATE notifications SET read_at = ? WHERE ea_id = ? AND read_at IS NULL').bind(now, me.id).run();
        }
        return json({ ok: true }, 200, origin);
      }

      if (path === '/me/notifications' && request.method === 'DELETE') {
        if (me.is_admin) {
          await db.prepare('DELETE FROM notifications WHERE audience = ? OR ea_id = ?').bind('admin', me.id).run();
        } else {
          await db.prepare('DELETE FROM notifications WHERE ea_id = ?').bind(me.id).run();
        }
        return json({ ok: true }, 200, origin);
      }

      if (path.startsWith('/me/notifications/') && path.endsWith('/read') && request.method === 'POST') {
        const notifId = path.split('/')[3];
        await db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND (ea_id = ? OR audience = ?)')
          .bind(new Date().toISOString(), notifId, me.id, me.is_admin ? 'admin' : '__none__').run();
        return json({ ok: true }, 200, origin);
      }

      // ── MESSAGES (EA's conversation thread with HowardAI) ────────────────
      if (path === '/messages' && request.method === 'GET') {
        const rows = await db.prepare('SELECT * FROM messages WHERE ea_id = ? ORDER BY created_at ASC').bind(me.id).all();
        await db.prepare("UPDATE messages SET read_at = ? WHERE ea_id = ? AND sender = 'admin' AND read_at IS NULL")
          .bind(new Date().toISOString(), me.id).run();
        return json({ messages: rows.results.map(messageToJson) }, 200, origin);
      }

      if (path === '/messages' && request.method === 'POST') {
        const { message, attachment } = await request.json();
        const text = (message || '').trim();
        if (!text && !attachment) return error('Message cannot be empty.', 400, origin);
        if (attachment && attachment.length > MAX_ATTACHMENT_BYTES) return error('That image is too large.', 400, origin);
        const id = genId('msg');
        await db.prepare("INSERT INTO messages (id, ea_id, sender, message, attachment, created_at) VALUES (?, ?, 'ea', ?, ?, ?)")
          .bind(id, me.id, text, attachment || null, new Date().toISOString()).run();
        const row = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first();
        await notifyAdmins(db, {
          type: 'contact',
          title: `New message from ${me.name}`,
          body: text ? text.slice(0, 140) : 'Sent a photo.',
          link: `admin-conversation:${me.id}`
        });
        return json(messageToJson(row), 200, origin);
      }

      // ── ADMINISTRATOR PLATFORM (read-only over EA data; view, not create) ──
      if (path.startsWith('/admin/')) {
        if (!me.is_admin) return error('Not authorized.', 403, origin);
        const parts = path.split('/').filter(Boolean); // ['admin', ...]

        if (parts.length === 2 && parts[1] === 'overview' && request.method === 'GET') {
          const [totals, statusCounts, severityCounts, feedbackImportance, pending] = await Promise.all([
            db.prepare('SELECT COUNT(*) n FROM early_adopters').first(),
            db.prepare("SELECT install_status, COUNT(*) n FROM early_adopters GROUP BY install_status").all(),
            db.prepare('SELECT severity, COUNT(*) n FROM bug_reports GROUP BY severity').all(),
            db.prepare('SELECT importance, COUNT(*) n FROM feedback GROUP BY importance').all(),
            db.prepare('SELECT COUNT(*) n FROM early_adopters WHERE activation_token IS NOT NULL AND password_hash IS NULL').first()
          ]);
          const [feedbackTotal, bugTotal, contactTotal] = await Promise.all([
            db.prepare('SELECT COUNT(*) n FROM feedback').first(),
            db.prepare('SELECT COUNT(*) n FROM bug_reports').first(),
            db.prepare("SELECT COUNT(*) n FROM messages WHERE sender = 'ea'").first()
          ]);
          const toMap = rows => Object.fromEntries(rows.results.map(r => [r.install_status || r.severity || r.importance, r.n]));
          return json({
            totalEarlyAdopters: totals.n,
            pendingActivation: pending.n,
            installStatusCounts: toMap(statusCounts),
            bugSeverityCounts: toMap(severityCounts),
            feedbackImportanceCounts: toMap(feedbackImportance),
            feedbackTotal: feedbackTotal.n,
            bugTotal: bugTotal.n,
            contactTotal: contactTotal.n
          }, 200, origin);
        }

        if (parts.length === 2 && parts[1] === 'early-adopters' && request.method === 'GET') {
          const rows = await db.prepare(`
            SELECT ea.*,
              (SELECT COUNT(*) FROM feedback f WHERE f.ea_id = ea.id) feedback_count,
              (SELECT COUNT(*) FROM bug_reports b WHERE b.ea_id = ea.id) bug_count,
              (SELECT COUNT(*) FROM messages m WHERE m.ea_id = ea.id AND m.sender = 'ea') message_count
            FROM early_adopters ea
            ORDER BY ea.created_at DESC
          `).all();
          return json({ earlyAdopters: rows.results.map(earlyAdopterToAdminJson) }, 200, origin);
        }

        if (parts.length === 3 && parts[1] === 'early-adopters' && request.method === 'GET') {
          const eaId = parts[2];
          const row = await db.prepare(`
            SELECT ea.*,
              (SELECT COUNT(*) FROM feedback f WHERE f.ea_id = ea.id) feedback_count,
              (SELECT COUNT(*) FROM bug_reports b WHERE b.ea_id = ea.id) bug_count,
              (SELECT COUNT(*) FROM messages m WHERE m.ea_id = ea.id AND m.sender = 'ea') message_count
            FROM early_adopters ea WHERE ea.id = ?
          `).bind(eaId).first();
          if (!row) return error('Early Adopter not found.', 404, origin);
          const [feedbackRows, bugRows] = await Promise.all([
            db.prepare('SELECT * FROM feedback WHERE ea_id = ? ORDER BY created_at DESC').bind(eaId).all(),
            db.prepare('SELECT * FROM bug_reports WHERE ea_id = ? ORDER BY created_at DESC').bind(eaId).all()
          ]);
          return json({
            earlyAdopter: earlyAdopterToAdminJson(row),
            feedback: feedbackRows.results.map(feedbackToJson),
            bugs: bugRows.results.map(bugToJson)
          }, 200, origin);
        }

        if (parts.length === 4 && parts[1] === 'early-adopters' && parts[3] === 'status' && request.method === 'PATCH') {
          const eaId = parts[2];
          const { installStatus } = await request.json();
          if (!['scheduled', 'installed'].includes(installStatus)) {
            return error('installStatus must be "scheduled" or "installed".', 400, origin);
          }
          const before = await db.prepare('SELECT install_status FROM early_adopters WHERE id = ?').bind(eaId).first();
          if (!before) return error('Early Adopter not found.', 404, origin);
          await db.prepare('UPDATE early_adopters SET install_status = ? WHERE id = ?').bind(installStatus, eaId).run();
          if (before.install_status !== installStatus) {
            await notifyEA(db, eaId, {
              type: 'system',
              title: installStatus === 'installed' ? 'Your install is complete' : 'Your install status changed',
              body: installStatus === 'installed'
                ? 'Howard has been marked as installed on your account.'
                : "Your install status was updated to 'Scheduled'.",
              link: 'home'
            });
          }
          const row = await db.prepare('SELECT * FROM early_adopters WHERE id = ?').bind(eaId).first();
          return json({ earlyAdopter: earlyAdopterToAdminJson(row) }, 200, origin);
        }

        if (parts.length === 2 && parts[1] === 'feedback' && request.method === 'GET') {
          const rows = await db.prepare(`
            SELECT f.*, ea.name ea_name, ea.email ea_email FROM feedback f
            JOIN early_adopters ea ON ea.id = f.ea_id ORDER BY f.created_at DESC
          `).all();
          return json({ feedback: rows.results.map(feedbackToAdminJson) }, 200, origin);
        }

        if (parts.length === 2 && parts[1] === 'bugs' && request.method === 'GET') {
          const rows = await db.prepare(`
            SELECT b.*, ea.name ea_name, ea.email ea_email FROM bug_reports b
            JOIN early_adopters ea ON ea.id = b.ea_id ORDER BY b.created_at DESC
          `).all();
          return json({ bugs: rows.results.map(bugToAdminJson) }, 200, origin);
        }

        // Conversation list: one row per EA who has ever messaged, most
        // recently active first, with a preview of the last message and how
        // many of the EA's messages are still unread by any admin.
        if (parts.length === 2 && parts[1] === 'conversations' && request.method === 'GET') {
          const rows = await db.prepare(`
            SELECT ea.id ea_id, ea.name ea_name, ea.email ea_email, ea.avatar ea_avatar,
              (SELECT message FROM messages m WHERE m.ea_id = ea.id ORDER BY m.created_at DESC LIMIT 1) last_message,
              (SELECT sender FROM messages m WHERE m.ea_id = ea.id ORDER BY m.created_at DESC LIMIT 1) last_sender,
              (SELECT created_at FROM messages m WHERE m.ea_id = ea.id ORDER BY m.created_at DESC LIMIT 1) last_at,
              (SELECT COUNT(*) FROM messages m WHERE m.ea_id = ea.id AND m.sender = 'ea' AND m.read_at IS NULL) unread_count
            FROM early_adopters ea
            WHERE EXISTS (SELECT 1 FROM messages m WHERE m.ea_id = ea.id)
            ORDER BY last_at DESC
          `).all();
          return json({
            conversations: rows.results.map(r => ({
              eaId: r.ea_id, eaName: r.ea_name, eaEmail: r.ea_email, eaAvatar: r.ea_avatar || null,
              lastMessage: r.last_message, lastSender: r.last_sender, lastAt: r.last_at, unreadCount: r.unread_count
            }))
          }, 200, origin);
        }

        // Full thread with one EA + mark their messages as read by opening it.
        if (parts.length === 3 && parts[1] === 'conversations' && request.method === 'GET') {
          const eaId = parts[2];
          const eaRow = await getEARow(db, eaId);
          if (!eaRow) return error('Early Adopter not found.', 404, origin);
          const rows = await db.prepare('SELECT * FROM messages WHERE ea_id = ? ORDER BY created_at ASC').bind(eaId).all();
          await db.prepare("UPDATE messages SET read_at = ? WHERE ea_id = ? AND sender = 'ea' AND read_at IS NULL")
            .bind(new Date().toISOString(), eaId).run();
          return json({
            earlyAdopter: { id: eaRow.id, name: eaRow.name, email: eaRow.email, avatar: eaRow.avatar || null },
            messages: rows.results.map(messageToJson)
          }, 200, origin);
        }

        // Admin reply into an EA's thread.
        if (parts.length === 4 && parts[1] === 'conversations' && parts[3] === 'messages' && request.method === 'POST') {
          const eaId = parts[2];
          const eaRow = await getEARow(db, eaId);
          if (!eaRow) return error('Early Adopter not found.', 404, origin);
          const { message, attachment } = await request.json();
          const text = (message || '').trim();
          if (!text && !attachment) return error('Message cannot be empty.', 400, origin);
          if (attachment && attachment.length > MAX_ATTACHMENT_BYTES) return error('That image is too large.', 400, origin);
          const id = genId('msg');
          await db.prepare("INSERT INTO messages (id, ea_id, sender, message, attachment, created_at) VALUES (?, ?, 'admin', ?, ?, ?)")
            .bind(id, eaId, text, attachment || null, new Date().toISOString()).run();
          const row = await db.prepare('SELECT * FROM messages WHERE id = ?').bind(id).first();
          await notifyEA(db, eaId, {
            type: 'contact',
            title: 'New reply from HowardAI',
            body: text ? text.slice(0, 140) : 'Sent a photo.',
            link: 'contact'
          });
          return json(messageToJson(row), 200, origin);
        }

        return error('Not found.', 404, origin);
      }

      // ── FEEDBACK ──────────────────────────────────────────────────────────
      if (path === '/feedback' && request.method === 'POST') {
        const f = await request.json();
        if (!f.feedbackType || !f.importance || !f.message || !f.message.trim()) {
          return error('Feedback type, importance, and details are required.', 400, origin);
        }
        const id = genId('fb');
        await db.prepare(`INSERT INTO feedback (id, ea_id, feedback_type, importance, message, where_encountered, additional_notes, created_at) VALUES (?,?,?,?,?,?,?,?)`)
          .bind(id, me.id, f.feedbackType, f.importance, f.message.trim(), f.whereEncountered?.trim() || null, f.additionalNotes?.trim() || null, new Date().toISOString()).run();
        const row = await db.prepare('SELECT * FROM feedback WHERE id = ?').bind(id).first();
        await notifyAdmins(db, {
          type: 'feedback',
          title: `New feedback from ${me.name}`,
          body: f.message.trim().slice(0, 140),
          link: 'admin-feedback'
        });
        return json(feedbackToJson(row), 200, origin);
      }

      // ── BUG REPORTS ───────────────────────────────────────────────────────
      if (path === '/bugs' && request.method === 'POST') {
        const b = await request.json();
        if (!b.title || !b.issueType || !b.severity || !b.whatHappened || !b.expected) {
          return error('Title, issue type, severity, what happened, and expected result are required.', 400, origin);
        }
        const id = genId('bug');
        const env = b.environment || {};
        await db.prepare(`INSERT INTO bug_reports (
          id, ea_id, title, issue_type, severity, what_happened, steps_to_reproduce, expected, actual,
          env_browser, env_os, env_device, env_screen, attachment_json, frequency, can_reproduce, diagnostics,
          tester_context, regression, blocking_feature, follow_up_ok, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
          id, me.id, b.title.trim(), b.issueType, b.severity,
          b.whatHappened.trim(), b.stepsToReproduce?.trim() || null, b.expected.trim(), b.actual?.trim() || null,
          env.browser || null, env.os || null, env.device || null, env.screen || null,
          b.attachment ? JSON.stringify(b.attachment) : null,
          b.frequency || null, b.canReproduce || null, b.diagnostics?.trim() || null,
          b.testerContext?.trim() || null, b.regression || null, b.blockingFeature || null, b.followUpOk || null,
          new Date().toISOString()
        ).run();
        const row = await db.prepare('SELECT * FROM bug_reports WHERE id = ?').bind(id).first();
        await notifyAdmins(db, {
          type: 'bug',
          title: `New bug report from ${me.name}`,
          body: b.title.trim().slice(0, 140),
          link: 'admin-bugs'
        });
        return json(bugToJson(row), 200, origin);
      }

      return error('Not found.', 404, origin);
    } catch (e) {
      return error(e.message || 'Internal error.', 500, origin);
    }
  }
};
