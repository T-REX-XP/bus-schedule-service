# Multi-stage build for EMT Valencia Bus Schedule API
# Stage 1: Builder - Install dependencies
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies needed for wrangler
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for wrangler)
RUN npm ci

# Stage 2: Runtime - Minimal runtime image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install runtime dependencies for wrangler
RUN apk add --no-cache python3

# Create non-root user for security
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY package*.json ./
COPY src ./src
COPY wrangler.toml ./

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:8787/').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Run the application with wrangler dev
CMD ["npx", "wrangler", "dev", "--port", "8787", "--ip", "0.0.0.0"]
