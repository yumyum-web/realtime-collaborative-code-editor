// Git Status API - Track uncommitted changes

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { getGitRepo } from "@/app/lib/gitUtils";

// GET: Get current Git status
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
      branch: status.current || branchInfo.current,
      modified: status.modified,
      added: status.created,
      deleted: status.deleted,
      untracked: status.not_added,
      conflicted: status.conflicted,
      staged: status.staged,
      ahead: status.ahead,
      behind: status.behind,
      isClean: status.isClean(),
    });
  } catch (err) {
    console.error("GET status error:", err);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 },
    );
  }
}
