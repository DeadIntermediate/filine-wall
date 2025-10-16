# Multi-stage build for FiLine Wall
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

# Install Node.js for the API server
RUN apk add --no-cache nodejs npm

# Copy built frontend files
COPY --from=builder /app/dist/public /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy API server files
COPY --from=builder /app/dist /app
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app

# Create application user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S filinewall -u 1001

# Set permissions
RUN chown -R filinewall:nodejs /app

# Expose ports
EXPOSE 80 443 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

USER filinewall

ENTRYPOINT ["/docker-entrypoint.sh"]