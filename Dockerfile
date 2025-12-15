FROM node:20-alpine AS builder

# Build Frontend
WORKDIR /app/client
COPY client/package*.json ./

# Install dependencies and fix permissions
RUN npm ci && chmod -R +x node_modules/.bin

COPY client/ ./

# Build using node directly to avoid permission issues
RUN ./node_modules/.bin/vite build

# Setup Backend & Runtime
FROM node:20-alpine
WORKDIR /app/server

# Install server dependencies
COPY server/package*.json ./
RUN npm ci --production

# Copy server code
COPY server/ ./

# Copy built frontend from builder stage
COPY --from=builder /app/client/dist ./public

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Start PostgreSQL version
CMD ["node", "index-pg.js"]
