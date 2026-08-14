// Local script: resets an existing Early Adopter's password by issuing a
// fresh one-time activation link (same mechanism as enrollment). Their old
// password stops working the moment this runs — they must use the new link
// to set a new one.
//
// Usage: node reset-password.mjs email@example.com
// Prints an UPDATE statement AND the new activation link to stdout. Run the SQL with:
//   npx wrangler d1 execute earlyadopter-db --remote --command="<the UPDATE line>"

function sqlStr(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function genCode(length) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < length; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const [email] = process.argv.slice(2);
if (!email) {
  console.error('Usage: node reset-password.mjs email@example.com');
  process.exit(1);
}

const activationToken = genCode(24) + genCode(24); // long, unguessable

console.log(
  `UPDATE early_adopters SET password_hash = NULL, password_salt = NULL, activation_token = ${sqlStr(activationToken)} WHERE lower(email) = lower(${sqlStr(email)});`
);
console.log('');
console.log(`New activation link: https://earlyadopters.howardai.us/?activate=${activationToken}`);
