#!/bin/bash

# Deployment Script for Knight Auto Works

echo "🚀 Starting Deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# 2. Build Docker Image
echo "🔨 Building Docker image (this may take a few minutes)..."
docker build -t knight-auto .

# 3. Stop old container if running
if [ "$(docker ps -q -f name=app)" ]; then
    echo "🛑 Stopping existing container..."
    docker stop app
    docker rm app
fi

# 4. Run new container
echo "✨ Starting new container..."
docker run -d \
  -p 80:3001 \
  --restart unless-stopped \
  -v kaw_data:/app/server/data \
  -v kaw_backups:/app/server/backups \
  --name app \
  knight-auto

echo "✅ Deployment Complete!"
echo "🌍 Your app should be live on your server's External IP."
