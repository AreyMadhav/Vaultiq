const fs = require('fs');
const path = require('path');
const pendingPath = path.resolve(__dirname, '../server/pending.json');
let pending = [];
if (fs.existsSync(pendingPath)) pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) || [];
if (pending.length === 0) {
  console.log('No pending registrations');
  process.exit(0);
}
for (const p of pending) {
  const d = new Date(p.requestedAt || 0).toISOString();
  console.log(`${p.username} — requested at ${d}`);
}
console.log('\nApprove with: node scripts/approve_pending.cjs <username>');
