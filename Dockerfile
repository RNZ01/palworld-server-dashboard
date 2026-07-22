FROM node:24.18.0-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps

COPY package.json package-lock.json ./
COPY scripts/patch-nextra-theme-docs.mjs ./scripts/patch-nextra-theme-docs.mjs
RUN npm ci

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24.18.0-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DEMO_MODE=0

WORKDIR /app

# /app/data holds the panel credential store and the FPS history ring. Baking
# it into the image owned by the app user makes it writable on every engine:
# Docker copies this ownership into fresh named volumes mounted here, and
# volumeless runs get a writable directory instead of a root-owned /app.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/data \
  && chown nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then((res) => { if (!res.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]

