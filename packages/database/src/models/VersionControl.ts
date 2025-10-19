import mongoose, { Schema, Document } from "mongoose";
import { FileEntity } from "./project.js"; // Re-using FileEntity type from Project model

// --- Interfaces for Type Safety ---

export interface Commit {
  _id?: mongoose.Types.ObjectId;
  message: string;
  author: string;
  timestamp: Date;
  structure: FileEntity; // full file tree snapshot
}

export interface Branch {
  name: string;
  commits: Commit[];
  lastStructure: FileEntity; // working tree for branch (latest changes)
  lastMergedFrom?: string; // optional metadata
}

export interface VersionControlDocument extends Document {
  projectId: mongoose.Types.ObjectId;
  branches: Branch[];
  activeBranch: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- Schemas ---

const CommitSchema = new Schema<Commit>(
  {
    message: { type: String, required: true },
    author: { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
    structure: { type: Schema.Types.Mixed, required: true },
  },
  { _id: true }, // Mongoose auto-generates ObjectId for subdocuments
);

const BranchSchema = new Schema<Branch>({
  name: { type: String, required: true },
  commits: { type: [CommitSchema], default: [] },
  lastStructure: { type: Schema.Types.Mixed, default: {} },
  lastMergedFrom: { type: String },
});

const VersionControlSchema = new Schema<VersionControlDocument>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
    },
    branches: { type: [BranchSchema], default: [] },
    activeBranch: { type: String, default: "main" },
  },
  { timestamps: true },
);

const VersionControl =
  mongoose.models.VersionControl ||
  mongoose.model<VersionControlDocument>(
    "VersionControl",
    VersionControlSchema,
  );

export default VersionControl;
