# 🛡️ FiLine Wall - Ultra-Simple Installation Guide

## One-Command Installation

FiLine Wall now has a **completely automated installer** that does EVERYTHING for you!

### Fresh Installation (From Scratch)

Run this single command to download, install, and set up FiLine Wall:

```bash
curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/install-complete.sh | bash
```

That's it! The installer will:

1. ✅ Detect your operating system
2. ✅ Update system packages
3. ✅ Install all dependencies (Node.js, PostgreSQL 18, build tools, etc.)
4. ✅ Download FiLine Wall from GitHub
5. ✅ Create and configure the PostgreSQL database
6. ✅ Install all npm packages (~200 packages)
7. ✅ Generate secure environment variables
8. ✅ Set up the database schema
9. ✅ Build the project
10. ✅ Run health checks
11. ✅ Offer to start the application automatically

### Installation from Downloaded Repository

If you've already cloned the repository:

```bash
cd filine-wall
./install-complete.sh
```

## What Gets Installed

The installer automatically sets up:

- **PostgreSQL 18** (latest version with ARM64 optimizations)
- **Node.js 20** (LTS version)
- **System dependencies** (build-essential, Python 3, git, etc.)
- **npm packages** (React, Express, TensorFlow.js, Drizzle ORM, etc.)
- **Database** (`filine_wall` database, schema, and migrations)
- **Environment variables** (auto-generated secrets, database URL)
- **Project structure** (logs, models, uploads directories)

## Starting FiLine Wall

After installation completes, you can start FiLine Wall in three ways:

### Option 1: Auto-Start (Recommended)
The installer will ask if you want to start immediately - just say "yes"!

### Option 2: Simple Start Script
```bash
cd filine-wall
./start-filine.sh
```

### Option 3: Manual Start
```bash
cd filine-wall
npx tsx server/index.ts
```

## Accessing FiLine Wall

Once started, access FiLine Wall at:

- **Web Interface**: http://localhost:5000
- **API Health Check**: http://localhost:5000/health

## System Requirements

- **OS**: Raspberry Pi OS (Debian), Ubuntu, or macOS
- **Architecture**: ARM64 (Raspberry Pi 4/5) or x86_64
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 2GB free space
- **Network**: Internet connection for installation

## Supported Platforms

✅ Raspberry Pi 4/5 (ARM64)  
✅ Debian 11/12  
✅ Ubuntu 20.04/22.04/24.04  
✅ macOS (Intel & Apple Silicon)

## Installation Time

- **Raspberry Pi 5**: ~10-15 minutes
- **Raspberry Pi 4**: ~15-20 minutes
- **Desktop/Laptop**: ~5-10 minutes

Times vary based on internet speed and system resources.

## Troubleshooting

### Installation Logs
Check the installation log for details:
```bash
cat ~/filine-wall/install.log
```

### Common Issues

**Issue**: `curl: command not found`  
**Fix**: Install curl first: `sudo apt install curl`

**Issue**: Permission denied  
**Fix**: The script will prompt for sudo when needed

**Issue**: PostgreSQL connection failed  
**Fix**: Check PostgreSQL is running: `sudo systemctl status postgresql`

**Issue**: Port 5000 already in use  
**Fix**: Stop other services on port 5000 or change PORT in `.env`

### Manual Database Setup

If database setup fails, you can run it manually:

```bash
cd filine-wall
sudo -u postgres psql -c "CREATE DATABASE filine_wall;"
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';"
npm run db:push
```

### Reinstalling

To completely reinstall:

```bash
# Remove old installation
rm -rf ~/filine-wall

# Drop existing database (optional)
sudo -u postgres psql -c "DROP DATABASE IF EXISTS filine_wall;"

# Run installer again
curl -fsSL https://raw.githubusercontent.com/DeadIntermediate/filine-wall/main/install-complete.sh | bash
```

## Configuration

After installation, you can customize settings in `.env`:

```bash
cd filine-wall
nano .env
```

Key settings:
- `DATABASE_URL` - PostgreSQL connection string
- `HOST` - Server bind address (default: 0.0.0.0)
- `PORT` - Server port (default: 5000)
- `MODEM_ENABLED` - Enable USB modem (default: false)
- `JWT_SECRET` - Auth token secret (auto-generated)
- `ENCRYPTION_KEY` - Data encryption key (auto-generated)

## Development Mode

For development with hot-reload:

```bash
npm run dev
```

This starts both the backend server and Vite frontend dev server.

## Production Deployment

For production, the installer already sets up:
- Optimized build artifacts
- Production-ready database
- Secure environment variables
- Health check endpoints

To run as a service, create a systemd service file (optional).

## Updating FiLine Wall

To update to the latest version:

```bash
cd filine-wall
git pull origin main
npm install
npm run db:push
npm run build
```

## Uninstalling

To remove FiLine Wall:

```bash
# Stop the application (Ctrl+C if running)

# Remove installation directory
rm -rf ~/filine-wall

# Drop database (optional)
sudo -u postgres psql -c "DROP DATABASE filine_wall;"

# Uninstall PostgreSQL (optional)
sudo apt remove --purge postgresql-18 postgresql-contrib-18
```

## Support

- **Issues**: https://github.com/DeadIntermediate/filine-wall/issues
- **Docs**: See `README.md` and other documentation files
- **Logs**: Check `install.log` and application logs in `logs/`

## License

FiLine Wall is open-source software. See LICENSE file for details.

---

**Made with ❤️ for Raspberry Pi**  
*Protecting your phone line from spam calls, one block at a time.*
