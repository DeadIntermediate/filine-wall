#!/bin/bash

# FiLine Wall Installation Script
# Supports Ubuntu/Debian, CentOS/RHEL, macOS

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_VERSION="20"
POSTGRES_VERSION="15"
PROJECT_NAME="filinewall"
INSTALL_DIR="/opt/filinewall"
SERVICE_USER="filinewall"
WEB_ROOT="/var/www/filinewall"

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║                FiLine Wall                   ║"
    echo "║         Installation & Setup Script         ║"
    echo "║                                              ║"
    echo "║   Anti-Telemarketing & Spam Call Blocker    ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        PACKAGE_MANAGER="brew"
    elif [[ -f /etc/debian_version ]]; then
        OS="debian"
        PACKAGE_MANAGER="apt"
    elif [[ -f /etc/redhat-release ]]; then
        OS="redhat"
        PACKAGE_MANAGER="yum"
    else
        log_error "Unsupported operating system"
        exit 1
    fi
    log_info "Detected OS: $OS"
}

# Check if running as root for system operations
check_privileges() {
    if [[ $EUID -eq 0 ]] && [[ "$1" != "--allow-root" ]]; then
        log_error "This script should not be run as root for security reasons."
        log_info "If you need to install system packages, the script will prompt for sudo."
        log_info "Use --allow-root flag only if you understand the security implications."
        exit 1
    fi
}

# Install system dependencies
install_system_deps() {
    log_info "Installing system dependencies..."
    
    case $OS in
        "debian")
            sudo apt update
            sudo apt install -y curl wget git build-essential python3 python3-pip python3-venv \
                               postgresql-$POSTGRES_VERSION postgresql-contrib nginx redis-server \
                               software-properties-common gpg
            ;;
        "redhat")
            sudo yum update -y
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y curl wget git python3 python3-pip postgresql-server \
                               postgresql-contrib nginx redis epel-release
            # Initialize PostgreSQL on RHEL/CentOS
            sudo postgresql-setup initdb
            ;;
        "macos")
            # Check if Homebrew is installed
            if ! command -v brew &> /dev/null; then
                log_info "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew update
            brew install node@$NODE_VERSION postgresql@$POSTGRES_VERSION nginx redis python@3.11
            brew services start postgresql@$POSTGRES_VERSION
            brew services start redis
            ;;
    esac
}

# Install Node.js
install_nodejs() {
    log_info "Installing Node.js $NODE_VERSION..."
    
    if command -v node &> /dev/null; then
        NODE_CURRENT=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $NODE_CURRENT -ge $NODE_VERSION ]]; then
            log_info "Node.js $NODE_CURRENT is already installed"
            return
        fi
    fi
    
    case $OS in
        "debian"|"redhat")
            # Install NodeSource repository
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
            if [[ $OS == "debian" ]]; then
                sudo apt install -y nodejs
            else
                sudo yum install -y nodejs
            fi
            ;;
        "macos")
            # Already installed via brew
            ;;
    esac
    
    # Install npm and pnpm
    sudo npm install -g npm@latest pnpm
}

# Create system user
create_service_user() {
    if [[ $OS != "macos" ]]; then
        if ! id "$SERVICE_USER" &>/dev/null; then
            log_info "Creating service user: $SERVICE_USER"
            sudo useradd --system --home $INSTALL_DIR --shell /bin/false $SERVICE_USER
        fi
    fi
}

# Setup PostgreSQL
setup_postgresql() {
    log_info "Setting up PostgreSQL..."
    
    case $OS in
        "debian")
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
        "redhat")
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
            ;;
        "macos")
            # Already started via brew services
            ;;
    esac
    
    # Create database and user
    log_info "Creating database and user..."
    sudo -u postgres psql -c "CREATE USER $SERVICE_USER WITH PASSWORD 'filinewall_secure_password';" || true
    sudo -u postgres psql -c "CREATE DATABASE $PROJECT_NAME OWNER $SERVICE_USER;" || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $PROJECT_NAME TO $SERVICE_USER;" || true
}

# Install application
install_application() {
    log_info "Installing FiLine Wall application..."
    
    # Create directories
    sudo mkdir -p $INSTALL_DIR
    sudo mkdir -p $WEB_ROOT
    sudo mkdir -p /var/log/filinewall
    
    # Copy application files
    if [[ $OS != "macos" ]]; then
        sudo chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
        sudo chown -R $SERVICE_USER:$SERVICE_USER /var/log/filinewall
    fi
    
    # Install dependencies
    log_info "Installing Node.js dependencies..."
    npm install
    
    # Build application
    log_info "Building application..."
    npm run build
    
    # Copy built files
    sudo cp -r dist/* $WEB_ROOT/
    if [[ $OS != "macos" ]]; then
        sudo chown -R www-data:www-data $WEB_ROOT
    fi
}

# Setup Python environment for device client
setup_python_env() {
    log_info "Setting up Python environment for device client..."
    
    cd device-client
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt 2>/dev/null || pip install cryptography pyserial
    deactivate
    cd ..
}

# Configure services
configure_services() {
    if [[ $OS == "macos" ]]; then
        log_info "Service configuration on macOS requires manual setup"
        return
    fi
    
    log_info "Configuring systemd services..."
    
    # FiLine Wall API service
    sudo tee /etc/systemd/system/filinewall.service > /dev/null <<EOF
[Unit]
Description=FiLine Wall API Server
After=network.target postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgresql://$SERVICE_USER:filinewall_secure_password@localhost:5432/$PROJECT_NAME
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=filinewall

[Install]
WantedBy=multi-user.target
EOF

    # FiLine Wall Device Client service
    sudo tee /etc/systemd/system/filinewall-device.service > /dev/null <<EOF
[Unit]
Description=FiLine Wall Device Client
After=network.target filinewall.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR/device-client
ExecStart=$INSTALL_DIR/device-client/venv/bin/python call_detector.py
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=filinewall-device

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable filinewall
    sudo systemctl enable filinewall-device
}

# Configure Nginx
configure_nginx() {
    log_info "Configuring Nginx..."
    
    # Copy nginx configuration
    if [[ -f nginx.conf ]]; then
        case $OS in
            "debian")
                sudo cp nginx.conf /etc/nginx/sites-available/filinewall
                sudo ln -sf /etc/nginx/sites-available/filinewall /etc/nginx/sites-enabled/
                sudo rm -f /etc/nginx/sites-enabled/default
                ;;
            "redhat")
                sudo cp nginx.conf /etc/nginx/conf.d/filinewall.conf
                ;;
            "macos")
                sudo cp nginx.conf /usr/local/etc/nginx/servers/filinewall.conf
                ;;
        esac
    fi
    
    # Test nginx configuration
    sudo nginx -t
    
    # Start nginx
    case $OS in
        "debian"|"redhat")
            sudo systemctl start nginx
            sudo systemctl enable nginx
            ;;
        "macos")
            sudo brew services start nginx
            ;;
    esac
}

# Setup environment file
setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [[ ! -f .env ]]; then
        cp .env.example .env
        
        # Generate JWT secret
        JWT_SECRET=$(openssl rand -base64 32)
        sed -i.bak "s/your-super-secure-secret-key-here/$JWT_SECRET/" .env
        
        # Update database URL
        sed -i.bak "s|postgresql://user:password@localhost:5432/filinewall|postgresql://$SERVICE_USER:filinewall_secure_password@localhost:5432/$PROJECT_NAME|" .env
        
        log_info "Environment file created. Please review and update .env as needed."
    fi
}

# Setup SSL certificates
setup_ssl() {
    read -p "Do you want to set up SSL certificates with Let's Encrypt? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter your domain name: " DOMAIN
        
        case $OS in
            "debian")
                sudo apt install -y certbot python3-certbot-nginx
                ;;
            "redhat")
                sudo yum install -y certbot python3-certbot-nginx
                ;;
            "macos")
                brew install certbot
                ;;
        esac
        
        sudo certbot --nginx -d $DOMAIN
        
        # Setup auto-renewal
        if [[ $OS != "macos" ]]; then
            (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | sudo crontab -
        fi
    fi
}

# Start services
start_services() {
    if [[ $OS == "macos" ]]; then
        log_info "On macOS, please start the services manually:"
        log_info "  npm start (in the project directory)"
        return
    fi
    
    log_info "Starting services..."
    
    sudo systemctl start postgresql
    sudo systemctl start redis-server
    sudo systemctl start nginx
    sudo systemctl start filinewall
    
    # Wait a moment for API to start
    sleep 5
    
    # Start device client if modem is available
    if [[ -e /dev/ttyUSB0 ]] || [[ -e /dev/ttyACM0 ]]; then
        sudo systemctl start filinewall-device
    else
        log_warn "No modem detected. Device client not started."
        log_info "Connect your modem and run: sudo systemctl start filinewall-device"
    fi
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Check if services are running
    if curl -s http://localhost/health &>/dev/null; then
        log_info "✓ Web interface is accessible"
    else
        log_warn "✗ Web interface is not accessible"
    fi
    
    if curl -s http://localhost:5000/health &>/dev/null; then
        log_info "✓ API server is running"
    else
        log_warn "✗ API server is not running"
    fi
    
    # Show status
    if [[ $OS != "macos" ]]; then
        systemctl is-active --quiet postgresql && log_info "✓ PostgreSQL is running" || log_warn "✗ PostgreSQL is not running"
        systemctl is-active --quiet redis-server && log_info "✓ Redis is running" || log_warn "✗ Redis is not running"
        systemctl is-active --quiet nginx && log_info "✓ Nginx is running" || log_warn "✗ Nginx is not running"
        systemctl is-active --quiet filinewall && log_info "✓ FiLine Wall API is running" || log_warn "✗ FiLine Wall API is not running"
    fi
}

# Show completion message
show_completion() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║              Installation Complete!          ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo "🚀 FiLine Wall has been installed successfully!"
    echo ""
    echo "📱 Web Interface: http://localhost (or https://your-domain.com)"
    echo "🔧 API Endpoint: http://localhost:5000"
    echo "📁 Installation Directory: $INSTALL_DIR"
    echo "📋 Logs: /var/log/filinewall/ or 'sudo journalctl -u filinewall'"
    echo ""
    echo "🔐 Default admin credentials:"
    echo "   Username: admin"
    echo "   Password: admin123 (PLEASE CHANGE THIS!)"
    echo ""
    echo "⚙️  Next steps:"
    echo "1. Review and update the .env file with your settings"
    echo "2. Change the default admin password"
    echo "3. Connect your modem device and configure it"
    echo "4. Set up your phone number whitelist/blocklist"
    echo ""
    echo "📖 Documentation: README.md and DEPLOYMENT.md"
    echo "🆘 Support: Check the GitHub repository for issues and documentation"
}

# Main installation flow
main() {
    print_header
    
    # Parse arguments
    ALLOW_ROOT=false
    for arg in "$@"; do
        case $arg in
            --allow-root)
                ALLOW_ROOT=true
                shift
                ;;
            --help|-h)
                echo "FiLine Wall Installation Script"
                echo ""
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --allow-root    Allow running as root (not recommended)"
                echo "  --help, -h      Show this help message"
                exit 0
                ;;
        esac
    done
    
    if [[ $ALLOW_ROOT == false ]]; then
        check_privileges
    fi
    
    detect_os
    
    log_info "Starting FiLine Wall installation..."
    log_info "This will install Node.js, PostgreSQL, Redis, Nginx, and Python dependencies."
    
    read -p "Continue with installation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Installation cancelled."
        exit 0
    fi
    
    install_system_deps
    install_nodejs
    create_service_user
    setup_postgresql
    install_application
    setup_python_env
    setup_environment
    configure_services
    configure_nginx
    setup_ssl
    start_services
    verify_installation
    show_completion
}

# Handle script interruption
trap 'log_error "Installation interrupted!"; exit 1' INT TERM

# Run main function
main "$@"