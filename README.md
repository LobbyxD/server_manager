# Minecraft Server Manager

A modern desktop application for managing multiple Minecraft server instances, built with Electron, React, and TypeScript.

---

## Features

- **Multi-Server Management** – Create and manage multiple server profiles, each pointing to its own `.bat`/`.cmd` start script
- **Server Lifecycle Control** – Start, stop, restart, and force-kill servers with a single click
- **Real-time Console** – Live stdout/stderr streaming with timestamps, ANSI color support, text filtering, and auto-scroll
- **Command History** – Navigate previously sent commands with the up/down arrow keys
- **Player Management Panel** – Kick, op/deop, whitelist, ban, and pardon players directly from the UI
- **Server Commands** – Broadcast messages, change time/weather, and save the world without touching the console
- **In-app .bat Editor** – Edit server start scripts without leaving the app
- **Auto-start** – Configure servers to start automatically when the app launches
- **System Tray** – Minimize to tray on close; keep servers running in the background
- **Auto-updater** – Checks for updates on launch and via Settings; downloads and installs silently

---

## Screenshots

> _Coming soon_

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 32 |
| Build tooling | electron-vite 2 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS 3 + CSS custom properties |
| State | Zustand 5 |
| Persistence | electron-store 8 |
| Auto-update | electron-updater 6 |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm 9 or later
- A Minecraft server with a `.bat` or `.cmd` start script

### Install dependencies

```bash
git clone https://github.com/LobbyxD/server_manager.git
cd server_manager
npm install
npm install --prefix installer
```

### Run in development

```bash
npm run dev
```

### Build (compile only)

```bash
npm run build
```

### Package (build + create installer EXE)

```bash
npm run package
```

Produces `installer/installer-dist/MinecraftServerManager-Setup.exe` — a portable, self-elevating installer.

### Publish a release to GitHub

```bash
npm run release
```

Builds everything, then creates a GitHub release tagged `v<version>` and uploads the installer EXE.

> Requires [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`).

---

## Installation (end users)

1. Download `MinecraftServerManager-Setup.exe` from the [Releases](https://github.com/LobbyxD/server_manager/releases) page.
2. Double-click — Windows will prompt for administrator rights (required to install).
3. Choose an install folder and optional shortcuts, then click **Install**.
4. The installer doubles as an uninstaller: re-run it after installation to **Repair** or **Uninstall**.

---

## Usage

1. **Add a server** – Click **Add Server** in the sidebar, enter a display name, and browse to your server's `.bat` or `.cmd` start script.
2. **Start the server** – Select it from the sidebar and click **Start**.
3. **Send commands** – Type into the console input bar and press Enter. Use the up/down arrows to recall previous commands.
4. **Manage players** – Switch to the **Players** tab for kick, op/deop, whitelist, ban, and pardon controls.
5. **Edit the start script** – Click **Edit Script** in the server controls to open the in-app `.bat` editor.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| Minimize to tray | On | Close button minimizes instead of quitting |
| Log font size | 13 px | Console font size (10–20 px) |
| Max concurrent servers | 1 | How many servers can run at once (1–10) |
| Debug mode | Off | Show raw error details instead of friendly messages |
| Check For Updates | — | Manually check for a new version |

---

## Project Structure

```
minecraft-server-manager/
├── src/
│   ├── main/               # Electron main process
│   │   ├── index.ts        # App entry, single-instance lock
│   │   ├── ipcHandlers.ts  # All IPC handlers
│   │   ├── serverProcess.ts# ServerProcess class (spawn/stop/kill)
│   │   ├── updater.ts      # Auto-updater (electron-updater)
│   │   ├── store.ts        # Persistent store helpers
│   │   ├── tray.ts         # System tray
│   │   └── window.ts       # BrowserWindow setup
│   ├── preload/
│   │   └── index.ts        # contextBridge window.api
│   ├── renderer/src/
│   │   ├── components/     # All UI components
│   │   ├── hooks/          # useServerEvents (IPC subscriptions)
│   │   ├── store/          # useAppStore (Zustand)
│   │   └── styles/         # Tailwind + CSS variables
│   └── shared/
│       └── types.ts        # Shared TypeScript types + IPC channel constants
├── installer/              # Standalone installer Electron app
│   ├── src/
│   │   ├── main/           # Installer main process + IPC handlers
│   │   ├── preload/        # contextBridge for installer renderer
│   │   └── renderer/src/   # React UI (InstallView / ManageView)
│   └── build/
│       └── after-build.js  # electron-builder afterPack hook
├── scripts/
│   └── release.js          # Build + publish GitHub release in one step
└── resources/
    └── icon.ico            # Windows app icon
```

---

## License

MIT
