#!/bin/bash

# Upgrade PostgreSQL from 15 to 17 on Debian/Raspberry Pi

set -e

echo "🔧 PostgreSQL Upgrade Script (15 → 17)"
echo "========================================"
echo ""

# Backup existing database
echo "📦 Step 1: Backing up existing database..."
sudo -u postgres pg_dump filine_wall > ~/filine_wall_backup.sql
echo "✅ Backup saved to ~/filine_wall_backup.sql"
echo ""

# Add PostgreSQL 17 repository
echo "📥 Step 2: Adding PostgreSQL 17 repository..."
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update

echo ""
echo "📦 Step 3: Installing PostgreSQL 17..."
sudo apt install -y postgresql-17 postgresql-contrib-17

echo ""
echo "🔄 Step 4: Stopping services..."
sudo systemctl stop postgresql

echo ""
echo "📊 Step 5: Migrating data from version 15 to 17..."
sudo -u postgres /usr/lib/postgresql/17/bin/pg_upgrade \
  -b /usr/lib/postgresql/15/bin \
  -B /usr/lib/postgresql/17/bin \
  -d /var/lib/postgresql/15/main \
  -D /var/lib/postgresql/17/main \
  -o '-c config_file=/etc/postgresql/15/main/postgresql.conf' \
  -O '-c config_file=/etc/postgresql/17/main/postgresql.conf'

echo ""
echo "🚀 Step 6: Starting PostgreSQL 17..."
sudo systemctl start postgresql@17-main
sudo systemctl enable postgresql@17-main

echo ""
echo "🧹 Step 7: Setting PostgreSQL 17 as default..."
sudo update-alternatives --install /usr/bin/psql psql /usr/lib/postgresql/17/bin/psql 100

echo ""
echo "✅ PostgreSQL upgraded to version 17!"
echo ""
echo "To verify:"
echo "  sudo -u postgres psql -c 'SELECT version();'"
echo ""
echo "To remove old PostgreSQL 15:"
echo "  sudo apt remove postgresql-15 postgresql-contrib-15"
echo "  sudo rm -rf /var/lib/postgresql/15"
