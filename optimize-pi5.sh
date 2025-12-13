#!/bin/bash
# Raspberry Pi 5 Performance Optimization for FiLine Wall
# Tunes system settings for optimal AI/ML performance

set -e

echo "╔════════════════════════════════════════════╗"
echo "║  FiLine Wall - Pi 5 Performance Tuning    ║"
echo "╚════════════════════════════════════════════╝"
echo ""

if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root: sudo ./optimize-pi5.sh"
  exit 1
fi

# CPU Governor - Performance mode
echo "⚡ Setting CPU governor to performance mode..."
echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null
echo "✓ CPU governor set to performance"

# Increase file descriptor limits for database connections
echo "📁 Increasing file descriptor limits..."
cat >> /etc/security/limits.conf << EOF

# FiLine Wall - Increased limits for database and concurrent connections
*    soft nofile 65536
*    hard nofile 65536
root soft nofile 65536
root hard nofile 65536
EOF
echo "✓ File descriptor limits increased"

# PostgreSQL tuning for Pi 5
echo "🗄️  Optimizing PostgreSQL for Pi 5..."
PG_CONF="/etc/postgresql/*/main/postgresql.conf"

if [ -f $PG_CONF ]; then
    # Backup original config
    cp $PG_CONF ${PG_CONF}.backup.$(date +%s)
    
    # Tune for Pi 5 (4GB RAM typical)
    cat >> $PG_CONF << EOF

# FiLine Wall - Pi 5 Optimizations
shared_buffers = 512MB              # 1/4 of RAM
effective_cache_size = 2GB          # 1/2 of RAM
maintenance_work_mem = 128MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1              # SSD/SD optimized
effective_io_concurrency = 200
work_mem = 8MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
EOF
    
    echo "✓ PostgreSQL optimized"
    systemctl restart postgresql
    echo "✓ PostgreSQL restarted"
else
    echo "⚠️  PostgreSQL config not found, skipping DB optimization"
fi

# Swap configuration (reduce swappiness for better performance)
echo "💾 Optimizing swap usage..."
echo "vm.swappiness=10" >> /etc/sysctl.conf
sysctl -w vm.swappiness=10 > /dev/null
echo "✓ Swap optimized (reduced swappiness to 10)"

# Network optimization for API calls
echo "🌐 Optimizing network settings..."
cat >> /etc/sysctl.conf << EOF

# FiLine Wall - Network optimizations
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_congestion_control = bbr
EOF
sysctl -p > /dev/null 2>&1
echo "✓ Network settings optimized"

# Create systemd service override for better process management
echo "⚙️  Creating systemd optimizations..."
mkdir -p /etc/systemd/system/call-detector.service.d
cat > /etc/systemd/system/call-detector.service.d/override.conf << EOF
[Service]
# CPU and memory optimizations
CPUWeight=200
MemoryHigh=512M
MemoryMax=1G
Nice=-5
IOWeight=200

# Faster restart on failure
RestartSec=3s

# Allow core dumps for debugging
LimitCORE=infinity
EOF

systemctl daemon-reload
echo "✓ Systemd optimizations applied"

# Install performance monitoring tools
echo "📊 Installing monitoring tools..."
apt-get update -qq
apt-get install -y htop iotop sysstat > /dev/null 2>&1
echo "✓ Monitoring tools installed (htop, iotop, sysstat)"

# Enable persistent performance mode (survives reboot)
echo "🔧 Making performance settings persistent..."
cat > /etc/rc.local << 'EOF'
#!/bin/bash
# FiLine Wall - Performance settings on boot
echo performance | tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor > /dev/null
exit 0
EOF
chmod +x /etc/rc.local
echo "✓ Performance mode will persist across reboots"

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║      Optimization Complete! ✅             ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Applied optimizations:"
echo "  ✅ CPU governor: performance mode"
echo "  ✅ File descriptors: 65,536"
echo "  ✅ PostgreSQL: tuned for 4GB RAM + SSD"
echo "  ✅ Swap: reduced swappiness (10)"
echo "  ✅ Network: BBR congestion control"
echo "  ✅ Systemd: higher priority for call-detector"
echo "  ✅ Monitoring: htop, iotop, sysstat installed"
echo ""
echo "Performance will persist across reboots"
echo ""
echo "Recommended: Reboot to apply all settings"
echo "  sudo reboot"
echo ""
