# Imagem da API do DnF (core/server.ts: Hono + Drizzle). Contexto de build: a RAIZ do repo (o bun resolve os workspaces).
#   docker build -f core/Dockerfile -t dnf-api .
FROM oven/bun:1

WORKDIR /app

# Só os package.json primeiro: a camada das dependências não refaz a cada mudança de código.
COPY package.json bun.lock ./
COPY core/package.json core/
COPY apps/mobile/package.json apps/mobile/
COPY apps/web/DM-Control/package.json apps/web/DM-Control/
COPY packages/sdk/package.json packages/sdk/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/ui/react-native/package.json packages/ui/react-native/
COPY packages/ui/svelte/package.json packages/ui/svelte/
RUN bun install --frozen-lockfile --production --filter @dnf/core

COPY core core

ENV NODE_ENV=production PORT=3000 FILES_DIR=/data/files NAS_DIR=/data/nas
# Avatares (FILES_DIR) ficam num volume; a pasta do NAS (NAS_DIR) o DM-Control grava e a API só lê.
RUN mkdir -p /data/files /data/nas && chown -R bun:bun /data
USER bun
WORKDIR /app/core
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

CMD ["bun", "server.ts"]
