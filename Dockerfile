# Multi-stage build: install workspaces, build web + API, run API serving static UI.
# APP_VERSION is injected at build time (CI / docker build --build-arg) and exposed
# via /api/health. On every container start the API migrates DB and re-runs seed.

ARG APP_VERSION=0.0.0-dev

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
ARG APP_VERSION=0.0.0-dev
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Relative to WORKDIR /app — serveStatic does not support absolute roots
ENV WEB_DIST=apps/web/dist
ENV UPLOAD_DIR=/data/uploads
ENV APP_VERSION=${APP_VERSION}

LABEL org.opencontainers.image.title="Facility Safety Maps" \
      org.opencontainers.image.description="Self-hosted interactive facility safety maps" \
      org.opencontainers.image.source="https://github.com/ajthom90/facility-maps" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${APP_VERSION}"

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --omit=dev

COPY --from=build /app/apps/api/dist ./apps/api/dist
# Startup runs drizzle migrate — folder must exist next to dist (../../drizzle from dist/db)
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist

EXPOSE 3000
# index.js: migrate → seed (system presets) → bootstrap admin → listen
CMD ["node", "apps/api/dist/index.js"]
