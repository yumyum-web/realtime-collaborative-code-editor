import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import Project from "@/app/models/project";

// Type definitions
interface Member {
  email: string;
  role: "owner" | "editor";
}

interface ProjectDoc {
  _id: string;
  title: string;
  description: string;
  members: Member[];
  structure: unknown;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// GET /api/projects/[id] - fetch single project
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await connectDB();

  const project = (await Project.findById(
    params.id,
  ).lean()) as ProjectDoc | null;
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...project,
    owner: project.members.find((m: Member) => m.role === "owner")?.email || "",
    collaborators: project.members
      .filter((m: Member) => m.role === "editor")
      .map((m: Member) => m.email),
  });
}

// PUT /api/projects/[id] - update project (title, description, structure)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await connectDB();
  const { title, description, structure } = await req.json();

  const project = (await Project.findByIdAndUpdate(
    params.id,
    { title, description, structure },
    { new: true },
  ).lean()) as ProjectDoc | null;

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...project,
    owner: project.members.find((m: Member) => m.role === "owner")?.email || "",
    collaborators: project.members
      .filter((m: Member) => m.role === "editor")
      .map((m: Member) => m.email),
  });
}

// DELETE /api/projects/[id] - delete project
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await connectDB();

  const project = await Project.findByIdAndDelete(params.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Project deleted" });
}
