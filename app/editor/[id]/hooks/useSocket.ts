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
    s.emit("join-doc", projectId);

    s.on("chat-history", (msgs: ChatMessage[]) => setChatMessages(msgs));
    s.on("chat-message", (m: ChatMessage) => setChatMessages((p) => [...p, m]));

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
