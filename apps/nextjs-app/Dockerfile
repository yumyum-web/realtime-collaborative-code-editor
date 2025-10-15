# syntax=docker/dockerfile:1

# Base stage with Node.js
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install turbo globally
RUN npm install -g turbo

# Prune stage - create a pruned monorepo for the nextjs-app
FROM base AS pruner
COPY . .
RUN turbo prune nextjs-app --docker

# Dependencies stage - install dependencies
FROM base AS deps
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci

# Builder stage - build the application
FROM base AS builder
COPY --from=pruner /app/out/full/ .
COPY --from=deps /app/node_modules ./node_modules

# Build the Next.js app
RUN turbo run build --filter=nextjs-app

# Runner stage - production image
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/apps/nextjs-app/next.config.ts ./
COPY --from=builder /app/apps/nextjs-app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextjs-app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextjs-app/.next/static ./apps/nextjs-app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/nextjs-app/public ./apps/nextjs-app/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/nextjs-app/server.js"]
