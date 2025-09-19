import React, { useState } from "react";
import { Resizable } from "re-resizable";
import type { ChatMessage, User } from "../types";
import { colorFromString } from "../utils/colorHelpers";

interface ChatPanelProps {
  chatMessages: ChatMessage[];
  user: User | null;
  onSendMessage: (message: ChatMessage) => void;
  onClose: () => void;
}

export function ChatPanel({
  chatMessages,
  user,
  onSendMessage,
  onClose,
}: ChatPanelProps) {
  const [newMessage, setNewMessage] = useState("");

  function sendChat() {
    if (!newMessage.trim() || !user) return;
    const payload: ChatMessage = {
      senderEmail: user.email,
      senderUsername: user.username ?? user.email,
      message: newMessage.trim(),
      timestamp: Date.now(),
    };
    onSendMessage(payload);
    setNewMessage("");
  }

  return (
    <Resizable
      defaultSize={{ width: 320 }}
      minWidth={220}
      maxWidth={600}
      enable={{ left: true }}
    >
      <aside className="h-full bg-gray-800 p-4 border-l border-gray-700 flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Chat</h3>
          <button
            className="text-gray-400 hover:text-gray-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto mb-2 space-y-3">
          {chatMessages.map((m, i) => (
            <div key={i} className="text-sm">
              <div className="flex items-center gap-2">
                <div
                  style={{
                    width: 10,
                    height: 10,
                    background: colorFromString(m.senderEmail),
                    borderRadius: 3,
                  }}
                />
                <div className="font-semibold text-xs text-blue-300">
                  {m.senderUsername ?? m.senderEmail}
                </div>
                <div className="text-xs text-gray-500 ml-auto">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className="ml-4">{m.message}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 p-2 rounded bg-gray-700 text-white"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Type a message..."
          />
          <button onClick={sendChat} className="bg-blue-700 px-3 rounded">
            Send
          </button>
        </div>
      </aside>
    </Resizable>
  );
}
