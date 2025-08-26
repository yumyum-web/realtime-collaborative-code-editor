// app/api/invitations/route.ts

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import Invitation from "@/app/models/Invitation";
import Project from "@/app/models/project";
import User from "@/app/models/User";

// ✅ GET invitations for a specific user
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail");

    if (!userEmail) {
      return NextResponse.json(
        { error: "Missing user email" },
        { status: 400 },
      );
    }

    const invitations = await Invitation.find({
      collaboratorEmail: userEmail,
      status: "pending",
    }).populate("projectId");

    return NextResponse.json(invitations);
  } catch (error) {
    console.error("Error in /api/invitations GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ✅ POST: Accept or decline invitation
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { invitationId, action } = await req.json(); // action = "accept" or "decline"

    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 },
      );
    }

    invitation.status = action === "accept" ? "accepted" : "declined";
    await invitation.save();

    if (action === "accept") {
      // ✅ Add project to user
      await User.findOneAndUpdate(
        { email: invitation.collaboratorEmail },
        { $addToSet: { projects: invitation.projectId } },
        { upsert: true },
      );

      // ✅ Add collaborator to project
      await Project.findByIdAndUpdate(invitation.projectId, {
        $addToSet: { collaborators: invitation.collaboratorEmail },
      });
    }

    return NextResponse.json({
      message: `Invitation ${action}ed successfully`,
    });
  } catch (error) {
    console.error("Error in /api/invitations POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
