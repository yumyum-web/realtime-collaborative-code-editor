// GitHub Push API
import { NextRequest, NextResponse } from "next/server";
import { createCommit, updateReference, getBranch } from "../githubService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, owner, repo, branch, message } = body;

    if (!token || !owner || !repo || !branch || !message) {
      return NextResponse.json(
        { message: "Missing required parameters." },
        { status: 400 },
      );
    }

    // Get the current branch reference
    const branchData = await getBranch(token, owner, repo, branch);
    const currentCommitSha = branchData.data.commit.sha;

    // Get the current tree
    const currentTree = branchData.data.commit.commit.tree.sha;

    // For demo purposes, we'll create a commit without changing files
    // In a real scenario, you'd need to create a new tree with file changes
    const newCommit = await createCommit(
      token,
      owner,
      repo,
      message,
      currentTree,
      [currentCommitSha],
    );

    // Update the branch reference to point to the new commit
    await updateReference(
      token,
      owner,
      repo,
      `heads/${branch}`,
      newCommit.data.sha,
    );

    return NextResponse.json({
      message: "Changes pushed successfully",
      commit: newCommit.data,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 },
    );
  }
}
