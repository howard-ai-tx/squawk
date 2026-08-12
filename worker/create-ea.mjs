// Local, gitignored script: creates one Early Adopter account.
// Usage: node create-ea.mjs "Full Name" email@example.com password ["referral source"]
// Prints an INSERT statement to stdout — run it with:
//   npx wrangler d1 execute earlyadopter-db --remote --command="$(node create-ea.mjs ...)"
import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

function genReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const [name, email, password, referralSource] = process.argv.slice(2);
if (!name || !email || !password) {
  console.error('Usage: node create-ea.mjs "Full Name" email@example.com password ["referral source"]');
  process.exit(1);
}

const { hash, salt } = await hashPassword(password);
const id = genId('ea');
const referralCode = genReferralCode();
const now = new Date().toISOString();

console.log(
  `INSERT INTO early_adopters (id, name, email, password_hash, password_salt, enrollment_date, referral_source, referral_code, install_status, representing_ack_at, created_at) VALUES ` +
  `(${sqlStr(id)}, ${sqlStr(name)}, ${sqlStr(email)}, ${sqlStr(hash)}, ${sqlStr(salt)}, ${sqlStr(now)}, ${sqlStr(referralSource || null)}, ${sqlStr(referralCode)}, 'scheduled', NULL, ${sqlStr(now)});`
);
