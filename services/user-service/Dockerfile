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
COPY services/user-service ./services/user-service
WORKDIR /app/services/user-service
EXPOSE 3002
CMD ["pnpm", "run", "start:dev"]

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY services/user-service ./services/user-service
WORKDIR /app/services/user-service
RUN pnpm run build

FROM node:20-alpine AS production
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/services/user-service/dist ./services/user-service/dist
COPY --from=build /app/services/user-service/package.json ./services/user-service/package.json
WORKDIR /app/services/user-service
EXPOSE 3002
CMD ["node", "dist/main.js"]
