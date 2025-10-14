// Enhanced Branch API with Git Integration

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import { getGitRepo, readFilesFromRepo } from "@/app/lib/gitUtils";

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
    const { branchName } = await req.json();

    if (!branchName) {
      return NextResponse.json(
        { error: "branchName required" },
        { status: 400 },
      );
    }

    const git = await getGitRepo(projectId);

    // Check if branch exists
    const branches = await git.branchLocal();
    if (!branches.all.includes(branchName)) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    // Checkout branch
    await git.checkout(branchName);

    // Read structure from new branch
    const structure = await readFilesFromRepo(projectId);

    console.log(`✅ Switched to branch ${branchName}`);

    return NextResponse.json({
      success: true,
      activeBranch: branchName,
      structure,
    });
  } catch (err) {
    console.error("PUT branch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
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
    const { branchName } = await req.json();

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

    // Delete branch
    await git.deleteLocalBranch(branchName);

    console.log(`✅ Deleted branch ${branchName}`);

    // Get updated branch list
    const updatedBranches = await git.branchLocal();

    return NextResponse.json({
      success: true,
      branches: updatedBranches.all,
    });
  } catch (err) {
    console.error("DELETE branch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
