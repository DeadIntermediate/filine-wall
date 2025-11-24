# 📦 FiLine Wall - Raspberry Pi Deployment Guide

## ✅ Your Package is Ready!

**Archive:** `filine-wall-deployment_20251123_091555.tar.gz` (284KB)

---

## 🚀 Quick Deployment Steps

### **Step 1: Transfer to New Raspberry Pi**

#### Option A: SCP (Network Transfer)
```bash
# From this computer:
scp filine-wall-deployment_*.tar.gz pi@192.168.1.100:~/
```

#### Option B: USB Drive
```bash
# Copy to USB drive
cp filine-wall-deployment_*.tar.gz /media/usb/

# On new Raspberry Pi, copy from USB
cp /media/usb/filine-wall-deployment_*.tar.gz ~/
```

#### Option C: Direct Download (if hosted)
```bash
# On new Raspberry Pi:
wget http://yourserver.com/filine-wall-deployment_*.tar.gz
```

---

### **Step 2: Extract on New Raspberry Pi**

```bash
# SSH into new Raspberry Pi
ssh pi@192.168.1.100

# Extract the package
cd ~
tar -xzf filine-wall-deployment_*.tar.gz
cd filine-wall-deployment
```

---

### **Step 3: One-Command Install** ⚡

```bash
# This does EVERYTHING automatically:
./quick-install.sh
```

**What it does:**
- ✅ Installs all dependencies (Node.js, PostgreSQL, etc.)
- ✅ Sets up the database
- ✅ Configures the environment
- ✅ Starts the server in tmux

**Done!** 🎉

---

### **Step 4: Access FiLine Wall**

```
http://192.168.1.100:5000
```
(Replace with your Raspberry Pi's IP address)

---

## 📋 Manual Installation (Alternative)

If you prefer step-by-step:

### 1. Extract
```bash
tar -xzf filine-wall-deployment_*.tar.gz
cd filine-wall-deployment
```

### 2. Run Setup
```bash
./setup.sh
```

### 3. Start Server
```bash
# Option A: Standard
./start.sh

# Option B: Tmux (recommended)
./start-tmux.sh

# Option C: Background with control
./filine-ctl.sh start
```

---

## 🎯 Managing Your Server

### View Logs
```bash
./filine-ctl.sh attach
# Press Ctrl+B then D to detach
```

### Check Status
```bash
./filine-ctl.sh status
```

### Stop Server
```bash
./filine-ctl.sh stop
```

### Restart Server
```bash
./filine-ctl.sh restart
```

---

## 📦 What's Included in the Package

- ✅ **Complete source code** (client, server, database)
- ✅ **All detection services** (9 advanced methods)
- ✅ **Setup scripts** (automated installation)
- ✅ **Tmux scripts** (background operation)
- ✅ **Management tools** (easy control)
- ✅ **Documentation** (guides and references)
- ✅ **Configuration templates** (.env.example)
- ✅ **Quick install script** (one-command deployment)

**Total:** 207 files, 284KB compressed

---

## 🔧 System Requirements

### Minimum:
- Raspberry Pi 3B or newer
- 1GB RAM
- 2GB free disk space
- Raspberry Pi OS (Debian-based)
- Internet connection (for initial setup)

### Recommended:
- Raspberry Pi 4/5
- 2GB+ RAM
- 8GB+ free disk space
- Ethernet connection
- Static IP address

---

## 🆘 Troubleshooting

### Package Won't Extract
```bash
# Check file integrity
sha256sum filine-wall-deployment_*.tar.gz

# Try force extract
tar -xzvf filine-wall-deployment_*.tar.gz
```

### Setup Fails
```bash
# Check system updates
sudo apt update && sudo apt upgrade

# Check disk space
df -h

# Check permissions
chmod +x *.sh
```

### Port 5000 Already in Use
```bash
# Find what's using it
sudo lsof -i :5000

# Kill the process
sudo kill -9 <PID>
```

### Database Connection Issues
```bash
# Restart PostgreSQL
sudo systemctl restart postgresql

# Check status
sudo systemctl status postgresql

# Re-run database setup
./setup-database.sh
```

### Can't Access Web Interface
```bash
# Check if server is running
./filine-ctl.sh status

# Check firewall
sudo ufw status
sudo ufw allow 5000

# Check server is listening
netstat -tulpn | grep 5000
```

---

## 📚 Documentation Files Included

- `DEPLOY_README.txt` - Quick deployment reference
- `README.md` - Project overview
- `GETTING_STARTED.md` - Getting started guide
- `QUICK_START.md` - Quick start guide
- `INSTALL.md` - Installation instructions
- `DEPLOYMENT.md` - Deployment guide
- `TMUX_GUIDE.md` - Tmux usage guide
- `CONSOLE_LOGGING_GUIDE.md` - Logging reference
- `FILES.txt` - Complete file list
- `CHECKSUMS.txt` - File checksums

---

## 🎬 Example Deployment Session

```bash
# On your computer
$ scp filine-wall-deployment_20251123_091555.tar.gz pi@192.168.1.100:~/
filine-wall-deployment_20251123_091555.tar.gz    100%  284KB  28.4MB/s

# SSH to new Raspberry Pi
$ ssh pi@192.168.1.100

# On new Raspberry Pi
pi@raspberrypi:~ $ tar -xzf filine-wall-deployment_20251123_091555.tar.gz
pi@raspberrypi:~ $ cd filine-wall-deployment
pi@raspberrypi:~/filine-wall-deployment $ ./quick-install.sh

╔═══════════════════════════════════════════════╗
║         FiLine Wall - Quick Install           ║
╚═══════════════════════════════════════════════╝

Continue? (y/N): y

Running setup...
[✓] Node.js installed
[✓] PostgreSQL installed
[✓] Dependencies installed
[✓] Database configured
[✓] Environment configured

Starting server in tmux...
[✓] Session started!

╔═══════════════════════════════════════════════╗
║         Installation Complete! 🎉             ║
╚═══════════════════════════════════════════════╝

Access FiLine Wall at: http://192.168.1.100:5000

View logs: ./filine-ctl.sh attach
Stop server: ./filine-ctl.sh stop
```

**Done!** Visit http://192.168.1.100:5000 and start blocking spam calls! 🎉

---

## 💡 Pro Tips

### Make Auto-Start on Boot
```bash
# Add to /etc/rc.local
cd /home/pi/filine-wall-deployment && ./start-tmux.sh detached
```

### Set Static IP
```bash
# Edit: /etc/dhcpcd.conf
sudo nano /etc/dhcpcd.conf

# Add:
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1
```

### Monitor Resource Usage
```bash
# In tmux session, create new window: Ctrl+B then C
htop
```

### Backup Configuration
```bash
# Backup your .env file
cp .env .env.backup

# Backup database
pg_dump filine_wall > backup_$(date +%Y%m%d).sql
```

---

## 🎉 You're All Set!

Your FiLine Wall deployment package is ready to transfer and install on any Raspberry Pi!

**Next Steps:**
1. Transfer the .tar.gz file to your new Raspberry Pi
2. Run `./quick-install.sh`
3. Access the web interface
4. Start blocking spam calls!

**Questions?** Check the included documentation files! 📚
