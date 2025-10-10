import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import Project, { FileEntity, ProjectDocument } from "@/app/models/project";
import VersionControl from "@/app/models/VersionControl";

type UpdateProjectBody = {
  title?: string;
  description?: string;
  structure?: FileEntity;
};

// GET project by ID - now respects active branch
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const { id } = await context.params;

  // Check if branch query parameter is provided
  const { searchParams } = new URL(req.url);
  const branchQuery = searchParams.get("branch");

  const project = (await Project.findById(id).lean()) as ProjectDocument | null;
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // If branch query is provided and it's not "main", fetch from version control
  if (branchQuery && branchQuery !== "main") {
    try {
      const versionControl = await VersionControl.findOne({ projectId: id });
      if (!versionControl) {
        // If no version control found, return main project structure
        return NextResponse.json(project);
      }

      const branch = versionControl.branches.find(
        (b: { name: string; lastStructure?: FileEntity }) =>
          b.name === branchQuery,
      );
      if (!branch) {
        return NextResponse.json(
          { error: `Branch "${branchQuery}" not found` },
          { status: 404 },
        );
      }

      // Return project with branch structure
      return NextResponse.json({
        ...project,
        structure: branch.lastStructure || project.structure,
        activeBranch: branchQuery,
      });
    } catch (err) {
      console.error("Error fetching branch data:", err);
      // Fallback to main structure
      return NextResponse.json(project);
    }
  }

  // If no branch specified or branch is "main", check for active branch in version control
  try {
    const versionControl = await VersionControl.findOne({ projectId: id });
    if (
      versionControl &&
      versionControl.activeBranch &&
      versionControl.activeBranch !== "main"
    ) {
      const activeBranch = versionControl.branches.find(
        (b: { name: string; lastStructure?: FileEntity }) =>
          b.name === versionControl.activeBranch,
      );

      if (activeBranch && activeBranch.lastStructure) {
        return NextResponse.json({
          ...project,
          structure: activeBranch.lastStructure,
          activeBranch: versionControl.activeBranch,
        });
      }
    }
  } catch (err) {
    console.error("Error checking active branch:", err);
  }

  // Default: return main project structure
  return NextResponse.json({
    ...project,
    activeBranch: "main",
  });
}

// Update project (used by main save, only updates Project.structure when on 'main' branch)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const { id } = await context.params;
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
  context: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const { id } = await context.params;

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

  // Also delete the associated VersionControl document
  try {
    await VersionControl.findOneAndDelete({ projectId: id });
  } catch (err) {
    console.error("Error deleting version control:", err);
  }

  return NextResponse.json({ message: "Project deleted successfully" });
}

// Add chat message
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const { id } = await context.params;
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
