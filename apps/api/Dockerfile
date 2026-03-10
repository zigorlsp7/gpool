FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps-build
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY scripts/prepare-husky.mjs scripts/prepare-husky.mjs
RUN HUSKY=0 npm ci --workspace @gpool/api --include-workspace-root --ignore-scripts

FROM base AS deps-prod
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY scripts/prepare-husky.mjs scripts/prepare-husky.mjs
RUN HUSKY=0 npm ci --workspace @gpool/api --include-workspace-root --omit=dev --ignore-scripts

FROM base AS build
ENV NODE_ENV=production
COPY --from=deps-build /app/node_modules /app/node_modules
COPY package.json /app/package.json
COPY apps/api /app/apps/api
WORKDIR /app/apps/api
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app/apps/api
ENV NODE_ENV=production
RUN apk upgrade --no-cache zlib \
 && rm -rf /usr/local/lib/node_modules/npm /opt/yarn-v1.22.22 \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=deps-prod /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY scripts/openbao-run.mjs /app/scripts/openbao-run.mjs
COPY apps/api/package.json /app/apps/api/package.json
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM prod AS local
