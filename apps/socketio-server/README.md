# Socket.IO Integration

## Overview

This project uses a separate Socket.IO server that runs independently from the Next.js application. The Socket.IO server handles real-time events for collaboration, including:

- File tree changes (node-added, node-deleted)
- Chat messages
- Version control events (commits, merges, pull updates)
- Real-time collaboration notifications

## Architecture

### Socket.IO Server (`apps/socketio-server`)

The Socket.IO server runs on port 3001 (configurable via `SOCKET_PORT` environment variable) and provides:

1. **WebSocket connections** for real-time bidirectional communication
2. **HTTP endpoint** (`POST /emit`) for triggering socket events from API routes
3. **Health check endpoint** (`GET /health`)

### Next.js Application (`apps/nextjs-app`)

The Next.js application communicates with the Socket.IO server in two ways:

1. **Client-side**: Direct WebSocket connection for real-time updates
2. **Server-side**: HTTP requests to the Socket.IO server's `/emit` endpoint to broadcast events

## Emitting Events from API Routes

The Next.js API routes use the `emitSocketEvent` utility function to broadcast events:

```typescript
import { emitSocketEvent } from "@/app/lib/socketio";

// Emit an event to a specific room
await emitSocketEvent(projectId, "commit-created", {
  projectId,
  branchName: "main",
  commitHash: "abc123",
  message: "Initial commit",
  author: "user@example.com",
  timestamp: new Date().toISOString(),
});
```

## Configuration

### Socket.IO Server

Set the `SOCKET_PORT` environment variable (default: 3001):

```bash
SOCKET_PORT=3001
```

### Next.js Application

Set the `SOCKET_SERVER_URL` environment variable to point to the Socket.IO server (default: http://localhost:3001):

```bash
SOCKET_SERVER_URL=http://localhost:3001
```

## Running the Servers

Start both servers in development mode:

```bash
# Terminal 1: Start Socket.IO server
cd apps/socketio-server
npm run dev

# Terminal 2: Start Next.js application
cd apps/nextjs-app
npm run dev
```

## API

### Socket.IO Server HTTP Endpoint

**POST /emit**

Triggers a Socket.IO event broadcast.

Request body:

```json
{
  "room": "project-id",
  "event": "event-name",
  "data": {
    /* event payload */
  }
}
```

Response:

```json
{
  "success": true
}
```

**GET /health**

Health check endpoint.

Response:

```json
{
  "status": "ok"
}
```
