#!/bin/bash

# FiLine Wall PostgreSQL Setup Script for Raspberry Pi
# This script sets up and optimizes PostgreSQL for FiLine Wall

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="${DB_NAME:-filinewall}"
DB_USER="${DB_USER:-filinewall}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32)}"
PG_VERSION="15"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FiLine Wall PostgreSQL Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running on Raspberry Pi
if [ -f /proc/device-tree/model ]; then
    echo -e "${GREEN}✓${NC} Detected: $(cat /proc/device-tree/model)"
else
    echo -e "${YELLOW}⚠${NC} Warning: Not running on Raspberry Pi, continuing anyway..."
fi

# Check available RAM
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
echo -e "${GREEN}✓${NC} Available RAM: ${TOTAL_RAM}MB"

if [ "$TOTAL_RAM" -lt 2048 ]; then
    echo -e "${YELLOW}⚠${NC} Warning: Less than 2GB RAM detected. PostgreSQL will use conservative settings."
    SHARED_BUFFERS="128MB"
    EFFECTIVE_CACHE="512MB"
else
    SHARED_BUFFERS="256MB"
    EFFECTIVE_CACHE="1GB"
fi

# Install PostgreSQL
echo ""
echo -e "${BLUE}Installing PostgreSQL ${PG_VERSION}...${NC}"

sudo apt update
sudo apt install -y postgresql-${PG_VERSION} postgresql-contrib-${PG_VERSION} postgresql-client-${PG_VERSION}

# Start PostgreSQL
echo -e "${GREEN}✓${NC} Starting PostgreSQL service..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Wait for PostgreSQL to be ready
echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
    if sudo -u postgres psql -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} PostgreSQL is ready!"
        break
    fi
    echo -n "."
    sleep 1
done

# Create database and user
echo ""
echo -e "${BLUE}Creating database and user...${NC}"

sudo -u postgres psql << EOF
-- Drop existing database/user if they exist (for clean reinstall)
DROP DATABASE IF EXISTS ${DB_NAME};
DROP USER IF EXISTS ${DB_USER};

-- Create user
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';

-- Create database
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER USER ${DB_USER} CREATEDB;

\c ${DB_NAME}

-- Install extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};

EOF

echo -e "${GREEN}✓${NC} Database '${DB_NAME}' created"
echo -e "${GREEN}✓${NC} User '${DB_USER}' created"
echo -e "${GREEN}✓${NC} Extensions installed: pg_trgm, btree_gin, pg_stat_statements"

# Optimize PostgreSQL configuration
echo ""
echo -e "${BLUE}Optimizing PostgreSQL configuration for Raspberry Pi...${NC}"

PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

# Backup original config
sudo cp ${PG_CONF} ${PG_CONF}.backup
sudo cp ${PG_HBA} ${PG_HBA}.backup

# Update postgresql.conf
sudo tee -a ${PG_CONF} > /dev/null << EOF

# ============================================
# FiLine Wall Optimizations
# ============================================

# Memory settings (optimized for Raspberry Pi)
shared_buffers = ${SHARED_BUFFERS}
effective_cache_size = ${EFFECTIVE_CACHE}
maintenance_work_mem = 64MB
work_mem = 4MB

# Checkpoint and WAL settings
wal_buffers = 16MB
checkpoint_completion_target = 0.9
min_wal_size = 1GB
max_wal_size = 4GB

# Query planner
default_statistics_target = 100
random_page_cost = 1.1        # SSD optimization
effective_io_concurrency = 200 # SSD optimization

# Connection settings
max_connections = 50
superuser_reserved_connections = 3

# Logging
log_min_duration_statement = 1000  # Log queries slower than 1 second
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# Performance monitoring
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000

# Autovacuum (keep database clean)
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min

EOF

echo -e "${GREEN}✓${NC} PostgreSQL configuration optimized"

# Update pg_hba.conf for local connections
sudo sed -i "s/local   all             all                                     peer/local   all             all                                     md5/" ${PG_HBA}

echo -e "${GREEN}✓${NC} Authentication configured (md5)"

# Restart PostgreSQL to apply changes
echo ""
echo -e "${BLUE}Restarting PostgreSQL...${NC}"
sudo systemctl restart postgresql

sleep 3

# Verify configuration
echo ""
echo -e "${BLUE}Verifying installation...${NC}"

if sudo -u postgres psql -d ${DB_NAME} -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Database connection successful"
else
    echo -e "${RED}✗${NC} Database connection failed"
    exit 1
fi

# Run optimization script if it exists
if [ -f "db/optimize.sql" ]; then
    echo ""
    echo -e "${BLUE}Running database optimization script...${NC}"
    sudo -u postgres psql -d ${DB_NAME} -f db/optimize.sql
    echo -e "${GREEN}✓${NC} Database optimizations applied"
fi

# Set up automated backups
echo ""
echo -e "${BLUE}Setting up automated backups...${NC}"

BACKUP_DIR="/var/backups/filinewall"
sudo mkdir -p ${BACKUP_DIR}
sudo chown postgres:postgres ${BACKUP_DIR}

sudo tee /usr/local/bin/backup-filinewall.sh > /dev/null << 'BACKUP_SCRIPT'
#!/bin/bash
BACKUP_DIR="/var/backups/filinewall"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="filinewall"

# Create backup
pg_dump -U postgres ${DB_NAME} | gzip > "${BACKUP_DIR}/filinewall_${DATE}.sql.gz"

# Keep only last 30 days
find "${BACKUP_DIR}" -name "filinewall_*.sql.gz" -mtime +30 -delete

# Log success
if [ $? -eq 0 ]; then
    echo "$(date): Backup successful - filinewall_${DATE}.sql.gz" >> "${BACKUP_DIR}/backup.log"
else
    echo "$(date): Backup FAILED!" >> "${BACKUP_DIR}/backup.log"
    exit 1
fi
BACKUP_SCRIPT

sudo chmod +x /usr/local/bin/backup-filinewall.sh

# Add to cron (daily at 2 AM)
(sudo crontab -u postgres -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-filinewall.sh") | sudo crontab -u postgres -

echo -e "${GREEN}✓${NC} Automated daily backups configured (2 AM)"

# Create .env file
echo ""
echo -e "${BLUE}Creating .env configuration...${NC}"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

if [ ! -f .env ]; then
    cp .env.example .env
fi

# Update or add DATABASE_URL in .env
if grep -q "^DATABASE_URL=" .env; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${DATABASE_URL}|" .env
else
    echo "DATABASE_URL=${DATABASE_URL}" >> .env
fi

echo -e "${GREEN}✓${NC} .env file updated with database connection"

# Display connection info
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}PostgreSQL Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Database Information:${NC}"
echo -e "  Database: ${DB_NAME}"
echo -e "  User: ${DB_USER}"
echo -e "  Password: ${DB_PASSWORD}"
echo -e "  Connection URL: ${DATABASE_URL}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo -e "  RAM allocated: ${SHARED_BUFFERS} (shared_buffers)"
echo -e "  Cache size: ${EFFECTIVE_CACHE}"
echo -e "  Max connections: 50"
echo ""
echo -e "${BLUE}Features Installed:${NC}"
echo -e "  ✓ pg_trgm (fuzzy search)"
echo -e "  ✓ btree_gin (JSONB indexing)"
echo -e "  ✓ pg_stat_statements (query monitoring)"
echo ""
echo -e "${BLUE}Backup Configuration:${NC}"
echo -e "  ✓ Daily backups at 2 AM"
echo -e "  ✓ Backup location: ${BACKUP_DIR}"
echo -e "  ✓ Retention: 30 days"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} Save your database password securely!"
echo -e "${YELLOW}Password:${NC} ${DB_PASSWORD}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Run database migrations:"
echo "     npm run db:push"
echo ""
echo "  2. Start FiLine Wall:"
echo "     npm start"
echo ""
echo "  3. Monitor database performance:"
echo "     sudo -u postgres psql -d ${DB_NAME} -c 'SELECT * FROM slow_queries;'"
echo ""
echo "  4. Check database size:"
echo "     sudo -u postgres psql -d ${DB_NAME} -c 'SELECT * FROM table_sizes;'"
echo ""
echo -e "${GREEN}Setup complete! 🎉${NC}"
