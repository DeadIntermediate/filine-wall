# FiLine Wall - Unified Management Script Guide

All shell scripts (35 total) have been consolidated into a single, easy-to-use management script: **`filine.sh`**

## Quick Start

```bash
# Make executable (on Linux/Pi)
chmod +x filine.sh

# View all available commands
./filine.sh help

# Start the application
./filine.sh start

# Check status
./filine.sh status

# View logs
./filine.sh logs
```

## Common Commands

### Application Management
```bash
./filine.sh start           # Start FiLine Wall
./filine.sh stop            # Stop FiLine Wall
./filine.sh restart         # Restart FiLine Wall
./filine.sh status          # Check status
./filine.sh logs            # View logs (attach to tmux)
```

### Installation & Setup
```bash
./filine.sh install         # Complete installation
./filine.sh setup           # Quick setup/configuration
./filine.sh setup-pi5       # Optimize for Raspberry Pi 5
./filine.sh setup-postgres  # Setup PostgreSQL database
```

### Modem & Device Client
```bash
./filine.sh modem-setup                # Setup modem hardware
./filine.sh modem-install-service      # Install as systemd service
./filine.sh modem-install-autodetect   # Install auto-detection
./filine.sh modem-status               # Check modem status
./filine.sh modem-service start        # Start call detector
./filine.sh modem-service stop         # Stop call detector
./filine.sh modem-service logs         # View service logs
```

### Database Operations
```bash
./filine.sh db-provision    # Provision database schema
./filine.sh db-test         # Test database connection
./filine.sh db-fix          # Fix database issues
./filine.sh db-start        # Start PostgreSQL
```

### Diagnostics & Testing
```bash
./filine.sh check-env       # Verify environment
./filine.sh check-status    # Full system check
./filine.sh diagnose-modem  # Diagnose modem issues
./filine.sh test-calls      # Test call detection
```

### Maintenance
```bash
./filine.sh fix-deps        # Fix dependency issues
./filine.sh fix-env         # Fix environment file
./filine.sh update          # Update from GitHub
./filine.sh optimize        # Optimize for Raspberry Pi
./filine.sh package         # Package for deployment
```

## What Changed?

**Before:** 35 separate shell scripts cluttering the project
```
Root directory (29 scripts):
check-env.sh, check-status.sh, diagnose-modem-pi.sh, 
enable-network-access.sh, filine-ctl.sh, fix-database.sh,
fix-dependencies.sh, fix-env.sh, fix-imports.sh, 
install-complete.sh, manage-filine.sh, optimize-pi5.sh,
... and 17 more files!

device-client directory (6 scripts):
setup.sh, install-service.sh, check-modem-status.sh,
modem-autoconfig.sh, install-modem-autodetect.sh,
update-on-pi.sh
```

**After:** 1 unified script with organized commands
```
filine.sh    # All functionality in one place
```

## Benefits

✅ **Dramatically cleaner** - Removed 35 scattered scripts  
✅ **Single command** - One script to rule them all  
✅ **Better organized** - Logical command grouping  
✅ **Consistent interface** - All commands follow same pattern  
✅ **Built-in help** - `./filine.sh help` shows everything  
✅ **Easier maintenance** - Update one file instead of 35  
✅ **No more confusion** - Clear command names  

## Migration Notes

All functionality from the old scripts has been preserved and organized into the new unified script. The command names are intuitive and match their original purposes:

### Root Scripts
| Old Script | New Command |
|------------|-------------|
| start-filine.sh | `./filine.sh start` |
| manage-filine.sh | `./filine.sh start/stop/restart` |
| check-env.sh | `./filine.sh check-env` |
| quick-setup.sh | `./filine.sh setup` |
| setup-pi5.sh | `./filine.sh setup-pi5` |
| provision-database.sh | `./filine.sh db-provision` |
| test-db-connection.sh | `./filine.sh db-test` |
| diagnose-modem-pi.sh | `./filine.sh diagnose-modem` |
| update-from-github.sh | `./filine.sh update` |

### device-client Scripts  
| Old Script | New Command |
|------------|-------------|
| device-client/setup.sh | `./filine.sh modem-setup` |
| device-client/install-service.sh | `./filine.sh modem-install-service` |
| device-client/check-modem-status.sh | `./filine.sh modem-status` |
| device-client/install-modem-autodetect.sh | `./filine.sh modem-install-autodetect` |
| device-client/modem-autoconfig.sh | Embedded in auto-detect |

## Tips

- Use tab completion if your shell supports it
- Run `./filine.sh help` anytime to see all commands
- The script includes colored output for better readability
- Most commands provide helpful feedback about what they're doing
- When transferring to Raspberry Pi, remember to `chmod +x filine.sh`

## Support

For detailed information about specific features, refer to the other documentation files:
- [QUICK_START.md](QUICK_START.md) - Getting started guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment instructions
- [TROUBLESHOOTING_RASPBERRY_PI.md](TROUBLESHOOTING_RASPBERRY_PI.md) - Troubleshooting help
