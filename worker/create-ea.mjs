// Local script: creates one Early Adopter account with a one-time activation
// link instead of a password — the EA sets their own password when they
// first visit the link. After that, it's normal email + password sign-in.
//
// Usage: node create-ea.mjs "Full Name" email@example.com ["referral source"]
// Prints the INSERT statement AND the activation link to stdout. Run the SQL with:
//   npx wrangler d1 execute earlyadopter-db --remote --command="<the INSERT line>"
import { webcrypto } from 'node:crypto';

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

function genCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const [name, email, referralSource] = process.argv.slice(2);
if (!name || !email) {
  console.error('Usage: node create-ea.mjs "Full Name" email@example.com ["referral source"]');
  process.exit(1);
}

const id = genId('ea');
const referralCode = genCode(8);
const activationToken = genCode(24) + genCode(24); // long, unguessable
const now = new Date().toISOString();

console.log(
  `INSERT INTO early_adopters (id, name, email, activation_token, enrollment_date, referral_source, referral_code, install_status, representing_ack_at, created_at) VALUES ` +
  `(${sqlStr(id)}, ${sqlStr(name)}, ${sqlStr(email)}, ${sqlStr(activationToken)}, ${sqlStr(now)}, ${sqlStr(referralSource || null)}, ${sqlStr(referralCode)}, 'scheduled', NULL, ${sqlStr(now)});`
);
console.log('');
console.log(`Activation link: https://earlyadopters.howardai.us/?activate=${activationToken}`);
