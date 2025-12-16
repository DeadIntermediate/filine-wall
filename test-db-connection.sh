#!/bin/bash
# Test connection to remote PostgreSQL server

echo "╔════════════════════════════════════════════╗"
echo "║   PostgreSQL Connection Test               ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Extract database connection details from .env
if [ -f .env ]; then
    DB_URL=$(grep DATABASE_URL .env | cut -d'=' -f2)
    DB_HOST=$(echo $DB_URL | cut -d'@' -f2 | cut -d':' -f1)
    DB_PORT=$(echo $DB_URL | cut -d':' -f4 | cut -d'/' -f1)
    DB_NAME=$(echo $DB_URL | cut -d'/' -f4)
    DB_USER=$(echo $DB_URL | cut -d'/' -f3 | cut -d':' -f1)
    
    echo "Database Configuration:"
    echo "  Host: $DB_HOST"
    echo "  Port: ${DB_PORT:-5432}"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo ""
else
    echo "❌ .env file not found"
    exit 1
fi

# Test network connectivity
echo "🌐 Testing network connectivity..."
if ping -c 1 -W 2 $DB_HOST > /dev/null 2>&1; then
    echo "✓ Host $DB_HOST is reachable"
else
    echo "❌ Cannot reach host $DB_HOST"
    echo "   Check network connection and IP address"
    exit 1
fi

# Test PostgreSQL port
echo ""
echo "🔌 Testing PostgreSQL port..."
if timeout 2 bash -c "cat < /dev/null > /dev/tcp/$DB_HOST/${DB_PORT:-5432}" 2>/dev/null; then
    echo "✓ Port ${DB_PORT:-5432} is open on $DB_HOST"
else
    echo "❌ Cannot connect to port ${DB_PORT:-5432} on $DB_HOST"
    echo "   Possible issues:"
    echo "   1. PostgreSQL not running: sudo systemctl status postgresql"
    echo "   2. PostgreSQL not listening on network: check listen_addresses"
    echo "   3. Firewall blocking: sudo ufw allow 5432/tcp"
    exit 1
fi

# Test database connection (requires postgresql-client)
echo ""
echo "🗄️  Testing database connection..."

if command -v psql &> /dev/null; then
    # Extract password (if in URL)
    DB_PASS=$(echo $DB_URL | grep -oP '://.*?:\K[^@]+')
    
    if [ -n "$DB_PASS" ]; then
        export PGPASSWORD="$DB_PASS"
    fi
    
    if psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
        echo "✓ Successfully connected to database"
        echo ""
        echo "📊 Database Info:"
        psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME -c "
            SELECT 
                version() as postgres_version,
                current_database() as database,
                current_user as user;
        " 2>/dev/null | head -10
        
        echo ""
        echo "📋 Checking FiLine Wall tables..."
        TABLE_COUNT=$(psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME -t -c "
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        " 2>/dev/null | xargs)
        
        echo "   Tables found: ${TABLE_COUNT:-0}"
        
        if [ "${TABLE_COUNT:-0}" -lt 5 ]; then
            echo ""
            echo "⚠️  Database exists but tables not initialized"
            echo "   Run: npm run db:push"
        fi
    else
        echo "❌ Failed to connect to database"
        echo "   Possible issues:"
        echo "   1. Wrong password in DATABASE_URL"
        echo "   2. User doesn't have permissions"
        echo "   3. pg_hba.conf not configured for remote access"
        exit 1
    fi
    
    unset PGPASSWORD
else
    echo "⚠️  psql client not installed, skipping database test"
    echo "   Install: sudo apt install postgresql-client"
    echo ""
    echo "✓ Network connectivity OK - database likely accessible"
fi

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║        Connection Test Passed! ✅          ║"
echo "╚════════════════════════════════════════════╝"
echo ""
