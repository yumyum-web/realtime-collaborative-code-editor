// Enhanced Branch API with Git Integration

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { getGitRepo, readFilesFromRepo } from "@/app/lib/gitUtils";
import { emitSocketEvent } from "@/app/lib/socketio";

// GET: List all branches
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;

    const git = await getGitRepo(projectId);
    const branchInfo = await git.branchLocal();

    return NextResponse.json({
      branches: branchInfo.all,
      activeBranch: branchInfo.current,
    });
  } catch (err) {
    console.error("GET branches error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST: Create new branch
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { branchName, baseBranch } = await req.json();

    console.log(
      `📝 POST branch request: ${branchName} from ${baseBranch || "main"} for project ${projectId}`,
    );

    if (!branchName) {
      return NextResponse.json(
        { error: "branchName required" },
        { status: 400 },
      );
    }

    const git = await getGitRepo(projectId);
    const base = baseBranch || "main";

    // Ensure base branch exists
    const branches = await git.branchLocal();
    console.log(
      `📋 Available branches: [${branches.all.join(", ")}], current: ${branches.current}`,
    );

    if (!branches.all.includes(base)) {
      console.error(`❌ Base branch "${base}" not found`);
      return NextResponse.json(
        { error: `Base branch "${base}" not found` },
        { status: 404 },
      );
    }

    // Check if branch already exists
    if (branches.all.includes(branchName)) {
      console.error(`❌ Branch "${branchName}" already exists`);
      return NextResponse.json(
        { error: "Branch already exists" },
        { status: 400 },
      );
    }

    // Create new branch from base
    console.log(`🌿 Creating branch "${branchName}" from "${base}"...`);
    await git.checkoutBranch(branchName, base);

    // IMPORTANT: Commit the current state to the new branch to make it distinct
    // This ensures the new branch has its own initial commit with the current structure
    try {
      await git.add(".");
      await git.commit(`Initial commit for branch ${branchName}`, {
        "--allow-empty": null, // Allow empty commits if no changes
      });
      console.log(`✅ Committed initial state to branch ${branchName}`);
    } catch (commitErr) {
      console.warn(
        `⚠️ Could not commit to new branch (may be empty):`,
        commitErr,
      );
      // This is not a fatal error - the branch is still created
    }

    console.log(`✅ Created branch ${branchName} from ${base}`);

    // Broadcast branch creation event to all connected clients (non-blocking)
    const updatedBranches = await git.branchLocal();
    emitSocketEvent(projectId, "branch-created", {
      branchName,
      baseBranch: base,
      allBranches: updatedBranches.all,
    }).catch((err) =>
      console.error("⚠️ Socket broadcast failed (non-fatal):", err),
    );

    return NextResponse.json({
      success: true,
      branch: branchName,
      baseBranch: base,
    });
  } catch (err) {
    console.error("POST branch error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error("Error stack:", errorStack);
    return NextResponse.json(
      {
        error: "Server error",
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}

// PUT: Switch active branch
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { branchName, forceSwitch } = await req.json();

    if (!branchName) {
      return NextResponse.json(
        { error: "branchName required" },
        { status: 400 },
      );
    }

    const git = await getGitRepo(projectId);
    const branches = await git.branchLocal();
    const currentBranch = branches.current;

    // Check if branch exists
    if (!branches.all.includes(branchName)) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // If already on the target branch, just return current state
    if (currentBranch === branchName) {
      const structure = await readFilesFromRepo(projectId);
      return NextResponse.json({
        success: true,
        activeBranch: branchName,
        structure,
        message: "Already on this branch",
      });
    }

    // Check for uncommitted changes
    const status = await git.status();
    if (!status.isClean() && !forceSwitch) {
      console.log(`[SWITCH] Uncommitted changes detected on ${currentBranch}`);

      // Automatically commit pending changes before switching
      try {
        await git.add(".");
        await git.commit(`Auto-save before switching to ${branchName}`, {
          "--allow-empty": null,
        });
        console.log(`[SWITCH] Auto-committed changes on ${currentBranch}`);
      } catch (commitErr) {
        console.error("[SWITCH] Failed to auto-commit:", commitErr);
        return NextResponse.json(
          {
            error:
              "Uncommitted changes present. Please commit or stash changes before switching.",
            hasUncommittedChanges: true,
            modifiedFiles: [
              ...status.modified,
              ...status.created,
              ...status.deleted,
            ],
          },
          { status: 400 },
        );
      }
    }

    // Checkout branch with error handling
    try {
      console.log(`[SWITCH] Checking out branch: ${branchName}`);
      await git.checkout(branchName);
    } catch (checkoutErr) {
      console.error(`[SWITCH] Checkout failed:`, checkoutErr);
      const errMsg =
        checkoutErr instanceof Error
          ? checkoutErr.message
          : String(checkoutErr);

      // Handle specific checkout errors
      if (errMsg.includes("would be overwritten")) {
        return NextResponse.json(
          {
            error:
              "Checkout would overwrite local changes. Please commit or stash your changes first.",
            requiresCommit: true,
          },
          { status: 400 },
        );
      }

      throw checkoutErr;
    }

    // Read structure from new branch
    const structure = await readFilesFromRepo(projectId);

    console.log(`✅ Switched from ${currentBranch} to ${branchName}`);

    // Broadcast branch switch event to all connected clients (non-blocking)
    emitSocketEvent(projectId, "branch-switched", {
      fromBranch: currentBranch,
      toBranch: branchName,
      structure,
    }).catch((err) =>
      console.error("⚠️ Socket broadcast failed (non-fatal):", err),
    );

    return NextResponse.json({
      success: true,
      activeBranch: branchName,
      previousBranch: currentBranch,
      structure,
    });
  } catch (err) {
    console.error("PUT branch error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json(
      { error: "Failed to switch branch", details: errorMessage },
      { status: 500 },
    );
  }
}

// DELETE: Delete a branch
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { branchName, force } = await req.json();

    if (!branchName) {
      return NextResponse.json(
        { error: "branchName required" },
        { status: 400 },
      );
    }

    // Cannot delete main branch
    if (branchName === "main") {
      return NextResponse.json(
        { error: "Cannot delete the main branch" },
        { status: 400 },
      );
    }

    const git = await getGitRepo(projectId);
    const branchInfo = await git.branchLocal();

    // Cannot delete current branch
    if (branchInfo.current === branchName) {
      return NextResponse.json(
        { error: "Switch to another branch before deleting" },
        { status: 400 },
      );
    }

    // Check if branch exists
    if (!branchInfo.all.includes(branchName)) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Delete branch - use force delete if requested to handle unmerged branches
    try {
      if (force) {
        // Force delete even if branch has unmerged commits
        await git.deleteLocalBranch(branchName, true);
        console.log(`✅ Force deleted branch ${branchName}`);
      } else {
        // Try normal delete first
        try {
          await git.deleteLocalBranch(branchName);
          console.log(`✅ Deleted branch ${branchName}`);
        } catch (deleteErr) {
          // If delete fails due to unmerged commits, inform the user
          const errMsg =
            deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
          if (
            errMsg.includes("not fully merged") ||
            errMsg.includes("unmerged")
          ) {
            return NextResponse.json(
              {
                error:
                  "Branch has unmerged commits. Use force delete to proceed.",
                requiresForce: true,
                branchName,
              },
              { status: 400 },
            );
          }
          throw deleteErr;
        }
      }
    } catch (deleteErr) {
      console.error(`❌ Failed to delete branch ${branchName}:`, deleteErr);
      throw deleteErr;
    }

    // Get updated branch list
    const updatedBranches = await git.branchLocal();

    // Broadcast branch deletion event to all connected clients (non-blocking)
    emitSocketEvent(projectId, "branch-deleted", {
      branchName,
      remainingBranches: updatedBranches.all,
      activeBranch: branchInfo.current,
    }).catch((err) =>
      console.error("⚠️ Socket broadcast failed (non-fatal):", err),
    );

    return NextResponse.json({
      success: true,
      branches: updatedBranches.all,
      activeBranch: branchInfo.current,
      deletedBranch: branchName,
    });
  } catch (err) {
    console.error("DELETE branch error:", err);
    const errorMessage = err instanceof Error ? err.message : "Server error";
    return NextResponse.json(
      { error: "Failed to delete branch", details: errorMessage },
      { status: 500 },
    );
  }
}
