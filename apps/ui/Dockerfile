FROM node:25-alpine AS base
WORKDIR /workspace

FROM base AS deps-build
COPY package.json package-lock.json ./
COPY apps/ui/package.json apps/ui/package.json
COPY scripts/prepare-husky.mjs scripts/prepare-husky.mjs
RUN HUSKY=0 npm ci --workspace @gpool/web --include-workspace-root --ignore-scripts

FROM base AS deps-prod
COPY package.json package-lock.json ./
COPY apps/ui/package.json apps/ui/package.json
COPY scripts/prepare-husky.mjs scripts/prepare-husky.mjs
RUN HUSKY=0 npm ci --workspace @gpool/web --include-workspace-root --omit=dev --ignore-scripts

FROM base AS build
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_RELEASE
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_RELEASE=${NEXT_PUBLIC_RELEASE}
COPY --from=deps-build /workspace/node_modules /workspace/node_modules
COPY package.json /workspace/package.json
COPY apps/ui /workspace/apps/ui
WORKDIR /workspace/apps/ui
RUN npm run build

FROM node:25-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
RUN apk upgrade --no-cache zlib \
 && rm -rf /usr/local/lib/node_modules/npm /opt/yarn-v1.22.22 \
 && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=deps-prod /workspace/node_modules /app/node_modules
COPY --from=build /workspace/apps/ui/.next/standalone ./
COPY --from=build /workspace/apps/ui/.next/static ./apps/ui/.next/static
COPY --from=build /workspace/apps/ui/public ./apps/ui/public
COPY --from=build /workspace/apps/ui/messages ./apps/ui/messages
COPY scripts/openbao-run.mjs /app/scripts/openbao-run.mjs
USER node
EXPOSE 3001
CMD ["node", "apps/ui/server.js"]

FROM prod AS local
