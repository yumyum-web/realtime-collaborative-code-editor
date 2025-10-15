import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { Invitation, Project, User } from "@repo/database";

// GET invitations for a user
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail");
    if (!userEmail)
      return NextResponse.json(
        { error: "userEmail required" },
        { status: 400 },
      );

    const invitations = await Invitation.find({
      collaboratorEmail: userEmail,
      status: "pending",
    }).lean();

    return NextResponse.json(invitations);
  } catch (err) {
    console.error("Invitations GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST accept/decline
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { invitationId, action } = await req.json();
    if (!invitationId || !["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const invitation = await Invitation.findById(invitationId);
    if (!invitation)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    invitation.status = action === "accept" ? "accepted" : "declined";
    await invitation.save();

    if (action === "accept") {
      // ensure user exists
      await User.findOneAndUpdate(
        { email: invitation.collaboratorEmail },
        { $addToSet: { projects: invitation.projectId } },
        { upsert: true },
      );

      // add to project.members
      await Project.findByIdAndUpdate(invitation.projectId, {
        $addToSet: {
          members: { email: invitation.collaboratorEmail, role: "editor" },
        },
      });
    }

    return NextResponse.json({ message: `Invitation ${action}ed` });
  } catch (err) {
    console.error("Invitations POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
