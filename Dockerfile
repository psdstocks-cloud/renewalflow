# Use Node.js 20 LTS
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files from server directory
COPY server/package*.json ./
COPY server/prisma ./prisma/

# Install dependencies
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
COPY server/start.sh ./start.sh

# Make start script executable
RUN chmod +x ./start.sh

# Expose port (Railway will set PORT env var)
EXPOSE 4000

# Start the application
CMD ["./start.sh"]

