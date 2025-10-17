// GitHub Pull API
import { NextRequest, NextResponse } from "next/server";
import { getBranch, getCommitHistory } from "../githubService";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get("token");
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const branch = searchParams.get("branch");

    if (!token || !owner || !repo || !branch) {
      return NextResponse.json(
        { message: "Missing required parameters." },
        { status: 400 },
      );
    }

    // Get the latest commit on the branch
    const branchData = await getBranch(token, owner, repo, branch);

    // Get recent commits
    const commits = await getCommitHistory(token, owner, repo, branch);

    return NextResponse.json({
      message: "Successfully fetched latest changes",
      branch: branchData.data,
      latestCommits: commits.data.slice(0, 5),
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
