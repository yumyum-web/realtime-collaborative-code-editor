import React, { useState, useRef, useEffect } from "react";

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

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/ai-chat`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.aiChats || []);
        }
      } catch (error) {
        console.error("Failed to load AI chat history:", error);
      }
    };
    loadChatHistory();
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-card">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          🤖 AI Assistant
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-gray-400 text-center py-8">
            <p>👋 Ask me anything about code!</p>
            <p className="text-sm mt-2">
              Try: &quot;give me insertion sort in python&quot;
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              <div className="text-xs font-semibold mb-1 opacity-70">
                {msg.role === "user" ? "You" : "🤖 AI Assistant"}
              </div>
              <div className="whitespace-pre-wrap break-words">
                {msg.content}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 text-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="animate-pulse">🤖</div>
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 border-t border-gray-700 flex gap-2 bg-card">
        <input
          className="flex-1 rounded bg-gray-800 text-white px-3 py-2 outline-none"
          placeholder="Ask AI for code help..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage()}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
          disabled={loading || !input.trim()}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
};
