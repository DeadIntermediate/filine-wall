# 🚀 Getting Started with FiLine Wall

**The fastest way to get FiLine Wall up and running!**

---

## 📦 One-Command Setup & Start

### Linux / macOS

```bash
# 1. Run automatic setup
chmod +x setup.sh
./setup.sh

# 2. Start the application
chmod +x start.sh
./start.sh
```

### Windows (PowerShell)

```powershell
# 1. Run automatic setup
.\setup.ps1

# 2. Start the application
.\start.ps1
```

**That's it!** The setup script will:
- ✅ Check all prerequisites (Node.js, PostgreSQL)
- ✅ Install dependencies
- ✅ Generate secure encryption keys
- ✅ Configure your database
- ✅ Create necessary directories
- ✅ Apply database schema

---

## 🎯 What the Setup Script Does

### Automated Steps:

1. **Validates Requirements**
   - Node.js 18+ installed
   - PostgreSQL 13+ available

2. **Installs Dependencies**
   - All npm packages
   - Development tools

3. **Creates Environment Configuration**
   - Copies `.env.example` to `.env`
   - Generates secure JWT_SECRET (32 random bytes)
   - Generates secure ENCRYPTION_KEY (32 random bytes)
   - Prompts for database credentials

4. **Database Setup**
   - Creates database (if needed)
   - Applies schema with Drizzle ORM
   - Sets up tables and indexes

5. **Directory Structure**
   - Creates `logs/` for application logs
   - Creates `models/` for ML models

---

## 🏃 Starting the Application

After setup, use the start script:

```bash
# Linux/macOS
./start.sh

# Windows
.\start.ps1
```

The start script will:
- ✅ Verify setup is complete
- ✅ Check Node.js is available
- ✅ Test database connection
- ✅ Check if ports are available
- ✅ Display server URLs
- ✅ Start the development server

### Access Points:
- **Web Interface**: http://localhost:5173
- **API Server**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

---

## 🛠️ Alternative: Manual Setup

If you prefer manual setup or the scripts don't work:

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Generate secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# 4. Edit .env with your settings and paste the generated secrets
nano .env  # or use your editor

# 5. Create database
createdb filine_wall

# 6. Apply schema
npm run db:push

# 7. Start application
npm run dev
```

---

## 📋 NPM Scripts Reference

### Quick Commands
```bash
npm run dev              # Start development server (same as ./start.sh)
npm run setup            # Basic setup (install + schema)
npm start                # Start production server
```

### Database Commands
```bash
npm run db:push          # Apply schema changes
npm run db:studio        # Open visual database editor
npm run db:reset         # Reset database schema
npm run db:generate      # Generate migration files
```

### Development Commands
```bash
npm run type-check       # Check TypeScript errors
npm run lint             # Check code quality
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier
npm run clean            # Clean build artifacts
```

### Health & Testing
```bash
npm run healthcheck      # Check if server is running
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

### Security
```bash
npm run security:audit   # Check for vulnerabilities
npm run security:check   # Check high-priority vulnerabilities
```

---

## 🔧 Configuration

### Minimum Required `.env` Settings

```env
# Database Connection
DATABASE_URL=postgresql://username:password@localhost:5432/filine_wall

# Security Keys (use the generated ones!)
JWT_SECRET=your-generated-jwt-secret-here
ENCRYPTION_KEY=your-generated-encryption-key-here

# Server Configuration
NODE_ENV=development
PORT=5000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Optional API Keys (For Enhanced Features)

```env
# Twilio (phone verification)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# Numverify (number validation)
NUMVERIFY_API_KEY=your_api_key

# Additional APIs
NOMOROBO_API_KEY=your_api_key
NUMLOOKUP_API_KEY=your_api_key
```

---

## ✅ Verify Installation

### 1. Check Server Health
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-07T...",
  "services": {
    "database": "healthy",
    "api": "healthy"
  }
}
```

### 2. Check Database Connection
```bash
npm run db:studio
```
This opens a visual database editor in your browser.

### 3. Check TypeScript Compilation
```bash
npm run type-check
```
Should complete without critical errors.

---

## 🎨 First Steps After Setup

### 1. Create Admin Account

Open your browser to http://localhost:5173 and register, or use API:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "YourSecurePassword123!",
    "role": "admin"
  }'
```

### 2. Login to Web Interface
- Navigate to http://localhost:5173
- Login with your credentials
- You'll see the dashboard

### 3. Configure Settings
- Go to **Settings** page
- Enable/disable features
- Add external API keys (optional)

### 4. Add Phone Numbers
- **Whitelist**: Always allow these numbers
- **Blacklist**: Always block these numbers
- Go to **Phone Numbers** page to manage

### 5. Connect USB Modem (Optional)
- See `MODEM_SUPPORT.md` for detailed instructions
- USRobotics USR5637 recommended
- Update `.env` with `MODEM_PORT=/dev/ttyUSB0`

---

## 🐛 Troubleshooting

### Setup Script Issues

**"Node.js not found"**
```bash
# Install Node.js 18+ from https://nodejs.org/
# Or use nvm:
nvm install 18
nvm use 18
```

**"PostgreSQL not found"**
```bash
# Linux (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

**"Permission denied" on Linux/macOS**
```bash
chmod +x setup.sh start.sh
```

**"Database connection failed"**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list | grep postgresql  # macOS

# Start PostgreSQL if needed
sudo systemctl start postgresql  # Linux
brew services start postgresql  # macOS
```

### Start Script Issues

**"Port 5000 already in use"**
```bash
# Find what's using the port
lsof -i :5000  # Linux/macOS
netstat -ano | findstr :5000  # Windows

# Kill the process or change PORT in .env
PORT=5001
```

**".env file not found"**
```bash
# Run setup script first
./setup.sh  # or .\setup.ps1 on Windows
```

**"Module not found" errors**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 📚 Next Steps

After successful setup:

1. **Read Documentation**
   - `README.md` - Full project overview
   - `CODE_IMPROVEMENTS_SUMMARY.md` - Recent enhancements
   - `MODEM_SUPPORT.md` - Hardware setup
   - `API_QUICK_REFERENCE.md` - API documentation

2. **Configure External Services**
   - Sign up for Twilio, Numverify, etc.
   - Add API keys to `.env`
   - Enhanced spam detection with external data

3. **Production Deployment**
   - See `DEPLOYMENT.md`
   - Configure SSL/TLS
   - Set up monitoring
   - Configure backups

4. **Hardware Setup**
   - Connect USB modem
   - Test call blocking
   - Configure IVR screening

---

## 🆘 Getting Help

- **Check Logs**: Application logs are in `logs/` directory
- **Error Messages**: Read them carefully - they often contain solutions
- **Documentation**: Comprehensive docs in project root
- **Health Check**: Use `npm run healthcheck` to diagnose issues

---

## 🎉 Success!

You should now have FiLine Wall running on your system. The web interface at http://localhost:5173 is your control center for managing spam call blocking.

**Happy spam blocking!** 🚫📞
