// Sync API - Sync current workspace with Git repository

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { getGitRepo, writeFilesToRepo } from "@/app/lib/gitUtils";

// POST: Sync workspace - save current changes to Git
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { structure, autoCommit, commitMessage } = await req.json();

    if (!structure) {
      return NextResponse.json(
        { error: "structure required" },
        { status: 400 },
      );
    }

    const git = await getGitRepo(projectId);
    const branchInfo = await git.branchLocal();
    const currentBranch = branchInfo.current;

    // Write structure to Git repository
    await writeFilesToRepo(projectId, structure);

    // Check status after writing
    const status = await git.status();

    // Auto-commit if requested and there are changes
    if (autoCommit && !status.isClean()) {
      await git.add(".");
      const message = commitMessage || `Auto-sync on ${currentBranch}`;
      await git.commit(message, { "--allow-empty": null });

      console.log(`✅ Auto-committed changes on ${currentBranch}`);

      return NextResponse.json({
        success: true,
        synced: true,
        committed: true,
        branch: currentBranch,
        message: "Workspace synced and committed",
      });
    }

    console.log(`✅ Synced workspace to ${currentBranch}`);

    return NextResponse.json({
      success: true,
      synced: true,
      committed: false,
      branch: currentBranch,
      hasUncommittedChanges: !status.isClean(),
      modifiedFiles:
        status.modified.length + status.created.length + status.deleted.length,
    });
  } catch (err) {
    console.error("POST sync error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json(
      { error: "Failed to sync workspace", details: errorMessage },
      { status: 500 },
    );
  }
}

// GET: Check if workspace is in sync with Git
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;

    const git = await getGitRepo(projectId);
    const status = await git.status();
    const branchInfo = await git.branchLocal();

    return NextResponse.json({
      inSync: status.isClean(),
      branch: branchInfo.current,
      uncommittedChanges: !status.isClean(),
      modifiedFiles: status.modified.length,
      addedFiles: status.created.length,
      deletedFiles: status.deleted.length,
      untrackedFiles: status.not_added.length,
    });
  } catch (err) {
    console.error("GET sync status error:", err);
    return NextResponse.json(
      { error: "Failed to check sync status" },
      { status: 500 },
    );
  }
}
