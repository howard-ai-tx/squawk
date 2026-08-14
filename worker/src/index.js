import {
  json, error, genId, hashPassword, verifyPassword, corsHeaders,
  earlyAdopterToJson, earlyAdopterToAdminJson,
  feedbackToJson, bugToJson, contactToJson,
  feedbackToAdminJson, bugToAdminJson, contactToAdminJson
} from './util.js';

const SESSION_TTL_MS = 86400000; // 24h

async function getEARow(db, id) {
  return db.prepare('SELECT * FROM early_adopters WHERE id = ?').bind(id).first();
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

      // ── ADMINISTRATOR PLATFORM (read-only over EA data; view, not create) ──
      if (path.startsWith('/admin/')) {
        if (!me.is_admin) return error('Not authorized.', 403, origin);
        const parts = path.split('/').filter(Boolean); // ['admin', ...]

        if (parts.length === 2 && parts[1] === 'overview' && request.method === 'GET') {
          const [totals, statusCounts, severityCounts, feedbackImportance, pending, acked] = await Promise.all([
            db.prepare('SELECT COUNT(*) n FROM early_adopters').first(),
            db.prepare("SELECT install_status, COUNT(*) n FROM early_adopters GROUP BY install_status").all(),
            db.prepare('SELECT severity, COUNT(*) n FROM bug_reports GROUP BY severity').all(),
            db.prepare('SELECT importance, COUNT(*) n FROM feedback GROUP BY importance').all(),
            db.prepare('SELECT COUNT(*) n FROM early_adopters WHERE activation_token IS NOT NULL AND password_hash IS NULL').first(),
            db.prepare('SELECT COUNT(*) n FROM early_adopters WHERE representing_ack_at IS NOT NULL').first()
          ]);
          const [feedbackTotal, bugTotal, contactTotal] = await Promise.all([
            db.prepare('SELECT COUNT(*) n FROM feedback').first(),
            db.prepare('SELECT COUNT(*) n FROM bug_reports').first(),
            db.prepare('SELECT COUNT(*) n FROM contact_messages').first()
          ]);
          const toMap = rows => Object.fromEntries(rows.results.map(r => [r.install_status || r.severity || r.importance, r.n]));
          return json({
            totalEarlyAdopters: totals.n,
            pendingActivation: pending.n,
            representingAcknowledged: acked.n,
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
              (SELECT COUNT(*) FROM contact_messages c WHERE c.ea_id = ea.id) contact_count
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
              (SELECT COUNT(*) FROM contact_messages c WHERE c.ea_id = ea.id) contact_count
            FROM early_adopters ea WHERE ea.id = ?
          `).bind(eaId).first();
          if (!row) return error('Early Adopter not found.', 404, origin);
          const [feedbackRows, bugRows, contactRows] = await Promise.all([
            db.prepare('SELECT * FROM feedback WHERE ea_id = ? ORDER BY created_at DESC').bind(eaId).all(),
            db.prepare('SELECT * FROM bug_reports WHERE ea_id = ? ORDER BY created_at DESC').bind(eaId).all(),
            db.prepare('SELECT * FROM contact_messages WHERE ea_id = ? ORDER BY created_at DESC').bind(eaId).all()
          ]);
          return json({
            earlyAdopter: earlyAdopterToAdminJson(row),
            feedback: feedbackRows.results.map(feedbackToJson),
            bugs: bugRows.results.map(bugToJson),
            contact: contactRows.results.map(contactToJson)
          }, 200, origin);
        }

        if (parts.length === 4 && parts[1] === 'early-adopters' && parts[3] === 'status' && request.method === 'PATCH') {
          const eaId = parts[2];
          const { installStatus } = await request.json();
          if (!['scheduled', 'installed'].includes(installStatus)) {
            return error('installStatus must be "scheduled" or "installed".', 400, origin);
          }
          await db.prepare('UPDATE early_adopters SET install_status = ? WHERE id = ?').bind(installStatus, eaId).run();
          const row = await db.prepare('SELECT * FROM early_adopters WHERE id = ?').bind(eaId).first();
          if (!row) return error('Early Adopter not found.', 404, origin);
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

        if (parts.length === 2 && parts[1] === 'contact' && request.method === 'GET') {
          const rows = await db.prepare(`
            SELECT c.*, ea.name ea_name, ea.email ea_email FROM contact_messages c
            JOIN early_adopters ea ON ea.id = c.ea_id ORDER BY c.created_at DESC
          `).all();
          return json({ contact: rows.results.map(contactToAdminJson) }, 200, origin);
        }

        return error('Not found.', 404, origin);
      }

      // ── REPRESENTING HOWARDAI ACKNOWLEDGMENT ─────────────────────────────
      if (path === '/representing/ack' && request.method === 'POST') {
        if (!me.representing_ack_at) {
          await db.prepare('UPDATE early_adopters SET representing_ack_at = ? WHERE id = ?')
            .bind(new Date().toISOString(), me.id).run();
        }
        const updated = await getEARow(db, me.id);
        return json({ earlyAdopter: earlyAdopterToJson(updated) }, 200, origin);
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
        return json(bugToJson(row), 200, origin);
      }

      // ── CONTACT ───────────────────────────────────────────────────────────
      if (path === '/contact' && request.method === 'POST') {
        const { message } = await request.json();
        if (!message || !message.trim()) return error('Message cannot be empty.', 400, origin);
        const id = genId('msg');
        await db.prepare('INSERT INTO contact_messages (id, ea_id, message, created_at) VALUES (?, ?, ?, ?)')
          .bind(id, me.id, message.trim(), new Date().toISOString()).run();
        const row = await db.prepare('SELECT * FROM contact_messages WHERE id = ?').bind(id).first();
        return json(contactToJson(row), 200, origin);
      }

      return error('Not found.', 404, origin);
    } catch (e) {
      return error(e.message || 'Internal error.', 500, origin);
    }
  }
};
