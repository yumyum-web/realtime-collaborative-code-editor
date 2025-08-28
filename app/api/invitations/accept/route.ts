import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../lib/mongoose";
import Invitation from "../../../models/Invitation";
import User from "../../../models/User";
import Project from "../../../models/project";

// POST /api/invitations/accept?token=INVITATION_ID
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) {
      return NextResponse.json(
        { error: "Missing invitation token" },
        { status: 400 },
      );
    }

    // Get user from auth (assume JWT in header or session, or pass email in body for demo)
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json(
        { error: "User email required" },
        { status: 401 },
      );
    }

    // Find invitation
    const invitation = await Invitation.findById(token);
    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 },
      );
    }
    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Invitation already handled" },
        { status: 400 },
      );
    }
    if (invitation.collaboratorEmail !== email) {
      return NextResponse.json(
        { error: "This invitation is not for your email" },
        { status: 403 },
      );
    }

    // Add project to user's projects
    const user = await User.findOneAndUpdate(
      { email },
      { $addToSet: { projects: invitation.projectId } },
      { upsert: false, new: true },
    );
    if (!user) {
      return NextResponse.json(
        { error: "User not found. Please sign up first." },
        { status: 404 },
      );
    }

    // Mark invitation as accepted
    invitation.status = "accepted";
    await invitation.save();

    return NextResponse.json({
      message: "Invitation accepted",
      projectId: invitation.projectId,
    });
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
