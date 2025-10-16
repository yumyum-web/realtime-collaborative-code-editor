import React, { useState, useRef, useEffect } from "react";
import { VscSend, VscAccount } from "react-icons/vsc";
import { Bot, AlertTriangle } from "lucide-react";

interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
  userEmail: string;
  timestamp: Date;
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
  const [validationWarning, setValidationWarning] = useState("");
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

  // Frontend validation for coding-related questions
  const validateCodingQuestion = (message: string): boolean => {
    const codingKeywords = [
      "code",
      "function",
      "class",
      "variable",
      "error",
      "bug",
      "debug",
      "syntax",
      "algorithm",
      "programming",
      "javascript",
      "typescript",
      "react",
      "node",
      "api",
      "database",
      "query",
      "component",
      "state",
      "props",
      "import",
      "export",
      "async",
      "await",
      "promise",
      "array",
      "object",
      "string",
      "number",
      "boolean",
      "loop",
      "condition",
      "git",
      "version",
      "merge",
      "commit",
      "branch",
      "file",
      "folder",
      "path",
      "module",
      "package",
      "html",
      "css",
      "python",
      "java",
      "c++",
      "php",
      "sql",
      "json",
      "xml",
    ];

    return codingKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword),
    );
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Frontend validation
    if (!validateCodingQuestion(input) && input.length > 10) {
      setValidationWarning(
        "Please ask a coding or programming related question. I can only help with technical and development topics.",
      );
      return;
    }

    setValidationWarning(""); // Clear any previous warnings
    setLoading(true);
    const messageToSend = input; // Store the message before clearing
    setInput("");
    // Always scroll to bottom when user sends a message
    setIsUserAtBottom(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: messageToSend, userEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle different error types
        if (res.status === 429) {
          setValidationWarning(
            "Rate limit exceeded. Please wait a minute before sending another message.",
          );
        } else if (data.error) {
          setValidationWarning(data.error);
        } else {
          throw new Error(data.error || "Failed to get AI response");
        }
        setLoading(false);
        return;
      }

      // Add both messages to the chat
      if (data.userMessage && data.aiMessage) {
        setMessages((msgs) => [...msgs, data.userMessage, data.aiMessage]);
      }
    } catch (error) {
      console.error("AI chat error:", error);
      const errorMsg: AiChatMessage = {
        role: "assistant",
        content: "Error contacting AI. Check console for details.",
        userEmail: "assistant",
        timestamp: new Date(),
      };
      setMessages((msgs) => [...msgs, errorMsg]);
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
          <Bot className="w-5 h-5 text-white" />
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
                        <Bot className="w-3.5 h-3.5" />
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
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="font-medium text-xs text-gray-300">
                  AI Assistant
                </div>
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
        {validationWarning && (
          <div className="mb-2 p-2 bg-yellow-900/50 border border-yellow-600 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-200 text-xs leading-relaxed">
              {validationWarning}
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (validationWarning) setValidationWarning(""); // Clear warning when user types
            }}
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
