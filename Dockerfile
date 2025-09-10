# Multi-stage Dockerfile for Review Service

# =============================================================================
# BUILD STAGE
# =============================================================================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# =============================================================================
# RUNTIME STAGE
# =============================================================================
FROM node:18-alpine AS runtime

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S reviewservice -u 1001

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY --chown=reviewservice:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown reviewservice:nodejs logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3007
ENV HOST=0.0.0.0

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Expose port
EXPOSE 3007

# Switch to non-root user
USER reviewservice

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]

# =============================================================================
# DEVELOPMENT STAGE
# =============================================================================
FROM runtime AS development

# Switch back to root to install dev dependencies
USER root

# Copy development package.json (if different)
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci && npm cache clean --force

# Install development tools
RUN apk add --no-cache \
    git \
    bash \
    vim

# Switch back to non-root user
USER reviewservice

# Override command for development
CMD ["npm", "run", "dev"]

# =============================================================================
# TEST STAGE
# =============================================================================
FROM development AS test

# Copy test files and configuration
COPY --chown=reviewservice:nodejs tests/ ./tests/
COPY --chown=reviewservice:nodejs jest.config.js ./

# Set test environment
ENV NODE_ENV=test

# Run tests
CMD ["npm", "test"]

# =============================================================================
# LABELS
# =============================================================================
LABEL maintainer="AI Outlet Team <dev@aioutlet.com>"
LABEL version="1.0.0"
LABEL description="AI Outlet Review Service - Handles product reviews and ratings"
LABEL org.opencontainers.image.title="Review Service"
LABEL org.opencontainers.image.description="Microservice for managing product reviews and ratings"
LABEL org.opencontainers.image.vendor="AI Outlet"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.url="https://github.com/aioutlet/review-service"
LABEL org.opencontainers.image.documentation="https://docs.aioutlet.com/services/review"
LABEL org.opencontainers.image.source="https://github.com/aioutlet/review-service"
