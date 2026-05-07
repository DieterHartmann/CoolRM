FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ── Install deps ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/widget/package.json ./apps/widget/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY apps/web ./apps/web
COPY apps/widget ./apps/widget
COPY packages/shared ./packages/shared
RUN pnpm --filter @crm/shared build
RUN pnpm --filter @crm/web build
RUN pnpm --filter @crm/widget build

# ── Serve via Nginx ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY --from=builder /app/apps/widget/dist/widget.js /usr/share/nginx/html/widget.js
COPY --from=builder /app/apps/widget/dist/widget-frame.html /usr/share/nginx/html/widget-frame.html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
