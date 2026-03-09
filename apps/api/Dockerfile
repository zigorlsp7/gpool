FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY scripts/prepare-husky.mjs scripts/prepare-husky.mjs
RUN HUSKY=0 npm install --workspace @gpool/api --include-workspace-root --ignore-scripts

FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json /app/package.json
COPY apps/api /app/apps/api
WORKDIR /app/apps/api
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app/apps/api
ENV NODE_ENV=production
RUN apk upgrade --no-cache zlib
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY scripts/openbao-run.mjs /app/scripts/openbao-run.mjs
COPY apps/api/package.json /app/apps/api/package.json
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM prod AS local
