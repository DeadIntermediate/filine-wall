# FiLine Wall

**Advanced Anti-Telemarketing & Spam Call Blocking System**

FiLine Wall is a comprehensive, hardware-powered solution that blocks robocalls, telemarketers, and spam calls before they reach your phone. Using real-time AI analysis, voice pattern recognition, and collaborative spam detection, it provides superior protection against unwanted calls.

## 🚀 Quick Installation

Choose your preferred installation method:

### 🐳 Docker (Recommended - One Command)
```bash
# Download and run the Docker setup script
curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/docker-setup.sh | bash

# Or clone and run locally
git clone https://github.com/DeadIntermediate/filine-wall.git
cd filine-wall
chmod +x docker-setup.sh
./docker-setup.sh
```

### 🖥️ Windows Installation
```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install.ps1

# For Docker-only installation
.\install.ps1 -DockerOnly

# For Windows-native (no WSL)
.\install.ps1 -SkipWSL
```

### 🐧 Linux/macOS Installation
```bash
# Make the script executable and run
chmod +x install.sh
./install.sh

# For help and options
./install.sh --help
```

### 🧙‍♂️ Interactive Setup Wizard
```bash
# Node.js-based guided configuration
node setup-wizard.js
```

## 📋 System Requirements

### Minimum Requirements
- **OS**: Linux (Ubuntu 20.04+), macOS (10.15+), Windows 10/11
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 10GB free space
- **Network**: Internet connection for spam database updates
- **Hardware**: USB port for modem connection

### Supported Modems
- USRobotics 5637 USB Fax Modem
- StarTech 56k USB Dial-up and Fax Modem V.92 External
- Any V.92 compatible USB modem with Caller ID support

### Software Dependencies
- **Node.js** 18+ (automatically installed)
- **PostgreSQL** 13+ (automatically installed)
- **Redis** 6+ (optional, for caching)
- **Python** 3.8+ (for device client)

## 🏗️ Architecture Overview

### Core Components
- **Web Interface**: React + TypeScript frontend with real-time dashboard
- **API Server**: Express.js backend with authentication and call management
- **Device Client**: Python-based modem interface for call interception
- **Database**: PostgreSQL with call logs, user management, and spam patterns
- **AI Engine**: TensorFlow.js for spam detection and voice analysis

### Call Flow Process
1. **Call Detection**: Modem intercepts incoming calls and captures Caller ID
2. **Real-time Analysis**: AI processes number patterns, reputation scores, and voice characteristics
3. **Decision Engine**: Determines whether to block, screen, or allow the call
4. **Action Execution**: Automatically blocks spam or screens suspicious calls
5. **Learning**: System learns from user feedback to improve accuracy

## ⚙️ Hardware Setup

### Modem Connection
1. Connect your USB modem to your system
2. Connect your phone line to the modem's LINE port
3. Connect your phone to the modem's PHONE port
4. Run the installation script to configure the modem automatically

### Network Setup
```
[Phone Line] → [USB Modem] → [Computer] → [Your Phone]
                    ↓
              [FiLine Wall Software]
```

## 🔧 Configuration

### Environment Setup
The installation process automatically creates a `.env` file with secure defaults:

```env
# Database Configuration
DATABASE_URL=postgresql://filinewall:password@localhost:5432/filinewall

# Security
JWT_SECRET=auto-generated-secure-key
DEVICE_ENCRYPTION_KEY=auto-generated-key

# Optional External Services
TWILIO_ACCOUNT_SID=your_twilio_sid
SPAM_API_KEY=your_spam_detection_api_key
```

### First-Time Setup
1. **Access Web Interface**: Navigate to `http://localhost` after installation
2. **Login**: Use default credentials (admin/admin123) - **CHANGE IMMEDIATELY**
3. **Configure Numbers**: Set up your whitelist and blacklist
4. **Test Modem**: Verify modem connection and configuration
5. **Customize Settings**: Adjust blocking sensitivity and notification preferences

## 🎯 Features

### Core Protection
- ✅ **Real-time Call Blocking**: Stops spam before your phone rings
- ✅ **AI-Powered Detection**: Machine learning identifies new spam patterns
- ✅ **Voice Analysis**: Analyzes speech patterns for robocall detection
- ✅ **Collaborative Database**: Crowdsourced spam reporting
- ✅ **Caller ID Verification**: Cross-references legitimate business numbers

### Advanced Features
- 📊 **Real-time Dashboard**: Monitor call activity and blocking statistics
- 📈 **Analytics & Reporting**: Detailed insights into call patterns
- 🔔 **Smart Notifications**: Configurable alerts via email, SMS, or push
- 👥 **Multi-user Support**: Family accounts with individual preferences
- 🌐 **Web Interface**: Manage settings from any device
- 📱 **Mobile-Responsive**: Full functionality on phones and tablets

### Security & Privacy
- 🔒 **End-to-End Encryption**: All data encrypted at rest and in transit
- 🔐 **Role-Based Access**: Admin, user, and read-only permission levels
- 🛡️ **Rate Limiting**: Protection against API abuse
- 📝 **Audit Logging**: Complete activity tracking for security
- 🔄 **Automatic Updates**: Security patches and spam database updates

## 📚 Documentation

### Installation Guides
- [**DEPLOYMENT.md**](DEPLOYMENT.md) - Comprehensive deployment options
- [**Docker Setup**](docker-setup.sh) - Container-based installation
- [**Windows Guide**](install.ps1) - PowerShell installation script
- [**Linux/macOS Guide**](install.sh) - Bash installation script

### User Guides
- **Getting Started**: First-time setup and configuration
- **Web Interface**: Dashboard and settings management
- **Device Configuration**: Modem setup and troubleshooting
- **API Documentation**: Developer reference and integration

## 🛠️ Development

### Local Development Setup
```bash
# Clone the repository
git clone https://github.com/DeadIntermediate/filine-wall.git
cd filine-wall

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development servers
npm run dev          # Start API server
npm run dev:client   # Start frontend development server
```

### Available Scripts
```bash
npm run build        # Build for production
npm run test         # Run test suite
npm run lint         # Code linting
npm run format       # Code formatting
npm start           # Start production server
```

### Project Structure
```
filine-wall/
├── client/          # React frontend application
├── server/          # Express.js API server
├── device-client/   # Python modem interface
├── db/             # Database schema and migrations
├── docker/         # Docker configuration files
└── scripts/        # Utility and setup scripts
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- 📖 **Documentation**: Check our comprehensive guides
- 🐛 **Bug Reports**: Create an issue on GitHub
- 💡 **Feature Requests**: Submit enhancement suggestions
- 💬 **Community**: Join our discussions

### Troubleshooting
- **Installation Issues**: Check the installation logs and requirements
- **Modem Problems**: Verify USB connection and driver installation
- **Performance**: Monitor system resources and database performance
- **Network**: Ensure firewall settings allow required ports

### System Status
- 🟢 **Web Interface**: http://localhost/health
- 🟢 **API Server**: http://localhost:5000/health
- 🟢 **Database**: Connection status in dashboard

---

**⚠️ Important Security Note**: Always change default passwords immediately after installation and keep your system updated with the latest security patches.

**🔄 Auto-Updates**: FiLine Wall automatically updates its spam database. Manual updates for the software are available through the web interface.

## Supported Hardware
- USRobotics 5637 USB Fax Modem
- StarTech 56k USB Dial-up and Fax Modem V.92 External

## How It Works
1. When a call comes in, it's first intercepted by the modem before reaching your phone
2. The modem captures the Caller ID information using `AT+VCID=1` command
3. Our software quickly checks:
   - Local cache for known numbers
   - AI spam prediction
   - Voice pattern analysis
   - Call pattern analysis
   
4. Based on the analysis (takes milliseconds):
   - If spam: Call is blocked before your phone rings
   - If uncertain: Call is screened (modem answers first)
   - If safe: Call is allowed to ring through to your phone

## Modem Command Flow
```
1. RING detected
2. NMBR=1234567890 (Caller ID captured)
3. Quick analysis performed
4. If blocking:
   - ATH (Hang up command)
5. If screening:
   - ATA (Answer command)
   - Voice analysis performed
6. If allowing:
   - Let ring continue to phone
```

These V.92 USB modems are ideal for this setup because:
1. Supports Caller ID capture (VCID)
2. Hardware-level call control
3. Voice quality sampling
4. Compatible with standard AT commands
5. Reliable USB interface
6. Automatic device detection
