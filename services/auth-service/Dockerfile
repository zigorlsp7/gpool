# ============================================
# Base Stage
# ============================================
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

# ============================================
# Dependencies Stage
# ============================================
FROM base AS dependencies

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Development Stage
# ============================================
FROM base AS development

# Copy dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages

# Copy service-specific files (will be overridden by volume mount in docker-compose)
COPY services/auth-service ./services/auth-service

# Create entrypoint script to ensure dependencies are installed
RUN cat > /entrypoint.sh << 'EOF'
#!/bin/sh
set -e
echo "Installing dependencies..."
cd /app
pnpm install --frozen-lockfile || pnpm install
echo "Dependencies installed. Starting NestJS..."
cd /app/services/auth-service
exec "$@"
EOF
RUN chmod +x /entrypoint.sh

WORKDIR /app

# Expose port
EXPOSE 3001

ENTRYPOINT ["/entrypoint.sh"]

# Start development server with hot reload
# Use pnpm exec to find nest CLI in workspace
CMD ["pnpm", "exec", "nest", "start", "--watch"]

# ============================================
# Build Stage
# ============================================
FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY services/auth-service ./services/auth-service

WORKDIR /app/services/auth-service

# Build the application
RUN pnpm run build

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=build /app/services/auth-service/dist ./services/auth-service/dist
COPY --from=build /app/services/auth-service/package.json ./services/auth-service/package.json

WORKDIR /app/services/auth-service

# Expose port
EXPOSE 3001

# Start production server
CMD ["node", "dist/main.js"]
