#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [,, username, password, encPathArg, outPathArg] = process.argv;
if (!username || !password || !encPathArg) {
  console.error('Usage: node scripts/decrypt_file.cjs <username> <password> <path/to/file.enc> [outPath]');
  process.exit(2);
}

const encPath = path.resolve(encPathArg);
if (!fs.existsSync(encPath)) {
  console.error('Encrypted file not found:', encPath);
  process.exit(2);
}

const USERS_FILE = path.resolve(__dirname, '../server/users.json');
if (!fs.existsSync(USERS_FILE)) {
  console.error('users.json not found at', USERS_FILE);
  process.exit(2);
}

const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) || [];
const user = users.find((u) => u.username === username);
if (!user) {
  console.error('User not found in users.json');
  process.exit(2);
}

try {
  let masterKeyBuf = null;
  // modern fields: enc / encSalt / encIv / encTag (all hex)
  if (user.enc && user.encSalt) {
    const encSalt = Buffer.from(user.encSalt, 'hex');
    const encBuf = Buffer.from(user.enc, 'hex');
    const encKey = crypto.scryptSync(password, encSalt, 32, { N: 16384, r: 8, p: 1 });
    const iv = Buffer.from(user.encIv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(Buffer.from(user.encTag, 'hex'));
    masterKeyBuf = Buffer.concat([decipher.update(encBuf), decipher.final()]);
  } else if (user.encMaster) {
    // legacy: encMaster (base64) with encSalt prefix
    const encAll = Buffer.from(user.encMaster, 'base64');
    const encSalt = encAll.slice(0, 16);
    const enc = encAll.slice(16);
    const encKey = crypto.scryptSync(password, encSalt, 32);
    const iv = Buffer.from(user.encIv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
    decipher.setAuthTag(Buffer.from(user.encTag, 'hex'));
    masterKeyBuf = Buffer.concat([decipher.update(enc), decipher.final()]);
  } else {
    console.error('User record does not contain encrypted master key fields');
    process.exit(2);
  }

  const metaPath = encPath + '.meta.json';
  if (!fs.existsSync(metaPath)) {
    console.error('Missing metadata file:', metaPath);
    process.exit(2);
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {};
  if (!meta.iv || !meta.tag) {
    console.error('Metadata missing iv/tag');
    process.exit(2);
  }

  const fileIv = Buffer.from(meta.iv, 'hex');
  const fileTag = Buffer.from(meta.tag, 'hex');

  const defaultOut = meta.originalName
    ? path.resolve(path.dirname(encPath), meta.originalName)
    : path.resolve(encPath.replace(/\.enc$/i, ''));
  const outPath = outPathArg ? path.resolve(outPathArg) : defaultOut;

  const inp = fs.createReadStream(encPath);
  const out = fs.createWriteStream(outPath);
  const decipherFile = crypto.createDecipheriv('aes-256-gcm', masterKeyBuf, fileIv);
  decipherFile.setAuthTag(fileTag);
  inp.pipe(decipherFile).pipe(out);

  out.on('finish', () => console.log('Decrypted to', outPath));
  out.on('error', (e) => { console.error('Write error', e.message); process.exit(1); });
  inp.on('error', (e) => { console.error('Read error', e.message); process.exit(1); });
} catch (err) {
  console.error('Decryption failed:', (err && err.message) || err);
  process.exit(1);
}
