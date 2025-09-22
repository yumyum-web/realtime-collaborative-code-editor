"use client";
import React, { useState } from "react";
import { Resizable } from "re-resizable";
import type { ChatMessage, User } from "../types";
import { colorFromString } from "../utils/colorHelpers";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";

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

  const sendChat = () => {
    if (!newMessage.trim() || !user) return;
    onSendMessage({
      senderEmail: user.email,
      senderUsername: user.username ?? user.email,
      message: newMessage.trim(),
      timestamp: Date.now(),
    });
    setNewMessage("");
  };

  return (
    <Resizable
      defaultSize={{ width: 320 }}
      minWidth={220}
      maxWidth={500}
      enable={{ left: true }}
    >
      <aside className="h-full bg-muted/40 border-l border-border flex flex-col">
        <header className="flex justify-between items-center p-3 border-b border-border">
          <h3 className="text-sm font-semibold">Team Chat</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {chatMessages.map((m, i) => (
            <div key={i} className="text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: colorFromString(m.senderEmail) }}
                />
                <span className="font-medium text-primary">
                  {m.senderUsername ?? m.senderEmail}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="ml-4 text-foreground">{m.message}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 p-3 border-t border-border">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Type a message..."
          />
          <Button onClick={sendChat}>Send</Button>
        </div>
      </aside>
    </Resizable>
  );
}
