"use client";
import React from "react";
import type { PresenceUser } from "../types";

export function PresenceList({ presence }: { presence: PresenceUser[] }) {
  return (
    <div className="mt-6">
      <h4 className="text-sm font-semibold mb-2">Active</h4>
      <div className="space-y-2">
        {presence.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No collaborators yet
          </div>
        )}
        {presence.map((p) => (
          <div key={p.clientId} className="flex items-center gap-2">
            <span
              style={{
                width: 10,
                height: 10,
                background: p.user?.color ?? "#888",
                borderRadius: 3,
              }}
            />
            <div>
              <div className="font-medium text-sm">
                {p.user?.name ?? p.user?.email ?? "unknown"}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.cursor
                  ? `Line ${p.cursor.line}, Col ${p.cursor.column}`
                  : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
