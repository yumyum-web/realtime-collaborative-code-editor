#!/bin/bash

# Railway deployment start script
# This script starts all required services for the collaborative code editor

echo "🚀 Starting Realtime Collaborative Code Editor on Railway..."

# Start Next.js, Socket.IO, and Y.js WebSocket server
npm run start:all
