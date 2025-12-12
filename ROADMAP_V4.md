# FiLine Wall v4.0 - "Clean Installation" Roadmap

**Target Release:** Q2 2026  
**Current Version:** 2.0.0  
**Code Name:** Clean Installation Edition

---

## 🎯 Primary Goals

### 1. Minimal Filesystem Footprint
**Vision:** FiLine Wall should run with only TWO folders on the host system:
- `/opt/filine/` (Linux/macOS) or `C:\Program Files\FiLine\` (Windows) - Application binaries and configuration
- `/var/log/filine/` (Linux/macOS) or `C:\ProgramData\FiLine\logs\` (Windows) - Call logs and system logs

Everything else (node_modules, dependencies, build artifacts) should be containerized or bundled into a single binary.

### 2. Cross-Platform Support
**Vision:** Single installation experience across all major operating systems:
- **Linux** - Primary platform (Raspberry Pi, Ubuntu, Debian)
- **macOS** - Desktop/laptop deployment
- **Windows** - Desktop/laptop deployment

Same codebase, same features, platform-native installation.

---

## 🏗️ Architecture Changes

### Current State (v2.0.0)
```
~/filine-wall/
├── node_modules/          (1.1GB - largest footprint)
├── client/                (532KB - React source)
├── server/                (804KB - Express source)
├── device-client/         (40KB - Python modem interface)
├── db/                    (40KB - Database schema)
├── dist/                  (1.3MB - Built artifacts)
├── logs/                  (varies - call logs)
├── uploads/               (varies - user uploads)
├── models/                (varies - ML models)
├── .env                   (config file)
└── [50+ other files]      (~2MB docs/scripts)
```

**Total:** ~1.2GB + runtime data

### Target State (v4.0.0)

#### Linux & macOS
```
/opt/filine/                    (macOS: /Applications/FiLine.app/)
├── filine                      (single binary ~50MB)
├── config.yaml                 (user configuration)
└── .version                    (version tracker)

/var/log/filine/
├── calls/                      (call logs by date)
│   ├── 2026-01-15.log
│   └── 2026-01-16.log
└── system.log                  (application logs)

/var/lib/filine/                (optional - database if not using external)
└── database/
```

#### Windows
```
C:\Program Files\FiLine\
├── filine.exe                  (single binary ~50MB)
├── config.yaml                 (user configuration)
└── .version                    (version tracker)

C:\ProgramData\FiLine\
├── logs\                       (call logs by date)
│   ├── calls\
│   │   ├── 2026-01-15.log
│   │   └── 2026-01-16.log
│   └── system.log
└── database\                   (optional)
    └── filine.db
```

**Total:** ~50MB + runtime data (95% reduction) - **All platforms**

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
# /opt/filine/config.yaml
filine:
  version: "4.0.0"
  
server:
  port: 5000
  host: "0.0.0.0"
  
database:
  type: "sqlite"  # or "postgresql"
  path: "/var/lib/filine/database/filine.db"
  # url: "postgresql://..." for external DB
  
logging:
  level: "info"
  directory: "/var/log/filine"
  rotation:
    enabled: true
    max_size: "100MB"
    max_age: "30d"
    
security:
  jwt_secret: "auto-generated-on-first-run"
  encryption_key: "auto-generated-on-first-run"
  
modem:
  enabled: true
  port: "/dev/ttyUSB0"
  baud_rate: 115200
  auto_detect: true
  
features:
  voice_analysis: true
  nlp_detection: true
  ivr: true
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

**Windows Installation:**
```powershell
# PowerShell (as Administrator)
irm https://install.filine.app/windows | iex

# Or download installer
# FiLine-Setup-4.0.0.exe (GUI installer)
```

**What it does:**
1. Detects OS and architecture automatically
2. Downloads appropriate pre-built binary
3. Creates platform-specific directories
4. Generates `config.yaml` with platform defaults
5. Sets up service (systemd/launchd/Windows Service)
6. Configures firewall rules
7. Starts FiLine Wall

**Total time:** 10-30 seconds (vs. 5-10 minutes currently) - **All platforms**

#### 4.2 Update Process

**Linux/macOS:**
```bash
filine update
# or
sudo filine update
```

**Windows:**
```powershell
# PowerShell (as Administrator)
filine update

# Or use GUI updater
FiLine-Updater.exe
```

**Features:**
- Built-in update command (cross-platform)
- Auto-detects architecture
- Downloads latest binary for your platform
- Preserves config.yaml
- Restarts service automatically
- Rollback on failure
- Optional GUI updater for Windows/macOS

#### 4.3 Uninstall Process
```bash
filine uninstall --keep-logs
```

- Removes `/opt/filine/`
- Optionally removes `/var/log/filine/`
- Removes systemd service
- Clean system state

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
# Binary executables
filine-v4.0.0-linux-arm64
filine-v4.0.0-linux-arm
filine-v4.0.0-linux-x64
filine-v4.0.0-macos-arm64
filine-v4.0.0-macos-x64
filine-v4.0.0-windows-x64.exe
filine-v4.0.0-windows-arm64.exe

# Platform-specific installers
FiLine-Setup-4.0.0.exe          # Windows installer
FiLine-4.0.0.dmg                # macOS disk image
filine_4.0.0_amd64.deb          # Debian/Ubuntu package
filine-4.0.0-1.x86_64.rpm       # RedHat/Fedora package
filine_4.0.0_arm64.deb          # Raspberry Pi package

# Install scripts
install.sh                       # Linux/macOS
install.ps1                      # Windows PowerShell
checksums.txt                    # SHA256 hashes
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
- GUI installer expectations met
- Windows Service for background operation
- Good USB serial support

**Challenges:**
- Different path conventions (`C:\` vs `/`)
- COM ports instead of `/dev/tty*`
- Windows Defender / SmartScreen warnings
- Code signing recommended (but optional)

**Service Management:**
```powershell
# Windows Service
Start-Service FiLine
Set-Service FiLine -StartupType Automatic
Get-Service FiLine
```

**Distribution:**
- MSI installer (recommended)
- EXE installer (alternative)
- Chocolatey package: `choco install filine`
- Optional: Microsoft Store (requires registration)

**Firewall:**
- Auto-configure Windows Firewall rules during install
- Allow inbound port 5000 for web interface

### Platform-Specific Features

#### Tray Icons / Menu Bar
**macOS:**
- Menu bar icon with quick actions
- "Open Dashboard", "View Logs", "Preferences", "Quit"

**Windows:**
- System tray icon
- Right-click menu for common actions
- Balloon notifications for blocked calls

**Linux (Optional):**
- GTK indicator for desktop users
- Not needed for headless Raspberry Pi

#### Notifications
- **macOS:** Native notifications via `node-notifier`
- **Windows:** Toast notifications
- **Linux:** libnotify / D-Bus notifications

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
- [ ] Platform-specific installers created
- [ ] Service management (systemd/launchd/Windows Service)

### Milestone 3: Production Ready (Week 12)
- [ ] Automated builds for all 7 platforms
- [ ] Code signing (macOS and Windows)
- [ ] Platform-specific installers (DMG, MSI, DEB, RPM)
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
| **Disk Usage** | 1.2GB | 50MB | **95% smaller** |
| **Files on Disk** | 50,000+ | <10 | **99.9% fewer** |
| **Supported Platforms** | Linux only | Linux, macOS, Windows | **3x platforms** |
| **Dependencies** | Node.js, npm, PostgreSQL, Python | None (embedded) | **100% self-contained** |
| **Update Time** | 3-5 min | 10 sec | **97% faster** |
| **Uninstall Cleanliness** | Manual cleanup needed | One command | **100% clean** |
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

### Code Signing (Optional but Recommended)
- **Apple Developer Account:** $99/year
  - Required for macOS code signing
  - Prevents Gatekeeper warnings
  - Required for Mac App Store
  
- **Windows Code Signing Certificate:** $100-300/year
  - Prevents SmartScreen warnings
  - Builds trust with Windows users
  - Not strictly required but highly recommended

### Infrastructure
- GitHub Actions CI/CD (free tier sufficient for public repos)
- Binary hosting (GitHub Releases - free, ~5GB for all platforms)
- Documentation hosting (GitHub Pages - free)
- Optional: CDN for install scripts (Cloudflare - free tier)

**Total Cost:** 
- Minimum: $0 (developer time only)
- Recommended: $200-400/year (code signing certificates)
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
