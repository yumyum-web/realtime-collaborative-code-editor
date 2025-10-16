import React, { useState, useRef, useEffect } from "react";
import { VscSend, VscAccount, VscSymbolMisc } from "react-icons/vsc";

interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiChatPanelProps {
  projectId: string;
  userEmail: string;
  onClose: () => void;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  projectId,
  userEmail,
  onClose,
}) => {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/ai-chat`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.aiChats || []);
          // Set user at bottom when messages load
          setIsUserAtBottom(true);
        }
      } catch (error) {
        console.error("Failed to load AI chat history:", error);
      }
    };
    loadChatHistory();
  }, [projectId]);

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
    if (messagesContainerRef.current && isUserAtBottom) {
      // Use setTimeout to ensure DOM has updated
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [messages, isUserAtBottom]);

  // Save a message to the database
  const saveMessage = async (role: "user" | "assistant", content: string) => {
    try {
      await fetch(`/api/projects/${projectId}/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, content, userEmail }),
      });
    } catch (error) {
      console.error("Failed to save AI chat message:", error);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: AiChatMessage = { role: "user", content: input };
    const promptText = input;
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setLoading(true);
    // Always scroll to bottom when user sends a message
    setIsUserAtBottom(true);

    // Save user message to database
    await saveMessage("user", userMsg.content);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("AI API error:", data);
        const errorMsg = {
          role: "assistant" as const,
          content: ` Error: ${data.error || "Unknown error"}`,
        };
        setMessages((msgs) => [...msgs, errorMsg]);
        // Save error message to database
        await saveMessage("assistant", errorMsg.content);
      } else {
        const assistantMsg = {
          role: "assistant" as const,
          content: data.response || "(No response)",
        };
        setMessages((msgs) => [...msgs, assistantMsg]);
        // Save assistant response to database
        await saveMessage("assistant", assistantMsg.content);
      }
    } catch (error) {
      console.error("AI chat error:", error);
      const errorMsg = {
        role: "assistant" as const,
        content: " Error contacting AI. Check console for details.",
      };
      setMessages((msgs) => [...msgs, errorMsg]);
      // Save error message to database
      await saveMessage("assistant", errorMsg.content);
    }
    setLoading(false);
    // Refocus input after AI responds
    inputRef.current?.focus();
  };

  return (
    <div className="h-full bg-sidebar border-l border-gray-700 flex flex-col relative">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b border-gray-700 flex-shrink-0 bg-card">
        <div className="flex items-center gap-3 h-8">
          <VscSymbolMisc className="w-5 h-5 text-white" />
          <h3 className="text-lg font-bold text-white">AI Assistant</h3>
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
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            <p className="text-xs">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isCurrentUser = msg.role === "user";
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
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 bg-purple-500">
                        <VscSymbolMisc className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`font-medium text-xs ${isCurrentUser ? "text-blue-300" : "text-gray-300"}`}
                    >
                      {isCurrentUser ? "You" : "AI Assistant"}
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
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-xs lg:max-w-md order-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0 bg-purple-500">
                  <VscSymbolMisc className="w-3.5 h-3.5" />
                </div>
                <div className="font-medium text-xs text-gray-300">AI Assistant</div>
              </div>
              <div className="p-2 rounded-lg text-sm leading-relaxed bg-white/20 text-gray-200 mr-8">
                <div className="flex items-center gap-2">
                  <div className="animate-pulse">⚡</div>
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Absolutely positioned at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-700 bg-card">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage()}
            placeholder="Ask AI for code help..."
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
          >
            <VscSend className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
