# Stage 1: Install dependencies
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Stage 2: Build the application
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure public directory exists (Next.js standalone COPY needs it)
RUN mkdir -p public

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_ env vars must be available at build time for Next.js to inline them.
# Railway passes these as Docker build args automatically.
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

# Stage 3: Production runner
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat openssl \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
# Use Alpine's system Chromium instead of Playwright's bundled browser
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma: schema, migrations, client, and full CLI with engines
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Copy xlsx (serverExternalPackage — not traced by Next.js standalone)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/xlsx ./node_modules/xlsx

# Copy Anthropic SDK (serverExternalPackage — deep subpath imports not traced)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@anthropic-ai ./node_modules/@anthropic-ai

# Copy @react-pdf/renderer + native deps (serverExternalPackage with @emnapi native bindings)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@react-pdf ./node_modules/@react-pdf
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@emnapi ./node_modules/@emnapi

# Copy Playwright (serverExternalPackage — uses system Chromium via PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/playwright ./node_modules/playwright
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/playwright-core ./node_modules/playwright-core

COPY --from=builder --chown=nextjs:nodejs /app/start.sh ./start.sh

USER nextjs

EXPOSE 3000

CMD ["sh", "start.sh"]
