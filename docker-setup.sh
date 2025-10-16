#!/bin/bash

# FiLine Wall Docker Quick Setup
# One-command installation using Docker

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║             FiLine Wall Docker               ║"
    echo "║              Quick Setup Script              ║"
    echo "║                                              ║"
    echo "║       🐳 Container-Based Installation       ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed!"
        echo ""
        echo "Please install Docker first:"
        echo "  • Linux: https://docs.docker.com/engine/install/"
        echo "  • macOS: https://docs.docker.com/desktop/mac/"
        echo "  • Windows: https://docs.docker.com/desktop/windows/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed!"
        echo ""
        echo "Please install Docker Compose:"
        echo "  https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running!"
        echo ""
        echo "Please start Docker and try again."
        exit 1
    fi
    
    log_info "Docker and Docker Compose are available"
}

# Setup environment
setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [[ ! -f .env ]]; then
        if [[ -f .env.example ]]; then
            cp .env.example .env
            log_info "Created .env from .env.example"
        else
            # Create basic .env file
            cat > .env << EOF
# Database Configuration
DATABASE_URL=postgresql://filinewall:filinewall_secure_password@postgres:5432/filinewall

# JWT Secret (generated automatically)
JWT_SECRET=$(openssl rand -base64 32)

# Redis Configuration  
REDIS_URL=redis://redis:6379

# API Configuration
NODE_ENV=production
PORT=5000

# Device Client Configuration
DEVICE_ENCRYPTION_KEY=your-device-encryption-key-here
DEVICE_API_ENDPOINT=http://api:5000

# Optional: External Service APIs
# TWILIO_ACCOUNT_SID=your_twilio_sid
# TWILIO_AUTH_TOKEN=your_twilio_token
# SPAM_API_KEY=your_spam_detection_api_key
EOF
            log_info "Created basic .env file"
        fi
    else
        log_info "Using existing .env file"
    fi
}

# Pull latest images
pull_images() {
    log_info "Pulling Docker images..."
    
    # Check if we have docker-compose.yml
    if [[ -f docker-compose.yml ]]; then
        docker-compose pull
    else
        log_warn "No docker-compose.yml found, will build from Dockerfile"
    fi
}

# Build and start containers
start_containers() {
    log_info "Building and starting containers..."
    
    if [[ -f docker-compose.yml ]]; then
        # Use docker-compose
        docker-compose up -d --build
    else
        # Fallback to manual container management
        log_info "Using manual container setup..."
        
        # Start PostgreSQL
        docker run -d \
            --name filinewall-postgres \
            --restart unless-stopped \
            -e POSTGRES_DB=filinewall \
            -e POSTGRES_USER=filinewall \
            -e POSTGRES_PASSWORD=filinewall_secure_password \
            -v filinewall_postgres_data:/var/lib/postgresql/data \
            -p 5432:5432 \
            postgres:15
        
        # Start Redis
        docker run -d \
            --name filinewall-redis \
            --restart unless-stopped \
            -v filinewall_redis_data:/data \
            -p 6379:6379 \
            redis:7-alpine
        
        # Wait for databases to be ready
        log_info "Waiting for databases to be ready..."
        sleep 10
        
        # Build and start the main application
        if [[ -f Dockerfile ]]; then
            docker build -t filinewall .
            docker run -d \
                --name filinewall-app \
                --restart unless-stopped \
                --link filinewall-postgres:postgres \
                --link filinewall-redis:redis \
                --env-file .env \
                -p 80:80 \
                -p 443:443 \
                -p 5000:5000 \
                filinewall
        else
            log_error "No Dockerfile found!"
            exit 1
        fi
    fi
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    # Wait for database
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker exec filinewall-postgres-1 2>/dev/null || docker exec filinewall-postgres 2>/dev/null; then
            if docker exec filinewall-postgres-1 pg_isready -U filinewall 2>/dev/null || \
               docker exec filinewall-postgres pg_isready -U filinewall 2>/dev/null; then
                log_info "Database is ready"
                break
            fi
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Database failed to start within expected time"
        exit 1
    fi
    
    # Wait for API
    log_info "Waiting for API to be ready..."
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:5000/health &>/dev/null || \
           curl -s http://localhost/health &>/dev/null; then
            log_info "API is ready"
            break
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_warn "API may not be fully ready, but continuing..."
    fi
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."
    
    # Check containers
    local containers=(
        "postgres"
        "redis"
        "filinewall"
    )
    
    for container in "${containers[@]}"; do
        if docker ps --format "{{.Names}}" | grep -q "$container"; then
            log_info "✓ $container container is running"
        else
            log_warn "✗ $container container not found"
        fi
    done
    
    # Check web interface
    if curl -s http://localhost &>/dev/null; then
        log_info "✓ Web interface is accessible at http://localhost"
    else
        log_warn "✗ Web interface is not accessible"
    fi
    
    # Check API
    if curl -s http://localhost:5000/health &>/dev/null; then
        log_info "✓ API is accessible at http://localhost:5000"
    elif curl -s http://localhost/api/health &>/dev/null; then
        log_info "✓ API is accessible at http://localhost/api"
    else
        log_warn "✗ API is not accessible"
    fi
}

# Show logs
show_logs() {
    echo ""
    log_info "Recent container logs:"
    echo ""
    
    if command -v docker-compose &> /dev/null; then
        docker-compose logs --tail=20
    else
        echo "=== Main Application ==="
        docker logs --tail=10 filinewall-app 2>/dev/null || echo "No logs available"
        echo ""
        echo "=== Database ==="
        docker logs --tail=5 filinewall-postgres 2>/dev/null || echo "No logs available"
    fi
}

# Show completion message
show_completion() {
    echo ""
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║         🎉 Installation Complete! 🎉        ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo "🚀 FiLine Wall is now running in Docker containers!"
    echo ""
    echo "🌐 Access your installation:"
    echo "   • Web Interface: http://localhost"
    echo "   • API Endpoint: http://localhost:5000"
    echo "   • Health Check: http://localhost:5000/health"
    echo ""
    echo "🔐 Default admin credentials:"
    echo "   • Username: admin"
    echo "   • Password: admin123"
    echo "   ⚠️  CHANGE THESE IMMEDIATELY!"
    echo ""
    echo "🛠️  Useful Docker commands:"
    echo "   • View logs: docker-compose logs -f"
    echo "   • Stop services: docker-compose down"
    echo "   • Restart: docker-compose restart"
    echo "   • Update: docker-compose pull && docker-compose up -d"
    echo ""
    echo "📁 Data persistence:"
    echo "   • Database: Docker volume 'filinewall_postgres_data'"
    echo "   • Redis: Docker volume 'filinewall_redis_data'"
    echo ""
    echo "⚙️  Next steps:"
    echo "1. Change the default admin password"
    echo "2. Configure your environment in .env file"
    echo "3. Set up your phone number lists"
    echo "4. Connect and configure your modem device"
    echo ""
    echo "📚 Documentation: README.md and DEPLOYMENT.md"
    echo "🐳 Docker docs: https://docs.docker.com/"
}

# Cleanup function
cleanup() {
    if [[ "$1" == "full" ]]; then
        log_info "Stopping and removing all containers..."
        docker-compose down -v 2>/dev/null || true
        docker stop filinewall-app filinewall-postgres filinewall-redis 2>/dev/null || true
        docker rm filinewall-app filinewall-postgres filinewall-redis 2>/dev/null || true
        docker volume rm filinewall_postgres_data filinewall_redis_data 2>/dev/null || true
        log_info "Cleanup complete"
    else
        log_info "Stopping containers..."
        docker-compose down 2>/dev/null || true
        docker stop filinewall-app filinewall-postgres filinewall-redis 2>/dev/null || true
    fi
}

# Main function
main() {
    print_header
    
    # Parse arguments
    case "${1:-}" in
        --help|-h)
            echo "FiLine Wall Docker Quick Setup"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --help, -h       Show this help"
            echo "  --logs, -l       Show container logs after setup"
            echo "  --cleanup        Stop and remove containers"
            echo "  --cleanup-full   Stop, remove containers and delete data"
            echo ""
            echo "Examples:"
            echo "  $0               # Quick setup"
            echo "  $0 --logs        # Setup and show logs"
            echo "  $0 --cleanup     # Stop containers"
            exit 0
            ;;
        --cleanup)
            cleanup
            exit 0
            ;;
        --cleanup-full)
            cleanup full
            exit 0
            ;;
        --logs|-l)
            SHOW_LOGS=true
            ;;
    esac
    
    log_info "Starting FiLine Wall Docker quick setup..."
    
    check_docker
    setup_environment
    pull_images
    start_containers
    wait_for_services
    verify_installation
    
    if [[ "$SHOW_LOGS" == "true" ]]; then
        show_logs
    fi
    
    show_completion
}

# Handle interruption
trap 'log_error "Setup interrupted!"; exit 1' INT TERM

# Run main function
main "$@"