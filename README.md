# 🚀 BesTTY — The Next-Gen Open-Source SSH/SFTP Client for Windows 10 & 11

> **Spiritual successor to SmarTTY**, reimagined for 2026 with modern Windows 11 Fluent 2 Design, GPU-accelerated terminal emulation, in-place Monaco code editor, real-time VPS telemetry, and zero-knowledge encrypted vault.

---

**Languages / Языки / Լեզուներ:**  
[English](#-bestty--the-next-gen-open-source-sshsftp-client-for-windows-10--11) • [Русский](#-описание-на-русском-языке) • [Հայերեն](#-նկարագրություն-հայերենով) • [🌐 Request a Language / Запросить язык](#-локализация-и-запрос-новых-языков--localization--language-requests)

---

## ✨ Why BesTTY?

For years, **SmarTTY** was the undisputed favorite tool for developers and sysadmins working with Linux servers because of its revolutionary multi-tab terminal, graphical SFTP sidebar, and instant in-place file editor. However, its development ceased in 2022, leaving it with outdated crypto, blurry High-DPI fonts, lack of split panes, and missing modern authentication (FIDO2, Windows OpenSSH agent).

Other tools either have outdated 2000s-era interfaces (PuTTY, MobaXterm) or have locked basic sysadmin features behind steep $12+/month subscriptions (Termius).

**BesTTY is 100% Free & Open Source (MIT License with Non-Commercial & Author Protection Conditions)**, built from the ground up to provide the ultimate desktop experience for Windows 10/11 users managing Linux VPS, dedicated servers, clouds (AWS, Hetzner, DigitalOcean), and home labs.

---

## 📊 Feature Comparison

| Capability | BesTTY | SmarTTY (Legacy) | PuTTY | Termius | MobaXterm |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **License** | **Free / MIT (Non-Commercial)** | Free (Closed source) | Free / Open Source | Paid ($12+/mo for features) | Freemium ($69/seat) |
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

## 🌐 Локализация и запрос новых языков / Localization & Language Requests

BesTTY aims to support developers and sysadmins across the globe. You can easily request your native language or help us translate the interface!

| Language | Code | Status | Issue / PR |
| :--- | :---: | :---: | :---: |
| **English** | `en` | ✅ Available (Default) | Built-in |
| **Русский (Russian)** | `ru` | ✅ Available | Built-in |
| **Հայերեն (Armenian)** | `hy` | ✅ Available | Built-in |
| *Your Language Here* | — | ⏳ Available upon request | [👉 Request New Language](https://github.com/bazmadev/BesTTY/issues/new?template=language_request.yml) |

### 🗳️ How to Request a New Language:
1. Open a new request via our [🌐 Language Request Issue Template](https://github.com/bazmadev/BesTTY/issues/new?template=language_request.yml).
2. Specify your language name and ISO code (e.g. `de` for German, `es` for Spanish, `fr` for French, `zh` for Chinese, etc.).
3. Languages with the highest community demand are prioritized for upcoming releases!
4. If you want to contribute translations directly, mention it in the issue — we warmly welcome pull requests!

---

## 🇷🇺 Описание на русском языке

### 🚀 BesTTY — Open-Source SSH/SFTP клиент нового поколения для Windows 10 & 11

> **Духовный наследник легендарного SmarTTY**, переосмысленный для 2026 года с ультрасовременным дизайном Windows 11 Fluent 2 / Mica, аппаратным WebGL-ускорением терминала, встроенным редактором кода Monaco, телеметрией сервера в реальном времени и защищенным хранилищем с шифрованием AES-256.

### ✨ Почему BesTTY?

Долгие годы программа **SmarTTY** оставалась незаменимым инструментом для разработчиков, DevOps-инженеров и системных администраторов благодаря удобным вкладкам, наглядному графическому SFTP-проводнику и мгновенному редактированию файлов без ручного скачивания. Однако разработка SmarTTY прекратилась в 2022 году, из-за чего в ней остались устаревшие алгоритмы криптографии, размытые шрифты на экранах с высоким разрешением (High-DPI/4K), отсутствие разделения экрана (Split View) и отсутствие поддержки современного OpenSSH-агента Windows.

Другие решения либо застряли в интерфейсах эпохи 2000-х годов (PuTTY, MobaXterm), либо берут ежемесячную платную подписку от $12/месяц за базовые функции (Termius).

**BesTTY на 100% бесплатный проект с открытым исходным кодом (лицензия MIT с условием некоммерческого использования и защиты авторства)**, созданный специально для комфортной повседневной работы на Windows 10 и 11 с удаленными серверами Linux, VPS/VDS, облаками (AWS, Hetzner, DigitalOcean) и домашними серверами (HomeLab).

### 🛠️ Ключевые возможности:

1. **🖥️ Аппаратно ускоренный терминал на GPU (WebGL)**:
   - Плавная прокрутка с частотой 120+ FPS на базе `@xterm/xterm` и WebGL.
   - Полная поддержка TrueColor (24-bit RGB), ANSI 16/256 цветов, Unicode 15 и шрифтов для разработчиков со значками Powerline / Nerd Fonts (Cascadia Code, JetBrains Mono, Fira Code).
   - Интерактивные кликабельные ссылки (OSC 8) и поиск по истории терминала (`Ctrl+F`).
   - **Умное отслеживание каталогов (OSC 7)**: при выполнении `cd /var/www` в bash/zsh SFTP-проводник автоматически переходит в указанную папку!

2. **📂 Встроенный SFTP-проводник**:
   - Управление файлами в один или два клика (настраивается по предпочтению).
   - Удобная навигация («хлебные крошки»), быстрый переход по папкам.
   - Загрузка, скачивание, создание каталогов, удаление, переименование и редактирование прав доступа Unix (`chmod 755 / 644`).
   - Возможность разделить экран (Split View) для одновременной работы с локальными файлами Windows и удаленным SFTP сервером.

3. **📝 Встроенный редактор кода Monaco (движок VS Code)**:
   - Открытие и редактирование удаленных файлов прямо на сервере в один клик без промежуточных временных файлов.
   - Подсветка синтаксиса для более чем 70 языков (Nginx, Dockerfile, Python, Shell/Bash, YAML, JSON, SQL и др.).
   - **Sudo Save**: если файл защищен правами root (например `/etc/nginx/nginx.conf`), BesTTY сохранит его через `sudo tee` без ошибки отказа в доступе.
   - **Встроенный Diff-просмотр**: сравнение локальных изменений с оригиналом на сервере перед сохранением.

4. **📈 Мониторинг VPS в реальном времени**:
   - Фоновый поток телеметрии с обновлением каждые 3 секунды.
   - Наглядные графики использования процессора (CPU %), оперативной памяти (RAM) и файла подкачки (Swap).
   - Средняя загрузка (Load Average 1m, 5m, 15m) и время аптайма.
   - Заполненность дисковых разделов.
   - Список ресурсоемких процессов с возможностью завершения (`SIGTERM` / `SIGKILL`).

5. **🌐 Менеджер SSH-туннелей и проброса портов (Port Forwarding)**:
   - **Local Port Forwarding (`-L`)**: проброс портов к закрытым внутренним базам данных (PostgreSQL, MySQL, Redis).
   - **Dynamic Port Forwarding (`-D`)**: превращение любого SSH-соединения в персональный **SOCKS5-прокси** для безопасного веб-серфинга.
   - **Remote Port Forwarding (`-R`)**: доступ к локальным веб-серверам разработки из интернета.

6. **🔐 Зашифрованное хранилище Vault (Zero-Knowledge)**:
   - Все пароли, приватные ключи, настройки хостов и сниппеты защищены шифрованием **AES-256-GCM** с алгоритмом PBKDF2 (100 000 итераций).
   - Поддержка системного агента ключей Windows OpenSSH (`\\.\pipe\openssh-ssh-agent`) и Pageant.

---

## 🇦🇲 Նկարագրություն հայերենով

### 🚀 BesTTY — Նոր սերնդի բաց կոդով SSH/SFTP ծրագիր Windows 10 և 11-ի համար

> **Լեգենդար SmarTTY-ի գաղափարական շարունակությունը**, վերաիմաստավորված 2026 թվականի համար՝ Windows 11 Fluent 2 / Mica դիզայնով, GPU-արագացված տերմինալով, ներկառուցված Monaco կոդի խմբագրիչով, VPS ռեսուրսների իրական ժամանակում մոնիթորինգով և AES-256 ծածկագրված անվտանգ պահոցով:

### ✨ Ինչո՞ւ ընտրել BesTTY-ն

Երկար տարիներ **SmarTTY**-ն համարվում էր ծրագրավորողների և համակարգային ադմինիստրատորների ամենասիրելի գործիքներից մեկը՝ շնորհիվ ներդիրներով (tabs) տերմինալի, SFTP ֆայլային կառավարչի և ֆայլերի տեղում խմբագրման հնարավորության: Սակայն SmarTTY-ի զարգացումը դադարեցվել է 2022 թվականին, ինչի պատճառով այնտեղ բացակայում էին ժամանակակից կրիպտոգրաֆիկ ալգորիթմները, High-DPI/4K էկրանների վրա տեքստը լղոզված էր, բացակայում էր էկրանի բաժանումը (Split View) և Windows OpenSSH գործակալի աջակցությունը:

Այլ ծրագրերը կամ ունեն 2000-ականների հնացած ինտերֆեյս (PuTTY, MobaXterm), կամ հիմնական գործառույթների համար պահանջում են ամսական թանկ բաժանորդագրություն (Termius, $12+/ամիս):

**BesTTY-ն 100% անվճար է և բաց կոդով (MIT լիցենզիա՝ ոչ առևտրային օգտագործման և հեղինակային իրավունքների պաշտպանության պայմանով)**, ստեղծված հատուկ Windows 10 և 11 օգտատերերի համար՝ Linux սերվերների, VPS/VDS-ների, ամպային ծառայությունների (AWS, Hetzner, DigitalOcean) և տնային սերվերների (HomeLab) հետ առավելագույնս հարմարավետ աշխատելու նպատակով:

### 🛠️ Հիմնական առանձնահատկությունները՝

1. **🖥️ GPU-արագացված վիրտուալ տերմինալ (WebGL)**՝
   - Գերարագ և սահուն ոլորում 120+ FPS արագությամբ՝ `@xterm/xterm` և WebGL տեխնոլոգիայով:
   - TrueColor (24-bit RGB), ANSI 16/256 գույներ, Unicode 15 և ծրագրավորման լեզուների Nerd Fonts / Cascadia Code տառատեսակների ամբողջական աջակցություն:
   - Ինտերակտիվ սեղմվող հղումներ (OSC 8) և որոնում տերմինալի պատմության մեջ (`Ctrl+F`):
   - **Կատալոգների խելացի հետևում (OSC 7)**՝ bash/zsh տերմինալում `cd` հրաման կատարելիս SFTP կառավարիչն ինքնաշխատ կերպով բացում է համապատասխան թղթապանակը:

2. **📂 Գրաֆիկական SFTP ֆայլային կառավարիչ**՝
   - Ֆայլերի դիտում և նավիգացիա մեկ կամ երկու կտտոցով (կարգավորելի ըստ ցանկության):
   - Արագ նավիգացիա («հացի փշրանքներ»), թղթապանակների հարմար որոնում:
   - Ներբեռնում, վերբեռնում, նոր թղթապանակների ստեղծում, հեռացում, վերանվանում և Unix թույլտվությունների խմբագրում (`chmod 755 / 644`):
   - Էկրանի բաժանում (Split View)՝ տեղական Windows ֆայլերի և հեռակա սերվերի SFTP-ի միջև ֆայլերի հեշտ փոխանակման համար:

3. **📝 Ներկառուցված Monaco կոդի խմբագրիչ (VS Code շարժիչ)**՝
   - Ֆայլերի բացում և խմբագրում անմիջապես սերվերի վրա՝ առանց ձեռքով ներբեռնելու:
   - 70-ից ավելի ծրագրավորման լեզուների շարահյուսական գունավորում (Nginx, Dockerfile, Python, Bash, YAML, JSON, SQL և այլն):
   - **Sudo Save**՝ root իրավունքներ պահանջող ֆայլերի (օր. `/etc/nginx/nginx.conf`) պահպանում `sudo tee`-ի միջոցով՝ առանց իրավունքի մերժման սխալի:
   - **Ներկառուցված Diff տեսարան**՝ կատարված փոփոխությունները նախնական ֆայլի հետ համեմատելու հնարավորություն:

4. **📈 VPS-ի իրական ժամանակի մոնիթորինգ**՝
   - Համակարգային ռեսուրսների ավտոմատ թարմացում յուրաքանչյուր 3 վայրկյանը մեկ:
   - Պրոցեսորի (CPU %), օպերատիվ հիշողության (RAM) և Swap-ի տեսողական գրաֆիկներ:
   - Միջին ծանրաբեռնվածության (Load Average) և սերվերի աշխատանքի տևողության (Uptime) ցուցիչներ:
   - Կոշտ սկավառակների ծավալի զբաղվածության ստուգում:
   - Ամենաշատ ռեսուրս օգտագործող գործընթացների ցանկ՝ դրանք անջատելու հնարավորությամբ (`SIGTERM` / `SIGKILL`):

5. **🌐 SSH թունելներ և Port Forwarding**՝
   - **Local Port Forwarding (`-L`)**՝ տեղական պորտերի վերահասցեավորում դեպի ներքին տվյալների բազաներ (PostgreSQL, MySQL, Redis):
   - **Dynamic Port Forwarding (`-D`)**՝ SSH կապի վերածում անձնական **SOCKS5 Proxy**-ի՝ ապահով ինտերնետ կապ ապահովելու համար:
   - **Remote Port Forwarding (`-R`)**՝ լոկալ ծրագրերի հասանելի դարձնելը համացանցում:

6. **🔐 Ծածկագրված պահոց (Zero-Knowledge Vault)**՝
   - Բոլոր գաղտնաբառերը, SSH բանալիները և կարգավորումները պահպանվում են **AES-256-GCM** ծածկագրմամբ և PBKDF2 ալգորիթմով (100,000 իտերացիա):
   - Windows OpenSSH (`\\.\pipe\openssh-ssh-agent`) և Pageant աջակցություն:

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

## 📜 License & Anti-Plagiarism Protection

This project is licensed under the **MIT License with Non-Commercial & Author Protection Conditions** — completely free for personal and community use.

- **Non-Commercial**: Commercial resale, repackaging for profit, and collecting donations/sponsorships by third-party forks or clones are strictly prohibited without the express written permission of Bazma Dev.
- **Cryptographic Provenance**: The application features a cryptographically anchored update engine tied to the official [bazmadev/BesTTY](https://github.com/bazmadev/BesTTY) repository. Derivative works or forks will automatically check against official releases and update to authentic versions, preserving author donation channels and credits.
- **Contributions & Translations**: Pull Requests, bug reports, and translations are warmly welcome!
