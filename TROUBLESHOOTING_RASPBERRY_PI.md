# FiLine Wall - Raspberry Pi Troubleshooting Guide

**Last Updated:** December 13, 2025

---

## 🔴 ERROR: ".env file not found" or "Exit because error for .env file is missing"

### Quick Fix (Run this on the Raspberry Pi):

```bash
cd ~/filine-wall  # or wherever you cloned the project
./quick-setup.sh
```

If that doesn't exist or doesn't work:

```bash
# Manual fix
cp .env.example .env
nano .env  # Edit the file
```

---

## 🔍 Diagnosis: Which Raspberry Pi?

### Check Your Architecture:

```bash
uname -m
```

**Results:**
- `armv7l` or `armhf` = **32-bit Raspberry Pi** (Pi 3, Pi Zero, older models)
- `aarch64` or `arm64` = **64-bit Raspberry Pi** (Pi 4, Pi 5 with 64-bit OS)

---

## 🛠️ Setup for 32-bit Raspberry Pi (armhf)

### ⚠️ Important: TensorFlow NOT supported on 32-bit ARM

Your `.env` file MUST have these settings:

```bash
# Disable ML features on 32-bit ARM
ENABLE_VOICE_ANALYSIS=false
ENABLE_NLP_DETECTION=false
ENABLE_FEDERATED_LEARNING=false
```

### Complete 32-bit Setup:

```bash
# 1. Clone the repository
git clone https://github.com/DeadIntermediate/filine-wall
cd filine-wall

# 2. Run quick setup (automatically configures for 32-bit)
./quick-setup.sh

# 3. Install dependencies
npm install

# 4. Setup database
npm run db:push

# 5. Start server
npm run dev
```

### Expected Behavior on 32-bit:
- ✅ Server starts successfully
- ✅ Rule-based spam detection works (80% accuracy)
- ⚠️ You'll see warnings about TensorFlow (this is NORMAL)
- ⚠️ "Voice analysis not available" (expected)
- ⚠️ "TensorFlow not available" (expected)
- ✅ Dashboard and call screening still work

---

## 🛠️ Setup for 64-bit Raspberry Pi (arm64/aarch64)

### ✅ TensorFlow IS supported on 64-bit ARM

Your `.env` file should have:

```bash
# Enable ML features on 64-bit ARM
ENABLE_VOICE_ANALYSIS=true
ENABLE_NLP_DETECTION=true
ENABLE_FEDERATED_LEARNING=true  # optional
```

### Complete 64-bit Setup:

```bash
# 1. Clone the repository
git clone https://github.com/DeadIntermediate/filine-wall
cd filine-wall

# 2. Run quick setup (automatically configures for 64-bit)
./quick-setup.sh

# 3. Install dependencies
npm install

# 4. Setup database
npm run db:push

# 5. Start server
npm run dev
```

### Expected Behavior on 64-bit:
- ✅ Server starts successfully
- ✅ TensorFlow loads successfully
- ✅ ML-powered spam detection (95%+ accuracy)
- ✅ Voice analysis works
- ✅ Advanced NLP scam detection works

---

## 📋 Common Issues and Solutions

### Issue 1: "ERROR: .env file not found!"

**Cause:** The `.env` file doesn't exist in the project root.

**Solution:**
```bash
./quick-setup.sh
# OR manually
cp .env.example .env
```

---

### Issue 2: Server exits immediately with no error

**Cause:** Likely a database connection issue.

**Check:**
```bash
# Is PostgreSQL running?
sudo systemctl status postgresql

# If not running, start it:
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Fix database connection in .env:**
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filine_wall
```

---

### Issue 3: "EADDRINUSE: address already in use :::5000"

**Cause:** Port 5000 is already in use.

**Solution:**
```bash
# Find what's using port 5000
sudo lsof -i :5000

# Kill the process or change port in .env
PORT=5001
```

---

### Issue 4: TensorFlow errors on 32-bit Pi

**Symptoms:**
- "wrong ELF class: ELFCLASS64"
- "require is not defined"
- "TensorFlow not available"

**This is EXPECTED and HANDLED!** The app falls back to rule-based detection.

**Verify your .env has:**
```bash
ENABLE_VOICE_ANALYSIS=false
ENABLE_NLP_DETECTION=false
```

**Re-run setup:**
```bash
./quick-setup.sh
```

---

### Issue 5: npm install fails

**Symptoms:**
- "Cannot find module"
- "peer dependency" errors

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

### Issue 6: Database "filine_wall" does not exist

**Solution:**
```bash
# Create database manually
sudo -u postgres psql -c "CREATE DATABASE filine_wall;"

# Run migrations
npm run db:push
```

---

## 🔄 Migration from One Pi to Another

### From 64-bit to 32-bit Pi:

```bash
# On 32-bit Pi, after cloning:
./quick-setup.sh  # Auto-detects and configures for 32-bit

# The script will automatically:
# - Disable ML features
# - Enable rule-based mode
# - Generate new secrets
```

### From 32-bit to 64-bit Pi:

```bash
# On 64-bit Pi, after cloning:
./quick-setup.sh  # Auto-detects and configures for 64-bit

# The script will automatically:
# - Enable ML features
# - Configure TensorFlow
# - Generate new secrets
```

---

## 🧪 Verify Installation

### Run the status check:

```bash
./check-status.sh
```

### Expected output:
```
✅ .env file exists
✅ Database URL configured
✅ PostgreSQL is running
⚠️  Server is NOT running (if you haven't started it)
```

### Start the server:

```bash
npm run dev
```

### Expected output:
```
✓ Server running on port 5000
✓ AI Spam Detection: Active
✓ Environment: development
Ready to accept connections
```

### Test the server:

```bash
# In another terminal
curl http://localhost:5000/api/health

# Expected response:
{"status":"healthy"}
```

---

## 📊 Performance Expectations

### 32-bit Raspberry Pi (armhf):
- Memory usage: ~200-300MB
- Response time: ~50-100ms
- Spam detection: Rule-based (80% accuracy)
- No ML features

### 64-bit Raspberry Pi (arm64):
- Memory usage: ~400-550MB
- Response time: ~30-60ms
- Spam detection: ML-powered (95%+ accuracy)
- Full ML features

---

## 🆘 Still Having Issues?

### Collect diagnostic information:

```bash
# Run this and share the output
echo "=== System Info ==="
uname -a
echo ""
echo "=== Node Version ==="
node --version
npm --version
echo ""
echo "=== .env exists? ==="
ls -lh .env
echo ""
echo "=== PostgreSQL Status ==="
sudo systemctl status postgresql
echo ""
echo "=== Port 5000 Status ==="
sudo lsof -i :5000
echo ""
echo "=== .env ML Settings ==="
grep "ENABLE_" .env
echo ""
echo "=== Recent Logs ==="
tail -20 logs/filine-wall.log 2>/dev/null || echo "No logs yet"
```

### Get help:
- GitHub Issues: https://github.com/DeadIntermediate/filine-wall/issues
- Include the diagnostic output above
- Mention which Raspberry Pi model you're using

---

## 🎯 Quick Command Reference

```bash
# Setup (first time only)
./quick-setup.sh
npm install
npm run db:push

# Daily operations
npm run dev                 # Start development server
npm run build              # Build for production
npm start                  # Run production build
npm run check              # Check TypeScript
./check-status.sh          # Check system status

# Database
npm run db:push            # Apply schema changes
npm run db:studio          # Open database GUI

# Maintenance
git pull origin main       # Update code
npm install               # Update dependencies
sudo systemctl restart postgresql  # Restart database
```

---

## ✅ Checklist for New Installation

- [ ] Clone repository
- [ ] Run `./quick-setup.sh`
- [ ] Verify `.env` file exists
- [ ] Check ML settings match your Pi (32-bit vs 64-bit)
- [ ] PostgreSQL is installed and running
- [ ] Run `npm install`
- [ ] Run `npm run db:push`
- [ ] Run `./check-status.sh`
- [ ] Start server with `npm run dev`
- [ ] Test with `curl http://localhost:5000/api/health`
- [ ] Access dashboard at `http://your-pi-ip:5000`

---

**That's it! Your FiLine Wall should be running smoothly now.** 🎉
