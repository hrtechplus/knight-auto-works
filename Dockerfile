FROM node:20-alpine AS builder

# Build Frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npx vite build

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
