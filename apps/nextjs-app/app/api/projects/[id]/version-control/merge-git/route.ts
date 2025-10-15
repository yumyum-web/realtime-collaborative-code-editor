// Enhanced Merge API with Git Integration

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { SimpleGit } from "simple-git";
import {
  getGitRepo,
  readFilesFromRepo,
  writeFilesToRepo,
} from "@/app/lib/gitUtils";
import { emitSocketEvent } from "@/app/lib/socketio";

// POST: Merge branch into current branch
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let git: SimpleGit | null = null;
  let originalBranch = "";
  let currentTarget = "";

  try {
    await connectDB();
    const { id: projectId } = await params;
    const { sourceBranch, targetBranch } = await req.json();

    if (!sourceBranch) {
      return NextResponse.json(
        { error: "sourceBranch required" },
        { status: 400 },
      );
    }

    console.log(
      `[MERGE] Starting merge: ${sourceBranch} → ${targetBranch || "current"}`,
    );

    git = await getGitRepo(projectId);
    const branchInfo = await git.branchLocal();
    originalBranch = branchInfo.current;
    currentTarget = branchInfo.current;
    if (targetBranch && targetBranch !== currentTarget) {
      if (!branchInfo.all.includes(targetBranch)) {
        return NextResponse.json(
          { error: `Target branch "${targetBranch}" not found` },
          { status: 404 },
        );
      }
      console.log(`[MERGE] Checking out target branch: ${targetBranch}`);
      await git.checkout(targetBranch);
      currentTarget = targetBranch;
    }

    // Check if source branch exists
    if (!branchInfo.all.includes(sourceBranch)) {
      return NextResponse.json(
        { error: "Source branch not found" },
        { status: 404 },
      );
    }

    // Cannot merge into itself
    if (currentTarget === sourceBranch) {
      return NextResponse.json(
        { error: "Cannot merge branch into itself" },
        { status: 400 },
      );
    }

    // Check if target branch has uncommitted changes
    const status = await git.status();
    if (!status.isClean()) {
      console.log(
        `[MERGE] Target branch has uncommitted changes, committing first...`,
      );
      await git.add(".");
      await git.commit(
        `Auto-commit before merge: ${sourceBranch} → ${currentTarget}`,
        { "--allow-empty": null },
      );
    }

    console.log(`[MERGE] Attempting to merge ${sourceBranch}...`);

    // Try to merge with strategy options
    let mergeResult;
    try {
      mergeResult = await git.merge([sourceBranch, "--no-ff"]);
    } catch (mergeErr) {
      console.error("[MERGE] Merge failed:", mergeErr);

      // Check if it's a conflict
      const postMergeStatus = await git.status();
      if (postMergeStatus.conflicted.length > 0) {
        console.log(
          `[MERGE] Conflicts detected: ${postMergeStatus.conflicted.join(", ")}`,
        );

        // Read the conflicted state
        const structure = await readFilesFromRepo(projectId);

        // Switch back to original branch before returning
        if (originalBranch !== currentTarget) {
          console.log(`[MERGE] Switching back to ${originalBranch}`);
          await git.checkout(originalBranch);
        }

        return NextResponse.json({
          success: false,
          hasConflicts: true,
          conflicts: postMergeStatus.conflicted,
          structure, // Contains conflict markers
          message: "Merge conflicts detected",
        });
      }

      // Some other error - switch back
      if (originalBranch !== currentTarget) {
        console.log(`[MERGE] Switching back to ${originalBranch}`);
        await git.checkout(originalBranch);
      }
      throw mergeErr;
    }

    // Check for conflicts in result
    if (mergeResult.conflicts && mergeResult.conflicts.length > 0) {
      console.log(
        `[MERGE] Conflicts in result: ${mergeResult.conflicts.join(", ")}`,
      );

      // Read the conflicted state
      const structure = await readFilesFromRepo(projectId);

      // Switch back to original branch
      if (originalBranch !== currentTarget) {
        console.log(`[MERGE] Switching back to ${originalBranch}`);
        await git.checkout(originalBranch);
      }

      return NextResponse.json({
        success: false,
        hasConflicts: true,
        conflicts: mergeResult.conflicts,
        structure, // Contains conflict markers
        message: "Merge conflicts detected",
      });
    }

    // Successful merge - read the final structure
    const finalStructure = await readFilesFromRepo(projectId);

    console.log(`✅ Successfully merged ${sourceBranch} into ${currentTarget}`);
    console.log(`[MERGE] Merge summary:`, mergeResult.summary);

    // Switch back to original branch if we changed it
    if (originalBranch !== currentTarget) {
      console.log(`[MERGE] Switching back to ${originalBranch}`);
      await git.checkout(originalBranch);
    }

    // Broadcast merge event via Socket.IO
    await emitSocketEvent(projectId, "branch-merged", {
      sourceBranch,
      targetBranch: currentTarget,
      structure: finalStructure,
    });

    return NextResponse.json({
      success: true,
      hasConflicts: false,
      targetBranch: currentTarget,
      sourceBranch,
      structure: finalStructure,
      summary: mergeResult.summary,
      message: `Successfully merged ${sourceBranch} into ${currentTarget}`,
      activeBranch: originalBranch, // Return the active branch after operation
    });
  } catch (err) {
    console.error("❌ Merge error:", err);

    // Attempt to switch back to original branch on error
    try {
      if (
        git &&
        originalBranch &&
        currentTarget &&
        originalBranch !== currentTarget
      ) {
        console.log(
          `[MERGE] Error cleanup: Switching back to ${originalBranch}`,
        );
        await git.checkout(originalBranch);
      }
    } catch (cleanupErr) {
      console.error("Failed to switch back during error:", cleanupErr);
    }

    // Git merge conflicts throw errors
    if (err instanceof Error && err.message?.includes("CONFLICTS")) {
      try {
        const structure = await readFilesFromRepo((await params).id);

        return NextResponse.json({
          success: false,
          hasConflicts: true,
          structure,
          message: err.message,
        });
      } catch (readErr) {
        console.error("Failed to read conflicted structure:", readErr);
      }
    }

    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
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
    await emitSocketEvent(projectId, "conflicts-resolved", {
      structure: resolvedStructure,
      message,
    });

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
