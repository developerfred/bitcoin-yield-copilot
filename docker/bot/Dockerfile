# Bitcoin Yield Copilot - Secure Dockerfile
# Uses multi-stage build with minimal attack surface

# ===========================================
# STAGE 1: Builder
# ===========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for building
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY scripts ./scripts
COPY contracts ./contracts

# Build TypeScript
RUN npm run build

# ===========================================
# STAGE 2: Production
# ===========================================
FROM node:20-alpine AS production

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder /app/contracts ./contracts

# Create directory for data with proper permissions
RUN mkdir -p /app/data /app/logs && \
    chown -R nodejs:nodejs /app

# Set environment variables for security
ENV NODE_ENV=production
ENV SKIP_CONFIG_VALIDATION=false

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start command (override with docker-compose)
CMD ["node", "dist/index.js"]
