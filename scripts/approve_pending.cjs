const fs = require('fs');
const path = require('path');

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/approve_pending.cjs <username>');
  process.exit(2);
}
const pendingPath = path.resolve(__dirname, '../server/pending.json');
const usersPath = path.resolve(__dirname, '../server/users.json');
let pending = [];
if (fs.existsSync(pendingPath)) pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) || [];
const idx = pending.findIndex(u => u.username === name);
if (idx === -1) {
  console.error('No pending user:', name);
  process.exit(2);
}
const rec = pending.splice(idx,1)[0];
let users = [];
if (fs.existsSync(usersPath)) users = JSON.parse(fs.readFileSync(usersPath, 'utf8')) || [];
// Remove requestedAt if present
delete rec.requestedAt;
users.push(rec);
fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2), 'utf8');
console.log('Approved user:', name);
