const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
let env = fs.readFileSync(envPath, 'utf8');
const mUsers = env.match(/^PRESET_USERS=(.*)$/m);
const mSecret = env.match(/^PRESET_SECRET=(.*)$/m);
if (!mUsers || !mSecret) {
  console.error('PRESET_USERS or PRESET_SECRET missing in .env');
  process.exit(2);
}
const preset = mUsers[1].trim();
const presetSecret = mSecret[1].trim();
const pairs = preset.split(',').map(s => s.trim()).filter(Boolean);
const out = [];
const N = 16384, r = 8, p = 1;
for (const pstr of pairs) {
  const idx = pstr.indexOf(':');
  if (idx === -1) continue;
  const username = pstr.slice(0, idx);
  const hex = pstr.slice(idx+1);
  try {
    const blob = Buffer.from(hex, 'hex');
    if (blob.length < 12 + 16) continue;
    const iv = blob.slice(0, 12);
    const tag = blob.slice(blob.length - 16);
    const cipherText = blob.slice(12, blob.length - 16);
    const key = crypto.scryptSync(presetSecret, Buffer.from(username), 32, {N, r, p});
    const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
    dec.setAuthTag(tag);
    const password = Buffer.concat([dec.update(cipherText), dec.final()]).toString('utf8');

    const authSalt = crypto.randomBytes(16).toString('hex');
    const authHashBuf = crypto.scryptSync(password, Buffer.from(authSalt, 'hex'), 32, {N, r, p});
    const masterKey = crypto.randomBytes(32);
    const encSalt = crypto.randomBytes(16);
    const encKey = crypto.scryptSync(password, encSalt, 32, {N, r, p});
    const encIv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encKey, encIv);
    const encBuf = Buffer.concat([cipher.update(masterKey), cipher.final()]);
    const encTag = cipher.getAuthTag();
    const rec = {
      username,
      authSalt,
      authHash: authHashBuf.toString('hex'),
      encSalt: encSalt.toString('hex'),
      enc: encBuf.toString('hex'),
      encIv: encIv.toString('hex'),
      encTag: encTag.toString('hex'),
    };
    out.push(rec);
  } catch (err) {
    console.error('failed', username, err.message);
  }
}

const usersPath = path.resolve(__dirname, '../server/users.json');
fs.writeFileSync(usersPath, JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', usersPath, 'with', out.length, 'users');
