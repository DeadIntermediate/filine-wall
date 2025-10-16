# FiLine Wall Deployment Guide

This guide covers different deployment options for the FiLine Wall web interface.

## 🏗️ Deployment Options

### Option 1: Express Only (Simplest)
**Best for:** Development, small deployments, proof of concept

```bash
# Build the application
npm run build

# Start in production mode
npm start
```

**Pros:**
- Simple setup
- Single service to manage
- Quick to deploy

**Cons:**
- Less efficient static file serving
- Limited scalability
- No advanced caching

### Option 2: Nginx + Express (Recommended)
**Best for:** Production deployments, better performance

#### Prerequisites
- Ubuntu/Debian: `sudo apt install nginx`
- CentOS/RHEL: `sudo yum install nginx`
- macOS: `brew install nginx`

#### Setup Steps

1. **Build the application:**
```bash
npm run build
```

2. **Copy nginx configuration:**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/filinewall
sudo ln -s /etc/nginx/sites-available/filinewall /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
```

3. **Update nginx.conf paths:**
```bash
# Edit the nginx.conf file to match your paths
sudo nano /etc/nginx/sites-available/filinewall

# Update these lines:
# root /var/www/filinewall/dist/public;  # Your build output
# ssl_certificate /path/to/your/certificate.pem;
# ssl_certificate_key /path/to/your/private-key.pem;
```

4. **Copy static files:**
```bash
sudo mkdir -p /var/www/filinewall
sudo cp -r dist/public/* /var/www/filinewall/dist/public/
sudo chown -R www-data:www-data /var/www/filinewall
```

5. **Start services:**
```bash
# Test nginx configuration
sudo nginx -t

# Start nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Start the API server (in background)
NODE_ENV=production node dist/index.js &
```

### Option 3: Docker (Most Flexible)
**Best for:** Containerized deployments, cloud platforms

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t filinewall .
docker run -p 80:80 -p 443:443 filinewall
```

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
nano .env
```

**Required variables:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/filinewall
JWT_SECRET=your-super-secure-secret-key-here
```

### SSL/TLS Setup (Production)

#### Option 1: Let's Encrypt (Free)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Option 2: Custom Certificate
```bash
# Place your certificates
sudo cp your-certificate.pem /etc/ssl/certs/filinewall.pem
sudo cp your-private-key.pem /etc/ssl/private/filinewall.key

# Update nginx.conf paths
ssl_certificate /etc/ssl/certs/filinewall.pem;
ssl_certificate_key /etc/ssl/private/filinewall.key;
```

## 🚀 Systemd Service (Linux)

Create a systemd service for automatic startup:

```bash
sudo nano /etc/systemd/system/filinewall.service
```

```ini
[Unit]
Description=FiLine Wall API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/filinewall
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=filinewall

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable filinewall
sudo systemctl start filinewall

# Check status
sudo systemctl status filinewall
```

## 📊 Monitoring

### Health Checks
```bash
# Check if services are running
curl http://localhost/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-10-15T...",
  "services": {
    "database": "healthy",
    "api": "healthy"
  }
}
```

### Log Monitoring
```bash
# Nginx logs
sudo tail -f /var/log/nginx/filinewall_access.log
sudo tail -f /var/log/nginx/filinewall_error.log

# Application logs
sudo journalctl -u filinewall -f

# Or if using PM2
pm2 logs filinewall
```

## 🔄 Reverse Proxy Alternatives

### Apache (Alternative to Nginx)
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    Redirect permanent / https://your-domain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName your-domain.com
    
    SSLEngine on
    SSLCertificateFile /path/to/certificate.pem
    SSLCertificateKeyFile /path/to/private-key.pem
    
    DocumentRoot /var/www/filinewall/dist/public
    
    ProxyPreserveHost On
    ProxyPass /api/ http://localhost:5000/api/
    ProxyPassReverse /api/ http://localhost:5000/api/
    ProxyPass /health http://localhost:5000/health
    ProxyPassReverse /health http://localhost:5000/health
</VirtualHost>
```

### Caddy (Automatic HTTPS)
```caddyfile
your-domain.com {
    root * /var/www/filinewall/dist/public
    file_server
    
    handle /api/* {
        reverse_proxy localhost:5000
    }
    
    handle /health {
        reverse_proxy localhost:5000
    }
}
```

## 🛡️ Security Considerations

1. **Firewall Setup:**
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 5000  # API (only if needed directly)
sudo ufw enable
```

2. **Regular Updates:**
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Update Node.js dependencies
npm audit fix
```

3. **Database Security:**
- Use strong passwords
- Enable SSL for database connections
- Regular backups

## 📝 Summary

**For development:** Use Express only (`npm run dev`)
**For production:** Use Nginx + Express or Docker
**For cloud deployment:** Use Docker with container orchestration

The nginx setup provides better performance, security, and scalability, making it the recommended choice for production deployments.