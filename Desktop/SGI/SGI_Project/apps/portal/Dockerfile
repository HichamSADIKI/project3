# syntax=docker/dockerfile:1.7

# ──────────────────────────────────────────────────────────────────────────
# SGI Portal — Next.js 15 standalone, multi-stage build (pnpm workspace).
# Build context: monorepo root (cf. docker-compose.yml).
# ──────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ── deps ───────────────────────────────────────────────────────────────
# Install dependencies (cache-friendly: only package manifests).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/portal/package.json apps/portal/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/i18n/package.json packages/i18n/package.json
RUN pnpm install --frozen-lockfile --filter @sgi/portal...

# ── builder ────────────────────────────────────────────────────────────
# Inherit from deps so the per-workspace node_modules symlinks are kept.
FROM deps AS builder
COPY turbo.json ./
COPY apps/portal apps/portal
COPY packages packages
RUN pnpm --filter @sgi/portal build

# ── runner ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nextjs && adduser -S -G nextjs nextjs

# Standalone output rooted at monorepo (outputFileTracingRoot)
COPY --from=builder --chown=nextjs:nextjs /repo/apps/portal/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /repo/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=builder --chown=nextjs:nextjs /repo/apps/portal/public ./apps/portal/public

USER nextjs
EXPOSE 3001

# server.js sits at apps/portal/server.js relative to the standalone root
CMD ["node", "apps/portal/server.js"]
