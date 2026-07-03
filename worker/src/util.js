// ─── CORS ────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://squawk.howardai.us',
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

export function genOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

export function userToJson(row, devices = []) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    otp: row.otp,
    otpUsed: !!row.otp_used,
    avatarDataUrl: row.avatar_data_url,
    settings: JSON.parse(row.settings_json || '{}'),
    devices: devices.map(deviceToJson),
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

export function deviceToJson(row) {
  return { id: row.id, name: row.name, serialNumber: row.serial_number, model: row.model, dateAdded: row.date_added };
}

export function draftToJson(row) {
  return {
    id: row.id, btId: row.bt_id, title: row.title, category: row.category, subcategory: row.subcategory,
    description: row.description, deviceId: row.device_id, model: row.model,
    eventTimestamp: row.event_timestamp, timestampPrecision: row.timestamp_precision,
    attachmentData: row.attachment_json ? JSON.parse(row.attachment_json) : null,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export function submissionToJson(row) {
  return {
    id: row.id, btId: row.bt_id, title: row.title, category: row.category, subcategory: row.subcategory,
    description: row.description, deviceId: row.device_id, model: row.model,
    eventTimestamp: row.event_timestamp, timestampPrecision: row.timestamp_precision,
    attachmentData: row.attachment_json ? JSON.parse(row.attachment_json) : null,
    submittedAt: row.submitted_at
  };
}

export function eventToJson(row) {
  return { id: row.id, submissionId: row.submission_id, type: row.type, timestamp: row.timestamp, repId: row.rep_id, data: JSON.parse(row.data_json || '{}') };
}
