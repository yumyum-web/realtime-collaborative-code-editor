import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { Project, VersionControl } from "@repo/database";
import type { FileEntity, ProjectDocument } from "@repo/database";
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

    // Check current branch
    const currentBranchInfo = await git.branchLocal();
    const currentBranch = currentBranchInfo.current;
    const availableBranches = currentBranchInfo.all;

    console.log(
      `[GET] Project ${id} - Current branch: ${currentBranch}, Available: [${availableBranches.join(", ")}]`,
    );

    // Check if Git repo has any real commits (not just the auto-generated initial commit)
    const log = await git.log();
    const hasUserCommits =
      log.all.length > 0 &&
      log.all.some((commit) => !commit.message.includes("Initial commit"));

    // If no user commits exist, use MongoDB structure (new project)
    if (!hasUserCommits) {
      console.log(`[GET] New project ${id}, using MongoDB default structure`);
      return NextResponse.json({
        ...project,
        structure: project.structure,
        activeBranch: currentBranch || "main",
        source: "mongodb-default",
      });
    }

    if (branchQuery) {
      // User requested specific branch via query parameter
      if (availableBranches.includes(branchQuery)) {
        if (currentBranch !== branchQuery) {
          // Need to checkout the requested branch
          console.log(
            `[GET] Checking out requested branch: ${branchQuery} (currently on ${currentBranch})`,
          );

          try {
            // Check if there are uncommitted changes
            const status = await git.status();
            if (!status.isClean()) {
              console.log(
                `[GET] Uncommitted changes detected, stashing before checkout`,
              );
              // Commit changes before switching
              await git.add(".");
              await git.commit(`Auto-save before reading ${branchQuery}`, {
                "--allow-empty": null,
              });
            }

            // Checkout the requested branch
            await git.checkout(branchQuery);
            console.log(`[GET] Successfully checked out ${branchQuery}`);
          } catch (checkoutErr) {
            console.error(
              `[GET] Failed to checkout ${branchQuery}:`,
              checkoutErr,
            );
            console.log(`[GET] Falling back to MongoDB`);
            return await loadFromMongoDBVC(id, branchQuery, project);
          }
        } else {
          // Git is already on requested branch
          console.log(`[GET] Already on requested branch: ${branchQuery}`);
        }
      } else {
        // Branch doesn't exist in Git, fall back to MongoDB VC
        console.log(
          `[GET] Branch ${branchQuery} not found in Git, using MongoDB`,
        );
        return await loadFromMongoDBVC(id, branchQuery, project);
      }
    } else {
      // No branch query - just read from whatever is currently checked out
      // This preserves the state set by the branch-git endpoint
      console.log(
        `[GET] No branch query, reading from current branch: ${currentBranch}`,
      );
    }

    // Read files from currently checked out branch (NO checkout happens here!)
    const structure = await readFilesFromRepo(id);
    const finalBranchInfo = await git.branchLocal();
    const activeBranch = finalBranchInfo.current;

    console.log(`[GET] Loaded from Git repo: ${id}/${activeBranch}`);

    return NextResponse.json({
      ...project,
      structure,
      activeBranch,
      source: "git",
    });
  } catch (gitError) {
    console.warn(
      `[GET] Git load failed for ${id}, falling back to MongoDB:`,
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
  console.log(`[MongoDB] Loading from MongoDB for ${projectId}`);

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

          console.log(`[PUT] Git backup completed for project ${id}`);
        }
      } catch (err) {
        console.error(`[PUT] Git backup failed for project ${id}:`, err);
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
