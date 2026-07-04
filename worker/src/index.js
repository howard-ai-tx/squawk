import { json, error, genId, genOTP, hashPassword, verifyPassword, userToJson, deviceToJson, draftToJson, submissionToJson, eventToJson, newsToJson, corsHeaders } from './util.js';

const SESSION_TTL_MS = 86400000; // 24h, matches previous client-side session TTL
const CATEGORY_ROUTING = {
  hardware: 'tucker', software: 'tucker', speed: 'tucker', bugs: 'tucker',
  usability: 'hendrik', features: 'hendrik', security: 'hendrik'
};
const CATEGORY_LABELS = {
  hardware: 'Hardware', software: 'Software / Arken', usability: 'Usability',
  bugs: 'Bugs', speed: 'Speed', features: 'Features', security: 'Security'
};
const REP_NAMES = { tucker: 'Tucker', hendrik: 'Hendrik' };

async function getUserRow(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

async function getUserDevices(db, id) {
  return (await db.prepare('SELECT * FROM devices WHERE user_id = ?').bind(id).all()).results;
}

async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  const session = await env.squawk_db.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
  if (!session || session.expires_at < Date.now()) return null;
  const userRow = await getUserRow(env.squawk_db, session.user_id);
  if (!userRow) return null;
  return { session, userRow };
}

async function submissionStatus(db, submissionId) {
  const evts = (await db.prepare('SELECT type FROM events WHERE submission_id = ?').bind(submissionId).all()).results;
  if (evts.some(e => e.type === 'close')) return 'closed';
  if (evts.some(e => e.type === 'claim')) return 'in-review';
  return 'new';
}

async function submissionOwner(db, submissionId) {
  const evts = (await db.prepare('SELECT * FROM events WHERE submission_id = ? ORDER BY timestamp ASC').bind(submissionId).all()).results;
  let owner = null;
  for (const e of evts) {
    if (e.type === 'claim') owner = e.rep_id;
    if (e.type === 'reassign') owner = null;
  }
  if (!owner) return null;
  const row = await getUserRow(db, owner);
  return row ? userToJson(row, await getUserDevices(db, owner)) : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const db = env.squawk_db;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    const path = url.pathname.replace(/\/+$/, '') || '/';
    const parts = path.split('/').filter(Boolean); // e.g. ['users', 'bt_alice', 'devices']

    try {
      // ── AUTH ──────────────────────────────────────────────────────────────
      if (path === '/auth/login' && request.method === 'POST') {
        const { email, password } = await request.json();
        const row = await db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').bind(email).first();
        if (!row || !row.otp_used || !row.password_hash) return error('Email or password is incorrect.', 401, origin);
        const ok = await verifyPassword(password, row.password_salt, row.password_hash);
        if (!ok) return error('Email or password is incorrect.', 401, origin);
        const token = genId('sess');
        await db.prepare('INSERT INTO sessions (token, user_id, role, expires_at) VALUES (?, ?, ?, ?)')
          .bind(token, row.id, row.role, Date.now() + SESSION_TTL_MS).run();
        return json({ token, user: userToJson(row, await getUserDevices(db, row.id)) }, 200, origin);
      }

      if (path === '/auth/check-first-login' && request.method === 'POST') {
        const { email } = await request.json();
        const row = await db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND otp IS NOT NULL AND otp_used = 0').bind(email).first();
        return json({ pending: !!row }, 200, origin);
      }

      if (path === '/auth/first-login' && request.method === 'POST') {
        const { email, otp, newPassword } = await request.json();
        const row = await db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) AND otp = ? AND otp_used = 0').bind(email, otp).first();
        if (!row) return error('That code is incorrect.', 401, origin);
        const { hash, salt } = await hashPassword(newPassword);
        await db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, otp = NULL, otp_used = 1 WHERE id = ?')
          .bind(hash, salt, row.id).run();
        const token = genId('sess');
        await db.prepare('INSERT INTO sessions (token, user_id, role, expires_at) VALUES (?, ?, ?, ?)')
          .bind(token, row.id, row.role, Date.now() + SESSION_TTL_MS).run();
        const updated = await getUserRow(db, row.id);
        return json({ token, user: userToJson(updated, await getUserDevices(db, row.id)) }, 200, origin);
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
        return json({ user: userToJson(auth.userRow, await getUserDevices(db, auth.userRow.id)) }, 200, origin);
      }

      // Everything past this point requires a valid session.
      const auth = await requireAuth(request, env);
      if (!auth) return error('Not authenticated.', 401, origin);
      const { userRow: me } = auth;

      // ── USERS ─────────────────────────────────────────────────────────────
      if (path === '/users' && request.method === 'GET') {
        const rows = (await db.prepare('SELECT * FROM users').all()).results;
        const out = [];
        for (const r of rows) out.push(userToJson(r, await getUserDevices(db, r.id)));
        return json(out, 200, origin);
      }

      if (path === '/users/bts' && request.method === 'GET') {
        const rows = (await db.prepare("SELECT * FROM users WHERE role = 'bt'").all()).results;
        const out = [];
        for (const r of rows) out.push(userToJson(r, await getUserDevices(db, r.id)));
        return json(out, 200, origin);
      }

      if (path === '/users/admins' && request.method === 'GET') {
        const rows = (await db.prepare("SELECT * FROM users WHERE role = 'admin'").all()).results;
        const out = [];
        for (const r of rows) out.push(userToJson(r, await getUserDevices(db, r.id)));
        return json(out, 200, origin);
      }

      if (path === '/users' && request.method === 'POST') {
        if (me.role !== 'admin') return error('Forbidden.', 403, origin);
        const { name, email } = await request.json();
        const existing = await db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').bind(email).first();
        if (existing) return json({ error: 'An account with that email already exists.' }, 200, origin);
        const otp = genOTP();
        const id = genId('bt');
        await db.prepare('INSERT INTO users (id, name, email, password_hash, password_salt, role, otp, otp_used, settings_json, created_at, created_by) VALUES (?, ?, ?, NULL, NULL, ?, ?, 0, ?, ?, ?)')
          .bind(id, name, email, 'bt', otp, '{}', new Date().toISOString(), me.id).run();
        const row = await getUserRow(db, id);
        return json({ user: userToJson(row, []), otp }, 200, origin);
      }

      if (parts[0] === 'users' && parts.length === 2 && request.method === 'GET') {
        const row = await getUserRow(db, parts[1]);
        if (!row) return error('Not found.', 404, origin);
        return json(userToJson(row, await getUserDevices(db, row.id)), 200, origin);
      }

      if (parts[0] === 'users' && parts.length === 2 && request.method === 'PATCH') {
        if (me.id !== parts[1] && me.role !== 'admin') return error('Forbidden.', 403, origin);
        const patch = await request.json();
        const fields = [];
        const values = [];
        if ('name' in patch) { fields.push('name = ?'); values.push(patch.name); }
        if ('email' in patch) { fields.push('email = ?'); values.push(patch.email); }
        if ('avatarDataUrl' in patch) { fields.push('avatar_data_url = ?'); values.push(patch.avatarDataUrl); }
        if ('passwordHash' in patch) {
          // Client no longer computes hashes; accept a raw newPassword field instead.
        }
        if ('newPassword' in patch) {
          const { hash, salt } = await hashPassword(patch.newPassword);
          fields.push('password_hash = ?', 'password_salt = ?');
          values.push(hash, salt);
        }
        if (fields.length === 0) return error('No valid fields to update.', 400, origin);
        values.push(parts[1]);
        await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
        const row = await getUserRow(db, parts[1]);
        return json(userToJson(row, await getUserDevices(db, row.id)), 200, origin);
      }

      if (parts[0] === 'users' && parts[2] === 'settings' && request.method === 'PATCH') {
        if (me.id !== parts[1] && me.role !== 'admin') return error('Forbidden.', 403, origin);
        const row = await getUserRow(db, parts[1]);
        if (!row) return error('Not found.', 404, origin);
        const current = JSON.parse(row.settings_json || '{}');
        const patch = await request.json();
        const merged = { ...current, ...patch };
        await db.prepare('UPDATE users SET settings_json = ? WHERE id = ?').bind(JSON.stringify(merged), parts[1]).run();
        const updated = await getUserRow(db, parts[1]);
        return json(userToJson(updated, await getUserDevices(db, parts[1])), 200, origin);
      }

      if (parts[0] === 'users' && parts[2] === 'devices' && parts.length === 3 && request.method === 'POST') {
        if (me.id !== parts[1] && me.role !== 'admin') return error('Forbidden.', 403, origin);
        const device = await request.json();
        const id = genId('dev');
        await db.prepare('INSERT INTO devices (id, user_id, name, serial_number, model, date_added) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(id, parts[1], device.name, device.serialNumber, device.model, device.dateAdded).run();
        const row = await db.prepare('SELECT * FROM devices WHERE id = ?').bind(id).first();
        return json(deviceToJson(row), 200, origin);
      }

      if (parts[0] === 'users' && parts[2] === 'devices' && parts.length === 4 && request.method === 'DELETE') {
        if (me.id !== parts[1] && me.role !== 'admin') return error('Forbidden.', 403, origin);
        await db.prepare('DELETE FROM devices WHERE id = ? AND user_id = ?').bind(parts[3], parts[1]).run();
        return json({ ok: true }, 200, origin);
      }

      if (parts[0] === 'users' && parts.length === 2 && request.method === 'DELETE') {
        if (me.id !== parts[1] && me.role !== 'admin') return error('Forbidden.', 403, origin);
        await db.prepare('DELETE FROM users WHERE id = ?').bind(parts[1]).run();
        return json({ ok: true }, 200, origin);
      }

      // ── DRAFTS ────────────────────────────────────────────────────────────
      if (path === '/drafts' && request.method === 'GET') {
        const btId = url.searchParams.get('btId');
        const rows = (await db.prepare('SELECT * FROM drafts WHERE bt_id = ? ORDER BY updated_at DESC').bind(btId).all()).results;
        return json(rows.map(draftToJson), 200, origin);
      }

      if (parts[0] === 'drafts' && parts.length === 2 && request.method === 'GET') {
        const row = await db.prepare('SELECT * FROM drafts WHERE id = ?').bind(parts[1]).first();
        if (!row) return error('Not found.', 404, origin);
        return json(draftToJson(row), 200, origin);
      }

      if (path === '/drafts' && request.method === 'POST') {
        const d = await request.json();
        const now = new Date().toISOString();
        const attachmentJson = d.attachmentData ? JSON.stringify(d.attachmentData) : null;
        if (d.id) {
          const existing = await db.prepare('SELECT * FROM drafts WHERE id = ?').bind(d.id).first();
          if (existing) {
            await db.prepare(`UPDATE drafts SET title=?, category=?, subcategory=?, description=?, device_id=?, model=?, event_timestamp=?, timestamp_precision=?, attachment_json=?, updated_at=? WHERE id=?`)
              .bind(d.title || null, d.category || null, d.subcategory || null, d.description || null, d.deviceId || null, d.model || null, d.eventTimestamp || null, d.timestampPrecision || null, attachmentJson, now, d.id).run();
            const row = await db.prepare('SELECT * FROM drafts WHERE id = ?').bind(d.id).first();
            return json(draftToJson(row), 200, origin);
          }
        }
        const id = genId('draft');
        await db.prepare(`INSERT INTO drafts (id, bt_id, title, category, subcategory, description, device_id, model, event_timestamp, timestamp_precision, attachment_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, d.btId, d.title || null, d.category || null, d.subcategory || null, d.description || null, d.deviceId || null, d.model || null, d.eventTimestamp || null, d.timestampPrecision || null, attachmentJson, now, now).run();
        const row = await db.prepare('SELECT * FROM drafts WHERE id = ?').bind(id).first();
        return json(draftToJson(row), 200, origin);
      }

      if (parts[0] === 'drafts' && parts.length === 2 && request.method === 'DELETE') {
        await db.prepare('DELETE FROM drafts WHERE id = ?').bind(parts[1]).run();
        return json({ ok: true }, 200, origin);
      }

      // ── SUBMISSIONS ───────────────────────────────────────────────────────
      if (path === '/submissions/with-meta' && request.method === 'GET') {
        const rows = (await db.prepare('SELECT * FROM submissions ORDER BY submitted_at DESC').all()).results;
        const out = [];
        for (const r of rows) {
          const sub = submissionToJson(r);
          const bt = await getUserRow(db, r.bt_id);
          out.push({ ...sub, bt: bt ? userToJson(bt, await getUserDevices(db, bt.id)) : null, status: await submissionStatus(db, r.id), owner: await submissionOwner(db, r.id) });
        }
        return json(out, 200, origin);
      }

      if (path === '/submissions' && request.method === 'GET') {
        const btId = url.searchParams.get('btId');
        const rows = btId
          ? (await db.prepare('SELECT * FROM submissions WHERE bt_id = ? ORDER BY submitted_at DESC').bind(btId).all()).results
          : (await db.prepare('SELECT * FROM submissions ORDER BY submitted_at DESC').all()).results;
        return json(rows.map(submissionToJson), 200, origin);
      }

      if (parts[0] === 'submissions' && parts.length === 2 && request.method === 'GET') {
        const row = await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(parts[1]).first();
        if (!row) return error('Not found.', 404, origin);
        const bt = await getUserRow(db, row.bt_id);
        return json({ ...submissionToJson(row), bt: bt ? userToJson(bt, await getUserDevices(db, bt.id)) : null, status: await submissionStatus(db, row.id), owner: await submissionOwner(db, row.id) }, 200, origin);
      }

      if (path === '/submissions' && request.method === 'POST') {
        const s = await request.json();
        const id = genId('sub');
        const submittedAt = new Date().toISOString();
        const attachmentJson = s.attachmentData ? JSON.stringify(s.attachmentData) : null;
        const routedTo = CATEGORY_ROUTING[s.category] || null;

        await db.batch([
          db.prepare(`INSERT INTO submissions (id, bt_id, title, category, subcategory, description, device_id, model, event_timestamp, timestamp_precision, attachment_json, submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
            .bind(id, s.btId, s.title || null, s.category, s.subcategory, s.description, s.deviceId || null, s.model || null, s.eventTimestamp || null, s.timestampPrecision || null, attachmentJson, submittedAt),
          db.prepare(`INSERT INTO events (id, submission_id, type, timestamp, rep_id, data_json) VALUES (?, ?, 'submission', ?, NULL, '{}')`)
            .bind(genId(), id, submittedAt),
          db.prepare(`INSERT INTO events (id, submission_id, type, timestamp, rep_id, data_json) VALUES (?, ?, 'auto_triage', ?, NULL, ?)`)
            .bind(genId(), id, submittedAt, JSON.stringify({
              routedTo,
              reason: routedTo ? `${CATEGORY_LABELS[s.category] || s.category} — routed to ${REP_NAMES[routedTo]}` : `${CATEGORY_LABELS[s.category] || s.category} — review for routing`
            }))
        ]);

        const row = await db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first();
        return json(submissionToJson(row), 200, origin);
      }

      // ── EVENTS ────────────────────────────────────────────────────────────
      if (path === '/events' && request.method === 'GET') {
        const submissionId = url.searchParams.get('submissionId');
        const rows = (await db.prepare('SELECT * FROM events WHERE submission_id = ? ORDER BY timestamp ASC').bind(submissionId).all()).results;
        return json(rows.map(eventToJson), 200, origin);
      }

      if (path === '/events/claim' && request.method === 'POST') {
        const { submissionId } = await request.json();
        await db.prepare(`INSERT INTO events (id, submission_id, type, timestamp, rep_id, data_json) VALUES (?, ?, 'claim', ?, ?, '{}')`)
          .bind(genId(), submissionId, new Date().toISOString(), me.id).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === '/events/reassign' && request.method === 'POST') {
        const { submissionId, toRepId, reason } = await request.json();
        await db.prepare(`INSERT INTO events (id, submission_id, type, timestamp, rep_id, data_json) VALUES (?, ?, 'reassign', ?, ?, ?)`)
          .bind(genId(), submissionId, new Date().toISOString(), me.id, JSON.stringify({ fromRepId: me.id, toRepId, reason: reason || '' })).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === '/events/note' && request.method === 'POST') {
        const { submissionId, content } = await request.json();
        await db.prepare(`INSERT INTO events (id, submission_id, type, timestamp, rep_id, data_json) VALUES (?, ?, 'note', ?, ?, ?)`)
          .bind(genId(), submissionId, new Date().toISOString(), me.id, JSON.stringify({ content })).run();
        return json({ ok: true }, 200, origin);
      }

      if (path === '/events/close' && request.method === 'POST') {
        const { submissionId, note } = await request.json();
        await db.prepare(`INSERT INTO events (id, submission_id, type, timestamp, rep_id, data_json) VALUES (?, ?, 'close', ?, ?, ?)`)
          .bind(genId(), submissionId, new Date().toISOString(), me.id, JSON.stringify({ note: note || '' })).run();
        return json({ ok: true }, 200, origin);
      }

      // ── DASHBOARD ─────────────────────────────────────────────────────────
      if (path === '/dashboard/stats' && request.method === 'GET') {
        const all = (await db.prepare('SELECT * FROM submissions').all()).results;
        const weekAgo = Date.now() - 7 * 86400000;
        let open = 0, thisWeek = 0, closedWeek = 0;
        for (const s of all) {
          const status = await submissionStatus(db, s.id);
          if (status !== 'closed') open++;
          if (new Date(s.submitted_at).getTime() > weekAgo) {
            thisWeek++;
            if (status === 'closed') closedWeek++;
          }
        }
        return json({ total: all.length, open, thisWeek, closedWeek }, 200, origin);
      }

      if (path === '/dashboard/category-breakdown' && request.method === 'GET') {
        const rows = (await db.prepare('SELECT category, subcategory, COUNT(*) as count FROM submissions GROUP BY category, subcategory ORDER BY count DESC').all()).results;
        return json(rows.map(r => ({
          category: r.category, subcategory: r.subcategory,
          catLabel: CATEGORY_LABELS[r.category] || r.category, subLabel: r.subcategory,
          count: r.count
        })), 200, origin);
      }

      if (path === '/dashboard/trend-alerts' && request.method === 'GET') {
        const since = new Date(Date.now() - 7 * 86400000).toISOString();
        const rows = (await db.prepare('SELECT category, subcategory, COUNT(*) as count FROM submissions WHERE submitted_at > ? GROUP BY category, subcategory HAVING count >= 3').bind(since).all()).results;
        return json(rows.map(r => ({
          category: r.category, subcategory: r.subcategory,
          catLabel: CATEGORY_LABELS[r.category] || r.category, subLabel: r.subcategory,
          count: r.count, routedTo: CATEGORY_ROUTING[r.category] || null
        })), 200, origin);
      }

      // ── NEWS ──────────────────────────────────────────────────────────────
      if (path === '/news' && request.method === 'GET') {
        const rows = (await db.prepare('SELECT * FROM news ORDER BY published_at DESC').all()).results;
        return json(rows.map(newsToJson), 200, origin);
      }

      if (path === '/news' && request.method === 'POST') {
        if (me.role !== 'admin') return error('Forbidden.', 403, origin);
        const n = await request.json();
        if (!n.title || !n.bodyHtml) return error('Title and body are required.', 400, origin);
        const id = genId('news');
        const publishedAt = new Date().toISOString();
        await db.prepare(`INSERT INTO news (id, title, subtitle, tags_json, image_json, body_html, author_id, author_name, published_at) VALUES (?,?,?,?,?,?,?,?,?)`)
          .bind(id, n.title, n.subtitle || null, JSON.stringify(n.tags || []), n.image ? JSON.stringify(n.image) : null, n.bodyHtml, me.id, me.name, publishedAt).run();
        const row = await db.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
        return json(newsToJson(row), 200, origin);
      }

      if (parts[0] === 'news' && parts.length === 2 && request.method === 'DELETE') {
        if (me.role !== 'admin') return error('Forbidden.', 403, origin);
        await db.prepare('DELETE FROM news WHERE id = ?').bind(parts[1]).run();
        return json({ ok: true }, 200, origin);
      }

      return error('Not found.', 404, origin);
    } catch (e) {
      return error(e.message || 'Internal error.', 500, origin);
    }
  }
};
