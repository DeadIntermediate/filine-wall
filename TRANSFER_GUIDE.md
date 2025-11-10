# Transfer FiLine Wall to Another Raspberry Pi

## 🎯 Quick Transfer Methods

### **Method 1: Create Compressed Archive (Recommended)**

#### **On Source Raspberry Pi:**

```bash
# Navigate to project parent directory
cd ~/Desktop/Projects/FiLine

# Create compressed archive (excludes unnecessary files)
tar -czf filine-wall-backup.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.env' \
  --exclude='logs/*' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  filine-wall/

# Check archive size
ls -lh filine-wall-backup.tar.gz

# Archive is now ready to transfer!
```

**Expected size:** ~5-15 MB (without node_modules and build artifacts)

#### **Transfer to New Raspberry Pi:**

**Option A: USB Drive**
```bash
# Copy to USB drive
cp filine-wall-backup.tar.gz /media/usb/

# On new Pi, copy from USB
cp /media/usb/filine-wall-backup.tar.gz ~/
```

**Option B: Network Transfer (SCP)**
```bash
# From source Pi, send to new Pi
scp filine-wall-backup.tar.gz pi@NEW_PI_IP:~/

# Or from new Pi, pull from source Pi
scp pi@SOURCE_PI_IP:~/filine-wall-backup.tar.gz ~/
```

**Option C: Network Transfer (rsync - faster for updates)**
```bash
# Sync directly between Pis (preserves permissions)
rsync -avz --exclude='node_modules' --exclude='.git' \
  ~/Desktop/Projects/FiLine/filine-wall/ \
  pi@NEW_PI_IP:~/filine-wall/
```

#### **On New Raspberry Pi:**

```bash
# Extract archive
tar -xzf filine-wall-backup.tar.gz

# Navigate to project
cd filine-wall

# Run setup (installs dependencies, sets up database)
chmod +x setup.sh
./setup.sh

# Start the system
./start.sh
```

---

### **Method 2: Complete System Backup (With Database)**

If you want to transfer **including your database data** (call history, settings, etc.):

#### **On Source Pi:**

```bash
# 1. Backup PostgreSQL database
pg_dump -U postgres filine_wall > filine_db_backup.sql

# 2. Create archive with database
tar -czf filine-wall-complete.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  filine-wall/ filine_db_backup.sql

# Optional: Include .env (contains secrets - handle carefully!)
# tar -czf filine-wall-complete.tar.gz filine-wall/ filine_db_backup.sql .env
```

#### **On New Pi:**

```bash
# Extract
tar -xzf filine-wall-complete.tar.gz

# Install dependencies
cd filine-wall
npm install

# Restore database
createdb filine_wall
psql -U postgres filine_wall < ../filine_db_backup.sql

# Copy .env or create new one
cp .env.example .env
# Edit .env with your settings
nano .env

# Start
./start.sh
```

---

### **Method 3: Git Clone (Fresh Installation)**

If you have the code in a Git repository:

```bash
# On new Pi
git clone https://github.com/DeadIntermediate/filine-wall.git
cd filine-wall
./setup.sh
./start.sh
```

---

## 📦 What Gets Compressed

### **Included in Archive:**
✅ Source code (TypeScript/JavaScript)
✅ Configuration files (package.json, tsconfig.json, etc.)
✅ Database schema (db/schema.ts)
✅ Setup scripts (setup.sh, start.sh)
✅ Documentation (all .md files)
✅ Client code (React frontend)
✅ Server code (Express backend)

### **Excluded (Re-installed on new Pi):**
❌ `node_modules/` - Reinstalled via npm install
❌ `.git/` - Git history (optional)
❌ `dist/` or `build/` - Rebuilt during setup
❌ `logs/` - Empty on new installation
❌ `.env` - Contains secrets, create new

---

## 🔧 Advanced: Create Deployment Script

Create a reusable deployment script:

```bash
# deploy.sh
#!/bin/bash

echo "📦 Creating FiLine Wall deployment package..."

# Set variables
BACKUP_NAME="filine-wall-$(date +%Y%m%d-%H%M%S).tar.gz"
PROJECT_DIR="filine-wall"

# Create backup
tar -czf "$BACKUP_NAME" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.env' \
  --exclude='logs/*' \
  --exclude='*.log' \
  "$PROJECT_DIR/"

echo "✅ Created: $BACKUP_NAME"
echo "📊 Size: $(ls -lh $BACKUP_NAME | awk '{print $5}')"
echo ""
echo "🚀 Transfer to new Pi with:"
echo "   scp $BACKUP_NAME pi@NEW_PI_IP:~/"
echo ""
echo "📝 On new Pi, extract with:"
echo "   tar -xzf $BACKUP_NAME"
echo "   cd filine-wall"
echo "   ./setup.sh"
```

Usage:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 🔐 Security Considerations

### **DO NOT include in archive:**
- ❌ `.env` file (contains database passwords, API keys)
- ❌ `logs/` (may contain sensitive call data)
- ❌ SSL certificates/private keys

### **Handle separately:**
```bash
# On source Pi - backup secrets securely
tar -czf secrets.tar.gz .env

# Encrypt the secrets (optional but recommended)
gpg -c secrets.tar.gz  # Creates secrets.tar.gz.gpg

# Transfer encrypted file
scp secrets.tar.gz.gpg pi@NEW_PI_IP:~/

# On new Pi - decrypt and extract
gpg -d secrets.tar.gz.gpg > secrets.tar.gz
tar -xzf secrets.tar.gz
```

---

## 🎯 Quick Reference Commands

### **Compress:**
```bash
tar -czf filine-backup.tar.gz --exclude='node_modules' --exclude='.git' filine-wall/
```

### **Transfer:**
```bash
scp filine-backup.tar.gz pi@192.168.1.100:~/
```

### **Extract:**
```bash
tar -xzf filine-backup.tar.gz
```

### **Setup on new Pi:**
```bash
cd filine-wall
./setup.sh
./start.sh
```

---

## 📊 Estimated Transfer Sizes

| Content | Size |
|---------|------|
| Code only (no node_modules) | 5-10 MB |
| Code + Database (empty) | 5-10 MB |
| Code + Database (1 month data) | 15-30 MB |
| Code + Database (6 months data) | 50-100 MB |
| Full with node_modules | 200-400 MB |

**Recommendation:** Transfer **without** node_modules, reinstall on new Pi with `npm install`.

---

## 🔄 Update Existing Installation

If FiLine Wall is already on the new Pi and you want to update:

```bash
# On new Pi
cd filine-wall

# Backup current installation
tar -czf backup-before-update.tar.gz .

# Pull new code
rsync -avz --exclude='node_modules' --exclude='.env' \
  pi@SOURCE_PI_IP:~/filine-wall/ ./

# Update dependencies
npm install

# Restart
./start.sh
```

---

## ✅ Verification Checklist

After transfer, verify on new Pi:

- [ ] Extract archive successfully
- [ ] `package.json` exists
- [ ] Run `./setup.sh` completes without errors
- [ ] PostgreSQL database created
- [ ] Dependencies installed (`node_modules/` exists)
- [ ] `.env` file configured
- [ ] Server starts: `./start.sh`
- [ ] Web interface accessible: http://localhost:5173
- [ ] API responds: http://localhost:5000/health
- [ ] Can login to web interface
- [ ] Modem detected (if connected)

---

## 🆘 Troubleshooting

**"Permission denied" errors:**
```bash
chmod +x setup.sh start.sh
sudo chown -R $USER:$USER filine-wall/
```

**"Module not found" errors:**
```bash
cd filine-wall
rm -rf node_modules package-lock.json
npm install
```

**"Database connection failed":**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Recreate database
dropdb filine_wall
createdb filine_wall
npm run db:push
```

**"Port already in use":**
```bash
# Check what's using the port
sudo lsof -i :5000
sudo lsof -i :5173

# Kill the process or change port in .env
```

---

## 🎉 Done!

Your FiLine Wall installation is now on the new Raspberry Pi and ready to use!

**Next steps:**
1. Connect USRobotics modem
2. Configure phone line
3. Add trusted numbers to whitelist
4. Start blocking spam! 🚫📞
