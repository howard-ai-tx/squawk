import { json, error, genId, hashPassword, verifyPassword, earlyAdopterToJson, feedbackToJson, bugToJson, contactToJson, corsHeaders } from './util.js';

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
        if (!row || !row.password_hash) return error('Email or password is incorrect.', 401, origin);
        const ok = await verifyPassword(password, row.password_salt, row.password_hash);
        if (!ok) return error('Email or password is incorrect.', 401, origin);
        const token = genId('sess');
        await db.prepare('INSERT INTO sessions (token, ea_id, expires_at) VALUES (?, ?, ?)')
          .bind(token, row.id, Date.now() + SESSION_TTL_MS).run();
        return json({ token, earlyAdopter: earlyAdopterToJson(row) }, 200, origin);
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
        const { message } = await request.json();
        if (!message || !message.trim()) return error('Feedback cannot be empty.', 400, origin);
        const id = genId('fb');
        await db.prepare('INSERT INTO feedback (id, ea_id, message, created_at) VALUES (?, ?, ?, ?)')
          .bind(id, me.id, message.trim(), new Date().toISOString()).run();
        const row = await db.prepare('SELECT * FROM feedback WHERE id = ?').bind(id).first();
        return json(feedbackToJson(row), 200, origin);
      }

      // ── BUG REPORTS ───────────────────────────────────────────────────────
      if (path === '/bugs' && request.method === 'POST') {
        const { whatHappened, expected, urgency } = await request.json();
        if (!whatHappened || !expected || !urgency) return error('All fields are required.', 400, origin);
        const id = genId('bug');
        await db.prepare('INSERT INTO bug_reports (id, ea_id, what_happened, expected, urgency, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(id, me.id, whatHappened.trim(), expected.trim(), urgency, new Date().toISOString()).run();
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
