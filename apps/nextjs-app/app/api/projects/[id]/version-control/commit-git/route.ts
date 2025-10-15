// Enhanced Commit API with Git Integration + Socket.IO notifications

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { Project } from "@repo/database";
import { getGitRepo, writeFilesToRepo } from "@/app/lib/gitUtils";
import { emitSocketEvent } from "@/app/lib/socketio";

// POST: Create a commit using Git
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { message, author, branchName, structure } = await req.json();

    if (!message || !author) {
      return NextResponse.json(
        { error: "message & author required" },
        { status: 400 },
      );
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const targetBranch = branchName || "main";
    const git = await getGitRepo(projectId);

    // Ensure we're on the correct branch
    const branches = await git.branchLocal();
    if (!branches.all.includes(targetBranch)) {
      // Create branch if it doesn't exist
      await git.checkoutLocalBranch(targetBranch);
    } else {
      await git.checkout(targetBranch);
    }

    // Write files to repository
    await writeFilesToRepo(projectId, structure);

    // Stage all changes
    await git.add(".");

    // Create commit
    const commitResult = await git.commit(message, {
      "--author": `${author} <${author}>`,
    });

    // Update MongoDB backup using findByIdAndUpdate to avoid validation issues
    const updateData: { lastSyncedAt: Date; structure?: typeof structure } = {
      lastSyncedAt: new Date(),
    };
    if (targetBranch === "main") {
      updateData.structure = structure;
    }

    await Project.findByIdAndUpdate(
      projectId,
      { $set: updateData },
      { runValidators: false }, // Skip validation to avoid issues with existing data
    );

    console.log(`✅ Git commit created: ${commitResult.commit}`);

    // 🔔 NOTIFY OTHER USERS via Socket.IO (non-blocking)
    emitSocketEvent(projectId, "commit-created", {
      projectId,
      branchName: targetBranch,
      commitHash: commitResult.commit,
      message,
      author,
      timestamp: new Date().toISOString(),
    })
      .then(() => {
        console.log(
          `📢 Broadcasted commit notification to project ${projectId}`,
        );
      })
      .catch((socketErr) => {
        console.error(
          "⚠️ Failed to broadcast socket event (non-fatal):",
          socketErr,
        );
      });

    return NextResponse.json({
      success: true,
      commit: {
        hash: commitResult.commit,
        message,
        author,
        branch: targetBranch,
      },
    });
  } catch (err) {
    console.error("POST commit error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error("Error details:", errorMessage);
    console.error("Stack trace:", errorStack);
    return NextResponse.json(
      { error: "Failed to create commit", details: errorMessage },
      { status: 500 },
    );
  }
}

// GET: Get commit history using Git
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const url = new URL(req.url);
    const branchName = url.searchParams.get("branch") || "main";

    console.log(
      `📜 Fetching commits for branch: ${branchName} (project: ${projectId})`,
    );

    const git = await getGitRepo(projectId);

    // Verify branch exists
    const branches = await git.branchLocal();
    if (!branches.all.includes(branchName)) {
      console.error(
        `Branch ${branchName} not found. Available: ${branches.all.join(", ")}`,
      );
      return NextResponse.json(
        { error: `Branch "${branchName}" not found`, commits: [] },
        { status: 404 },
      );
    }

    // Get commit log for the specific branch
    try {
      const log = await git.log([branchName, "--max-count=50"]);

      const commits = log.all.map((commit) => ({
        _id: commit.hash,
        message: commit.message,
        author: commit.author_name,
        timestamp: commit.date,
      }));

      console.log(`✅ Found ${commits.length} commits for ${branchName}`);
      return NextResponse.json({ commits });
    } catch (logErr) {
      console.error(`Failed to get log for ${branchName}:`, logErr);

      // If log fails, the branch might be empty or have issues
      // Return empty array instead of failing
      return NextResponse.json({ commits: [] });
    }
  } catch (err) {
    console.error("GET commits error:", err);
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMsg, commits: [] }, { status: 500 });
  }
}

// PUT: Restore/checkout a specific commit
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { commitHash, branchName } = await req.json();

    if (!commitHash) {
      return NextResponse.json(
        { error: "commitHash required" },
        { status: 400 },
      );
    }

    const git = await getGitRepo(projectId);
    const targetBranch = branchName || "main";

    // Checkout the branch
    await git.checkout(targetBranch);

    // Reset to specific commit (hard reset)
    await git.reset(["--hard", commitHash]);

    // Read the restored structure
    const { readFilesFromRepo } = await import("@/app/lib/gitUtils");
    const restoredStructure = await readFilesFromRepo(projectId);

    // Update MongoDB if on main branch
    if (targetBranch === "main") {
      await Project.findByIdAndUpdate(
        projectId,
        {
          $set: {
            structure: restoredStructure,
            lastSyncedAt: new Date(),
          },
        },
        { runValidators: false }, // Skip validation to avoid issues with existing data
      );
    }

    console.log(`✅ Restored commit ${commitHash} on ${targetBranch}`);

    // Notify other users (non-blocking)
    emitSocketEvent(projectId, "commit-restored", {
      projectId,
      branchName: targetBranch,
      commitHash,
      timestamp: new Date().toISOString(),
    }).catch((err) =>
      console.error("⚠️ Socket broadcast failed (non-fatal):", err),
    );

    return NextResponse.json({
      success: true,
      structure: restoredStructure,
      branch: targetBranch,
    });
  } catch (err) {
    console.error("PUT commit restore error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
