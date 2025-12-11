# Quick Installation Guide

## One-Command Installation from GitHub

### ⚡ Quick Install (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/quick-install.sh | bash
```

### � Manual Installation
```bash
# Clone repository
git clone https://github.com/DeadIntermediate/filine-wall.git
cd filine-wall

# Run installer
chmod +x install-complete.sh
./install-complete.sh
```

### � Update Existing Installation
```bash
cd ~/filine-wall
./update-from-github.sh
```

## What Gets Installed

✅ **Core System**
- Node.js 20+ with npm
- PostgreSQL 18+ database
- System dependencies

✅ **FiLine Wall Application**
- Web interface on port 5000
- API server
- Device client for modem interface
- Database with spam detection data

✅ **Security Features**
- JWT authentication
- Rate limiting
- Audit logging

## Post-Installation

1. **Access Web Interface**: http://localhost:5000
2. **Default Login**: admin / admin123 ⚠️ **CHANGE IMMEDIATELY**
3. **Connect Modem**: Plug in your V.92 USB modem
4. **Configure Settings**: Set up number lists and preferences

## Troubleshooting

### Check Service Status
```bash
# Check if services are running
cd ~/filine-wall
./manage-filine.sh status

# View application logs
tail -f logs/*.log
```

### Need Help?
- 📖 **Full Documentation**: README.md
- 🚀 **Deployment Guide**: DEPLOYMENT.md