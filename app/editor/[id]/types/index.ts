export type FileNode = {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
};

export type ChatMessage = {
  senderEmail: string;
  senderUsername: string;
  message: string;
  timestamp: number;
};

export type NodeAddedPayload = {
  type: "file" | "folder";
  parentPath: string;
  name: string;
};

export type NodeDeletedPayload = { path: string };

export type User = {
  email: string;
  username?: string;
};

export type PresenceUser = {
  clientId: number;
  user?: { name?: string; email?: string; color?: string };
  cursor?: { line: number; column: number };
};
