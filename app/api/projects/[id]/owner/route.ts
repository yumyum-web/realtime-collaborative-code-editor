import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import Project, { ProjectDocument } from "@/app/models/project";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const { newOwnerEmail } = await req.json();

  const { id } = await context.params; // fixed
  const project = (await Project.findById(id)) as ProjectDocument | null;
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const target = project.members.find(
    (m: { email: string }) => m.email === newOwnerEmail,
  );
  if (!target) {
    return NextResponse.json({ error: "Not a member" }, { status: 400 });
  }

  // Demote old owner
  project.members.forEach((m: { role: string }) => {
    if (m.role === "owner") m.role = "editor";
  });

  // Promote target
  target.role = "owner";
  await project.save();

  return NextResponse.json({
    ...project.toObject(),
    owner: newOwnerEmail,
    collaborators: project.members
      .filter((m: { role: string }) => m.role === "editor")
      .map((m: { email: string }) => m.email),
  });
}
