FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
FROM base AS dependencies
RUN pnpm install --frozen-lockfile
FROM base AS development
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY services/websocket-service ./services/websocket-service
WORKDIR /app/services/websocket-service
EXPOSE 3009
CMD ["pnpm", "run", "start:dev"]
FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY services/websocket-service ./services/websocket-service
WORKDIR /app/services/websocket-service
RUN pnpm run build
FROM node:20-alpine AS production
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/services/websocket-service/dist ./services/websocket-service/dist
COPY --from=build /app/services/websocket-service/package.json ./services/websocket-service/package.json
WORKDIR /app/services/websocket-service
EXPOSE 3009
CMD ["node", "dist/main.js"]
