# Quick Installation Guide

## One-Command Installation

### 🐳 Docker (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/docker-setup.sh | bash
```

### 🐧 Linux/macOS
```bash
curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/install.sh | bash
```

### 🖥️ Windows
```powershell
# Run as Administrator
irm https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/install.ps1 | iex
```

## What Gets Installed

✅ **Core System**
- Node.js 20+ with npm/pnpm
- PostgreSQL 15+ database
- Redis cache (optional)
- Nginx reverse proxy

✅ **FiLine Wall Application**
- Web interface on port 80/443
- API server on port 5000
- Device client for modem interface
- Database with spam detection data

✅ **Security Features**
- SSL/TLS encryption
- JWT authentication
- Rate limiting
- Audit logging

## Post-Installation

1. **Access Web Interface**: http://localhost
2. **Default Login**: admin / admin123 ⚠️ **CHANGE IMMEDIATELY**
3. **Connect Modem**: Plug in your V.92 USB modem
4. **Configure Settings**: Set up number lists and preferences

## Troubleshooting

### Installation Issues
```bash
# Check service status
sudo systemctl status filinewall
sudo systemctl status nginx
sudo systemctl status postgresql

# View logs
sudo journalctl -u filinewall -f
```

### Docker Issues
```bash
# Check containers
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart
```

### Need Help?
- 📖 **Full Documentation**: README.md
- 🚀 **Deployment Guide**: DEPLOYMENT.md
- 🧙‍♂️ **Interactive Setup**: `node setup-wizard.js`