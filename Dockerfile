FROM node:18-alpine AS builder

# Build Frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Setup Backend & Runtime
FROM node:18-alpine
WORKDIR /app/server

# Install server dependencies
COPY server/package*.json ./
RUN npm ci --production

# Copy server code
COPY server/ ./

# Copy built frontend from builder stage
COPY --from=builder /app/client/dist ./public

# Create directories for data persistence
RUN mkdir -p /app/server/data /app/server/backups

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/server/data/knight-auto.db

# Expose port
EXPOSE 3001

# Start command
CMD ["node", "index.js"]
