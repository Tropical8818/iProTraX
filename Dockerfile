
# Stage 1: Dependencies
FROM node:22-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Upgrade npm to latest
RUN npm install -g npm@latest

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install OpenSSL for Prisma (needed in builder too for generation)
RUN apk add --no-cache openssl

# Generate Prisma Client
RUN npx prisma generate

# Pre-sync database schema (creates empty database with correct schema)

# Build Next.js
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
# Alpine syntax: addgroup, adduser
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install dependencies
# libc6-compat for Next.js, openssl for prisma, tzdata for time
# Enable Alpine Edge repos for bleeding-edge security fixes (CVE-2026-22184, CVE-2025-60876, CVE-2025-14819)
RUN echo "https://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories && \
    echo "https://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache \
    libc6-compat \
    openssl \
    tzdata \
    ca-certificates \
    curl \
    zlib \
    busybox && \
    apk upgrade --no-cache && \
    npm install -g npm@latest && \
    echo "--- Security Verification (Alpine Edge) ---" && \
    apk info -v zlib busybox curl

# Copy necessary files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src ./src

# Copy Prisma schema and migrations for runtime usage
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy Prisma CLI and client for bootstrap script
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy Native Rust/WASM Module (Required for license verification)
# This is needed because `dynamicRequire` bypasses Next.js dependency tracing
COPY --from=builder --chown=nextjs:nodejs /app/native/license-verifier/pkg ./native/license-verifier/pkg

# Copy bcryptjs for admin creation in bootstrap
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Install chokidar and tsx explicitly for watcher script
RUN npm install chokidar tsx

# Copy bootstrap script
# Copy scripts directory
COPY --chown=nextjs:nodejs scripts ./scripts
USER root
RUN chmod +x ./scripts/docker-bootstrap.sh
USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Use the bootstrap script to handle database setup before starting
CMD ["./scripts/docker-bootstrap.sh"]
