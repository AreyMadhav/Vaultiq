# Private Cloud

A self-hosted web app to browse, preview, upload, and download files from your personal computer over your VPN. Supports multiple drives/disks/locations accessible from a single sidebar.

## Quick start

### 1. Set your password

Open `.env` and change:

```
ACCESS_PASSWORD=changeme    # change this to a secret only you know
```

### 2. Add your drives / disks / folders

Open `drives.json` and list the locations you want to access. Each entry has an `id` (short unique name, no spaces), a `name` (display label), and a `path` (the folder on your computer):

```json
[
  { "id": "home",    "name": "Home",        "path": "./files" },
  { "id": "documents","name": "Documents",  "path": "/home/alex/Documents" },
  { "id": "media",   "name": "Media Drive", "path": "/mnt/media" },
  { "id": "photos",  "name": "Photos",      "path": "D:/Pictures" }
]
```

- **Linux/Mac:** use absolute paths like `/home/alex/Documents` or `/mnt/external`
- **Windows:** use paths like `C:/Users/Alex/Documents` or `D:/Pictures` (forward slashes work fine)
- You can add as many as you want — each one shows up as a clickable entry in the sidebar
- The `id` must be unique and contain no spaces or special characters

### 3. Run it

```bash
npm install
npm run build      # builds the frontend
npm start          # serves everything on one port (default 3000)
```

Open **http://localhost:3000** in your browser, enter your password, and you're in.

For development with hot reload:
```bash
npm run dev
```
Then open **http://localhost:5173** on this PC, or **http://<this-pc-ip>:5173** from another device on the same network.

If you want to force the dev server onto a specific interface, you can also run:
```bash
npm run dev -- --host 0.0.0.0
```

The same applies to production preview:
```bash
npm run preview
```
Then open **http://<this-pc-ip>:4173** from another device on the same network.

## Accessing it over your VPN

1. Your VPN is already installed on this computer, so this machine is reachable from your other devices on the VPN network.
2. Find this computer's VPN IP address (the one your VPN assigned it).
3. From any device on the same VPN, open `http://<this-computer's-VPN-IP>:3000`.
4. Enter your access password.

The server binds to `0.0.0.0` by default (all network interfaces), so it's reachable over the VPN. If you want localhost-only access, set `HOST=127.0.0.1` in `.env`.

## Features

- **Multiple drives** — add any number of disks, partitions, or folders in `drives.json`, all accessible from a sidebar
- Browse folders with breadcrumbs and back navigation
- Password-protected login (session stored in an httpOnly cookie, lasts 12 hours)
- Download individual files
- Multi-select files/folders and download them all as a single `.zip`
- Preview images and text/code files inline
- Upload files (button or drag-and-drop) with progress bar — works as a personal cloud
- Create new folders
- Rename files and folders
- Delete files and folders
- File-type icons with color coding
- Responsive, dark-themed UI

## Security notes

- Set `ACCESS_PASSWORD` to something strong — it's the only thing protecting access.
- Each drive is sandboxed to its own folder — the app cannot escape a drive's root path.
- All file paths are validated to prevent directory traversal.
- For real HTTPS, put a reverse proxy (e.g. Caddy or nginx) in front of it with TLS.
