# 🚀 Quick Start Guide - FiLine Wall

Get your FiLine Wall up and running in **under 10 minutes**!

## 📋 Prerequisites

- **Raspberry Pi 4** (4GB+ RAM recommended) or any Linux/Windows machine
- **Node.js 18+** and npm installed
- **PostgreSQL 15+** installed
- **USB Modem** (for actual call blocking)

---

## ⚡ Fast Track Setup (3 steps)

### Step 1: Fix Critical Issues

Run the automated fix script:

**Windows (PowerShell):**
```powershell
.\install-complete.sh
```

**Linux/Mac:**
```bash
chmod +x fix-critical-issues.sh
./fix-critical-issues.sh
```

This will:
- ✅ Fix all TypeScript compilation errors
- ✅ Create environment validation
- ✅ Add helpful npm scripts
- ✅ Create database seed file
- ✅ Set up health checks

### Step 2: Configure Environment

Create your `.env` file:

```bash
# Copy the example
cp .env.example .env

# Edit with your settings
nano .env  # or use any text editor
```

**Minimum required settings:**
```env
# Database
DATABASE_URL=postgresql://filinewall:yourpassword@localhost:5432/filinewall

# Security (generate a 32+ character random string)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Server
NODE_ENV=development
PORT=5000
```

**Optional API keys** (for enhanced spam detection):
```env
# Twilio Lookup (250 free lookups/month)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# Numverify (250 free requests/month)
NUMVERIFY_API_KEY=your_api_key

# NumLookup API (100 free lookups/month)
NUMLOOKUP_API_KEY=your_api_key
```

### Step 3: Initialize & Start

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Seed with example data
npm run db:seed

# Start the server
npm run dev
```

**That's it!** 🎉

Access your dashboard at: **http://localhost:5173**

Login with:
- **Username:** `admin`
- **Password:** `admin123` ⚠️ _Change this immediately!_

---

## 🔧 Common Commands

### Development
```bash
npm run dev              # Start dev server with hot reload
npm run dev:debug        # Start with debugger attached
npm run type-check       # Check TypeScript errors
npm run validate:env     # Validate environment variables
```

### Database
```bash
npm run db:push          # Push schema changes
npm run db:seed          # Add test data
npm run db:reset         # Reset and reseed database
npm run db:studio        # Open Drizzle Studio (visual editor)
```

### Production
```bash
npm run build            # Build for production
npm run prod:start       # Start in production mode
npm run docker:build     # Build Docker image
npm run docker:run       # Run in Docker container
```

### Health & Monitoring
```bash
# Check system health
.\scripts\health-check.ps1     # Windows
./scripts/health-check.sh      # Linux/Mac

# View logs
tail -f logs/app.log           # Application logs
tail -f logs/calls.log         # Call screening logs
```

---

## 📊 Verify Installation

### 1. Check Server Status
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "healthy",
  "uptime": 123,
  "memory": { "used": 245, "total": 8192 }
}
```

### 2. Check TypeScript Compilation
```bash
npm run type-check
```

Should show: **0 errors** ✅

### 3. Test API Endpoint
```bash
curl http://localhost:5000/api/statistics
```

Should return call statistics JSON.

### 4. Access Web Dashboard

Open browser: **http://localhost:5173**

You should see the FiLine Wall dashboard with:
- 📊 Statistics panel
- 📞 Recent calls table
- ⚙️ Settings panel
- 🛡️ Spam protection controls

---

## 🎯 Next Steps

### Essential Setup

1. **Change Admin Password**
   - Go to Settings → Account
   - Update password
   - Update email

2. **Configure Call Blocking Rules**
   - Go to Number Management
   - Add whitelist numbers (family, friends)
   - Review blacklist (auto-populated from spam databases)

3. **Connect Your Modem**
   ```bash
   # List available modems
   ls /dev/ttyUSB*
   
   # Update .env with your modem
   MODEM_PORT=/dev/ttyUSB0
   ```

4. **Test Call Screening**
   - Make a test call to your number
   - Watch it appear in real-time on dashboard
   - Verify blocking/allowing works correctly

### Optional Enhancements

5. **Enable External Spam APIs**
   - Sign up for free tier accounts (see API_QUICK_REFERENCE.md)
   - Add API keys to `.env`
   - Restart server

6. **Set Up Automated Backups**
   ```bash
   # Add to crontab
   0 2 * * * npm run db:backup
   ```

7. **Enable HTTPS** (for production)
   ```bash
   # Install certbot
   sudo apt install certbot
   
   # Get SSL certificate
   sudo certbot certonly --standalone -d yourdomain.com
   ```

8. **Configure Notifications**
   - Go to Settings → Notifications
   - Enable email/SMS alerts for blocked calls
   - Set up daily summary reports

---

## 🐛 Troubleshooting

### TypeScript Errors

**Problem:** `Cannot find name 'process'`

**Fix:**
```bash
npm run fix:types
```

### Database Connection Failed

**Problem:** `ECONNREFUSED` or `password authentication failed`

**Fix:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Start if needed
sudo systemctl start postgresql

# Verify DATABASE_URL in .env matches your setup
```

### Port Already in Use

**Problem:** `Port 5000 is already in use`

**Fix:**
```bash
# Change port in .env
PORT=5001

# Or kill process using port 5000
# Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux:
sudo lsof -ti:5000 | xargs kill -9
```

### Missing Dependencies

**Problem:** `Cannot find module 'xyz'`

**Fix:**
```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
```

### Modem Not Detected

**Problem:** Modem not showing in `/dev/ttyUSB*`

**Fix:**
```bash
# Check USB devices
lsusb

# Install modem drivers
sudo apt install usb-modeswitch

# Add user to dialout group
sudo usermod -a -G dialout $USER
# Log out and back in
```

---

## 📚 Documentation Reference

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Project overview & features |
| [IMPROVEMENTS_ROADMAP.md](IMPROVEMENTS_ROADMAP.md) | Future enhancements (20 items) |
| [DATABASE_ANALYSIS.md](DATABASE_ANALYSIS.md) | Database architecture details |
| [SPAM_API_SETUP.md](SPAM_API_SETUP.md) | External API integration guide |
| [API_QUICK_REFERENCE.md](API_QUICK_REFERENCE.md) | API comparison & pricing |
| [DATABASE_SETUP_SUMMARY.md](DATABASE_SETUP_SUMMARY.md) | Database optimization guide |

---

## 🎓 Learning Resources

### Understand the Architecture

```
┌─────────────────────────────────────────────────┐
│              FiLine Wall Architecture           │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────┐    ┌──────────┐   ┌───────────┐ │
│  │  Web UI  │◄───┤  Express │◄──┤ PostgreSQL│ │
│  │ (React)  │    │  Server  │   │  Database │ │
│  └──────────┘    └─────┬────┘   └───────────┘ │
│                        │                        │
│                        ▼                        │
│              ┌──────────────────┐              │
│              │  ML/AI Services  │              │
│              ├──────────────────┤              │
│              │ Voice Analysis   │              │
│              │ Pattern Detection│              │
│              │ Threat Intel     │              │
│              │ Adaptive Learning│              │
│              │ Honeypot System  │              │
│              └────────┬─────────┘              │
│                       │                        │
│                       ▼                        │
│              ┌──────────────────┐              │
│              │  External APIs   │              │
│              ├──────────────────┤              │
│              │ Twilio Lookup    │              │
│              │ Numverify        │              │
│              │ NumLookup        │              │
│              │ FCC Database     │              │
│              │ Community DBs    │              │
│              └────────┬─────────┘              │
│                       │                        │
│                       ▼                        │
│              ┌──────────────────┐              │
│              │   USB Modem      │              │
│              │  (Call Blocking) │              │
│              └──────────────────┘              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Key Concepts

**Call Screening Flow:**
1. Incoming call detected by modem
2. Caller ID extracted
3. Multi-layer analysis:
   - Whitelist/Blacklist check
   - External spam database lookup
   - ML voice pattern analysis
   - Reputation score calculation
   - Behavioral pattern matching
4. Risk score computed (0-100)
5. Action taken (allow/block/challenge)
6. User notified via dashboard

**ML/AI Features:**
- **Voice Analysis:** 50+ acoustic features analyzed in real-time
- **Pattern Detection:** Learns from 1000+ call patterns
- **Threat Intelligence:** Aggregates data from 500M+ spam numbers
- **Adaptive Learning:** Improves accuracy over time
- **Honeypot:** Baits and traps new scammer numbers

---

## 💡 Pro Tips

### Performance Optimization

```bash
# Enable PostgreSQL query optimization
npm run db:optimize

# Use materialized views for faster analytics
# (automatically refreshed every hour)
```

### Cost Savings

- Start with **100% free tier** (no API keys)
- Add Numverify (250 free/month) when needed
- Only upgrade to paid tiers if you get >100 calls/day

### Security Best Practices

- Change default admin password immediately
- Use strong JWT_SECRET (32+ random characters)
- Enable HTTPS in production
- Regular database backups (automated in roadmap)
- Keep dependencies updated: `npm audit fix`

### Raspberry Pi Optimization

```bash
# Run the optimized database setup
chmod +x setup-database.sh
./setup-database.sh

# This configures PostgreSQL for low-memory systems
```

---

## 🆘 Getting Help

**Still stuck?** Check these resources:

1. **Documentation:** Full guides in repo docs
2. **Health Check:** Run `.\scripts\health-check.ps1`
3. **Logs:** Check `logs/app.log` for errors
4. **Type Errors:** Run `npm run type-check`
5. **Database Issues:** See `DATABASE_ANALYSIS.md`

**Report Issues:**
- GitHub Issues: [Create an issue](https://github.com/yourusername/filine-wall/issues)
- Include: OS, Node version, error logs, steps to reproduce

---

## ✅ Post-Installation Checklist

- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] Server starts successfully (`npm run dev`)
- [ ] Database connection works (check `/health` endpoint)
- [ ] Web dashboard loads (http://localhost:5173)
- [ ] Can login with admin credentials
- [ ] Admin password changed
- [ ] Whitelist contains your important numbers
- [ ] Modem detected (if using hardware)
- [ ] Test call blocked/allowed correctly
- [ ] Notifications configured (optional)
- [ ] Automated backups scheduled (recommended)

---

## 🚀 You're Ready!

Your FiLine Wall is now operational and protecting against spam calls!

**Enjoy your spam-free phone! 📞🛡️**

---

_Last updated: 2024_
_For improvements and features, see: IMPROVEMENTS_ROADMAP.md_
