# FiLine Wall - Raspberry Pi 5 Production Deployment

This guide is optimized for **Raspberry Pi 5** with full AI/ML capabilities enabled.

## Why Raspberry Pi 5?

- ✅ **64-bit ARM (aarch64)** - Full TensorFlow support
- ✅ **4GB+ RAM** - Handles ML models efficiently
- ✅ **Quad-core CPU** - Parallel call analysis
- ✅ **Better I/O** - Faster database operations
- ✅ **All AI features** - No compromises

## Quick Start

```bash
cd ~/filine-wall
git pull

# 1. Setup with full ML features
./setup-pi5.sh

# 2. (Optional) Performance optimization
sudo ./optimize-pi5.sh
sudo reboot

# 3. Start FiLine Wall in tmux
./start-filine.sh
```

## What's Enabled on Pi 5

### AI/ML Features (Full Power)
- ✅ **Voice Analysis** - TensorFlow-powered robocall detection
- ✅ **Advanced NLP** - Scam phrase pattern recognition
- ✅ **Reinforcement Learning** - Gets smarter with each call
- ✅ **Federated Learning** - Privacy-preserving collaborative training
- ✅ **Real-time Transcription** - Live call content analysis
- ✅ **Behavioral Analysis** - Caller pattern detection
- ✅ **Collaborative Threat Intel** - Share/receive spam signatures

### Advanced Features
- ✅ **Honeypot System** - Track scammer behavior
- ✅ **Adaptive Learning** - Auto-adjusts thresholds
- ✅ **Multi-threaded Processing** - 4 concurrent analyses
- ✅ **Performance Caching** - Fast repeated lookups
- ✅ **Advanced Analytics** - Deep call insights

## Performance Tuning

The `optimize-pi5.sh` script configures:

1. **CPU Governor** - Performance mode (max speed)
2. **PostgreSQL** - Tuned for 4GB RAM + SSD
3. **Network** - BBR congestion control
4. **Swap** - Reduced swappiness for speed
5. **File Descriptors** - Increased limits
6. **Process Priority** - Higher for call-detector

## Hardware Setup

### Required
- Raspberry Pi 5 (4GB+ RAM recommended)
- MicroSD card (32GB+ Class 10)
- USRobotics 5637 USB Modem (or compatible)
- Phone line connection

### Modem Connection
1. Connect modem to USB port
2. Modem appears at `/dev/ttyACM0`
3. Verify: `ls -l /dev/ttyACM0`
4. Test: `python3 test-modem.py`

## Running in Production

### Start Server
```bash
./start-filine.sh
```

Server runs in tmux session `filine-wall`:
- **View logs**: `tmux attach -t filine-wall`
- **Detach**: Press `Ctrl+B`, then `D`
- **Stop**: `./stop-filine.sh`

### Install Call Detector Service
```bash
cd device-client
sudo ./install-service.sh
sudo systemctl start call-detector
sudo systemctl enable call-detector  # Auto-start on boot
```

Monitor call detection:
```bash
sudo journalctl -u call-detector -f
```

## Dashboard Access

- **URL**: `http://raspberry-pi-5.local:5000`
- **Or**: `http://<pi-ip-address>:5000`
- **No login required** (local deployment mode)

## System Monitoring

### Real-time Stats
```bash
htop              # CPU, memory, processes
iotop -o          # Disk I/O
sudo iftop        # Network traffic
```

### Database Performance
```bash
sudo -u postgres psql filine_wall -c "
  SELECT schemaname, tablename, 
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
  FROM pg_tables 
  WHERE schemaname = 'public';"
```

### Call Detection Logs
```bash
# Server logs
tmux attach -t filine-wall

# Call detector logs
sudo journalctl -u call-detector -f

# Database queries
tail -f logs/filine-wall.log
```

## Performance Expectations

### Pi 5 (Production - This Setup)
- **Call Analysis**: < 100ms
- **ML Inference**: < 200ms  
- **Database Query**: < 50ms
- **Total Decision**: < 500ms
- **Concurrent Calls**: 4-6 simultaneous
- **Model Training**: Background, non-blocking

### Compare: Pi 2/3 (32-bit)
- ❌ No ML models
- ❌ Rule-based only
- ❌ ~1-2s per call
- ❌ Single threaded

## Troubleshooting

### Check System Status
```bash
./check-status.sh
```

### Verify ML Features
```bash
# Should see TensorFlow loaded
tmux attach -t filine-wall
# Look for: "✓ AI Spam Detection: Active"
# NOT: "TensorFlow not available"
```

### Modem Issues
```bash
# Test modem
python3 test-modem.py

# Check permissions
groups  # Should include 'dialout'

# Add if missing
sudo usermod -a -G dialout $USER
newgrp dialout
```

### Database Issues
```bash
# Reset database
npm run db:push

# Check connection
sudo -u postgres psql -c "\l" | grep filine_wall
```

## Auto-start on Boot

```bash
# Enable FiLine Wall service (via tmux + systemd)
sudo crontab -e

# Add this line:
@reboot sleep 30 && cd /home/pi/filine-wall && ./start-filine.sh

# Enable call-detector
sudo systemctl enable call-detector
```

## Configuration Files

- **Environment**: `.env` (created from `.env.pi5-production`)
- **Call Detector**: `/etc/call-detector/config.ini`
- **Database**: `postgresql://localhost:5432/filine_wall`
- **Logs**: `logs/filine-wall.log`

## Updating

```bash
cd ~/filine-wall
git pull
npm install
npm run db:push
./stop-filine.sh
./start-filine.sh
```

## Security Notes

This setup is configured for **local/home use only**:
- ✅ No authentication required
- ✅ Binds to all interfaces (0.0.0.0)
- ⚠️ **Do not expose to internet** without enabling auth

To enable authentication for remote access:
```bash
# Edit .env
REQUIRE_AUTH=true

# Restart
./stop-filine.sh && ./start-filine.sh
```

## Support

- **Logs**: `tmux attach -t filine-wall`
- **Status**: `./check-status.sh`
- **Issues**: Check GitHub issues

---

**Enjoy full-powered spam protection!** 🚀🛡️
