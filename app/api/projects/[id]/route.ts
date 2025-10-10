import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import Project, { FileEntity, ProjectDocument } from "@/app/models/project";
import VersionControl from "@/app/models/VersionControl";
import { getGitRepo, getRepoPath, readFilesFromRepo } from "@/app/lib/gitUtils";

type UpdateProjectBody = {
  title?: string;
  description?: string;
  structure?: FileEntity;
};

// GET project by ID - HYBRID: Try Git first, fallback to MongoDB
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

  // HYBRID STRATEGY 1: Try loading from Git repository (FASTEST)
  try {
    const repoPath = getRepoPath(id);
    const git = await getGitRepo(id);

    // Initialize gitRepoPath if not set
    if (!project.gitRepoPath) {
      await Project.findByIdAndUpdate(id, { gitRepoPath: repoPath });
      project.gitRepoPath = repoPath;
    }

    // Check if we need to switch branches
    if (branchQuery && branchQuery !== "main") {
      const branches = await git.branchLocal();
      if (branches.all.includes(branchQuery)) {
        await git.checkout(branchQuery);
      } else {
        // Branch doesn't exist in Git, fall back to MongoDB VC
        console.log(`⚠️ Branch ${branchQuery} not in Git, using MongoDB VC`);
        return await loadFromMongoDBVC(id, branchQuery, project);
      }
    } else if (branchQuery === "main") {
      await git.checkout("main");
    }

    // Read files from Git repository
    const structure = await readFilesFromRepo(id);
    console.log(`📁 Loaded from Git repo: ${id}/${branchQuery || "main"}`);

    return NextResponse.json({
      ...project,
      structure,
      activeBranch: branchQuery || "main",
      source: "git", // Indicate source for debugging
    });
  } catch (gitError) {
    console.warn(
      `⚠️ Git load failed for ${id}, falling back to MongoDB:`,
      gitError,
    );

    // HYBRID STRATEGY 2: Fall back to MongoDB (RELIABLE)
    return await loadFromMongoDBVC(id, branchQuery, project);
  }
}

// Helper function to load from MongoDB version control
async function loadFromMongoDBVC(
  projectId: string,
  branchQuery: string | null,
  project: ProjectDocument,
) {
  console.log(`💾 Loading from MongoDB for ${projectId}`);

  // If branch query is provided and it's not "main", fetch from version control
  if (branchQuery && branchQuery !== "main") {
    try {
      const versionControl = await VersionControl.findOne({ projectId });
      if (!versionControl) {
        // If no version control found, return main project structure
        return NextResponse.json({ ...project, source: "mongodb-main" });
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
    const versionControl = await VersionControl.findOne({ projectId });
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
          source: "mongodb-branch",
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
    source: "mongodb-main",
  });
}

// Update project - HYBRID: Save to Git first, then MongoDB backup
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
  if (body.structure !== undefined) {
    update.structure = body.structure;

    // HYBRID SAVE: Write to Git repository (async, non-blocking)
    setImmediate(async () => {
      try {
        const { writeFilesToRepo } = await import("@/app/lib/gitUtils");
        if (body.structure) {
          await writeFilesToRepo(id, body.structure);

          // Update lastSyncedAt timestamp
          await Project.findByIdAndUpdate(id, {
            lastSyncedAt: new Date(),
          });

          console.log(`✅ Git backup completed for project ${id}`);
        }
      } catch (err) {
        console.error(`⚠️ Git backup failed for project ${id}:`, err);
      }
    });
  }

  // Use findByIdAndUpdate for MongoDB (primary for now, backup later)
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
