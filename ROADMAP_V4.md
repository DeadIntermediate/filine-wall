# FiLine Wall v4.0 - "Clean Installation" Roadmap

**Target Release:** Q2 2026  
**Current Version:** 2.0.0  
**Code Name:** Clean Installation Edition

---

## 🎯 Primary Goals

### 1. Minimal Filesystem Footprint
**Vision:** FiLine Wall should run with **ONLY ONE FOLDER** containing just the application:
- `/opt/filine/` (Linux/macOS) or `C:\Users\YourName\filine\` (Windows) - Application binary and config only
- **NO log files on disk** - All call logs stored in database only
- **NO separate data folders** - Everything in one place

Everything else (node_modules, dependencies, build artifacts, logs) should be containerized, bundled, or stored in the database.

### 2. Cross-Platform Support
**Vision:** Single installation experience across all major operating systems:
- **Linux** - Primary platform (Raspberry Pi, Ubuntu, Debian)
- **macOS** - Desktop/laptop deployment
- **Windows** - Desktop/laptop deployment

Same codebase, same features, platform-native installation.

---

## 🏗️ Architecture Changes

**Current State (v2.0.0)**
```
~/filine-wall/
├── node_modules/          (1.1GB - largest footprint)
├── client/                (532KB - React source)
├── server/                (804KB - Express source)
├── device-client/         (40KB - Python modem interface)
├── db/                    (40KB - Database schema)
├── dist/                  (1.3MB - Built artifacts)
├── logs/                  (varies - call logs as text files)
├── uploads/               (varies - user uploads)
├── models/                (varies - ML models)
├── .env                   (config file)
└── [50+ other files]      (~2MB docs/scripts)
```

**Total:** ~1.2GB + scattered log files + runtime data

### Target State (v4.0.0)

#### Linux & macOS
```
/opt/filine/                    (macOS: ~/filine/ or /Applications/FiLine.app/)
├── filine                      (single binary ~50MB)
├── config.yaml                 (user configuration)
├── filine.db                   (SQLite database - includes all call logs)
└── .version                    (version tracker)
```

**That's it! Just ONE folder with 4 files.**

#### Windows
```
C:\Users\YourName\filine\       (or anywhere you want!)
├── filine.exe                  (single binary ~50MB)
├── config.yaml                 (user configuration)
├── filine.db                   (SQLite database - includes all call logs)
└── .version                    (version tracker)
```

**That's it! Just ONE folder with 4 files.**

**Total:** ~50MB + database size (typically 5-10MB for months of calls)

### Call Log Storage Strategy

**Database-Only Approach:**
- All call logs stored in SQLite database
- No separate log files on disk
- Query via web interface or SQL directly
- Export options: CSV, JSON, PDF for archival
- Automatic cleanup: Keep last 90 days by default (configurable)
- Full-text search built-in

**Benefits:**
- ✅ **Zero log files** - Everything in database
- ✅ **Faster queries** - Indexed database vs text parsing
- ✅ **Easy backup** - Single filine.db file
- ✅ **Portable** - Copy folder = full backup
- ✅ **Clean system** - No scattered files
- ✅ **Built-in rotation** - Automatic old data cleanup

**System Logs (Application Errors):**
- **Console output only** - No log files
- **Windows:** Visible in PowerShell/CMD window
- **Linux/macOS:** Output to systemd journal or syslog
- **Or:** Optional in-memory ring buffer (last 1000 lines)
- **Web UI:** View system logs in Settings → Diagnostics

---

## 📦 Implementation Strategy

### Phase 1: Containerization Research (Weeks 1-2)

**Options to Evaluate:**

1. **Docker-based Approach** (Rejected in v2.0, reconsider for v4.0)
   - Pros: Industry standard, isolation, easy updates
   - Cons: Requires Docker daemon, more complex for Raspberry Pi
   - Size: ~200MB container image

2. **Standalone Binary with pkg/nexe**
   - Pros: True single binary, no Node.js required on host
   - Cons: Large binary size (~80-100MB), limited native module support
   - Tool: `pkg` or `nexe` for Node.js bundling

3. **Go Rewrite (Major)**
   - Pros: True minimal binary (5-15MB), native performance
   - Cons: Complete rewrite, lose TypeScript ecosystem
   - Effort: 6-12 months

4. **Electron/Tauri Desktop App**
   - Pros: Cross-platform, bundled runtime
   - Cons: Still large (~100MB+), desktop-focused
   - Not ideal for headless server

**Recommended:** Option 2 (Standalone Binary) with Option 1 (Docker) as alternative

---

### Phase 2: Backend Consolidation (Weeks 3-6)

#### 2.1 Bundle Node.js Application
- Use `pkg` to create standalone executable
- Bundle all dependencies into single binary
- Embed static assets (frontend build)
- **Target platforms:**
  - Linux ARM64 (Raspberry Pi 3/4/5)
  - Linux ARM (Raspberry Pi Zero, older models)
  - Linux x64 (Ubuntu, Debian, standard PC)
  - macOS ARM64 (Apple Silicon M1/M2/M3)
  - macOS x64 (Intel Macs)
  - Windows x64 (Windows 10/11)
  - Windows ARM64 (Windows on ARM)

#### 2.2 Simplify Python Device Client
- **Option A:** Rewrite in Node.js (preferred)
  - Use `serialport` npm package for modem communication
  - Cross-platform serial port support (Linux, macOS, Windows)
  - Eliminate Python dependency
  - Bundle into main binary
  - Works with USB modems on all platforms
  
- **Option B:** Bundle Python with PyInstaller
  - Creates separate binary for device client
  - Still requires Python runtime in bundle
  - Larger overall size
  - More complex cross-platform builds

**Recommended:** Option A - Node.js serialport library has excellent cross-platform support

#### 2.3 Database Strategy
- **Option A:** Embedded SQLite (simpler)
  - Single file database
  - No PostgreSQL installation needed
  - Migrate from Drizzle-PostgreSQL to Drizzle-SQLite
  
- **Option B:** Keep PostgreSQL (more powerful)
  - Require PostgreSQL as system dependency
  - Document in installation
  - Better for high-volume deployments

**Recommended:** SQLite for v4.0 (embedded), PostgreSQL optional for enterprise

---

### Phase 3: Configuration Management (Weeks 7-8)

#### 3.1 Single Configuration File
Replace `.env` with structured `config.yaml`:

```yaml
# /opt/filine/config.yaml (or wherever filine binary is located)
filine:
  version: "4.0.0"
  
server:
  port: 5000
  host: "0.0.0.0"
  
database:
  # Database is always in same folder as binary
  path: "./filine.db"
  retention_days: 90  # Auto-delete calls older than this
  
logging:
  level: "info"
  # No log files! Output to console/journal only
  console: true
  # Optional: Keep last N log entries in memory for web UI
  memory_buffer: 1000
  
security:
  jwt_secret: "auto-generated-on-first-run"
  encryption_key: "auto-generated-on-first-run"
  
modem:
  enabled: true
  port: "/dev/ttyUSB0"  # Linux/macOS
  # port: "COM3"        # Windows auto-detected
  baud_rate: 115200
  auto_detect: true
  
features:
  voice_analysis: true
  nlp_detection: true
  ivr: true

export:
  # Export call logs for archival/backup
  auto_export: false
  format: "csv"  # csv, json, or pdf
  directory: "./exports"
  schedule: "monthly"
```

#### 3.2 Auto-Configuration
- Generate secrets on first run
- Store in config.yaml with proper permissions (600)
- Support environment variable overrides

---

### Phase 4: Installation Simplification (Weeks 9-10)

#### 4.1 Platform-Specific Installers

**Linux/macOS Installation:**
```bash
curl -fsSL https://install.filine.app | bash
```

**Windows Installation (Portable - No Installer!):**
```powershell
# Method 1: Download and run (simplest)
# Just download filine.exe and double-click or run in PowerShell:
.\filine.exe

# Method 2: One-line install to PATH
irm https://install.filine.app/windows | iex
# This downloads filine.exe to %LOCALAPPDATA%\FiLine\ and adds to PATH

# Method 3: Direct download
# Download from: https://github.com/DeadIntermediate/filine-wall/releases
# Run from anywhere - no installation needed!
```

**What it does (Windows):**
- Downloads single `filine.exe` binary
- Creates `config.yaml` and `filine.db` in same folder on first run
- **No separate data folders**
- **No log files** - all data in database
- Optionally adds to PATH for convenience
- **No admin rights required**
- **No installer, no registry entries**
- **100% portable** - can run from USB stick!

**What it does (Linux/macOS):**
1. Detects OS and architecture automatically
2. Downloads appropriate pre-built binary
3. Creates installation directory
4. Generates `config.yaml` with platform defaults
5. Creates empty `filine.db` database
6. Sets up service (systemd/launchd)
7. Starts FiLine Wall

**Total time:** 10-30 seconds (all platforms) - **Windows: instant if just running .exe!**

#### 4.2 Update Process

**Linux/macOS:**
```bash
filine update
# or
sudo filine update
```

**Windows (Portable):**
```powershell
# Run from Command Prompt or PowerShell
filine.exe update

# Or manually download new version and replace .exe
# Old version: filine-old.exe (rename current)
# New version: Download and rename to filine.exe
# Zero downtime, instant rollback if needed
```

**Features:**
- Built-in update command (cross-platform)
- Auto-detects architecture
- Downloads latest binary for your platform
- Preserves config.yaml and database
- **Windows:** Can update while running (downloads to temp, swaps on restart)
- Automatic rollback on failure
- **No log files to preserve** - everything in database!

#### 4.3 Uninstall Process

**Linux/macOS:**
```bash
filine uninstall --keep-logs
```

**Windows (Portable):**
```powershell
# Just delete the folder - that's it!
rmdir /s C:\Users\YourName\filine

# Or use built-in cleanup
filine.exe uninstall

# Everything in one place - no scattered files!
```

**Features:**
- Removes application binary
- Optionally backs up database before deleting
- **Windows:** No registry cleanup needed (because nothing was installed!)
- **Windows:** True portable app - delete folder and done
- **No log files to clean** - everything in database
- Clean system state on all platforms

---

### Phase 5: Build & Release Pipeline (Weeks 11-12)

#### 5.1 GitHub Actions CI/CD
```yaml
# Build matrix - ALL PLATFORMS
platforms:
  - linux-arm64      # Raspberry Pi 3/4/5
  - linux-arm        # Raspberry Pi Zero, older models
  - linux-x64        # Ubuntu, Debian, standard PC
  - macos-arm64      # Apple Silicon M1/M2/M3
  - macos-x64        # Intel Macs
  - windows-x64      # Windows 10/11
  - windows-arm64    # Windows on ARM

# Build steps
1. Compile TypeScript
2. Bundle with webpack
3. Package with pkg for each platform
4. Run platform-specific tests
5. Code sign (macOS/Windows)
6. Create installers (MSI, DMG, DEB, RPM)
7. Create GitHub release
8. Upload all binaries
9. Update install scripts
10. Generate checksums
```

#### 5.2 Release Artifacts
```
# Binary executables (portable - no installers!)
filine-v4.0.0-linux-arm64
filine-v4.0.0-linux-arm
filine-v4.0.0-linux-x64
filine-v4.0.0-macos-arm64
filine-v4.0.0-macos-x64
filine-v4.0.0-windows-x64.exe       # Portable .exe
filine-v4.0.0-windows-arm64.exe     # Portable .exe

# Linux package installers (optional)
FiLine-4.0.0.dmg                # macOS disk image (optional)
filine_4.0.0_amd64.deb          # Debian/Ubuntu package
filine-4.0.0-1.x86_64.rpm       # RedHat/Fedora package
filine_4.0.0_arm64.deb          # Raspberry Pi package

# Install scripts
install.sh                       # Linux/macOS
install.ps1                      # Windows (optional - just downloads .exe)
checksums.txt                    # SHA256 hashes

# Windows: NO MSI, NO SETUP.EXE - Just portable .exe files!
```

---

## 🎨 User Experience Changes

### Before (v2.0.0)
```bash
# Install (5-10 minutes)
curl -fsSL https://raw.githubusercontent.com/.../quick-install.sh | bash
cd ~/filine-wall
./start-filine.sh

# Update
cd ~/filine-wall
./update-from-github.sh
npm install
npm run build

# Files everywhere:
~/filine-wall/               # 1.2GB
~/.npm/                      # Node cache
/var/lib/postgresql/         # Database
```

### After (v4.0.0)
```bash
# Install (10-30 seconds)
curl -fsSL https://install.filine.app | bash

# Auto-starts, no manual intervention

# Update
filine update

# Clean system:
/opt/filine/                 # 50MB
/var/log/filine/             # Call logs only
```

---

## �️ Platform-Specific Considerations

### Linux
**Strengths:**
- Primary development platform
- Excellent modem support via `/dev/ttyUSB*`
- Systemd service management
- Best for Raspberry Pi deployment

**Challenges:**
- Multiple distributions (solved with binary)
- Permission management for USB devices (udev rules)

**Service Management:**
```bash
# Systemd service
sudo systemctl start filine
sudo systemctl enable filine
sudo systemctl status filine
```

### macOS
**Strengths:**
- Developer-friendly
- USB serial support via `/dev/tty.usbserial*`
- launchd for service management
- Good testing platform

**Challenges:**
- Code signing requirements (needs Apple Developer account)
- Gatekeeper warnings for unsigned apps (can be bypassed)
- Different paths from Linux

**Service Management:**
```bash
# launchd service
sudo launchctl load /Library/LaunchDaemons/com.filine.plist
sudo launchctl start com.filine
launchctl list | grep filine
```

**Distribution:**
- DMG installer with drag-to-Applications
- Optional: Mac App Store distribution (requires $99/year developer account)
- Homebrew formula: `brew install filine`

### Windows
**Strengths:**
- Large user base
- **Perfect for portable applications**
- Good USB serial support (COM ports)
- Command Prompt / PowerShell ready
- Can run from any folder (Desktop, Downloads, USB stick)

**Challenges:**
- Different path conventions (`C:\` vs `/`)
- COM ports instead of `/dev/tty*`
- ~~Windows Defender / SmartScreen warnings~~ (Only for unsigned .exe on first download)
- ~~Code signing recommended~~ (Optional - can be bypassed with right-click → Run anyway)

**No Service Management Needed:**
```powershell
# Just run it!
cd C:\Users\YourName\Downloads
.\filine.exe

# Run in background
Start-Process filine.exe -WindowStyle Hidden

# Or add to startup (optional)
# Copy filine.exe to: shell:startup folder
```

**Distribution:**
- **Direct .exe download** (recommended) - Just run it!
- Chocolatey package: `choco install filine` (optional convenience)
- ~~No MSI installer~~ 
- ~~No Windows Service~~
- ~~No Microsoft Store~~ (too complex for portable app)
- **Run from anywhere** - Desktop, Downloads, USB stick, network drive

**Portable Benefits:**
✅ **No admin rights needed** - Run as regular user  
✅ **No installation** - Just download and run  
✅ **Easy updates** - Replace .exe file, done  
✅ **USB stick compatible** - Run from removable media  
✅ **Clean uninstall** - Delete .exe, optionally delete %APPDATA%\FiLine\  
✅ **No registry entries** - Leaves system pristine  

**Firewall:**
- Windows Firewall may prompt on first run (normal for any app)
- User can allow manually (one-time prompt)
- No automatic firewall configuration (requires admin)

### Platform-Specific Features

#### Tray Icons / Menu Bar
**macOS:**
- Menu bar icon with quick actions
- "Open Dashboard", "View Logs", "Preferences", "Quit"

**Windows (Optional - not required for portable):**
- Could add system tray icon if filine.exe runs in background
- Right-click menu for common actions
- Balloon notifications for blocked calls
- **But not required** - can run in terminal window

**Linux (Optional):**
- GTK indicator for desktop users
- Not needed for headless Raspberry Pi

#### Notifications
- **macOS:** Native notifications via `node-notifier`
- **Windows:** Console output or optional toast notifications
- **Linux:** libnotify / D-Bus notifications

#### Background Execution
**Windows Portable Options:**
```powershell
# Option 1: Run in visible console (simple)
.\filine.exe

# Option 2: Run hidden in background
Start-Process filine.exe -WindowStyle Hidden

# Option 3: Run as scheduled task (persistent across reboots)
# User creates scheduled task via Task Scheduler GUI
# No admin needed - runs on user login

# Option 4: Just keep terminal open
# Open PowerShell, run filine.exe, minimize window
```

---

## �🔧 Technical Milestones

### Milestone 1: Proof of Concept (Week 6)
- [ ] Bundle current app with pkg
- [ ] Test on Raspberry Pi (Linux ARM64)
- [ ] Test on macOS (both Intel and Apple Silicon)
- [ ] Test on Windows 11
- [ ] Measure binary size and performance across platforms
- [ ] Identify platform-specific blockers
- [ ] Test USB modem on all platforms

### Milestone 2: Feature Parity (Week 10)
- [ ] All v2.0 features working in binary
- [ ] Cross-platform modem interface (serialport library)
- [ ] Database migrations working (SQLite)
- [ ] Web UI accessible on all platforms
- [ ] Linux/macOS: Service management (systemd/launchd)
- [ ] Windows: Portable execution (no service needed)

### Milestone 3: Production Ready (Week 12)
- [ ] Automated builds for all 7 platforms
- [ ] Code signing for macOS (optional for Windows)
- [ ] Linux packages: DEB, RPM
- [ ] macOS: DMG installer (optional)
- [ ] Windows: Portable .exe (no installer!)
- [ ] Install/update/uninstall scripts for all platforms
- [ ] Documentation updated for all platforms
- [ ] Migration guide from v2.0

### Milestone 4: Beta Testing (Week 14)
- [ ] Deploy to test devices:
  - [ ] Raspberry Pi 4/5 (Linux ARM64)
  - [ ] Ubuntu PC (Linux x64)
  - [ ] MacBook M1 (macOS ARM64)
  - [ ] MacBook Intel (macOS x64)
  - [ ] Windows 11 PC (Windows x64)
- [ ] Community testing across platforms
- [ ] Bug fixes and platform-specific polish
- [ ] Performance optimization
- [ ] Cross-platform compatibility testing

### Milestone 5: Release (Week 16)
- [ ] v4.0.0 official release
- [ ] Migration path for existing users
- [ ] Updated installation docs
- [ ] Announcement and changelog

---

## 📊 Success Metrics

| Metric | v2.0.0 (Linux) | v4.0.0 Target (All Platforms) | Improvement |
|--------|----------------|-------------------------------|-------------|
| **Installation Time** | 5-10 min | 10-30 sec | **95% faster** |
| **Disk Usage** | 1.2GB | 50MB + database | **95% smaller** |
| **Files on Disk** | 50,000+ | 4 files | **99.99% fewer** |
| **Folders Required** | 5+ folders | 1 folder | **80% fewer** |
| **Log Files** | Hundreds of .log files | 0 (database only) | **100% eliminated** |
| **Supported Platforms** | Linux only | Linux, macOS, Windows | **3x platforms** |
| **Dependencies** | Node.js, npm, PostgreSQL, Python | None (embedded) | **100% self-contained** |
| **Update Time** | 3-5 min | 10 sec | **97% faster** |
| **Backup Complexity** | Multiple folders and files | Copy 1 folder | **100% simpler** |
| **Uninstall Cleanliness** | Manual cleanup needed | Delete 1 folder | **100% clean** |
| **Binary Size** | N/A | 50MB per platform | **Optimized** |

---

## 🚧 Challenges & Solutions

### Challenge 1: Native Modules
**Problem:** Some npm packages use native code (e.g., `@tensorflow/tfjs-node`)  
**Solution:** 
- Use WebAssembly versions where available
- Bundle pre-compiled binaries for target platforms
- Consider dropping heavy ML features or making them optional plugins

### Challenge 2: Database Portability
**Problem:** PostgreSQL is powerful but requires installation  
**Solution:**
- Switch to SQLite for embedded use (99% of users)
- Keep PostgreSQL support for enterprise (Docker image available)
- Provide migration tool

### Challenge 3: Modem Access (Cross-Platform)
**Problem:** USB modem device paths differ across platforms  
**Solution:**
- **Linux:** `/dev/ttyUSB*` - udev rules for permissions
- **macOS:** `/dev/tty.usbserial*` - automatic via security settings
- **Windows:** `COM1`, `COM2`, etc. - auto-detection via registry
- Use `serialport` npm package - handles all platforms
- Auto-detection scans all serial ports
- Clear documentation for manual configuration

**Platform-specific setup:**
```javascript
// Auto-detect modem across platforms
const SerialPort = require('serialport');
const ports = await SerialPort.list();
const modem = ports.find(p => 
  p.manufacturer?.includes('US Robotics') ||
  p.vendorId === '0BAF' // USRobotics vendor ID
);
```

### Challenge 4: Updates & Rollback
**Problem:** Binary updates could break the system  
**Solution:**
- Keep previous version in `/opt/filine/backup/`
- Automatic rollback on startup failure
- Config validation before restart

---

## 🔄 Migration Path (v2.0 → v4.0)

### Automated Migration Script
```bash
filine-migrate-v4
```

**Steps:**
1. Backup current installation
2. Export database to SQLite/SQL
3. Backup configuration and logs
4. Remove old installation
5. Install v4.0 binary
6. Import data
7. Verify functionality
8. Clean up old files

**User Data Preserved:**
- ✅ Call logs and history
- ✅ User accounts and settings
- ✅ Blocklists and allowlists
- ✅ ML model training data

---

## 📝 Documentation Updates

### New Docs for v4.0
1. **INSTALL_V4.md** - New simplified installation
2. **MIGRATION_V4.md** - Upgrade from v2.0/v3.0
3. **CONFIG_REFERENCE.md** - config.yaml documentation
4. **TROUBLESHOOTING_V4.md** - Binary-specific issues
5. **ARCHITECTURE_V4.md** - Technical deep-dive

### Updated Docs
- **README.md** - Highlight v4.0 improvements
- **QUICK_START.md** - New installation flow
- **DEPLOYMENT.md** - Systemd service management

---

## 🎯 Version Progression

### Version 3.0 (Intermediate - Optional)
If v4.0 is too ambitious for one release:

**v3.0 Goals:**
- Rewrite device-client in Node.js (eliminate Python)
- Switch to SQLite (optional PostgreSQL)
- Reduce node_modules size (remove unused deps)
- **Target:** 300MB footprint (75% reduction)

**Then v4.0:**
- Binary packaging
- Final cleanup
- **Target:** 50MB footprint

### Direct to v4.0 (Recommended)
Skip v3.0 and go straight to v4.0 with full rewrite.

---

## 💡 Additional v4.0 Features

Beyond minimal footprint, consider:

1. **Built-in Web UI Server**
   - Embed web frontend in binary
   - No separate build step needed
   - Serve from memory

2. **Auto-Update System**
   - Check for updates on startup
   - One-click update from web UI
   - Rollback capability

3. **Plugin System**
   - Optional ML features as plugins
   - Download only what you need
   - Keep core binary small

4. **Multi-Device Support**
   - Manage multiple Raspberry Pis from one dashboard
   - Centralized logging
   - Fleet management

5. **Cloud Sync (Optional)**
   - Sync call logs to cloud storage
   - Backup/restore from cloud
   - Multi-location deployment

---

## ✅ Action Items for v4.0 Planning

### Immediate (This Week)
- [ ] Review and approve this roadmap
- [ ] Decide: Direct to v4.0 or intermediate v3.0?
- [ ] Choose: SQLite or keep PostgreSQL?
- [ ] Test pkg bundling with current codebase

### Short Term (Next Month)
- [ ] Create proof-of-concept binary
- [ ] Test on Raspberry Pi hardware
- [ ] Measure performance impact
- [ ] Design new config.yaml structure

### Medium Term (3 Months)
- [ ] Rewrite device-client in Node.js
- [ ] Migrate database layer to SQLite
- [ ] Create build pipeline
- [ ] Write migration scripts

### Long Term (6 Months)
- [ ] Complete v4.0 development
- [ ] Beta testing program
- [ ] Documentation overhaul
- [ ] Official v4.0 release

---

## 🎉 Expected Benefits

### For Users
✅ **Instant Installation** - 30 seconds vs. 10 minutes  
✅ **Clean System** - No scattered files or dependencies  
✅ **Easy Updates** - One command, automatic rollback  
✅ **Less Maintenance** - Fewer moving parts  
✅ **Better Performance** - Optimized single binary  
✅ **Platform Freedom** - Use on your preferred OS  
✅ **Consistent Experience** - Same features everywhere  

### For Developers
✅ **Simpler Testing** - Single artifact per platform to test  
✅ **Easier Debugging** - Fewer dependency conflicts  
✅ **Faster CI/CD** - Binary builds vs. full installs  
✅ **Clear Architecture** - Well-defined boundaries  
✅ **Better Support** - Consistent environment  
✅ **Wider Testing** - Community tests across platforms  

### For the Project
✅ **Professional Image** - Production-grade software  
✅ **Easier Adoption** - Lower barrier to entry  
✅ **Broader Audience** - Windows/Mac users can now use FiLine  
✅ **Better Scalability** - Ready for enterprise  
✅ **Competitive Edge** - Unique cross-platform spam blocker  
✅ **Long-term Sustainability** - Maintainable codebase  
✅ **Market Expansion** - 3x platform coverage  

### For Distribution
✅ **App Stores** - Can submit to Microsoft Store, Mac App Store  
✅ **Package Managers** - Homebrew, Chocolatey, apt, etc.  
✅ **Corporate Deployment** - MSI for Windows enterprise  
✅ **Easy Testing** - Developers can test on their daily machines    

---

## 📅 Proposed Timeline

| Phase | Duration | Completion |
|-------|----------|------------|
| Planning & Design | 2 weeks | Week 2 |
| Proof of Concept | 4 weeks | Week 6 |
| Core Development | 6 weeks | Week 12 |
| Testing & Polish | 2 weeks | Week 14 |
| Beta Program | 2 weeks | Week 16 |
| **v4.0 Release** | - | **Week 16** |

**Total Development Time:** ~4 months  
**Target Release:** April 2026

---

## 💰 Resource Requirements

### Development
- 300-400 hours engineering time (increased for multi-platform)
- Testing devices:
  - 2-3 Raspberry Pi models (different generations)
  - 1 Ubuntu/Debian PC
  - 1 MacBook (Intel)
  - 1 MacBook (Apple Silicon)
  - 1 Windows 10/11 PC
- Cloud storage for binary hosting (~5GB for all platforms)

### Code Signing (Optional)
- **Apple Developer Account:** $99/year
  - Required for macOS code signing
  - Prevents Gatekeeper warnings
  - Required for Mac App Store
  
- **Windows Code Signing Certificate:** $100-300/year (OPTIONAL)
  - ~~Prevents SmartScreen warnings~~ (Users can bypass with right-click)
  - ~~Builds trust with Windows users~~ (Portable apps don't need this)
  - **Not needed for portable .exe** - Users expect to click "Run anyway"
  - Only needed if distributing via Microsoft Store

### Infrastructure
- GitHub Actions CI/CD (free tier sufficient for public repos)
- Binary hosting (GitHub Releases - free, ~5GB for all platforms)
- Documentation hosting (GitHub Pages - free)
- Optional: CDN for install scripts (Cloudflare - free tier)

**Total Cost:** 
- Minimum: $0 (developer time only, Windows portable needs no signing)
- Recommended: $99/year (macOS code signing only)
- Optional: $200-400/year (if also signing Windows, but not needed for portable)
- Testing hardware: $1000-2000 one-time (if purchasing new)

---

## 🎬 Next Steps

1. **Review this roadmap** and provide feedback
2. **Choose path:** Direct v4.0 or staged v3.0 → v4.0
3. **Approve approach:** Binary bundling vs. Docker vs. other
4. **Assign priority:** Is this next major version or future goal?
5. **Set timeline:** 4 months realistic or need longer?

---

**Document Version:** 1.0  
**Last Updated:** December 12, 2025  
**Author:** FiLine Wall Development Team  
**Status:** 📋 Planning Phase
