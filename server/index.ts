import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import archiver from 'archiver';
import mime from 'mime-types';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import os from 'node:os';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.API_PORT || process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

// Legacy single access password removed in favor of per-user accounts
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || '';

const AUTH_COOKIE = 'fe_auth';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h

const TEXT_PREVIEW_EXT = new Set([
  '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx',
  '.html', '.htm', '.css', '.scss', '.xml', '.yaml', '.yml', '.ini',
  '.conf', '.cfg', '.log', '.csv', '.tsv', '.svg', '.sh', '.bash',
  '.py', '.rb', '.go', '.rs', '.java', '.c', '.cc', '.cpp', '.h',
  '.hpp', '.php', '.sql', '.env', '.toml', '.gitignore', '.dockerfile',
]);

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif']);

// ---- Drive configuration ----
export interface Drive {
  id: string;
  name: string;
  path: string;
}

function loadDrives(): Drive[] {
  const configPath = path.resolve(__dirname, '../drives.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (Array.isArray(raw)) {
        return raw
          .filter((d) => d && typeof d.id === 'string' && typeof d.path === 'string')
          .map((d) => ({
            id: d.id,
            name: d.name || d.id,
            path: path.resolve(d.path),
          }));
      }
    } catch (e) {
      console.warn('Failed to parse drives.json:', (e as Error).message);
    }
  }
  // Fallback: single drive from FILES_ROOT or ./files
  const fallbackPath = process.env.FILES_ROOT
    ? path.resolve(process.env.FILES_ROOT)
    : path.resolve(__dirname, '../files');
  return [{ id: 'home', name: 'Home', path: fallbackPath }];
}

const DRIVES = loadDrives();
const DRIVES_BY_ID = new Map(DRIVES.map((d) => [d.id, d]));

function getDriveRoot(driveId: string): string | null {
  const drive = DRIVES_BY_ID.get(driveId);
  return drive ? drive.path : null;
}

function isPathSafe(driveId: string, userPath: string): boolean {
  const root = getDriveRoot(driveId);
  if (!root) return false;
  const resolved = path.resolve(root, userPath);
  const rel = path.relative(root, resolved);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function safeResolve(driveId: string, userPath: string): string {
  return path.resolve(getDriveRoot(driveId)!, userPath);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

async function getDriveSpaceStats(root: string) {
  try {
    const stats = await fsp.statfs(root);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    const usedBytes = Math.max(totalBytes - freeBytes, 0);
    return {
      totalSpaceBytes: totalBytes,
      usedSpaceBytes: usedBytes,
      freeSpaceBytes: freeBytes,
      usagePercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0,
    };
  } catch {
    return {};
  }
}

function makeSession(): string {
  return crypto.randomBytes(32).toString('hex');
}

// In-memory session store: token -> { expiresAt, username, masterKey }
const sessions = new Map<string, { expiresAt: number; username: string; masterKey: string }>();

// Simple users store on disk (server/users.json)
interface UserRecord {
  username: string;
  authSalt: string; // hex
  authHash: string; // hex (scrypt)
  // encrypted master key components (all hex strings)
  encSalt: string;
  enc: string;
  encIv: string;
  encTag: string;
}

const USERS_FILE = path.resolve(__dirname, './users.json');

function loadUsers(): UserRecord[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (Array.isArray(raw)) return raw;
  } catch (e) {
    console.warn('Failed to load users.json:', (e as Error).message);
  }
  // If users.json was missing or empty, try seeding from PRESET_USERS env var.
  // PRESET_USERS must contain encrypted password blobs (hex) produced by AES-256-GCM
  // using a PRESET_SECRET and the username as salt. Format: username:hexblob,comma,separated
  const preset = (process.env.PRESET_USERS || '').trim();
  const presetSecret = process.env.PRESET_SECRET || '';
  if (preset && presetSecret) {
    const out: UserRecord[] = [];
    const pairs = preset.split(',').map((s) => s.trim()).filter(Boolean);
    for (const p of pairs) {
      const idx = p.indexOf(':');
      if (idx === -1) continue;
      const username = p.slice(0, idx);
      const hex = p.slice(idx + 1);
      if (!username || !hex) continue;
      try {
        const blob = Buffer.from(hex, 'hex');
        if (blob.length < 12 + 16) continue;
        const iv = blob.slice(0, 12);
        const tag = blob.slice(blob.length - 16);
        const cipherText = blob.slice(12, blob.length - 16);
        // derive key from PRESET_SECRET using scrypt and username as salt
        const key = crypto.scryptSync(presetSecret, Buffer.from(username), 32, { N: 16384, r: 8, p: 1 });
        const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
        dec.setAuthTag(tag);
        const password = Buffer.concat([dec.update(cipherText), dec.final()]).toString('utf8');

        // build user record from decrypted password
        const authSalt = crypto.randomBytes(16).toString('hex');
        const authHashBuf = crypto.scryptSync(password, Buffer.from(authSalt, 'hex'), 32, { N: 16384, r: 8, p: 1 });
        const masterKey = crypto.randomBytes(32);
        const encSalt = crypto.randomBytes(16);
        const encKey = crypto.scryptSync(password, encSalt, 32, { N: 16384, r: 8, p: 1 });
        const encIv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', encKey, encIv);
        const encBuf = Buffer.concat([cipher.update(masterKey), cipher.final()]);
        const encTag = cipher.getAuthTag();
        const rec: UserRecord = {
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
        // skip bad entries
      }
    }
    if (out.length > 0) {
      try { saveUsers(out); } catch {}
      return out;
    }
  }
  return [];
}

function saveUsers(users: UserRecord[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

let users = loadUsers();

function getDriveId(req: express.Request): string {
  const fromQuery = typeof req.query.root === 'string' ? req.query.root : '';
  if (fromQuery && DRIVES_BY_ID.has(fromQuery)) return fromQuery;
  const fromBody = typeof req.body?.root === 'string' ? req.body.root : '';
  if (fromBody && DRIVES_BY_ID.has(fromBody)) return fromBody;
  return DRIVES[0]?.id || 'home';
}

function createApp() {
  const app = express();

  app.use(cookieParser());
  app.use(express.json());

  // ---- Auth ----
  function isAuthenticated(req: express.Request): boolean {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) return false;
    const s = sessions.get(token);
    if (!s) return false;
    if (Date.now() > s.expiresAt) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (isAuthenticated(req)) return next();
    res.status(401).json({ error: 'Unauthorized' });
  }

  // Registration flow: users may request access. Requests are stored in `server/pending.json`
  // Admin must manually approve requests using the included scripts (scripts/approve_pending.cjs).
  app.post('/api/auth/register', express.json(), async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Invalid username or password (min 6 chars)' });
    }
    // ensure not already registered or pending
    // reload users from disk so approvals made via CLI are visible immediately
    users = loadUsers();
    try {
      const pendingPath = path.resolve(__dirname, './pending.json');
      let pendingList: any[] = [];
      if (fs.existsSync(pendingPath)) {
        pendingList = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) || [];
      }
      if (users.find((u) => u.username === username) || pendingList.find((u) => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists or pending' });
      }
      const N = 16384, r = 8, p = 1;
      const authSalt = crypto.randomBytes(16).toString('hex');
      const authHashBuf = crypto.scryptSync(password, Buffer.from(authSalt, 'hex'), 32, { N, r, p });
      const masterKey = crypto.randomBytes(32);
      const encSalt = crypto.randomBytes(16);
      const encKey = crypto.scryptSync(password, encSalt, 32, { N, r, p });
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
        requestedAt: Date.now(),
      };
      pendingList.push(rec);
      fs.writeFileSync(pendingPath, JSON.stringify(pendingList, null, 2), 'utf8');
      console.log(`Pending registration: ${username} — approve with: node scripts/approve_pending.cjs ${username}`);
      return res.json({ ok: true, message: 'Request received. An admin will approve your account.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Login (username, password)
  app.post('/api/auth/login', express.json(), (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid request' });
    }
    // reload users on each login so newly approved users work without restarting the server
    users = loadUsers();
    const user = users.find((u) => u.username === username);
    if (!user) {
      // Compatibility: allow single ACCESS_PASSWORD fallback when set
      if (ACCESS_PASSWORD && password === ACCESS_PASSWORD) {
        // derive a master key from the access password for ephemeral session
        try {
          const masterKey = crypto.scryptSync(password, 'access_fallback_salt', 32);
          const token = makeSession();
          sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS, username, masterKey: masterKey.toString('hex') });
          res.cookie(AUTH_COOKIE, token, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: SESSION_TTL_MS,
            path: '/',
          });
          return res.json({ ok: true });
        } catch (err) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
      }
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    try {
      const authHashBuf = crypto.scryptSync(password, Buffer.from(user.authSalt, 'hex'), 32, { N: 16384, r: 8, p: 1 });
      if (authHashBuf.toString('hex') !== user.authHash) return res.status(401).json({ error: 'Invalid username or password' });
      // decrypt master key (supports new hex fields or legacy encMaster)
      let masterKey: Buffer | null = null;
      if ((user as any).enc && (user as any).encSalt) {
        const encSalt = Buffer.from((user as any).encSalt, 'hex');
        const encBuf = Buffer.from((user as any).enc, 'hex');
        const encKey = crypto.scryptSync(password, encSalt, 32, { N: 16384, r: 8, p: 1 });
        const iv = Buffer.from((user as any).encIv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
        decipher.setAuthTag(Buffer.from((user as any).encTag, 'hex'));
        masterKey = Buffer.concat([decipher.update(encBuf), decipher.final()]);
      } else if ((user as any).encMaster) {
        const encAll = Buffer.from((user as any).encMaster, 'base64');
        const encSalt = encAll.slice(0, 16);
        const enc = encAll.slice(16);
        const encKey = crypto.scryptSync(password, encSalt, 32);
        const iv = Buffer.from((user as any).encIv, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, iv);
        decipher.setAuthTag(Buffer.from((user as any).encTag, 'hex'));
        masterKey = Buffer.concat([decipher.update(enc), decipher.final()]);
      }
      if (!masterKey) return res.status(401).json({ error: 'Invalid username or password' });
      const token = makeSession();
      sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS, username, masterKey: masterKey.toString('hex') });
      res.cookie(AUTH_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_TTL_MS,
        path: '/',
      });
      res.json({ ok: true });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies?.[AUTH_COOKIE];
    if (token) sessions.delete(token);
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/check', (req, res) => {
    res.json({ authenticated: isAuthenticated(req) });
  });

  // ---- Drives ----
  app.get('/api/drives', requireAuth, async (_req, res) => {
    const drives = await Promise.all(
      DRIVES.map(async (d) => ({
        id: d.id,
        name: d.name,
        ...(await getDriveSpaceStats(d.path)),
      }))
    );
    res.json({ drives });
  });

  // ---- File listing ----
  app.get('/api/list', requireAuth, async (req, res) => {
    const driveId = getDriveId(req);
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!isPathSafe(driveId, relPath)) return res.status(400).json({ error: 'Invalid path' });
    const abs = safeResolve(driveId, relPath);
    try {
      const stat = await fsp.stat(abs);
      if (!stat.isDirectory()) return res.status(400).json({ error: 'Not a directory' });
      const entries = await fsp.readdir(abs, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (entry) => {
          const full = path.join(abs, entry.name);
          try {
            const s = await fsp.stat(full);
            let ext = path.extname(entry.name).toLowerCase();
            let isEncrypted = false;
            let originalName: string | undefined = undefined;
            let originalExt: string | undefined = undefined;
            // If this is an encrypted file, try to read its metadata to expose original name/type
            if (entry.name.toLowerCase().endsWith('.enc')) {
              const metaPath = full + '.meta.json';
              if (fs.existsSync(metaPath)) {
                try {
                  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || {};
                  if (meta.originalName && typeof meta.originalName === 'string') {
                    originalName = meta.originalName;
                    originalExt = path.extname(originalName).toLowerCase();
                  }
                } catch {
                  // ignore malformed metadata
                }
              }
              isEncrypted = true;
            }
            // use original extension when possible so frontend can show previews/icons
            const useExt = originalExt || ext;
            return {
              name: entry.name,
              isDir: entry.isDirectory(),
              size: s.isFile() ? s.size : 0,
              mtime: s.mtimeMs,
              ext: useExt,
              // expose encryption metadata for the client
              isEncrypted,
              originalName,
              originalExt,
              isText: TEXT_PREVIEW_EXT.has(useExt),
              isImage: IMAGE_EXT.has(useExt),
            };
          } catch {
            return null;
          }
        })
      );
      const clean = items.filter(Boolean) as any[];
      clean.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
      res.json({
        root: driveId,
        path: relPath,
        items: clean,
      });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ---- Stats for a file/dir ----
  app.get('/api/stat', requireAuth, async (req, res) => {
    const driveId = getDriveId(req);
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!isPathSafe(driveId, relPath)) return res.status(400).json({ error: 'Invalid path' });
    const abs = safeResolve(driveId, relPath);
    try {
      const stat = await fsp.stat(abs);
      res.json({
        name: path.basename(abs),
        isDir: stat.isDirectory(),
        size: stat.size,
        mtime: stat.mtimeMs,
      });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ---- Download a single file ----
  app.get('/api/download', requireAuth, async (req, res) => {
    const driveId = getDriveId(req);
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!isPathSafe(driveId, relPath)) return res.status(400).json({ error: 'Invalid path' });
    const abs = safeResolve(driveId, relPath);
    try {
      const stat = await fsp.stat(abs);
      if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
      // If file is encrypted (.enc) and has a .meta.json, decrypt using session master key
      if (abs.endsWith('.enc')) {
        const metaPath = abs + '.meta.json';
        if (!fs.existsSync(metaPath)) return res.status(400).json({ error: 'Missing metadata for encrypted file' });
        const token = req.cookies?.[AUTH_COOKIE];
        const session = token ? sessions.get(token) : undefined;
        if (!session) return res.status(401).json({ error: 'Unauthorized' });
        const masterKey = Buffer.from(session.masterKey, 'hex');
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const iv = Buffer.from(meta.iv, 'hex');
        const tag = Buffer.from(meta.tag, 'hex');
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(meta.originalName || path.basename(abs))}`);
        const inp = fs.createReadStream(abs);
        const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
        decipher.setAuthTag(tag);
        inp.on('error', (e) => { if (!res.headersSent) res.status(500).json({ error: e.message }); });
        inp.pipe(decipher).pipe(res);
        return;
      }
      const mimeType = mime.lookup(abs) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(abs))}`);
      const stream = fs.createReadStream(abs);
      stream.on('error', (e) => {
        if (!res.headersSent) res.status(500).json({ error: e.message });
      });
      stream.pipe(res);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ---- Text preview ----
  app.get('/api/preview', requireAuth, async (req, res) => {
    const driveId = getDriveId(req);
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!isPathSafe(driveId, relPath)) return res.status(400).json({ error: 'Invalid path' });
    const abs = safeResolve(driveId, relPath);
    try {
      const stat = await fsp.stat(abs);
      if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
      // Handle encrypted files: decrypt first then preview if text
      if (abs.endsWith('.enc')) {
        const metaPath = abs + '.meta.json';
        if (!fs.existsSync(metaPath)) return res.status(400).json({ error: 'Missing metadata for encrypted file' });
        const token = req.cookies?.[AUTH_COOKIE];
        const session = token ? sessions.get(token) : undefined;
        if (!session) return res.status(401).json({ error: 'Unauthorized' });
        const masterKey = Buffer.from(session.masterKey, 'hex');
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const iv = Buffer.from(meta.iv, 'hex');
        const tag = Buffer.from(meta.tag, 'hex');
        const MAX = 512 * 1024;
        const fd = await fsp.open(abs, 'r');
        const size = Math.min(stat.size, MAX);
        const encBuf = Buffer.alloc(size);
        await fd.read(encBuf, 0, size, 0);
        await fd.close();
        const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(encBuf), (() => { try { return decipher.final(); } catch { return Buffer.alloc(0); } })()]);
        const ext = path.extname(meta.originalName || '').toLowerCase();
        if (TEXT_PREVIEW_EXT.has(ext)) {
          res.json({ type: 'text', truncated: stat.size > MAX, content: plain.toString('utf8') });
          return;
        }
        if (IMAGE_EXT.has(ext)) {
          res.json({ type: 'image' });
          return;
        }
        res.json({ type: 'none' });
        return;
      }
      const ext = path.extname(abs).toLowerCase();
      const isText = TEXT_PREVIEW_EXT.has(ext);
      if (isText) {
        const MAX = 512 * 1024; // 512KB preview cap
        const size = Math.min(stat.size, MAX);
        const fd = await fsp.open(abs, 'r');
        const buf = Buffer.alloc(size);
        await fd.read(buf, 0, size, 0);
        await fd.close();
        res.json({
          type: 'text',
          truncated: stat.size > MAX,
          content: buf.toString('utf8'),
        });
      } else if (IMAGE_EXT.has(ext)) {
        res.json({ type: 'image' });
      } else {
        res.json({ type: 'none' });
      }
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ---- Stream raw file (for <img>/<video> src) ----
  app.get('/api/raw', requireAuth, async (req, res) => {
    const driveId = getDriveId(req);
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    if (!isPathSafe(driveId, relPath)) return res.status(400).json({ error: 'Invalid path' });
    const abs = safeResolve(driveId, relPath);
    try {
      const stat = await fsp.stat(abs);
      if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });
      if (abs.endsWith('.enc')) {
        const metaPath = abs + '.meta.json';
        if (!fs.existsSync(metaPath)) return res.status(400).json({ error: 'Missing metadata for encrypted file' });
        const token = req.cookies?.[AUTH_COOKIE];
        const session = token ? sessions.get(token) : undefined;
        if (!session) return res.status(401).json({ error: 'Unauthorized' });
        const masterKey = Buffer.from(session.masterKey, 'hex');
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const iv = Buffer.from(meta.iv, 'hex');
        const tag = Buffer.from(meta.tag, 'hex');
        const inp = fs.createReadStream(abs);
        const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
        decipher.setAuthTag(tag);
        const mimeType = mime.lookup(meta.originalName || '') || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        inp.on('error', (e) => { if (!res.headersSent) res.status(500).json({ error: e.message }); });
        inp.pipe(decipher).pipe(res);
        return;
      }
      const mimeType = mime.lookup(abs) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      const stream = fs.createReadStream(abs);
      stream.on('error', (e) => {
        if (!res.headersSent) res.status(500).json({ error: e.message });
      });
      stream.pipe(res);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ---- Download multiple paths as a zip ----
  app.post('/api/zip', requireAuth, express.json(), async (req, res) => {
    const driveId = getDriveId(req);
    const paths: string[] = Array.isArray(req.body?.paths) ? req.body.paths : [];
    if (paths.length === 0) return res.status(400).json({ error: 'No paths provided' });
    for (const p of paths) {
      if (!isPathSafe(driveId, p)) return res.status(400).json({ error: 'Invalid path' });
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="download-${Date.now()}.zip"`);
    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
    archive.pipe(res);
    for (const p of paths) {
      const abs = safeResolve(driveId, p);
      try {
        const stat = await fsp.stat(abs);
        const name = path.basename(abs);
        if (stat.isDirectory()) {
          archive.directory(abs, name);
        } else {
          archive.file(abs, { name });
        }
      } catch {
        // skip missing
      }
    }
    await archive.finalize();
  });

  // ---- Upload (multipart) ----
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        const driveId = getDriveId(req);
        const relPath = typeof req.body.path === 'string' ? req.body.path : '';
        if (!isPathSafe(driveId, relPath)) return cb(new Error('Invalid path'), '');
        const abs = safeResolve(driveId, relPath);
        cb(null, abs);
      },
      filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[\\/:*?"<>|]/g, '_');
        cb(null, safe);
      },
    }),
    limits: { fileSize: 1024 * 1024 * 1024 * 5 }, // 5GB per file
  });

  app.post('/api/upload', requireAuth, upload.array('files', 100), async (req, res) => {
    const token = req.cookies?.[AUTH_COOKIE];
    const session = token ? sessions.get(token) : undefined;
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
    const masterKey = Buffer.from(session.masterKey, 'hex');
    const files = (req.files as Express.Multer.File[]) || [];
    const uploaded: string[] = [];
    try {
      for (const f of files) {
        const src = f.path;
        const destName = f.filename + '.enc';
        const destPath = path.join(path.dirname(src), destName);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
        const inp = fs.createReadStream(src);
        const out = fs.createWriteStream(destPath);
        await new Promise<void>((resolve, reject) => {
          inp.pipe(cipher).pipe(out);
          out.on('finish', () => resolve());
          out.on('error', reject);
          inp.on('error', reject);
        });
        const tag = cipher.getAuthTag();
        // write metadata file for the encrypted file
        const meta = {
          originalName: f.originalname,
          iv: iv.toString('hex'),
          tag: tag.toString('hex'),
          size: fs.statSync(destPath).size,
        };
        fs.writeFileSync(destPath + '.meta.json', JSON.stringify(meta, null, 2), 'utf8');
        // remove original uploaded file
        try { fs.unlinkSync(src); } catch {}
        uploaded.push(f.originalname);
      }
      res.json({ ok: true, uploaded });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---- Create folder ----
  app.post('/api/mkdir', requireAuth, async (req, res) => {
    const driveId = getDriveId(req);
    const relPath = typeof req.body?.path === 'string' ? req.body.path : '';
    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    if (!isPathSafe(driveId, relPath) || !name) return res.status(400).json({ error: 'Invalid request' });
    const safeName = name.replace(/[\\/:*?"<>|]/g, '_');
    const abs = path.join(safeResolve(driveId, relPath), safeName);
    try {
      await fsp.mkdir(abs, { recursive: false });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---- Delete (file or directory, recursive) ----
  app.post('/api/delete', requireAuth, async (req, res) => {
    const driveId = getDriveId(req);
    const paths: string[] = Array.isArray(req.body?.paths) ? req.body.paths : [];
    if (paths.length === 0) return res.status(400).json({ error: 'No paths' });
    for (const p of paths) {
      if (!isPathSafe(driveId, p)) return res.status(400).json({ error: 'Invalid path' });
    }
    try {
      for (const p of paths) {
        await fsp.rm(safeResolve(driveId, p), { recursive: true, force: true });
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---- Rename / move ----
  app.post('/api/rename', requireAuth, async (req, res) => {
    const driveId = getDriveId(req);
    const from = typeof req.body?.from === 'string' ? req.body.from : '';
    const toName = typeof req.body?.to === 'string' ? req.body.to : '';
    if (!isPathSafe(driveId, from) || !toName) return res.status(400).json({ error: 'Invalid request' });
    const safeName = toName.replace(/[\\/:*?"<>|]/g, '_');
    const fromAbs = safeResolve(driveId, from);
    const toAbs = path.join(path.dirname(fromAbs), safeName);
    const root = getDriveRoot(driveId)!;
    if (path.relative(root, toAbs).startsWith('..')) {
      return res.status(400).json({ error: 'Invalid destination' });
    }
    try {
      await fsp.rename(fromAbs, toAbs);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---- Serve built frontend in production ----
  const clientDist = path.resolve(__dirname, '../dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  return app;
}

async function main() {
  for (const d of DRIVES) {
    try {
      await fsp.mkdir(d.path, { recursive: true });
    } catch {
      // may not be creatable (e.g. drive root); ignore
    }
  }
  const app = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`\n  Private Cloud running`);
    // list accessible URLs
    const nets = os.networkInterfaces();
    const addresses: string[] = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
    // always show localhost
    console.log(`  →  http://localhost:${PORT}`);
    if (HOST === '0.0.0.0' && addresses.length > 0) {
      console.log('  →  Accessible on the network at:');
      for (const a of addresses) {
        console.log(`     • http://${a}:${PORT}`);
      }
    } else if (HOST && HOST !== '0.0.0.0' && HOST !== '127.0.0.1') {
      console.log(`  →  http://${HOST}:${PORT}`);
    }
    console.log(`  Drives configured (${DRIVES.length}):`);
    for (const d of DRIVES) {
      console.log(`    • ${d.name}  [${d.id}]  →  ${d.path}`);
    }
    console.log(`  Access password: ${ACCESS_PASSWORD ? 'set' : 'not set'}`);
    console.log(`  Edit drives.json to add or remove drives/disks.`);
    console.log('');
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

export { createApp, formatBytes };
