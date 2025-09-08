import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import Project from "@/app/models/project";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  await connectDB();
  const { id } = context.params;
  const project = await Project.findById(id).lean();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

type UpdateProjectBody = {
  title?: string;
  description?: string;
  structure?: FileEntity;
};

type FileEntity = {
  name: string;
  type: "file" | "folder";
  children?: FileEntity[];
  content?: string | null;
};

export async function PUT(req: NextRequest, context: RouteContext) {
  await connectDB();
  const { id } = context.params;
  const body: UpdateProjectBody = await req.json();

  const update: UpdateProjectBody = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description;
  if (body.structure !== undefined) update.structure = body.structure;

  const project = await Project.findByIdAndUpdate(id, update, {
    new: true,
  }).lean();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

//owner can delete the project

export async function DELETE(req: NextRequest, context: RouteContext) {
  await connectDB();
  const { id } = context.params;

  // Optionally verify the user making the request
  const userEmail = req.headers.get("x-user-email");
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await Project.findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Only owner can delete
  const owner = project.members.find(
    (m: { email: string; role: string }) => m.role === "owner",
  );
  if (owner?.email !== userEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await Project.findByIdAndDelete(id);

  return NextResponse.json({ message: "Project deleted successfully" });
}

export async function POST(req: NextRequest, context: RouteContext) {
  await connectDB();
  const { id } = context.params;
  const { senderEmail, senderUsername, message } = await req.json();

  const project = await Project.findById(id);
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
