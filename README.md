# Private Cloud — Personal File Explorer

A lightweight, self-hosted web app for browsing, previewing, uploading, and downloading files from one or more folders on your machine. Designed for personal use over a LAN or VPN: add multiple drives/folders, preview common file types, zip downloads, and simple password access.

Supported features
- Multiple drives/folders (configured in `drives.json`)
- Browse folders with breadcrumbs and file-type icons
- Preview images and text/code files inline
- Download single files or multi-select ZIP archives
- Upload files (button or drag-and-drop) with progress
- Create, rename, and delete files/folders
- Password-protected access (httpOnly session cookie)

Getting started
1) Install dependencies

```bash
npm install
```

2) Configure access password

Copy or create a `.env` file at the project root and set a strong access password:

```
ACCESS_PASSWORD=your_secret_password_here
HOST=0.0.0.0
PORT=3000
```

3) Add drives / folders

Edit [drives.json](drives.json) and list the folders you want exposed. Each entry must include an `id` (short unique name), `name` (display label) and `path` (absolute or relative path):

```json
[ { "id": "home", "name": "Home", "path": "./files" } ]
```

Notes:
- Windows paths like `C:/Users/Alex/` work fine. Use forward slashes for portability.
- The `id` must be unique and contain no spaces or special characters.
- Each drive is sandboxed to its `path` root.

Development

- Start the frontend + server with hot reload:

```bash
npm run dev
```

- Or run only the server watcher:

```bash
npm run dev:server
```

Build & production

- Build the frontend:

```bash
npm run build
```

- Optionally compile server types (if you changed server TS sources):

```bash
npm run build:server
```

- Start the production server (runs `server/index.ts` directly):

```bash
npm start
```

- Preview a production build (Vite preview):

```bash
npm run preview
```

Ports and host

- Default host and port can be set in `.env` (see `HOST` and `PORT`).
- Dev mode exposes the Vite dev server (`5173`) and the API server (`3000`) by default when running `npm run dev`. The `dev` script uses `concurrently` to run both.

Environment variables

- `ACCESS_PASSWORD` — required, the password used to log in.
- `HOST` — network interface to bind (default `0.0.0.0` for accessibility on LAN/VPN).
- `PORT` — server port (default `3000`).

Security recommendations

- Use a strong, unique `ACCESS_PASSWORD`.
- Prefer running behind a reverse proxy (Caddy, nginx) for TLS termination and additional access controls.
- If you only need local access, set `HOST=127.0.0.1`.
- Keep `drives.json` limited to folders you intend to share; each drive is restricted to its root but misconfiguration can expose unwanted data.

Deployment tips

- For LAN/VPN access: ensure your machine's firewall allows the chosen `PORT` for the desired interface.
- For public exposure: do not rely on the built-in password alone. Use HTTPS + basic auth or OAuth at the reverse proxy level.

Useful scripts

- `npm run dev` — start frontend and server with watchers
- `npm run dev:server` — start just the server in watch mode
- `npm run build` — build frontend
- `npm run build:server` — compile server TypeScript
- `npm start` — run server (production)
- `npm run preview` — preview production build

Troubleshooting

- If the dev server fails to bind, check `HOST` in `.env` and any VPN or firewall settings.
- If files don't appear, confirm paths in [drives.json](drives.json) and permissions for the user running the server.
- For CORS or proxy issues in development, the `dev` script runs both frontend and API together via `concurrently`.

Contributing

- Bug reports and PRs welcome. Keep changes focused and add tests where applicable.

License

- This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

Files of interest

- [server/index.ts](server/index.ts) — backend API and file handlers
- [drives.json](drives.json) — list of drives/folders exposed by the app
- [src/](src) — React frontend

I added an example `.env.example` and a concise troubleshooting section for Windows and VPN setups below.

Troubleshooting (Windows & VPN)

- Find the correct IP to connect from another device:

	- Run `ipconfig` in PowerShell and look for the VPN adapter or the interface assigned by your VPN; use the `IPv4 Address` shown.

- Verify the server is running and listening on the expected port:

	- Start the app (`npm run dev` or `npm start`) and run:

		```powershell
		# show listening ports (Windows)
		netstat -ano | findstr :3000

		# or use PowerShell's cmdlet
		Get-NetTCPConnection -LocalPort 3000
		```

- If you can't reach the server from another machine:

	- Confirm `HOST` in `.env` is `0.0.0.0` (binds all interfaces) or the VPN-assigned IP. Example: `HOST=0.0.0.0`.
	- Ensure Windows Firewall allows the port (example to open TCP 3000):

		```powershell
		# run as Administrator
		New-NetFirewallRule -DisplayName "FileExplorer" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
		```

	- From another VPN device, test with curl or a browser:

		```bash
		curl http://<VPN_IP>:3000/
		```

- VPN notes:

	- Some VPNs block local port access by default. Check your VPN client settings for "Allow LAN access" or split-tunneling options.
	- Use the VPN-assigned IP (not the private LAN IP) when connecting from another device on the same VPN.
