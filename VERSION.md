# FiLine Wall Version History

## Version 2.0.0 (December 11, 2025) - GitHub Edition 🚀

### Major Changes
- **GitHub-Only Installation**: Streamlined to single-command GitHub installation
  * `quick-install.sh` - One-command install from GitHub
  * `update-from-github.sh` - Smart update system with dependency detection
  * Removed Docker, Windows, and redundant installation methods

- **UI Redesign**: Complete interface overhaul
  * New left sidebar navigation (collapsible)
  * Eliminated module overlapping issues
  * Cleaner, more modern layout
  * Improved responsiveness

- **Live Call Monitor**: Real-time call monitoring console
  * Live call log display with 3-second auto-refresh
  * Color-coded risk levels (Red/Yellow/Green)
  * Action badges (BLOCKED/ALLOWED/SCREENED)
  * Pause/Resume and Clear controls
  * Auto-scroll functionality

### Removed
- Docker support (Dockerfile, docker-compose.yml, docker-setup.sh, nginx.conf)
- Windows support (install.ps1, start.ps1, setup.ps1)
- Redundant installers (bootstrap.sh, setup-wizard.js, fix-critical-issues.sh)
- Outdated documentation files (7 summary/fix files)
- Temporary files and old deployment packages

### Improved
- Simplified installation documentation
- Streamlined codebase (-3,000+ lines removed)
- Better script organization
- Updated all documentation references
- Linux-focused development (Ubuntu, Debian, Raspberry Pi OS)

### Technical Details
- Package name changed from "rest-express" to "filine-wall"
- Installation methods reduced from 8 to 3
- Documentation files reduced from 37 to 30

## Version 1.0.0-alpha.2 (October 03, 2025)

### Added
- Extended hardware support to include StarTech 56k USB Dial-up and Fax Modem V.92 External
- Multiple USB vendor/product ID detection in udev rules
- Automatic detection for both USRobotics 5637 and StarTech V.92 modems

### Changed
- Updated setup script to detect multiple modem types
- Generalized modem references to "V.92 USB modem" throughout documentation
- Enhanced udev rules file to support additional modem chipsets

## Version 1.0.0-alpha.1 (January 03, 2025)

### Added
- Core Anti-Telemarketing Infrastructure
  * Complete PostgreSQL database schema for call tracking
  * Device management system with real-time monitoring
  * Call screening and blocking logic
  * Toggleable dashboard components

- Device Client Implementation
  * USB modem support (V.92 modems including USRobotics 5637)
  * Secure device authentication
  * Real-time call monitoring
  * Automatic modem detection and configuration
  * Systemd service integration

- Web Interface
  * Real-time dashboard with customizable views
  * Call analytics and statistics
  * Geographic call distribution visualization
  * Device diagnostics tools
  * Feature toggles for all dashboard components

### Technical Details
- Database: PostgreSQL with Drizzle ORM
- Frontend: React + TypeScript
- Backend: Express.js
- Device Client: Python with serial communication
- Security: AES-256 encryption for device communication

### Known Issues
- Initial alpha release, expect potential stability issues
- Geographic heatmap requires further optimization for large datasets
- USB modem compatibility being tested with various models
