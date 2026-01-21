FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/web ./apps/web

# Install all dependencies (workspace-aware)
RUN pnpm install --frozen-lockfile

FROM base AS development
WORKDIR /app/apps/web
EXPOSE 3000
# Next.js will bind to 0.0.0.0 by default in Docker
# Run pnpm dev from the web app directory
CMD ["pnpm", "run", "dev"]

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY apps/web ./apps/web
WORKDIR /app/apps/web
RUN pnpm run build

FROM node:20-alpine AS production
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/next.config.js ./apps/web/next.config.js
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "run", "start"]
