import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Invitation from "@/app/models/Invitation";
import connectDB from "@/app/lib/connectDB";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const { id: projectId } = await context.params; // Await the params properly
  if (!projectId) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }
  try {
    const invitations = await Invitation.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      status: "pending",
    });
    return NextResponse.json(invitations);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const { id: projectId } = await context.params; // Await the params properly
  if (!projectId) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }
  try {
    const { invitationId } = await req.json();
    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID required" },
        { status: 400 },
      );
    }
    const invitation = await Invitation.findById(invitationId);
    if (!invitation || invitation.projectId.toString() !== projectId) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 },
      );
    }
    await Invitation.findByIdAndDelete(invitationId);
    return NextResponse.json({ message: "Invitation canceled" });
  } catch {
    return NextResponse.json(
      { error: "Failed to cancel invitation" },
      { status: 500 },
    );
  }
}
