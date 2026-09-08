# 🚀 BesTTY — The Next-Gen Open-Source SSH/SFTP Client for Windows 10 & 11

> **Spiritual successor to SmarTTY**, reimagined for 2026 with modern Windows 11 Fluent 2 Design, GPU-accelerated terminal emulation, in-place Monaco code editor, real-time VPS telemetry, and zero-knowledge encrypted vault.

---

## ✨ Why BesTTY?

For years, **SmarTTY** was the undisputed favorite tool for developers and sysadmins working with Linux servers because of its revolutionary multi-tab terminal, graphical SFTP sidebar, and instant in-place file editor. However, its development ceased in 2022, leaving it with outdated crypto, blurry High-DPI fonts, lack of split panes, and missing modern authentication (FIDO2, Windows OpenSSH agent).

Other tools either have outdated 2000s-era interfaces (PuTTY, MobaXterm) or have locked basic sysadmin features behind steep $12+/month subscriptions (Termius).

**BesTTY is 100% Free & Open Source (MIT License)**, built from the ground up to provide the ultimate desktop experience for Windows 10/11 users managing Linux VPS, dedicated servers, clouds (AWS, Hetzner, DigitalOcean), and home labs.

---

## 📊 Feature Comparison

| Capability | BesTTY | SmarTTY (Legacy) | PuTTY | Termius | MobaXterm |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **License** | **Free / MIT** | Free (Closed source) | Free / Open Source | Paid ($12+/mo for features) | Freemium ($69/seat) |
| **UI Design** | **Windows 11 Fluent 2 / Mica** | WinForms (Old) | Win32 Classic (1998) | Modern Web | Outdated X11 GUI |
| **High-DPI / 4K Crispness** | **100% Native Vector** | ❌ Blurry fonts | ❌ Fixed bitmap | Modern | Mixed / Scaled |
| **GPU-Accelerated Terminal** | **WebGL / 120+ FPS** | ❌ Software GDI | ❌ Software GDI | WebGL | ❌ Software |
| **OSC 7 CWD Tracking** | **Instant Auto-sync SFTP** | ✅ (Custom hook) | ❌ | ❌ | ❌ |
| **In-place Remote Code Editor** | **Monaco Editor (VS Code core)** | Basic Editor | ❌ | ❌ | Notepad / Scintilla |
| **Sudo Save (Escalated write)** | **Native `sudo tee` support** | ❌ | ❌ | ❌ | ❌ |
| **Diff Viewer (Local vs Remote)** | **Built-in Diff Editor** | ❌ | ❌ | ❌ | ❌ |
| **Live VPS Health Monitor** | **CPU, RAM, Disks, Top PS** | ❌ | ❌ | ❌ | ❌ |
| **SSH Port Forwarding GUI** | **Local, Remote, Dynamic SOCKS5**| Partial | CLI flags only | Paid | Good |
| **SSH Key Agents** | **Win OpenSSH, Pageant, 1Pass** | Pageant only | Pageant only | Proprietary | Pageant |
| **Encrypted Vault** | **AES-256-GCM + Master Pass** | Plain / Windows DPAPI | Registry (Plain) | Cloud sync (Paid) | Local config |

---

## 🛠️ Complete Feature Deep-Dive

### 1. 🖥️ GPU-Accelerated Virtual Terminal
- Powered by `@xterm/xterm` with **WebGL** rendering pipeline for smooth 120+ FPS scrolling.
- Full support for **TrueColor (24-bit RGB)**, ANSI 16/256 colors, Unicode 15, and Powerline / Nerd Fonts with ligatures (Cascadia Code, JetBrains Mono, Fira Code).
- Interactive **OSC 8 Clickable Hyperlinks** and regex scrollback search (`Ctrl+F`).
- **OSC 7 Smart Directory Tracking**: When you execute `cd /var/www/html` in your Linux bash/zsh shell, the companion SFTP file explorer automatically navigates to that path!

### 2. 📂 Graphical SFTP File Explorer (The SmarTTY Champion)
- Dual and single panel file manager directly integrated with your active SSH session.
- Seamless breadcrumb navigation with one-click folder jumping.
- Upload, download, create folders, delete, rename, and edit Unix permissions (`chmod 755 / 644`).
- Double-click any file to launch the **In-place Monaco Editor** instantly!

### 3. 📝 In-Place Monaco Editor (VS Code Engine)
- Zero-download workflow: double-click `/etc/nginx/nginx.conf`, edit with full syntax highlighting, and press `Ctrl+S` to write back atomically over SFTP!
- Syntax highlighting for 70+ languages (JSON, YAML, Nginx, Dockerfile, Python, Shell, SQL, Markdown).
- **Sudo Save**: If editing a file protected by root permissions, one click writes via `sudo tee` without permission denied errors.
- **Side-by-Side Diff Viewer**: Compare your unsaved modifications against the original remote file before saving.

### 4. 📈 Real-Time VPS Health Telemetry & Process Manager
- Non-blocking background telemetry stream collecting metrics every 3 seconds:
  - **CPU Utilization (%)**
  - **Memory (RAM) & Swap usage**
  - **Load Averages (1m, 5m, 15m)** and Uptime
  - **Disk Mounts** with percentage gauges
  - **Top Running Processes** with one-click `SIGTERM` / `SIGKILL` termination.

### 5. 🌐 Visual SSH Tunnel & Port Forwarding Manager
- **Local Port Forwarding (`-L`)**: Forward local ports to internal remote services (e.g. `localhost:5432` to remote Postgres).
- **Dynamic Port Forwarding (`-D`)**: Turn any SSH connection into a private **SOCKS5 Proxy** for secure web browsing and firewall bypass.
- **Remote Port Forwarding (`-R`)**: Expose local webhooks or dev servers to the internet.
- Visual status indicators and one-click toggle.

### 6. 🔐 Zero-Knowledge Encrypted Vault
- All host credentials, private keys, tunnels, and snippets are stored in an encrypted database (`bestty-vault.enc`).
- Encrypted with **AES-256-GCM** using **PBKDF2** (100,000 rounds) key derivation.
- Master password lock/unlock with auto-clearing memory buffers.
- Support for Windows OpenSSH named pipe agent (`\\.\pipe\openssh-ssh-agent`) and Pageant.

---

## 💻 Tech Stack & Architecture

```
BesTTY Desktop Architecture
│
├── Main Process (Node.js 24 + Electron 35)
│   ├── SSHClientManager: ssh2 connection pooling, PTY multiplexing, OSC 7 parser
│   ├── SFTPManager: directory streaming, chunked transfers, sudo tee writer
│   ├── MonitorService: background procfs & ps parser
│   ├── TunnelManager: TCP forwarders & SOCKS5 dynamic proxy server
│   └── VaultManager: AES-256-GCM encrypted credential storage
│
└── Renderer Process (React 19 + TypeScript + Vite + Tailwind CSS)
    ├── TitleBar: Windows 11 custom controls & multi-tab navigation
    ├── TerminalView: xterm.js WebGL GPU engine & search
    ├── SftpView: file manager & breadcrumb navigation
    ├── MonacoEditorView: embedded VS Code editor & Diff viewer
    ├── MonitorView: VPS telemetry gauges & process killer
    ├── TunnelsView: interactive port forwarding dashboard
    └── SnippetsView: one-click command executor
```

---

## 🚀 Getting Started (Development & Build)

### Prerequisites
- Windows 10 or Windows 11 (64-bit or ARM64)
- Node.js 20+ or 24+ installed
- npm 10+ installed

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/bazmadev/BesTTY.git
cd BesTTY
npm install
```

### 2. Run in Development Mode
Launch both the Vite development server and Electron with hot reload:
```bash
npm run app
```

### 3. Build Production Executable / Installer
Compile TypeScript for both processes and package into a standalone Windows `.exe` / installer:
```bash
npm run dist
```

---

## 📜 License

This project is licensed under the **MIT License** — completely free for personal and commercial use.
Contributions and Pull Requests are warmly welcome!
