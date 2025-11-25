# Quick Fix for Missing .env

If you get the error "DATABASE_URL must be set", run these commands:

```bash
cd ~/filine-wall
git pull origin main
./start-filine.sh
```

The updated `start-filine.sh` script will now automatically create the `.env` file if it's missing!

Alternatively, you can manually create the .env file:

```bash
cd ~/filine-wall

cat > .env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/filine_wall
NODE_ENV=development
HOST=0.0.0.0
PORT=5000
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
MODEM_ENABLED=false
MODEM_PATH=/dev/ttyUSB0
MODEM_BAUD_RATE=115200
ENABLE_ML_DETECTION=true
ENABLE_VOICE_ANALYSIS=false
ENABLE_HONEYPOT=false
LOG_LEVEL=info
LOG_FILE=logs/filine-wall.log
EOF

./start-filine.sh
```
