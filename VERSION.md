# ScamShield Version History

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
