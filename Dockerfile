
# Stage 1: Dependencies
FROM node:22-slim AS deps
WORKDIR /app

# Upgrade system npm to fix CVEs
RUN npm install -g npm@latest

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Builder
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Generate Prisma Client
RUN npx prisma generate

# Pre-sync database schema (creates empty database with correct schema)
ENV DATABASE_URL="file:./prisma/dev.db"
RUN npx prisma db push --accept-data-loss

# Build Next.js
# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN groupadd -r -g 1001 nodejs
RUN useradd -r -u 1001 -g nodejs nextjs

# Install dependencies
# openssl for prisma, tzdata for time
# Upgrade all packages to latest to catch zlib fixes if any
# Deep Security Fix: Force refresh of repositories and explicit upgrade of all vulnerable packages
# CVE Targets: tar, glibc, systemd, coreutils, libgcrypt, perl, shadow, util-linux, apt, gcc-12, gnupg2, gnutls28
RUN echo "deb http://deb.debian.org/debian bookworm main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian-security bookworm-security main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian bookworm-updates main contrib non-free" >> /etc/apt/sources.list && \
    apt-get update -y && \
    apt-get dist-upgrade -y && \
    apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    tzdata \
    tar \
    libc6 \
    libc-bin \
    libsystemd0 \
    coreutils \
    libgcrypt20 \
    perl \
    passwd \
    util-linux \
    apt \
    libgcc-s1 \
    libstdc++6 \
    gnupg \
    libgnutls30 && \
    apt-get clean && rm -rf /var/lib/apt/lists/* && \
    npm install -g npm@latest && \
    echo "--- Security Verification (Deep Fix) ---" && \
    dpkg -l | grep -E "tar|libc6|libsystemd0|coreutils|libgcrypt20|perl|openssl|passwd|util-linux|apt|libgcc-s1|gnupg|libgnutls30"

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
