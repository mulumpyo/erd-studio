# syntax=docker/dockerfile:1
# linux/arm64 (Oracle Ampere). Build with:
#   docker buildx build --platform linux/arm64 --target web|api|collab
FROM node:22-bookworm-slim AS builder
# openssl must exist before `prisma generate` so it picks the openssl-3.0 engine.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/collab/package.json apps/collab/
COPY packages/shared/package.json packages/shared/
COPY packages/sql/package.json packages/sql/
COPY packages/yjs-erd/package.json packages/yjs-erd/
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm --filter @erd-studio/api exec prisma generate
ARG VITE_SITE_URL=https://erd-studio.com
ENV VITE_SITE_URL=$VITE_SITE_URL
RUN pnpm build

FROM nginx:1.27-alpine AS web
# Quoted heredoc: keeps nginx variables like $uri from being expanded at build time.
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

FROM node:22-bookworm-slim AS api
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json /app/apps/api/nest-cli.json ./apps/api/
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/sql/package.json ./packages/sql/
COPY --from=builder /app/packages/sql/node_modules ./packages/sql/node_modules
COPY --from=builder /app/packages/sql/dist ./packages/sql/dist
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema=prisma/schema.prisma --skip-generate && exec node dist/main.js"]

FROM node:22-bookworm-slim AS collab
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/collab/package.json ./apps/collab/
COPY --from=builder /app/apps/collab/node_modules ./apps/collab/node_modules
COPY --from=builder /app/apps/collab/dist ./apps/collab/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/yjs-erd/package.json ./packages/yjs-erd/
COPY --from=builder /app/packages/yjs-erd/node_modules ./packages/yjs-erd/node_modules
COPY --from=builder /app/packages/yjs-erd/dist ./packages/yjs-erd/dist
WORKDIR /app/apps/collab
EXPOSE 3030
CMD ["node", "dist/index.js"]
