# Biblioteka gier — EasyPanel / production image
# Multi-stage: Angular client + Node API in one container

# ---------- client ----------
FROM node:22-bookworm AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build -- --configuration=production

# ---------- server deps ----------
FROM node:22-bookworm AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r gameslib \
    && useradd -r -g gameslib -d /app -s /sbin/nologin gameslib

COPY --from=server-build /app/server /app/server
COPY --from=client-build /app/client/dist/client/browser /app/client/dist/client/browser

RUN chown -R gameslib:gameslib /app

WORKDIR /app/server
USER gameslib

ENV NODE_ENV=production \
    PORT=3000 \
    PUBLIC_DIR=/app/client/dist/client/browser \
    JWT_SECRET=change-me

EXPOSE 3000

# EasyPanel: osobna usługa MongoDB, MONGODB_URI w zmiennych środowiska
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
