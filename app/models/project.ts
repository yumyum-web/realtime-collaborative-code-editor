import mongoose, { Schema, Document } from "mongoose";

// --- Interfaces for Type Safety ---

export interface Member {
  email: string;
  username: string;
  role: "owner" | "editor";
}

export interface ChatMessage {
  senderEmail: string;
  senderUsername: string;
  message: string;
  timestamp: Date;
}

// Define FileEntity for the project structure (optional, as we use Schema.Types.Mixed)
export type FileEntity = {
  name: string;
  type: "file" | "folder";
  children?: FileEntity[];
  content?: string | null;
};

export interface ProjectDocument extends Document {
  title: string;
  description?: string;
  members: Member[];
  structure: FileEntity; // Using FileEntity type for clarity
  chats: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// --- Schemas ---

const ChatSchema = new Schema<ChatMessage>(
  {
    senderEmail: { type: String, required: true },
    senderUsername: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const MemberSchema = new Schema<Member>(
  {
    email: { type: String, required: true },
    username: { type: String, required: true },
    role: { type: String, enum: ["owner", "editor"], required: true },
  },
  { _id: false },
);

const ProjectSchema = new Schema<ProjectDocument>(
  {
    title: { type: String, required: true },
    description: { type: String },
    members: { type: [MemberSchema], required: true },
    // Use Mixed for flexible, nested file structure representation
    structure: {
      type: Schema.Types.Mixed,
      default: () => ({ name: "root", type: "folder", children: [] }),
    },
    chats: { type: [ChatSchema], default: [] },
  },
  { timestamps: true },
);

const Project =
  mongoose.models.Project ||
  mongoose.model<ProjectDocument>("Project", ProjectSchema);

export default Project;
