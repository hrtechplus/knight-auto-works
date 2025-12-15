FROM node:20-alpine AS builder

# Build Frontend
WORKDIR /app/client

# Copy all client files first
COPY client/ ./

# Install dependencies
RUN npm ci

# Build using node directly (bypasses shell script permissions)
RUN node ./node_modules/vite/bin/vite.js build

# Setup Backend & Runtime
FROM node:20-alpine
WORKDIR /app/server

# Copy server files
COPY server/ ./

# Install server dependencies
RUN npm ci --production

# Copy built frontend from builder stage
COPY --from=builder /app/client/dist ./public

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Start PostgreSQL version
CMD ["node", "index-pg.js"]
