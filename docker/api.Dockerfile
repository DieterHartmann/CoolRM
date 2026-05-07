FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ── Install deps (cached layer) ───────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
RUN pnpm --filter @crm/db generate
RUN pnpm --filter @crm/db build
# Prisma emits JS runtime files into src/generated/ — tsc never copies them.
# Move them into dist/generated/ so Node can resolve './generated/...' imports.
RUN cp -r packages/db/src/generated packages/db/dist/generated
RUN pnpm --filter @crm/shared build
RUN pnpm --filter @crm/api build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist
# dist/ now contains compiled JS + generated Prisma runtime under dist/generated/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
# prisma/ is needed at runtime for the tenant init.sql path in provision.ts
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
