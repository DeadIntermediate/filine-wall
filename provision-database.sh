#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  FiLine Wall - Database Provisioning${NC}"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed!${NC}"
    echo -e "${YELLOW}Installing PostgreSQL...${NC}"
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
    
    # Start PostgreSQL - try version-specific service first
    POSTGRES_VERSION=$(psql --version 2>/dev/null | grep -oP '\d+' | head -1)
    sudo systemctl start postgresql@${POSTGRES_VERSION}-main 2>/dev/null || \
    sudo systemctl start postgresql 2>/dev/null || true
    sudo systemctl enable postgresql 2>/dev/null || true
else
    # Ensure PostgreSQL is running
    POSTGRES_VERSION=$(psql --version 2>/dev/null | grep -oP '\d+' | head -1)
    if ! sudo systemctl is-active --quiet postgresql@${POSTGRES_VERSION}-main 2>/dev/null && \
       ! sudo systemctl is-active --quiet postgresql 2>/dev/null; then
        echo -e "${YELLOW}⚠️  PostgreSQL is not running. Starting it...${NC}"
        sudo systemctl start postgresql@${POSTGRES_VERSION}-main 2>/dev/null || \
        sudo systemctl start postgresql 2>/dev/null || true
    fi
fi

# Generate a secure random password
DB_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
DB_USER="filinewall"
DB_NAME="filine_wall"

echo -e "${YELLOW}📋 Database Configuration:${NC}"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo "  Password: ******* (will be saved in .env)"
echo ""

# Check if user exists
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")

if [ "$USER_EXISTS" = "1" ]; then
    echo -e "${YELLOW}⚠️  User '$DB_USER' already exists. Updating password...${NC}"
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
        echo -e "${RED}❌ Failed to update user password${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}👤 Creating database user '$DB_USER'...${NC}"
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
        echo -e "${RED}❌ Failed to create user${NC}"
        exit 1
    }
fi

# Check if database exists
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${YELLOW}⚠️  Database '$DB_NAME' already exists. Updating ownership...${NC}"
    sudo -u postgres psql -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;" 2>/dev/null || {
        echo -e "${RED}❌ Failed to update database ownership${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}🗄️  Creating database '$DB_NAME'...${NC}"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || {
        echo -e "${RED}❌ Failed to create database${NC}"
        exit 1
    }
fi

# Grant privileges
echo -e "${YELLOW}🔑 Granting privileges...${NC}"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null

echo -e "${GREEN}✅ Database provisioned successfully!${NC}"
echo ""

# Update or create .env file
if [ -f .env ]; then
    echo -e "${YELLOW}📝 Updating existing .env file...${NC}"
    # Backup existing .env
    cp .env .env.backup
    # Update DATABASE_URL
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME|" .env
    echo -e "${GREEN}✅ .env file updated (backup saved as .env.backup)${NC}"
else
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cat > .env << EOF
NODE_ENV=development
HOST=0.0.0.0
PORT=5000
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# Authentication Settings
REQUIRE_AUTH=false

# Security (auto-generated)
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Call Screening Settings
BLOCK_THRESHOLD=0.7
ADAPTIVE_LEARNING=true
ENABLE_HONEYPOT=false
ENABLE_ANALYTICS=true
METRICS_RETENTION_DAYS=90

# Logging
LOG_LEVEL=info
LOG_FILE=logs/filine-wall.log

# Modem Settings
MODEM_ENABLED=false
MODEM_PORT=/dev/ttyUSB0
MODEM_BAUD_RATE=115200
MODEM_AUTO_DETECT=true

# Feature Flags
ENABLE_VOICE_ANALYSIS=true
ENABLE_NLP_DETECTION=true
ENABLE_FEDERATED_LEARNING=false
ENABLE_IVR=true
EOF
    echo -e "${GREEN}✅ .env file created${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Database setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "  1. Run database migrations: npm run db:push"
echo "  2. Start FiLine Wall: ./start-filine.sh"
echo ""
echo -e "${GREEN}Database Info:${NC}"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Host: localhost:5432"
echo "  Password: (saved in .env file)"
