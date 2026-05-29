# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────
# SGI Web (Backoffice) — Next.js 15 standalone, multi-stage build.
# Build context: monorepo root (cf. docker-compose.yml).
# ──────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── deps ───────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/i18n/package.json packages/i18n/package.json
RUN pnpm install --frozen-lockfile --filter sgi-web...

# ── builder ────────────────────────────────────────────────────────────
FROM deps AS builder
COPY turbo.json ./
COPY apps/web apps/web
COPY packages packages
RUN pnpm --filter sgi-web build

# ── runner ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S -G nextjs nextjs

# Standalone output rooted at monorepo (outputFileTracingRoot)
COPY --from=builder --chown=nextjs:nextjs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nextjs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

# server.js sits at apps/web/server.js relative to the standalone root
CMD ["node", "apps/web/server.js"]
