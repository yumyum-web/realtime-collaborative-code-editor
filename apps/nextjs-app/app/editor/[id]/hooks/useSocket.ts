import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import type {
  ChatMessage,
  NodeAddedPayload,
  NodeDeletedPayload,
} from "../types";

export function useSocket(projectId: string) {
  const socketRef = useRef<SocketIOClient.Socket | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!projectId) return;

    const s = io("http://localhost:3001");
    socketRef.current = s;

    s.on("chat-history", (msgs: ChatMessage[]) => {
      console.log("📥 Received chat history:", msgs.length, "messages");
      // Always replace the entire message list when receiving history
      setChatMessages(msgs);
    });

    s.on("chat-message", (m: ChatMessage) => {
      console.log("💬 Received new chat message:", m.message);
      setChatMessages((prev) => {
        // Check if this exact message is already in the list to prevent duplicates
        const messageExists = prev.some(
          (existing) =>
            existing.senderEmail === m.senderEmail &&
            existing.message === m.message &&
            Math.abs(existing.timestamp - m.timestamp) < 1000, // Within 1 second
        );

        if (messageExists) {
          console.log("⚠️ Duplicate message detected, skipping");
          return prev; // Don't add duplicate
        }

        console.log("✅ Adding new message to chat");
        return [...prev, m];
      });
    });

    // Emit join-doc after setting up listeners
    s.emit("join-doc", projectId);

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  const emitNodeAdded = (payload: NodeAddedPayload) => {
    socketRef.current?.emit("node-added", payload);
  };

  const emitNodeDeleted = (payload: NodeDeletedPayload) => {
    socketRef.current?.emit("node-deleted", payload);
  };

  const emitChatMessage = (message: ChatMessage) => {
    socketRef.current?.emit("chat-message", message);
  };

  return {
    socket: socketRef.current,
    chatMessages,
    emitNodeAdded,
    emitNodeDeleted,
    emitChatMessage,
  };
}
