import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { connectDB, Project } from "@repo/database";

const httpServer = createServer((req, res) => {
  // Handle HTTP requests for triggering socket events
  if (req.method === "POST" && req.url === "/emit") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const { room, event, data } = JSON.parse(body);
        if (room && event && data) {
          io.to(room).emit(event, data);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing room, event, or data" }));
        }
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

interface ClientSocket extends Socket {
  room?: string;
}

io.on("connection", (socket: ClientSocket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-doc", async (docId: string) => {
    socket.room = docId;
    socket.join(docId);
    console.log(`Socket ${socket.id} joined ${docId}`);
    try {
      await connectDB();
      const project = (await Project.findById(docId).lean()) as {
        chats?: {
          senderEmail: string;
          senderUsername: string;
          message: string;
          timestamp: string;
        }[];
      } | null;
      if (project?.chats) {
        socket.emit(
          "chat-history",
          project.chats.map((c) => ({
            senderEmail: c.senderEmail,
            senderUsername: c.senderUsername,
            message: c.message,
            timestamp: new Date(c.timestamp).getTime(),
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  });

  // Editor content sync removed from Socket.IO: Yjs handles per-character syncing.
  // Socket remains responsible for file tree events and chat.

  socket.on(
    "node-added",
    (payload: {
      type: "file" | "folder";
      parentPath: string;
      name: string;
    }) => {
      if (socket.room) socket.to(socket.room).emit("node-added", payload);
    }
  );

  socket.on("node-deleted", (payload: { path: string }) => {
    if (payload.path === "root") return;
    if (socket.room) socket.to(socket.room).emit("node-deleted", payload);
  });

  socket.on(
    "chat-message",
    async (payload: {
      senderEmail: string;
      senderUsername: string;
      message: string;
    }) => {
      if (!socket.room) return;
      const chatMsg = {
        senderEmail: payload.senderEmail,
        senderUsername: payload.senderUsername,
        message: payload.message,
        timestamp: new Date(),
      };
      try {
        await connectDB();
        await Project.findByIdAndUpdate(socket.room, {
          $push: { chats: chatMsg },
        });
        io.to(socket.room).emit("chat-message", {
          senderEmail: chatMsg.senderEmail,
          senderUsername: chatMsg.senderUsername,
          message: chatMsg.message,
          timestamp: chatMsg.timestamp.getTime(),
        });
      } catch (err) {
        console.error("Failed to store chat:", err);
      }
    }
  );

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.SOCKET_PORT ? Number(process.env.SOCKET_PORT) : 3001;
httpServer.listen(PORT, () =>
  console.log(`Socket.IO server running on http://localhost:${PORT}`)
);
