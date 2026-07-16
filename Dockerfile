# Multi-stage build: install workspaces, build API + web, run API.
# Static web serving from apps/web/dist is added in a later task.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY apps/api ./apps/api
COPY apps/web ./apps/web
RUN npm run build -w @facility-maps/web
RUN npm run build -w @facility-maps/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/package.json ./package.json
# Placeholder: web dist will be copied and served by API in a later task
# COPY --from=build /app/apps/web/dist ./apps/web/dist
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
