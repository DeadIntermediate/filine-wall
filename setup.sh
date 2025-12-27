#!/bin/bash

# FiLine Wall Linux Setup Script
# This script sets up FiLine Wall on Linux systems with MariaDB

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    log_error "This setup script is designed for Linux systems only."
    log_info "For Windows, use the PowerShell setup scripts."
    exit 1
fi

# Check if running as root for system installations
if [ "$EUID" -eq 0 ]; then
    log_warning "Running as root. Some operations may require root access."
fi

log_info "Starting FiLine Wall Linux setup..."

# Detect distribution
if command -v apt-get >/dev/null 2>&1; then
    PACKAGE_MANAGER="apt"
    log_info "Detected Debian/Ubuntu-based system"
elif command -v yum >/dev/null 2>&1; then
    PACKAGE_MANAGER="yum"
    log_info "Detected RHEL/CentOS-based system"
elif command -v pacman >/dev/null 2>&1; then
    PACKAGE_MANAGER="pacman"
    log_info "Detected Arch Linux-based system"
else
    log_warning "Unknown package manager. Please install dependencies manually."
    PACKAGE_MANAGER="unknown"
fi

# Install system dependencies
install_dependencies() {
    log_info "Installing system dependencies..."

    case $PACKAGE_MANAGER in
        apt)
            sudo apt-get update
            sudo apt-get install -y curl wget gnupg2 software-properties-common lsb-release
            ;;
        yum)
            sudo yum update -y
            sudo yum install -y curl wget
            ;;
        pacman)
            sudo pacman -Syu --noconfirm curl wget
            ;;
    esac

    log_success "System dependencies installed"
}

# Install Node.js
install_nodejs() {
    log_info "Installing Node.js..."

    if ! command -v node >/dev/null 2>&1; then
        case $PACKAGE_MANAGER in
            apt)
                # Install Node.js 18+ from NodeSource
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                sudo apt-get install -y nodejs
                ;;
            yum)
                # Install Node.js from NodeSource
                curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
                sudo yum install -y nodejs
                ;;
            pacman)
                sudo pacman -S --noconfirm nodejs npm
                ;;
        esac
        log_success "Node.js installed"
    else
        log_info "Node.js already installed: $(node --version)"
    fi
}

# Install MariaDB
install_mariadb() {
    log_info "Installing MariaDB..."

    if ! command -v mariadb >/dev/null 2>&1 && ! command -v mysql >/dev/null 2>&1; then
        case $PACKAGE_MANAGER in
            apt)
                sudo apt-get install -y mariadb-server mariadb-client
                sudo systemctl enable mariadb
                sudo systemctl start mariadb
                ;;
            yum)
                # Add MariaDB repository
                sudo tee /etc/yum.repos.d/mariadb.repo > /dev/null <<EOF
[mariadb]
name = MariaDB
baseurl = https://rpm.mariadb.org/$(echo $(cat /etc/redhat-release | sed 's/.*release \([0-9]\+\).*/\1/'))/centos/$(echo $(cat /etc/redhat-release | sed 's/.*release \([0-9]\+\).*/\1/'))/x86_64/
gpgkey=https://rpm.mariadb.org/RPM-GPG-KEY-MariaDB
gpgcheck=1
EOF
                sudo yum install -y MariaDB-server MariaDB-client
                sudo systemctl enable mariadb
                sudo systemctl start mariadb
                ;;
            pacman)
                sudo pacman -S --noconfirm mariadb
                sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql
                sudo systemctl enable mariadb
                sudo systemctl start mariadb
                ;;
        esac

        # Secure MariaDB installation
        log_info "Securing MariaDB installation..."
        sudo mysql_secure_installation <<EOF

n
y
password
password
y
y
y
y
EOF

        log_success "MariaDB installed and secured"
    else
        log_info "MariaDB/MySQL already installed"
    fi
}

# Setup database
setup_database() {
    log_info "Setting up database..."

    # Create database
    sudo mysql -u root -ppassword -e "CREATE DATABASE IF NOT EXISTS filine_wall;"

    log_success "Database created"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment..."

    if [ ! -f ".env" ]; then
        cp .env.example .env 2>/dev/null || true

        # Update .env with Linux-specific settings
        cat > .env << EOF
# Environment Configuration for FiLine Wall (Linux)
NODE_ENV=development
PORT=5000
HOST=0.0.0.0

# Database Configuration (MariaDB)
DATABASE_URL=mysql://root:password@localhost:3306/filine_wall

# Disable voice analysis to avoid native binding issues
ENABLE_VOICE_ANALYSIS=false

# Disable NLP detection to avoid TensorFlow issues
ENABLE_NLP_DETECTION=false

# Security - Generate strong keys for production
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5000
EOF

        log_success "Environment file created"
    else
        log_info ".env file already exists"
    fi
}

# Install Node.js dependencies
install_npm_packages() {
    log_info "Installing Node.js dependencies..."
    npm install
    log_success "Node.js dependencies installed"
}

# Run database migrations
setup_database_schema() {
    log_info "Setting up database schema..."
    npm run db:push
    log_success "Database schema created"
}

# Main setup function
main() {
    log_info "FiLine Wall Linux Setup"
    log_info "======================"

    install_dependencies
    install_nodejs
    install_mariadb
    setup_database
    setup_environment
    install_npm_packages
    setup_database_schema

    log_success "Setup completed successfully!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Review the .env file and update any configuration as needed"
    log_info "2. Run 'npm run dev' to start the development server"
    log_info "3. Open http://localhost:3000 in your browser"
    log_info ""
    log_info "For production deployment, consider:"
    log_info "- Setting NODE_ENV=production"
    log_info "- Configuring proper firewall rules"
    log_info "- Setting up SSL certificates"
    log_info "- Configuring log rotation"
}

# Run main function
main "$@"