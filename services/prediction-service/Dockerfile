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
COPY services/prediction-service ./services/prediction-service
WORKDIR /app/services/prediction-service
EXPOSE 3005
CMD ["pnpm", "run", "start:dev"]
FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages ./packages
COPY services/prediction-service ./services/prediction-service
WORKDIR /app/services/prediction-service
RUN pnpm run build
FROM node:20-alpine AS production
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/services/prediction-service/dist ./services/prediction-service/dist
COPY --from=build /app/services/prediction-service/package.json ./services/prediction-service/package.json
WORKDIR /app/services/prediction-service
EXPOSE 3005
CMD ["node", "dist/main.js"]
