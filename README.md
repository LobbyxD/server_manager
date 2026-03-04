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
- **Themes** – Dark and light mode with instant switching
- **Steam Integration** – Ownership verification and achievement tracking via Steamworks SDK

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
| Steam SDK | steamworks.js |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm 9 or later
- A Minecraft server with a `.bat` or `.cmd` start script

### Install

```bash
git clone https://github.com/your-username/minecraft-server-manager.git
cd minecraft-server-manager
npm install
```

### Run in development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Package (creates installer in `dist/`)

```bash
npm run package
```

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
| Theme | Dark | Dark or light UI |
| Minimize to tray | On | Close button minimizes instead of quitting |
| Log font size | 13 px | Console font size (10–20 px) |
| Max concurrent servers | 1 | How many servers can run at once (1–10) |
| Debug mode | Off | Show raw error details instead of friendly messages |

---

## Achievements

The app ships with 8 Steam achievements:

| Achievement | How to unlock |
|---|---|
| First Launch | Open the app for the first time |
| First Server | Start your first server |
| Safe Exit | Gracefully shut down with servers running |
| Force Killer | Force-kill a server |
| Ban Hammer | Ban a player |
| OP Granted | Grant operator status to a player |
| Whitelist | Enable the whitelist |
| Multitasker | Run 2 or more servers at the same time |

---

## Project Structure

```
minecraft-server-manager/
├── src/
│   ├── main/               # Electron main process
│   │   ├── index.ts        # App entry, single-instance lock
│   │   ├── ipcHandlers.ts  # All IPC handlers
│   │   ├── serverProcess.ts# ServerProcess class (spawn/stop/kill)
│   │   ├── steam.ts        # Steamworks integration
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
└── resources/
    └── icon.ico            # Windows app icon
```

---

## License

MIT
