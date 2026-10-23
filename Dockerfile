# syntax=docker/dockerfile:1

FROM node:25-alpine AS base
RUN npm install -g pnpm@12.14.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
# The migration script runs outside Next.js, so it gets its own copy of the
# two packages it needs (both have no runtime dependencies).
RUN mkdir -p /migrator/node_modules \
  && cp -rL node_modules/drizzle-orm node_modules/postgres /migrator/node_modules/

FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /migrator/node_modules ./migrator/node_modules
COPY scripts/migrate.mjs ./migrator/migrate.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "server.js"]
