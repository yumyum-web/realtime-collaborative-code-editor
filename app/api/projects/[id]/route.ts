import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import Project, { FileEntity, ProjectDocument } from "@/app/models/project"; // Import types

type UpdateProjectBody = {
  title?: string;
  description?: string;
  structure?: FileEntity;
};

// GET project by ID
export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }, // Use standard Next.js context parameter type
) {
  await connectDB();
  const { id } = context.params;
  const project = await Project.findById(id).lean();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

// Update project (used by main save, only updates Project.structure when on 'main' branch)
export async function PUT(
  req: NextRequest,
  context: { params: { id: string } },
) {
  await connectDB();
  const { id } = context.params;
  const body: UpdateProjectBody = await req.json();

  const update: UpdateProjectBody = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description;
  if (body.structure !== undefined) update.structure = body.structure;

  // Use findByIdAndUpdate for simplicity when only updating the main document
  const project = await Project.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  }).lean();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

// Delete project (only owner)
export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } },
) {
  await connectDB();
  const { id } = context.params;

  const userEmail = req.headers.get("x-user-email");
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await Project.findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const owner = project.members.find(
    (m: { email: string; role: string }) => m.role === "owner",
  );
  if (owner?.email !== userEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await Project.findByIdAndDelete(id);
  // NOTE: In a complete system, you should also delete the associated VersionControl document here.

  return NextResponse.json({ message: "Project deleted successfully" });
}

// Add chat message
export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  await connectDB();
  const { id } = context.params;
  const { senderEmail, senderUsername, message } = await req.json();

  // Find the project document for update
  const project = (await Project.findById(id)) as ProjectDocument | null;
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const chatMsg = {
    senderEmail,
    senderUsername,
    message,
    timestamp: new Date(),
  };

  project.chats.push(chatMsg);
  await project.save();

  return NextResponse.json(chatMsg);
}
