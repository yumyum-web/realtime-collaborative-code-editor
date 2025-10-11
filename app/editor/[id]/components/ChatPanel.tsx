import React, { useState, useEffect, useRef } from "react";
import { VscSend, VscAccount, VscComment } from "react-icons/vsc";
import type { ChatMessage, User } from "../types";

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
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
    // Always scroll to bottom when user sends a message
    setIsUserAtBottom(true);
  }

  // Check if user is at bottom of chat
  const checkIfAtBottom = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
      setIsUserAtBottom(atBottom);
    }
  };

  // Handle scroll events
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkIfAtBottom);
      return () => container.removeEventListener("scroll", checkIfAtBottom);
    }
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (messagesEndRef.current) {
      // Always scroll on initial load
      if (isInitialLoad) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
        setIsInitialLoad(false);
        setIsUserAtBottom(true);
      }
      // Only auto-scroll if user is at bottom and it's not initial load
      else if (isUserAtBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [chatMessages, isUserAtBottom, isInitialLoad]);

  return (
    <div className="h-full bg-sidebar border-l border-gray-700 flex flex-col relative">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-700 flex-shrink-0 bg-card">
        <div className="flex items-center gap-3 h-8">
          <VscComment className="w-5 h-5 text-white" />
          <h3 className="text-lg font-bold text-white">Chat</h3>
        </div>
        <button
          className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          onClick={onClose}
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

      {/* Chat Messages - Scrollable (with bottom padding for input) */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 pb-20 min-h-0 space-y-3"
      >
        {chatMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            <p className="text-xs">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          chatMessages.map((m, i) => {
            const isCurrentUser = user && m.senderEmail === user.email;
            return (
              <div
                key={i}
                className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md ${isCurrentUser ? "order-2" : "order-1"}`}
                >
                  <div
                    className={`flex items-center gap-2 mb-1 ${isCurrentUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isCurrentUser && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 bg-orange-500">
                        <VscAccount className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`font-medium text-xs ${isCurrentUser ? "text-blue-300" : "text-gray-300"}`}
                    >
                      {isCurrentUser
                        ? "You"
                        : (m.senderUsername ?? m.senderEmail)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </div>
                    {isCurrentUser && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 bg-blue-500">
                        <VscAccount className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  <div
                    className={`p-2 rounded-lg text-sm leading-relaxed ${
                      isCurrentUser
                        ? "bg-white/20 text-white ml-8"
                        : "bg-white/20 text-gray-200 mr-8"
                    }`}
                  >
                    {m.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Absolutely positioned at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-700 bg-card">
        <div className="flex gap-2">
          <input
            className="flex-1 p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Type a message..."
          />
          <button
            onClick={sendChat}
            disabled={!newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
          >
            <VscSend className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
