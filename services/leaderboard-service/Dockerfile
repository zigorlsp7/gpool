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
COPY services/leaderboard-service ./services/leaderboard-service
WORKDIR /app/services/leaderboard-service
EXPOSE 3007
CMD ["pnpm", "run", "start:dev"]
FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY services/leaderboard-service ./services/leaderboard-service
WORKDIR /app/services/leaderboard-service
RUN pnpm run build
FROM node:20-alpine AS production
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/services/leaderboard-service/dist ./services/leaderboard-service/dist
COPY --from=build /app/services/leaderboard-service/package.json ./services/leaderboard-service/package.json
WORKDIR /app/services/leaderboard-service
EXPOSE 3007
CMD ["node", "dist/main.js"]
