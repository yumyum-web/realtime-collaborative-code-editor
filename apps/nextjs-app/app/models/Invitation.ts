import mongoose from "mongoose";

const InvitationSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    projectTitle: { type: String, required: true },
    ownerEmail: { type: String, required: true },
    collaboratorEmail: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export default mongoose.models.Invitation ||
  mongoose.model("Invitation", InvitationSchema);
