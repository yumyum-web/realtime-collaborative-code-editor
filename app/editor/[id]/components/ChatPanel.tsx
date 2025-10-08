import React, { useState, useEffect, useRef } from "react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

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
    <div
      className="w-80 h-full bg-gray-800 border-l border-gray-700"
      style={{
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        minHeight: 0,
      }}
    >
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Chat</h3>
          <button
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            onClick={onClose}
            title="Close chat"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Messages - Scrollable Area */}
      <div
        className="overflow-y-auto overflow-x-hidden"
        style={{ minHeight: 0 }}
      >
        <div className="p-4 space-y-3">
          {chatMessages.map((m, i) => (
            <div key={i} className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    background: colorFromString(m.senderEmail),
                    borderRadius: 2,
                  }}
                />
                <div className="font-semibold text-xs text-blue-300 truncate">
                  {m.senderUsername ?? m.senderEmail}
                </div>
                <div className="text-xs text-gray-500 ml-auto flex-shrink-0">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div className="ml-4 text-gray-200 leading-relaxed">
                {m.message}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input Area - Fixed at Bottom */}
      <div className="px-4 py-3 border-t border-gray-700 bg-gray-800">
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Type a message..."
          />
          <button
            onClick={sendChat}
            disabled={!newMessage.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg disabled:transform-none disabled:shadow-none flex items-center gap-1 text-sm whitespace-nowrap"
          >
            <svg
              className="w-3 h-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ transform: "rotate(90deg)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
