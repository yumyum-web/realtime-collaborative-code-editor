import mongoose, { Schema, Document } from "mongoose";

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

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  filesChanged: string[];
}

export interface GitBranch {
  name: string;
  current: boolean;
}

export interface ProjectDocument extends Document {
  title: string;
  description?: string;
  members: Member[];
  structure: Record<string, unknown>;
  chats: ChatMessage[];
  gitRepoPath?: string; // Path to the Git repository on the server
  gitCommits: GitCommit[]; // List of commits
  gitBranches: GitBranch[]; // List of branches
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<ChatMessage>(
  {
    senderEmail: { type: String, required: true },
    senderUsername: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const GitCommitSchema = new Schema<GitCommit>(
  {
    hash: { type: String, required: true },
    message: { type: String, required: true },
    author: { type: String, required: true },
    date: { type: Date, required: true },
    filesChanged: { type: [String], default: [] },
  },
  { _id: false },
);

const GitBranchSchema = new Schema<GitBranch>(
  {
    name: { type: String, required: true },
    current: { type: Boolean, default: false },
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
    structure: { type: Schema.Types.Mixed, default: {} },
    chats: { type: [ChatSchema], default: [] },
    gitRepoPath: { type: String },
    gitCommits: { type: [GitCommitSchema], default: [] },
    gitBranches: { type: [GitBranchSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.models.Project ||
  mongoose.model<ProjectDocument>("Project", ProjectSchema);
