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

# Copy service-specific files
COPY services/auth-service ./services/auth-service

WORKDIR /app/services/auth-service

# Expose port
EXPOSE 3001

# Start development server with hot reload
CMD ["pnpm", "run", "start:dev"]

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
