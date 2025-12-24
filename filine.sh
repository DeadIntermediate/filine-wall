#!/bin/bash

# FiLine Wall - Unified Management Script
# All-in-one script for managing FiLine Wall system

set -e

SESSION_NAME="filine-wall"
VERSION=$(cat VERSION 2>/dev/null || echo "unknown")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

# ============================================================================
# HELP & USAGE
# ============================================================================

show_help() {
    cat << EOF
${CYAN}╔═══════════════════════════════════════════════════════════════╗
║              FiLine Wall - Management Script v${VERSION}             ║
╚═══════════════════════════════════════════════════════════════╝${NC}

${GREEN}USAGE:${NC}
  ./filine.sh <command> [options]

${GREEN}APPLICATION COMMANDS:${NC}
  ${CYAN}start${NC}              Start FiLine Wall application
  ${CYAN}stop${NC}               Stop FiLine Wall application
  ${CYAN}restart${NC}            Restart FiLine Wall application
  ${CYAN}status${NC}             Check application status
  ${CYAN}logs${NC}               Attach to tmux session to view logs
  ${CYAN}attach${NC}             Attach to running tmux session

${GREEN}SETUP & INSTALLATION:${NC}
  ${CYAN}install${NC}            Complete installation (quick)
  ${CYAN}setup${NC}              Quick setup/configuration
  ${CYAN}setup-pi5${NC}          Optimize for Raspberry Pi 5
  ${CYAN}setup-sudo${NC}         Setup sudo access
  ${CYAN}setup-postgres${NC}     Setup PostgreSQL database
  ${CYAN}setup-postgres-remote${NC}  Setup remote PostgreSQL access

${GREEN}DATABASE COMMANDS:${NC}
  ${CYAN}db-provision${NC}       Provision database schema
  ${CYAN}db-test${NC}            Test database connection
  ${CYAN}db-fix${NC}             Fix database issues
  ${CYAN}db-upgrade${NC}         Upgrade PostgreSQL version
  ${CYAN}db-start${NC}           Start PostgreSQL service

${GREEN}DIAGNOSTICS & TESTING:${NC}
  ${CYAN}check-env${NC}          Verify environment configuration
  ${CYAN}check-status${NC}       Full system status check
  ${CYAN}diagnose-modem${NC}     Diagnose modem issues
  ${CYAN}test-modem${NC}         Test modem functionality
  ${CYAN}test-calls${NC}         Test live call detection

${GREEN}MAINTENANCE:${NC}
  ${CYAN}fix-deps${NC}           Fix dependency issues
  ${CYAN}fix-env${NC}            Fix environment file
  ${CYAN}fix-imports${NC}        Fix import statements
  ${CYAN}update${NC}             Update from GitHub
  ${CYAN}optimize${NC}           Optimize for Raspberry Pi
  ${CYAN}package${NC}            Package for deployment

${GREEN}MODEM & DEVICE CLIENT:${NC}
  ${CYAN}modem-setup${NC}        Setup modem hardware and dependencies
  ${CYAN}modem-install-service${NC}  Install call detector as systemd service
  ${CYAN}modem-install-autodetect${NC}  Install automatic modem detection
  ${CYAN}modem-status${NC}       Check modem and service status
  ${CYAN}modem-service${NC} <action>  Manage service (start|stop|restart|status|logs)

${GREEN}NETWORK:${NC}
  ${CYAN}enable-network${NC}     Enable network access

${GREEN}HELP:${NC}
  ${CYAN}help${NC}               Show this help message
  ${CYAN}version${NC}            Show version information

${YELLOW}EXAMPLES:${NC}
  ./filine.sh start          # Start the application
  ./filine.sh status         # Check if running
  ./filine.sh install        # Full installation
  ./filine.sh db-provision   # Setup database
  ./filine.sh modem-setup    # Setup modem hardware
  ./filine.sh modem-service start  # Start call detector

EOF
}

# ============================================================================
# APPLICATION MANAGEMENT
# ============================================================================

cmd_start() {
    log_info "Starting FiLine Wall..."
    
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        log_warning "Session already exists. Use 'restart' to restart."
        exit 1
    fi

    # Check if .env exists
    if [ ! -f ".env" ]; then
        log_error ".env file not found. Run './filine.sh setup' first."
        exit 1
    fi

    # Create tmux session
    tmux new-session -d -s "$SESSION_NAME" -n "filine"
    
    # Start PostgreSQL if needed
    tmux send-keys -t "$SESSION_NAME:0" "sudo service postgresql start" C-m
    sleep 2
    
    # Start the application
    tmux send-keys -t "$SESSION_NAME:0" "npm run dev" C-m
    
    log_success "FiLine Wall started in tmux session '$SESSION_NAME'"
    log_info "Use './filine.sh logs' to attach and view logs"
    log_info "Use Ctrl+B then D to detach from session"
}

cmd_stop() {
    log_info "Stopping FiLine Wall..."
    
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        tmux kill-session -t "$SESSION_NAME"
        log_success "FiLine Wall stopped"
    else
        log_warning "FiLine Wall is not running"
    fi
}

cmd_restart() {
    log_info "Restarting FiLine Wall..."
    cmd_stop
    sleep 2
    cmd_start
}

cmd_status() {
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}FiLine Wall Status${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    
    # Check tmux session
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo -e "Application:      ${GREEN}Running${NC} (tmux session: $SESSION_NAME)"
    else
        echo -e "Application:      ${RED}Not running${NC}"
    fi
    
    # Check PostgreSQL
    if sudo service postgresql status > /dev/null 2>&1; then
        echo -e "PostgreSQL:       ${GREEN}Running${NC}"
    else
        echo -e "PostgreSQL:       ${RED}Not running${NC}"
    fi
    
    # Check Node.js
    if command -v node > /dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        echo -e "Node.js:          ${GREEN}Installed${NC} ($NODE_VERSION)"
    else
        echo -e "Node.js:          ${RED}Not installed${NC}"
    fi
    
    # Check .env
    if [ -f ".env" ]; then
        echo -e ".env file:        ${GREEN}Present${NC}"
    else
        echo -e ".env file:        ${RED}Missing${NC}"
    fi
    
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
}

cmd_logs() {
    if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        log_info "Attaching to session... (Ctrl+B then D to detach)"
        sleep 1
        tmux attach-session -t "$SESSION_NAME"
    else
        log_error "FiLine Wall is not running"
        exit 1
    fi
}

# ============================================================================
# SETUP & INSTALLATION
# ============================================================================

cmd_install() {
    log_info "Starting quick installation..."
    
    # Detect architecture
    ARCH=$(uname -m)
    log_info "Detected architecture: $ARCH"
    
    # Update system
    log_info "Updating system packages..."
    sudo apt-get update
    
    # Install dependencies
    log_info "Installing dependencies..."
    sudo apt-get install -y nodejs npm postgresql git tmux python3 python3-pip
    
    # Install Python dependencies
    log_info "Installing Python dependencies..."
    pip3 install pyserial
    
    # Setup environment
    cmd_setup
    
    # Setup database
    cmd_db_provision
    
    # Install npm packages
    log_info "Installing npm packages..."
    npm install
    
    log_success "Installation complete!"
    log_info "Run './filine.sh start' to start the application"
}

cmd_setup() {
    log_info "Running quick setup..."
    
    # Detect architecture
    ARCH=$(uname -m)
    IS_32BIT=false
    
    if [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "armhf" ]; then
        log_info "32-bit ARM detected"
        IS_32BIT=true
    fi
    
    # Check if .env exists
    if [ -f ".env" ]; then
        log_info ".env file already exists"
        read -p "Recreate it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Keeping existing .env"
            return
        fi
    fi
    
    # Create .env file
    log_info "Creating .env file..."
    
    # Get database password
    read -sp "Enter PostgreSQL password (leave empty for default): " DB_PASS
    echo
    DB_PASS=${DB_PASS:-filine_secure_pass}
    
    cat > .env << EOF
# FiLine Wall Configuration
NODE_ENV=production
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://filine_user:${DB_PASS}@localhost:5432/filine_wall

# Session Secret
SESSION_SECRET=$(openssl rand -base64 32)

# ML Configuration
ENABLE_VOICE_ANALYSIS=$([ "$IS_32BIT" = true ] && echo "false" || echo "true")
ENABLE_NLP_DETECTION=$([ "$IS_32BIT" = true ] && echo "false" || echo "true")
ENABLE_PATTERN_LEARNING=true

# Call Detection
ENABLE_CALLER_ID=true
ENABLE_SPAM_DETECTION=true

# Logging
LOG_LEVEL=info
EOF
    
    log_success ".env file created successfully"
}

cmd_setup_pi5() {
    log_info "Optimizing for Raspberry Pi 5..."
    
    # Enable performance governor
    sudo apt-get install -y cpufrequtils
    echo 'GOVERNOR="performance"' | sudo tee /etc/default/cpufrequtils
    sudo systemctl restart cpufrequtils
    
    # Optimize swap
    sudo dphys-swapfile swapoff
    sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
    sudo dphys-swapfile setup
    sudo dphys-swapfile swapon
    
    log_success "Pi 5 optimization complete"
}

cmd_setup_sudo() {
    log_info "Setting up sudo access..."
    
    # Add user to necessary groups
    sudo usermod -aG dialout,plugdev,gpio,i2c,spi "$USER"
    
    # Setup passwordless sudo for service commands
    echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/service postgresql *" | sudo tee /etc/sudoers.d/filine-postgresql
    echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl * postgresql" | sudo tee -a /etc/sudoers.d/filine-postgresql
    
    sudo chmod 0440 /etc/sudoers.d/filine-postgresql
    
    log_success "Sudo access configured"
    log_warning "You may need to log out and back in for group changes to take effect"
}

cmd_setup_postgres() {
    log_info "Setting up PostgreSQL..."
    
    # Install PostgreSQL
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    
    # Start PostgreSQL
    sudo service postgresql start
    
    # Create user and database
    sudo -u postgres psql << EOF
CREATE USER filine_user WITH PASSWORD 'filine_secure_pass';
CREATE DATABASE filine_wall OWNER filine_user;
GRANT ALL PRIVILEGES ON DATABASE filine_wall TO filine_user;
EOF
    
    log_success "PostgreSQL setup complete"
}

cmd_setup_postgres_remote() {
    log_info "Configuring PostgreSQL for remote access..."
    
    # Backup configs
    sudo cp /etc/postgresql/*/main/postgresql.conf /etc/postgresql/*/main/postgresql.conf.bak
    sudo cp /etc/postgresql/*/main/pg_hba.conf /etc/postgresql/*/main/pg_hba.conf.bak
    
    # Enable remote connections
    sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf
    
    # Allow connections from local network
    echo "host    all             all             192.168.0.0/16          md5" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf
    
    # Restart PostgreSQL
    sudo service postgresql restart
    
    log_success "PostgreSQL configured for remote access"
}

# ============================================================================
# DATABASE COMMANDS
# ============================================================================

cmd_db_provision() {
    log_info "Provisioning database..."
    
    # Ensure PostgreSQL is running
    sudo service postgresql start
    
    # Run migrations
    npm run db:push
    
    log_success "Database provisioned successfully"
}

cmd_db_test() {
    log_info "Testing database connection..."
    
    if [ ! -f ".env" ]; then
        log_error ".env file not found"
        exit 1
    fi
    
    source .env
    
    psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        log_success "Database connection successful"
    else
        log_error "Database connection failed"
        exit 1
    fi
}

cmd_db_fix() {
    log_info "Fixing database issues..."
    
    # Start PostgreSQL
    sudo service postgresql start
    
    # Drop and recreate database
    sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS filine_wall;
CREATE DATABASE filine_wall OWNER filine_user;
GRANT ALL PRIVILEGES ON DATABASE filine_wall TO filine_user;
EOF
    
    # Re-provision
    cmd_db_provision
    
    log_success "Database fixed"
}

cmd_db_upgrade() {
    log_info "Upgrading PostgreSQL..."
    
    # Backup data
    sudo -u postgres pg_dumpall > /tmp/pg_backup.sql
    
    # Upgrade
    sudo apt-get update
    sudo apt-get upgrade -y postgresql
    
    # Restore data
    sudo -u postgres psql -f /tmp/pg_backup.sql
    
    log_success "PostgreSQL upgraded"
}

cmd_db_start() {
    log_info "Starting PostgreSQL..."
    sudo service postgresql start
    log_success "PostgreSQL started"
}

# ============================================================================
# DIAGNOSTICS & TESTING
# ============================================================================

cmd_check_env() {
    log_info "Checking environment configuration..."
    
    echo -e "\n${CYAN}Environment Check${NC}"
    echo "─────────────────────────────────────────────────────"
    
    # Check .env file
    if [ -f ".env" ]; then
        log_success ".env file exists"
        
        # Check required variables
        source .env
        
        [ -n "$DATABASE_URL" ] && log_success "DATABASE_URL is set" || log_error "DATABASE_URL is missing"
        [ -n "$SESSION_SECRET" ] && log_success "SESSION_SECRET is set" || log_error "SESSION_SECRET is missing"
        [ -n "$PORT" ] && log_success "PORT is set" || log_error "PORT is missing"
    else
        log_error ".env file not found"
    fi
    
    # Check Node.js
    if command -v node > /dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        log_success "Node.js: $NODE_VERSION"
    else
        log_error "Node.js not installed"
    fi
    
    # Check npm
    if command -v npm > /dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        log_success "npm: $NPM_VERSION"
    else
        log_error "npm not installed"
    fi
    
    # Check PostgreSQL
    if command -v psql > /dev/null 2>&1; then
        PSQL_VERSION=$(psql --version | awk '{print $3}')
        log_success "PostgreSQL: $PSQL_VERSION"
    else
        log_error "PostgreSQL not installed"
    fi
    
    # Check Python
    if command -v python3 > /dev/null 2>&1; then
        PYTHON_VERSION=$(python3 --version | awk '{print $2}')
        log_success "Python: $PYTHON_VERSION"
    else
        log_error "Python3 not installed"
    fi
    
    echo "─────────────────────────────────────────────────────"
}

cmd_check_status() {
    cmd_status
    echo ""
    cmd_check_env
}

cmd_diagnose_modem() {
    log_info "Diagnosing modem..."
    
    # Check for modem devices
    if ls /dev/ttyACM* 1> /dev/null 2>&1; then
        log_success "Modem devices found:"
        ls -l /dev/ttyACM*
    else
        log_error "No modem devices found on /dev/ttyACM*"
    fi
    
    if ls /dev/ttyUSB* 1> /dev/null 2>&1; then
        log_success "USB serial devices found:"
        ls -l /dev/ttyUSB*
    else
        log_warning "No USB serial devices found"
    fi
    
    # Check permissions
    CURRENT_USER=$(whoami)
    if groups "$CURRENT_USER" | grep -q dialout; then
        log_success "User is in dialout group"
    else
        log_error "User is not in dialout group"
        log_info "Run: sudo usermod -aG dialout $CURRENT_USER"
    fi
    
    # Test Python script
    if [ -f "test-modem.py" ]; then
        log_info "Running modem test..."
        python3 test-modem.py
    fi
}

cmd_test_modem() {
    if [ -f "test-modem.py" ]; then
        log_info "Testing modem..."
        python3 test-modem.py
    else
        log_error "test-modem.py not found"
    fi
}

cmd_test_calls() {
    log_info "Testing live call detection..."
    
    if [ -f "device-client/call_detector.py" ]; then
        python3 device-client/call_detector.py --test
    else
        log_error "call_detector.py not found"
    fi
}

# ============================================================================
# MAINTENANCE
# ============================================================================

cmd_fix_deps() {
    log_info "Fixing dependencies..."
    
    # Remove node_modules and package-lock
    rm -rf node_modules package-lock.json
    
    # Clean npm cache
    npm cache clean --force
    
    # Reinstall
    npm install
    
    log_success "Dependencies fixed"
}

cmd_fix_env() {
    log_info "Fixing environment configuration..."
    
    if [ ! -f ".env" ]; then
        log_warning ".env not found, creating new one..."
        cmd_setup
    else
        log_info "Checking .env file..."
        
        # Ensure SESSION_SECRET exists
        if ! grep -q "SESSION_SECRET" .env; then
            echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env
            log_success "Added SESSION_SECRET"
        fi
        
        log_success "Environment configuration checked"
    fi
}

cmd_fix_imports() {
    log_info "Fixing import statements..."
    
    # Fix common import issues in TypeScript files
    find . -name "*.ts" -type f -not -path "./node_modules/*" -exec sed -i 's/from "\.\//from "@\//g' {} \;
    
    log_success "Import statements fixed"
}

cmd_update() {
    log_info "Updating from GitHub..."
    
    # Stash local changes
    git stash
    
    # Pull latest changes
    git pull origin main
    
    # Install dependencies
    npm install
    
    # Run migrations
    npm run db:push
    
    log_success "Update complete"
    log_info "Restart the application to apply changes"
}

cmd_optimize() {
    log_info "Optimizing system..."
    
    # Run Pi 5 optimizations
    cmd_setup_pi5
    
    # Optimize npm packages
    npm dedupe
    npm prune
    
    log_success "Optimization complete"
}

cmd_package() {
    log_info "Packaging for deployment..."
    
    # Create deployment package
    DEPLOY_DIR="filine-wall-deploy"
    rm -rf "$DEPLOY_DIR"
    mkdir -p "$DEPLOY_DIR"
    
    # Copy necessary files
    cp -r client server db device-client "$DEPLOY_DIR/"
    cp package.json tsconfig.json vite.config.ts drizzle.config.ts "$DEPLOY_DIR/"
    cp *.md "$DEPLOY_DIR/"
    cp filine.sh "$DEPLOY_DIR/"
    
    # Create tarball
    tar -czf "filine-wall-deploy-$(date +%Y%m%d).tar.gz" "$DEPLOY_DIR"
    
    log_success "Deployment package created: filine-wall-deploy-$(date +%Y%m%d).tar.gz"
}

# ============================================================================
# NETWORK
# ============================================================================

cmd_enable_network() {
    log_info "Enabling network access..."
    
    # Open firewall ports
    if command -v ufw > /dev/null 2>&1; then
        sudo ufw allow 5000/tcp
        sudo ufw allow 5432/tcp
        log_success "Firewall rules added"
    else
        log_warning "UFW not installed, skipping firewall configuration"
    fi
    
    log_success "Network access enabled"
}

# ============================================================================
# MODEM & DEVICE CLIENT
# ============================================================================

cmd_modem_setup() {
    log_info "Setting up modem and device client..."
    
    if [ "$EUID" -ne 0 ]; then 
        log_error "This command requires root privileges"
        log_info "Run: sudo ./filine.sh modem-setup"
        exit 1
    fi
    
    # Install dependencies
    log_info "Installing modem dependencies..."
    apt-get update
    apt-get install -y nodejs npm udev usb-modeswitch usb-modeswitch-data ppp \
        modemmanager libqmi-utils portaudio19-dev jq python3-pip
    
    # Install Python packages
    python3 -m pip install pyserial requests cryptography
    
    # Create service user
    log_info "Creating service user..."
    useradd -r -s /bin/false calldetector 2>/dev/null || true
    usermod -a -G dialout calldetector
    
    # Create directories
    mkdir -p /etc/call-detector /var/log/call-detector
    chown calldetector:calldetector /var/log/call-detector
    chmod 700 /etc/call-detector
    
    # Create udev rules for supported modems
    log_info "Creating udev rules..."
    cat > /etc/udev/rules.d/99-supported-modems.rules << 'EOL'
# USRobotics 5637 USB Fax Modem
SUBSYSTEM=="tty", ATTRS{idVendor}=="0baf", ATTRS{idProduct}=="0303", SYMLINK+="ttyUSB-modem", MODE="0660", GROUP="dialout"
# Prolific chipset
SUBSYSTEM=="tty", ATTRS{idVendor}=="067b", ATTRS{idProduct}=="2303", SYMLINK+="ttyUSB-modem", MODE="0660", GROUP="dialout"
# StarTech 56k USB V.92 Modem
SUBSYSTEM=="tty", ATTRS{idVendor}=="06cd", ATTRS{idProduct}=="0121", SYMLINK+="ttyUSB-modem", MODE="0660", GROUP="dialout"
SUBSYSTEM=="tty", ATTRS{idVendor}=="0557", ATTRS{idProduct}=="2008", SYMLINK+="ttyUSB-modem", MODE="0660", GROUP="dialout"
EOL
    
    # Reload udev
    udevadm control --reload-rules
    udevadm trigger
    
    log_success "Modem setup complete"
}

cmd_modem_install_service() {
    log_info "Installing call detector service..."
    
    if [ "$EUID" -ne 0 ]; then 
        log_error "This command requires root privileges"
        log_info "Run: sudo ./filine.sh modem-install-service"
        exit 1
    fi
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    DEVICE_CLIENT_DIR="$SCRIPT_DIR/device-client"
    
    # Create config directory
    mkdir -p /etc/call-detector
    chmod 755 /etc/call-detector
    
    # Create default config if it doesn't exist
    if [ ! -f /etc/call-detector/config.ini ]; then
        log_info "Creating default configuration..."
        cat > /etc/call-detector/config.ini << 'EOF'
[server]
url = http://localhost:5000

[device]
id = raspberry-pi-filine
auth_token = local-dev-token-no-auth-required

[modem]
device = /dev/ttyUSB0
baudrate = 115200
EOF
    fi
    
    # Create systemd service
    log_info "Creating systemd service..."
    cat > /etc/systemd/system/call-detector.service << EOF
[Unit]
Description=FiLine Wall Call Detector
After=network.target

[Service]
Type=simple
User=calldetector
Group=dialout
WorkingDirectory=$DEVICE_CLIENT_DIR
ExecStart=/usr/bin/python3 $DEVICE_CLIENT_DIR/call_detector.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable call-detector.service
    
    log_success "Service installed"
    log_info "Start with: sudo systemctl start call-detector.service"
}

cmd_modem_status() {
    log_info "Checking modem status..."
    
    echo ""
    echo -e "${CYAN}1. USB Devices:${NC}"
    lsusb | grep -i "modem\|serial\|robotics" || echo "   No modem-like devices found"
    
    echo ""
    echo -e "${CYAN}2. Serial Devices:${NC}"
    if ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null; then
        ls -l /dev/ttyACM* /dev/ttyUSB* 2>/dev/null
    else
        log_error "No serial devices found"
    fi
    
    echo ""
    echo -e "${CYAN}3. Call Detector Service:${NC}"
    if systemctl is-active --quiet call-detector.service 2>/dev/null; then
        log_success "Service is running"
        echo ""
        echo "Recent logs:"
        journalctl -u call-detector.service -n 10 --no-pager
    else
        log_warning "Service is not running"
    fi
    
    echo ""
    echo -e "${CYAN}4. Configuration:${NC}"
    if [ -f /etc/call-detector/config.ini ]; then
        cat /etc/call-detector/config.ini
    else
        log_warning "Config file not found"
    fi
}

cmd_modem_service() {
    local action="${2:-status}"
    
    case "$action" in
        start)
            log_info "Starting call detector service..."
            sudo systemctl start call-detector.service
            log_success "Service started"
            ;;
        stop)
            log_info "Stopping call detector service..."
            sudo systemctl stop call-detector.service
            log_success "Service stopped"
            ;;
        restart)
            log_info "Restarting call detector service..."
            sudo systemctl restart call-detector.service
            log_success "Service restarted"
            ;;
        status)
            systemctl status call-detector.service
            ;;
        logs)
            journalctl -u call-detector.service -f
            ;;
        *)
            log_error "Unknown action: $action"
            log_info "Usage: ./filine.sh modem-service {start|stop|restart|status|logs}"
            exit 1
            ;;
    esac
}

cmd_modem_install_autodetect() {
    log_info "Installing modem auto-detection..."
    
    if [ "$EUID" -ne 0 ]; then 
        log_error "This command requires root privileges"
        log_info "Run: sudo ./filine.sh modem-install-autodetect"
        exit 1
    fi
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Create auto-config script
    log_info "Creating modem auto-config script..."
    cat > /usr/local/bin/modem-autoconfig.sh << 'AUTOCONFIG_SCRIPT'
#!/bin/bash
MODEM_DEVICE=$1
LOG_FILE="/var/log/modem-autoconfig.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Modem detected: $MODEM_DEVICE"
sleep 2

if [ ! -e "$MODEM_DEVICE" ]; then
    log "ERROR: Device $MODEM_DEVICE not found"
    exit 1
fi

python3 << 'EOF'
import serial, time, sys

device = sys.argv[1] if len(sys.argv) > 1 else '$MODEM_DEVICE'
log_file = '$LOG_FILE'

try:
    with open(log_file, 'a') as log:
        log.write(f"Opening modem on {device}...\n")
        modem = serial.Serial(device, 57600, timeout=2)
        
        # Reset and configure
        commands = [
            ('ATZ', 'Reset'),
            ('AT+VCID=1', 'Enable Caller ID'),
            ('AT#CID=1', 'Alt Caller ID'),
            ('AT+CLIP=1', 'CLIP'),
        ]
        
        for cmd, desc in commands:
            log.write(f"Sending {cmd} ({desc})...\n")
            modem.write(f'{cmd}\r'.encode())
            time.sleep(0.5)
            response = modem.read(modem.in_waiting).decode(errors='ignore')
            log.write(f"Response: {response.strip()}\n")
        
        modem.close()
        log.write("✓ Modem configured successfully\n")
except Exception as e:
    with open(log_file, 'a') as log:
        log.write(f"ERROR: {str(e)}\n")
    sys.exit(1)
EOF

# Update config and restart service
if [ $? -eq 0 ]; then
    log "✓ Modem configured successfully"
    if [ -f "/etc/call-detector/config.ini" ]; then
        sed -i "s|^device = .*|device = $MODEM_DEVICE|" /etc/call-detector/config.ini
    fi
    systemctl restart call-detector.service 2>/dev/null
    log "Service restarted"
fi
AUTOCONFIG_SCRIPT
    
    chmod +x /usr/local/bin/modem-autoconfig.sh
    log_success "Auto-config script installed"
    
    # Install udev rule
    log_info "Installing udev rule..."
    cat > /etc/udev/rules.d/99-modem-autodetect.rules << 'EOF'
# Automatic modem detection
SUBSYSTEM=="tty", KERNEL=="ttyACM*", ACTION=="add", RUN+="/usr/local/bin/modem-autoconfig.sh /dev/%k"
SUBSYSTEM=="tty", KERNEL=="ttyUSB*", ACTION=="add", RUN+="/usr/local/bin/modem-autoconfig.sh /dev/%k"
SUBSYSTEM=="tty", KERNEL=="ttyACM*", MODE="0666", GROUP="dialout"
SUBSYSTEM=="tty", KERNEL=="ttyUSB*", MODE="0666", GROUP="dialout"
EOF
    
    # Reload udev
    udevadm control --reload-rules
    udevadm trigger
    
    # Create log file
    touch /var/log/modem-autoconfig.log
    chmod 666 /var/log/modem-autoconfig.log
    
    log_success "Auto-detection installed"
    log_info "Unplug and replug your modem to test"
    log_info "Monitor with: tail -f /var/log/modem-autoconfig.log"
}

# ============================================================================
# VERSION
# ============================================================================

cmd_version() {
    echo -e "${CYAN}FiLine Wall${NC} version ${GREEN}$VERSION${NC}"
}

# ============================================================================
# MAIN DISPATCHER
# ============================================================================

case "${1:-}" in
    # Application
    start)              cmd_start ;;
    stop)               cmd_stop ;;
    restart)            cmd_restart ;;
    status)             cmd_status ;;
    logs|attach)        cmd_logs ;;
    
    # Setup
    install)            cmd_install ;;
    setup)              cmd_setup ;;
    setup-pi5)          cmd_setup_pi5 ;;
    setup-sudo)         cmd_setup_sudo ;;
    setup-postgres)     cmd_setup_postgres ;;
    setup-postgres-remote) cmd_setup_postgres_remote ;;
    
    # Database
    db-provision)       cmd_db_provision ;;
    db-test)            cmd_db_test ;;
    db-fix)             cmd_db_fix ;;
    db-upgrade)         cmd_db_upgrade ;;
    db-start)           cmd_db_start ;;
    
    # Diagnostics
    check-env)          cmd_check_env ;;
    check-status)       cmd_check_status ;;
    diagnose-modem)     cmd_diagnose_modem ;;
    test-modem)         cmd_test_modem ;;
    test-calls)         cmd_test_calls ;;
    
    # Maintenance
    fix-deps)           cmd_fix_deps ;;
    fix-env)            cmd_fix_env ;;
    fix-imports)        cmd_fix_imports ;;
    update)             cmd_update ;;
    optimize)           cmd_optimize ;;
    package)            cmd_package ;;
    
    # Modem & Device Client
    modem-setup)        cmd_modem_setup ;;
    modem-install-service) cmd_modem_install_service ;;
    modem-install-autodetect) cmd_modem_install_autodetect ;;
    modem-status)       cmd_modem_status ;;
    modem-service)      cmd_modem_service "$@" ;;
    
    # Network
    enable-network)     cmd_enable_network ;;
    
    # Help
    help|--help|-h)     show_help ;;
    version|--version)  cmd_version ;;
    
    *)
        log_error "Unknown command: ${1:-}"
        echo ""
        show_help
        exit 1
        ;;
esac
