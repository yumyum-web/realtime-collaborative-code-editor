import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { Project, Invitation } from "@repo/database";
import sendEmail from "@/app/lib/email";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { email } = await req.json();
    const userEmail = req.headers.get("x-user-email");
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const { id } = await context.params; // fixed
    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only owner can invite
    const owner = project.members.find(
      (m: { email: string; role: string }) => m.role === "owner",
    )?.email;
    if (owner !== userEmail) {
      return NextResponse.json(
        { error: "Only owner can invite collaborators" },
        { status: 403 },
      );
    }

    // Check if already in members
    if (
      project.members.some(
        (m: { email: string; role: string }) => m.email === email,
      )
    ) {
      return NextResponse.json({ error: "Already a member" }, { status: 400 });
    }

    // Check if already invited
    const existingInvite = await Invitation.findOne({
      projectId: project._id,
      collaboratorEmail: email,
      status: "pending",
    });
    if (existingInvite) {
      return NextResponse.json(
        { error: "Invitation already sent" },
        { status: 400 },
      );
    }

    // Create invitation
    const invitation = await Invitation.create({
      projectId: project._id,
      projectTitle: project.title,
      ownerEmail: owner,
      collaboratorEmail: email,
      status: "pending",
    });

    // Send invitation email
    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";
    const inviteUrl = `${appBaseUrl}/invitations/accept?token=${invitation._id}`;
    await sendEmail({
      to: email,
      subject: `Invitation to Collaborate on "${project.title}"`,
      text: `You have been invited by ${owner} to collaborate on the project "${project.title}". Click the link to accept: ${inviteUrl}`,
      html: `<p>You have been invited by <strong>${owner}</strong> to collaborate on the project <strong>${project.title}</strong>.</p><p>Click <a href="${inviteUrl}">here</a> to accept the invitation.</p>`,
    });

    return NextResponse.json(invitation, { status: 201 });
  } catch (err) {
    console.error("Error sending invitation:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { email } = await req.json();

    const { id } = await context.params; // fixed
    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    project.members = project.members.filter(
      (m: { email: string; role: string }) => m.email !== email,
    );
    await project.save();

    return NextResponse.json({
      ...project.toObject(),
      owner:
        project.members.find(
          (m: { email: string; role: string }) => m.role === "owner",
        )?.email || "",
      collaborators: project.members
        .filter((m: { email: string; role: string }) => m.role === "editor")
        .map((m: { email: string; role: string }) => m.email),
    });
  } catch (err) {
    console.error("Error removing collaborator:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
