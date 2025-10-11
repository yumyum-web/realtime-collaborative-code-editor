// Enhanced Commit API with Git Integration + Socket.IO notifications

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import Project from "@/app/models/project";
import { getGitRepo, writeFilesToRepo } from "@/app/lib/gitUtils";
import { Server as SocketIOServer } from "socket.io";

// Get Socket.IO instance (you'll need to export this from your socket server)
function getSocketIO(): SocketIOServer | null {
  return global.socketIOServer || null;
}

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

    // Update MongoDB backup
    if (targetBranch === "main") {
      project.structure = structure;
    }
    project.lastSyncedAt = new Date();
    await project.save();

    console.log(`✅ Git commit created: ${commitResult.commit}`);

    // 🔔 NOTIFY OTHER USERS via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(projectId).emit("commit-created", {
        projectId,
        branchName: targetBranch,
        commitHash: commitResult.commit,
        message,
        author,
        timestamp: new Date().toISOString(),
      });
      console.log(`📢 Broadcasted commit notification to project ${projectId}`);
    }

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
    return NextResponse.json({ error: "Server error" }, { status: 500 });
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

    const git = await getGitRepo(projectId);

    // Get commit log for the branch
    const log = await git.log([branchName]);

    const commits = log.all.map((commit) => ({
      _id: commit.hash,
      message: commit.message,
      author: commit.author_name,
      timestamp: commit.date,
    }));

    return NextResponse.json({ commits });
  } catch (err) {
    console.error("GET commits error:", err);
    return NextResponse.json({ commits: [] });
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
      await Project.findByIdAndUpdate(projectId, {
        structure: restoredStructure,
        lastSyncedAt: new Date(),
      });
    }

    console.log(`✅ Restored commit ${commitHash} on ${targetBranch}`);

    // Notify other users
    const io = getSocketIO();
    if (io) {
      io.to(projectId).emit("commit-restored", {
        projectId,
        branchName: targetBranch,
        commitHash,
        timestamp: new Date().toISOString(),
      });
    }

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
