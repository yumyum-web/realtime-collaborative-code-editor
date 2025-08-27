import mongoose, { Schema, Document } from "mongoose";

export interface Member {
  email: string;
  role: "owner" | "editor";
}

export interface ProjectDocument extends Document {
  title: string;
  description?: string;
  members: Member[]; // contains both owner + collaborators
  structure: Record<string, unknown>; // Replaced 'any' with 'unknown' for better type safety
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<ProjectDocument>(
  {
    title: { type: String, required: true },
    description: { type: String },
    members: [
      {
        email: { type: String, required: true },
        role: { type: String, enum: ["owner", "editor"], required: true },
      },
    ],
    structure: { type: Schema.Types.Mixed, default: {} }, // Ensure this matches the updated type
  },
  { timestamps: true },
);

export default mongoose.models.Project ||
  mongoose.model<ProjectDocument>("Project", ProjectSchema);
