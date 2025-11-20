# Use Node.js 20 LTS
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files from server directory
COPY server/package*.json ./
COPY server/prisma ./prisma/

# Install dependencies (including devDependencies for tsx)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY server/package*.json ./
COPY server/tsconfig.json ./
COPY server/src ./src
COPY server/prisma ./prisma
COPY server/start.sh ./start.sh

# Build TypeScript
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/start.sh ./start.sh

# Make start script executable
RUN chmod +x ./start.sh

# Ensure tsx is available (needed for ES module imports at runtime)
# Since tsx is now in dependencies, it should be in node_modules
# But verify and install if missing (npm install without --save to avoid modifying package.json)
RUN if ! command -v tsx > /dev/null 2>&1 && ! npm list tsx > /dev/null 2>&1; then \
      echo "Installing tsx (not found in node_modules)..." && \
      npm install tsx --no-save; \
    fi && \
    echo "Verifying tsx installation..." && \
    (npx tsx --version || npm list tsx || echo "WARNING: tsx verification failed")

# Expose port (Railway will set PORT env var)
EXPOSE 4000

# Start the application
CMD ["/app/start.sh"]

