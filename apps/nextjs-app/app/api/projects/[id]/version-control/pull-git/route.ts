// Pull Changes API - Fetch updates from Git repository

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { Project } from "@repo/database";
import { getGitRepo, readFilesFromRepo } from "@/app/lib/gitUtils";
import { emitSocketEvent } from "@/app/lib/socketio";

// GET: Check for new commits on current branch
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;

    const git = await getGitRepo(projectId);
    const branchInfo = await git.branchLocal();
    const currentBranch = branchInfo.current;

    // Get commit history
    const log = await git.log({ maxCount: 10 });
    const latestCommit = log.latest;

    return NextResponse.json({
      currentBranch,
      latestCommit: {
        hash: latestCommit?.hash,
        message: latestCommit?.message,
        author: latestCommit?.author_name,
        date: latestCommit?.date,
      },
      totalCommits: log.total,
      recentCommits: log.all.slice(0, 10).map((c) => ({
        hash: c.hash,
        message: c.message,
        author: c.author_name,
        date: c.date,
      })),
    });
  } catch (err) {
    console.error("GET pull status error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: Pull latest changes from current branch
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;

    const git = await getGitRepo(projectId);
    const branchInfo = await git.branchLocal();
    const currentBranch = branchInfo.current;

    // Get latest commit before pull
    const beforeLog = await git.log({ maxCount: 1 });
    const beforeCommit = beforeLog.latest?.hash;

    // Read the latest structure from Git
    const structure = await readFilesFromRepo(projectId);

    // Get latest commit after reading
    const afterLog = await git.log({ maxCount: 1 });
    const afterCommit = afterLog.latest?.hash;

    console.log(`✅ Pulled latest changes on ${currentBranch}`);

    // Update MongoDB backup with latest structure
    await Project.findByIdAndUpdate(
      projectId,
      {
        $set: {
          structure,
          activeBranch: currentBranch,
          lastSyncedAt: new Date(),
        },
      },
      { runValidators: false }, // Skip validation to avoid issues with existing data
    );

    // Broadcast pull event to notify other users (non-blocking)
    emitSocketEvent(projectId, "changes-pulled", {
      branch: currentBranch,
      structure,
      commit: afterCommit,
    }).catch((err) =>
      console.error("⚠️ Socket broadcast failed (non-fatal):", err),
    );

    return NextResponse.json({
      success: true,
      branch: currentBranch,
      structure,
      hasNewChanges: beforeCommit !== afterCommit,
      latestCommit: {
        hash: afterLog.latest?.hash,
        message: afterLog.latest?.message,
        author: afterLog.latest?.author_name,
        date: afterLog.latest?.date,
      },
    });
  } catch (err) {
    console.error("POST pull error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    console.error("Error details:", errorMessage);
    return NextResponse.json(
      { error: "Failed to pull changes", details: errorMessage },
      { status: 500 },
    );
  }
}
