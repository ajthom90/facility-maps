# Multi-stage build: install workspaces, build web + API, run API + SQLite + static UI.
# APP_VERSION is injected at build time. On every start: migrate → seed → listen.
# Data lives on volumes: /data (sqlite + uploads), /config (app.env).

ARG APP_VERSION=0.0.0-dev

# bookworm has better-sqlite3 prebuilds; alpine/musl often needs a full native compile.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
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

FROM node:22-bookworm-slim AS runner
ARG APP_VERSION=0.0.0-dev
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST=apps/web/dist
ENV SQLITE_PATH=/data/db/facility-maps.sqlite
ENV UPLOAD_DIR=/data/uploads
ENV CONFIG_FILE=/config/app.env
ENV APP_VERSION=${APP_VERSION}

LABEL org.opencontainers.image.title="Facility Safety Maps" \
      org.opencontainers.image.description="Self-hosted interactive facility safety maps (SQLite)" \
      org.opencontainers.image.source="https://github.com/ajthom90/facility-maps" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${APP_VERSION}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN npm ci --omit=dev \
  && apt-get purge -y python3 make g++ \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist

# Volume mount points (documented; actual mounts come from Compose)
RUN mkdir -p /data/db /data/uploads /config

EXPOSE 3000
# index.js: migrate → seed system presets → bootstrap admin → listen
CMD ["node", "apps/api/dist/index.js"]
