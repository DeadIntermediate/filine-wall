#!/bin/bash
# Standalone PostgreSQL Configuration for FiLine Wall
# Copy this single file to your PostgreSQL Raspberry Pi (10.0.0.97) and run it
# No need to install FiLine Wall on this server

set -e

echo "╔════════════════════════════════════════════╗"
echo "║  PostgreSQL Remote Access Configuration   ║"
echo "║        FiLine Wall Database Server         ║"
echo "╚════════════════════════════════════════════╝"
echo ""

if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root: sudo bash filine-postgres-setup.sh"
  exit 1
fi

# Detect PostgreSQL version
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed!"
    echo ""
    read -p "Install PostgreSQL now? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Installing PostgreSQL..."
        apt-get update -qq
        apt-get install -y postgresql postgresql-contrib
        systemctl enable postgresql
        systemctl start postgresql
        echo "✓ PostgreSQL installed"
    else
        exit 1
    fi
fi

PG_VERSION=$(sudo -u postgres psql --version | grep -oP '\d+' | head -1)
PG_CONF_DIR="/etc/postgresql/${PG_VERSION}/main"

echo "📦 PostgreSQL Version: $PG_VERSION"
echo "📁 Config Directory: $PG_CONF_DIR"
echo "🌐 Server IP: $(hostname -I | awk '{print $1}')"
echo ""

# Set PostgreSQL password (optional but recommended)
read -p "Set password for PostgreSQL user 'postgres'? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Enter new password for PostgreSQL user 'postgres':"
    sudo -u postgres psql -c "\password postgres"
fi

# Create FiLine Wall database
echo ""
echo "🗄️  Creating filine_wall database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'filine_wall'" | grep -q 1 || \
sudo -u postgres psql -c "CREATE DATABASE filine_wall;"
echo "✓ Database created/exists"

# Create/update postgresql user with password
echo ""
echo "👤 Setting up postgresql user..."
sudo -u postgres psql -c "DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'postgresql') THEN
    CREATE USER postgresql WITH PASSWORD '12345678';
  ELSE
    ALTER USER postgresql WITH PASSWORD '12345678';
  END IF;
END
\$\$;"
echo "✓ User 'postgresql' configured with password"

# Grant privileges to postgresql user
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE filine_wall TO postgresql;"
sudo -u postgres psql -d filine_wall -c "GRANT ALL ON SCHEMA public TO postgresql;"
echo "✓ Privileges granted to postgresql user"

# Backup existing config
echo ""
echo "📋 Backing up existing configuration..."
cp ${PG_CONF_DIR}/postgresql.conf ${PG_CONF_DIR}/postgresql.conf.backup.$(date +%s)
cp ${PG_CONF_DIR}/pg_hba.conf ${PG_CONF_DIR}/pg_hba.conf.backup.$(date +%s)
echo "✓ Backups created"

# Configure PostgreSQL to listen on all interfaces
echo ""
echo "🔧 Configuring PostgreSQL for remote access..."

# Update listen_addresses
if grep -q "^listen_addresses" ${PG_CONF_DIR}/postgresql.conf; then
    sed -i "s/^listen_addresses.*/listen_addresses = '*'/" ${PG_CONF_DIR}/postgresql.conf
else
    sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" ${PG_CONF_DIR}/postgresql.conf
fi

# Verify it's set
if ! grep -q "^listen_addresses = '\*'" ${PG_CONF_DIR}/postgresql.conf; then
    echo "listen_addresses = '*'" >> ${PG_CONF_DIR}/postgresql.conf
fi
echo "✓ PostgreSQL listening on all interfaces (0.0.0.0)"

# Configure client authentication for FiLine Wall Pi
echo ""
echo "🔐 Configuring client authentication..."

# Get network range
NETWORK_IP=$(hostname -I | awk '{print $1}' | cut -d'.' -f1-3)
FILINE_SUBNET="${NETWORK_IP}.0/24"

echo "   Allowing connections from: $FILINE_SUBNET"

# Check if rule already exists
if ! grep -q "# FiLine Wall Remote Access" ${PG_CONF_DIR}/pg_hba.conf; then
    cat >> ${PG_CONF_DIR}/pg_hba.conf << EOF

# FiLine Wall Remote Access
host    filine_wall     postgresql      ${FILINE_SUBNET}          md5
host    all             postgresql      ${FILINE_SUBNET}          md5
EOF
    echo "✓ Authentication rules added"
else
    echo "✓ Authentication rules already exist"
fi

# Performance tuning
echo ""
echo "⚡ Applying performance optimizations..."

if ! grep -q "# FiLine Wall - Remote Access Optimizations" ${PG_CONF_DIR}/postgresql.conf; then
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
else
    echo "✓ Performance settings already applied"
fi

# Configure firewall if UFW is active
echo ""
echo "🔥 Checking firewall..."
if command -v ufw &> /dev/null && ufw status | grep -q "active"; then
    echo "   UFW is active, opening PostgreSQL port..."
    ufw allow 5432/tcp
    echo "✓ Port 5432 opened in firewall"
else
    echo "   No active firewall detected (UFW not active)"
fi

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

# Test local connection
echo ""
echo "🧪 Testing database connection..."
if sudo -u postgres psql -d filine_wall -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ Local database connection successful"
else
    echo "❌ Local database connection failed"
    exit 1
fi

# Show listening status
echo ""
echo "📡 PostgreSQL Network Status:"
ss -tulpn | grep 5432 2>/dev/null || netstat -tulpn | grep 5432 2>/dev/null || echo "   Could not determine listening status"

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║         Configuration Complete! ✅         ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "📊 Database Server Details:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Server IP:       $(hostname -I | awk '{print $1}')"
echo "  Database Name:   filine_wall"
echo "  Port:            5432"
echo "  User:            postgresql"
echo "  Password:        12345678"
echo "  Allowed From:    ${FILINE_SUBNET}"
echo ""
echo "🔧 Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. On FiLine Wall Pi, update .env:"
echo "   DATABASE_URL=postgresql://postgresql:12345678@$(hostname -I | awk '{print $1}'):5432/filine_wall"
echo ""
echo "2. Test connection from FiLine Wall Pi:"
echo "   psql -h $(hostname -I | awk '{print $1}') -U postgresql -d filine_wall"
echo ""
echo "3. Initialize database schema:"
echo "   npm run db:push"
echo ""
echo "📝 Configuration files backed up with timestamp"
echo "   Restore if needed from: ${PG_CONF_DIR}/*.backup.*"
echo ""
