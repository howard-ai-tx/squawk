// ─── CORS ────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://earlyadopters.howardai.us',
  'http://localhost:4200'
];

export function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

export function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

export function error(message, status = 400, origin = '') {
  return json({ error: message }, status, origin);
}

// ─── IDS ─────────────────────────────────────────────────────────────────────

export function genId(prefix = '') {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  return prefix ? `${prefix}_${id}` : id;
}

// ─── PASSWORD HASHING (PBKDF2-SHA256 via Web Crypto) ────────────────────────

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

export async function hashPassword(password, saltHex = null) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

export async function verifyPassword(password, saltHex, expectedHash) {
  const { hash } = await hashPassword(password, saltHex);
  if (hash.length !== expectedHash.length) return false;
  // Constant-time-ish comparison
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

// ─── ROW <-> JSON SHAPING ────────────────────────────────────────────────────
// EA-ID is internal-only and intentionally omitted from earlyAdopterToJson —
// it must never be surfaced to the Early Adopter in the UI.

export function earlyAdopterToJson(row) {
  return {
    name: row.name,
    email: row.email,
    enrollmentDate: row.enrollment_date,
    referralSource: row.referral_source,
    referralCode: row.referral_code,
    installStatus: row.install_status,
    isAdmin: !!row.is_admin,
    avatar: row.avatar || null,
    reducedMotion: !!row.reduced_motion
  };
}

export function notificationToJson(row) {
  return {
    id: row.id, type: row.type, title: row.title, body: row.body, link: row.link,
    readAt: row.read_at, createdAt: row.created_at
  };
}

// Admin-facing shape: unlike earlyAdopterToJson, this intentionally includes
// the internal id (needed to address a specific EA from the admin panel).
export function earlyAdopterToAdminJson(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    enrollmentDate: row.enrollment_date,
    referralSource: row.referral_source,
    referralCode: row.referral_code,
    installStatus: row.install_status,
    isAdmin: !!row.is_admin,
    pendingActivation: !!row.activation_token && !row.password_hash,
    createdAt: row.created_at,
    feedbackCount: row.feedback_count ?? undefined,
    bugCount: row.bug_count ?? undefined,
    messageCount: row.message_count ?? undefined,
    unreadFromEA: row.unread_from_ea ?? undefined
  };
}

export function feedbackToJson(row) {
  return {
    id: row.id, feedbackType: row.feedback_type, importance: row.importance,
    message: row.message, whereEncountered: row.where_encountered, additionalNotes: row.additional_notes,
    createdAt: row.created_at
  };
}

export function bugToJson(row) {
  return {
    id: row.id, title: row.title, issueType: row.issue_type, severity: row.severity,
    whatHappened: row.what_happened, stepsToReproduce: row.steps_to_reproduce,
    expected: row.expected, actual: row.actual,
    environment: { browser: row.env_browser, os: row.env_os, device: row.env_device, screen: row.env_screen },
    attachment: row.attachment_json ? JSON.parse(row.attachment_json) : null,
    frequency: row.frequency, canReproduce: row.can_reproduce, diagnostics: row.diagnostics,
    testerContext: row.tester_context, regression: row.regression,
    blockingFeature: row.blocking_feature, followUpOk: row.follow_up_ok,
    createdAt: row.created_at
  };
}

export function messageToJson(row) {
  return {
    id: row.id, sender: row.sender, message: row.message,
    readAt: row.read_at, createdAt: row.created_at
  };
}

// ─── ADMIN-FACING VARIANTS (include the submitting EA's identity) ──────────

export function feedbackToAdminJson(row) {
  return { ...feedbackToJson(row), eaId: row.ea_id, eaName: row.ea_name, eaEmail: row.ea_email };
}

export function bugToAdminJson(row) {
  return { ...bugToJson(row), eaId: row.ea_id, eaName: row.ea_name, eaEmail: row.ea_email };
}
