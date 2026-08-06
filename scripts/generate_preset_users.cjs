const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
let env = fs.readFileSync(envPath, 'utf8');
const m = env.match(/^PRESET_USERS=(.*)$/m);
if (!m) {
  console.error('No PRESET_USERS line found in .env');
  process.exit(2);
}
const presetLine = m[1].trim();
if (!presetLine) {
  console.error('PRESET_USERS is empty');
  process.exit(2);
}
const pairs = presetLine.split(',').map(s => s.trim()).filter(Boolean);
if (pairs.length === 0) {
  console.error('No preset users');
  process.exit(2);
}

const secret = crypto.randomBytes(32).toString('hex');
const N = 16384, r = 8, p = 1;
const blobs = pairs.map(pair => {
  const idx = pair.indexOf(':');
  if (idx === -1) throw new Error('Invalid pair: ' + pair);
  const username = pair.slice(0, idx);
  const password = pair.slice(idx + 1);
  const key = crypto.scryptSync(secret, Buffer.from(username), 32, {N, r, p});
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, ct, tag]).toString('hex');
  return `${username}:${blob}`;
});

console.log('PRESET_SECRET=' + secret);
console.log('PRESET_USERS=' + blobs.join(','));
