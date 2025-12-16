#!/bin/bash
# PostgreSQL Remote Server Configuration for FiLine Wall
# Run this on the PostgreSQL server (10.0.0.97)

set -e

echo "╔════════════════════════════════════════════╗"
echo "║  PostgreSQL Remote Access Configuration   ║"
echo "╚════════════════════════════════════════════╝"
echo ""

if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root: sudo ./setup-postgres-remote.sh"
  exit 1
fi

PG_VERSION=$(sudo -u postgres psql --version | grep -oP '\d+' | head -1)
PG_CONF_DIR="/etc/postgresql/${PG_VERSION}/main"

echo "📦 PostgreSQL Version: $PG_VERSION"
echo "📁 Config Directory: $PG_CONF_DIR"
echo ""

# Create FiLine Wall database if it doesn't exist
echo "🗄️  Creating filine_wall database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'filine_wall'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE filine_wall;"
echo "✓ Database exists"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE filine_wall TO postgres;"
echo "✓ Privileges granted"

# Backup existing config
echo ""
echo "📋 Backing up existing configuration..."
cp ${PG_CONF_DIR}/postgresql.conf ${PG_CONF_DIR}/postgresql.conf.backup.$(date +%s)
cp ${PG_CONF_DIR}/pg_hba.conf ${PG_CONF_DIR}/pg_hba.conf.backup.$(date +%s)
echo "✓ Backups created"

# Configure PostgreSQL to listen on all interfaces
echo ""
echo "🔧 Configuring PostgreSQL for remote access..."
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" ${PG_CONF_DIR}/postgresql.conf
sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/" ${PG_CONF_DIR}/postgresql.conf

# Add entry if it doesn't exist
if ! grep -q "listen_addresses = '*'" ${PG_CONF_DIR}/postgresql.conf; then
    echo "listen_addresses = '*'" >> ${PG_CONF_DIR}/postgresql.conf
fi
echo "✓ PostgreSQL listening on all interfaces"

# Configure client authentication for FiLine Wall Pi
echo ""
echo "🔐 Configuring client authentication..."

# Get FiLine Wall Pi IP (you can modify this)
FILINE_IP="10.0.0.0/24"  # Allows entire subnet
echo "   Allowing connections from: $FILINE_IP"

# Add authentication rule for FiLine Wall
cat >> ${PG_CONF_DIR}/pg_hba.conf << EOF

# FiLine Wall Remote Access
host    filine_wall     postgres        ${FILINE_IP}          md5
host    all             postgres        ${FILINE_IP}          md5
EOF
echo "✓ Authentication configured"

# Performance tuning for remote access
echo ""
echo "⚡ Applying performance optimizations..."
cat >> ${PG_CONF_DIR}/postgresql.conf << 'EOF'

# FiLine Wall - Remote Access Optimizations
max_connections = 50
shared_buffers = 512MB
effective_cache_size = 2GB
maintenance_work_mem = 128MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 8MB
min_wal_size = 1GB
max_wal_size = 4GB
EOF
echo "✓ Performance settings applied"

# Restart PostgreSQL
echo ""
echo "🔄 Restarting PostgreSQL..."
systemctl restart postgresql
sleep 3

# Verify PostgreSQL is running
if systemctl is-active --quiet postgresql; then
    echo "✓ PostgreSQL restarted successfully"
else
    echo "❌ PostgreSQL failed to start!"
    echo "   Check logs: sudo journalctl -u postgresql -n 50"
    exit 1
fi

# Test connection
echo ""
echo "🧪 Testing database connection..."
if sudo -u postgres psql -d filine_wall -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ Database connection successful"
else
    echo "❌ Database connection failed"
    exit 1
fi

# Show listening status
echo ""
echo "📡 PostgreSQL Network Status:"
ss -tulpn | grep 5432 || netstat -tulpn | grep 5432

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║         Configuration Complete! ✅         ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "PostgreSQL is now configured for remote access"
echo ""
echo "Server IP: $(hostname -I | awk '{print $1}')"
echo "Database: filine_wall"
echo "Port: 5432"
echo "User: postgres"
echo "Allowed from: ${FILINE_IP}"
echo ""
echo "Test connection from FiLine Wall Pi:"
echo "  psql -h 10.0.0.97 -U postgres -d filine_wall"
echo ""
echo "If connection fails, check firewall:"
echo "  sudo ufw allow 5432/tcp"
echo "  sudo ufw status"
echo ""
