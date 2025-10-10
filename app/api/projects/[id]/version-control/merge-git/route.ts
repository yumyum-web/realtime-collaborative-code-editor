// Enhanced Merge API with Git Integration

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import {
  getGitRepo,
  readFilesFromRepo,
  writeFilesToRepo,
} from "@/app/lib/gitUtils";

// POST: Merge branch into current branch
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { sourceBranch } = await req.json();

    if (!sourceBranch) {
      return NextResponse.json(
        { error: "sourceBranch required" },
        { status: 400 },
      );
    }

    const git = await getGitRepo(projectId);
    const branchInfo = await git.branchLocal();
    const targetBranch = branchInfo.current;

    // Check if source branch exists
    if (!branchInfo.all.includes(sourceBranch)) {
      return NextResponse.json(
        { error: "Source branch not found" },
        { status: 404 },
      );
    }

    // Cannot merge into itself
    if (targetBranch === sourceBranch) {
      return NextResponse.json(
        { error: "Cannot merge branch into itself" },
        { status: 400 },
      );
    }

    // Try to merge
    const mergeResult = await git.merge([sourceBranch]);

    // Check for conflicts
    if (mergeResult.conflicts && mergeResult.conflicts.length > 0) {
      // Read the conflicted state
      const structure = await readFilesFromRepo(projectId);

      return NextResponse.json({
        success: false,
        hasConflicts: true,
        conflicts: mergeResult.conflicts,
        structure, // Contains conflict markers
        message: "Merge conflicts detected",
      });
    }

    // Successful merge
    const finalStructure = await readFilesFromRepo(projectId);

    console.log(`✅ Merged ${sourceBranch} into ${targetBranch}`);

    // Broadcast merge event via Socket.IO
    const io = global.socketIOServer;
    if (io) {
      io.to(projectId).emit("branch-merged", {
        sourceBranch,
        targetBranch,
        structure: finalStructure,
      });
    }

    return NextResponse.json({
      success: true,
      hasConflicts: false,
      targetBranch,
      sourceBranch,
      structure: finalStructure,
      summary: mergeResult.summary,
    });
  } catch (err) {
    console.error("Merge error:", err);

    // Git merge conflicts throw errors
    if (err instanceof Error && err.message?.includes("CONFLICTS")) {
      const structure = await readFilesFromRepo((await params).id);

      return NextResponse.json({
        success: false,
        hasConflicts: true,
        structure,
        message: err.message,
      });
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT: Resolve merge conflicts
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { resolvedStructure, commitMessage } = await req.json();

    if (!resolvedStructure) {
      return NextResponse.json(
        { error: "resolvedStructure required" },
        { status: 400 },
      );
    }

    const git = await getGitRepo(projectId);

    // Write resolved files to repo
    await writeFilesToRepo(projectId, resolvedStructure);

    // Stage all resolved files
    await git.add(".");

    // Complete the merge with a commit
    const message = commitMessage || "Merge: Resolved conflicts";
    await git.commit(message);

    console.log(`✅ Merge conflicts resolved`);

    // Broadcast conflict resolution
    const io = global.socketIOServer;
    if (io) {
      io.to(projectId).emit("conflicts-resolved", {
        structure: resolvedStructure,
        message,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Conflicts resolved and merge completed",
      structure: resolvedStructure,
    });
  } catch (err) {
    console.error("Conflict resolution error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET: Check merge status (if merge is in progress)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;

    const git = await getGitRepo(projectId);
    const status = await git.status();

    return NextResponse.json({
      mergeInProgress: status.conflicted.length > 0,
      conflicts: status.conflicted,
      currentBranch: status.current,
    });
  } catch (err) {
    console.error("GET merge status error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
