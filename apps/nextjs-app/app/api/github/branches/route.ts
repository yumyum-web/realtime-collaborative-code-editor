// GitHub Branches API
import { NextRequest, NextResponse } from "next/server";
import { listBranches, createBranch, getBranch } from "../githubService";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get("token");
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!token || !owner || !repo) {
      return NextResponse.json(
        { message: "Missing required parameters." },
        { status: 400 },
      );
    }

    const branches = await listBranches(token, owner, repo);
    return NextResponse.json(branches.data);
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, owner, repo, branchName, fromBranch } = body;

    if (!token || !owner || !repo || !branchName || !fromBranch) {
      return NextResponse.json(
        { message: "Missing required parameters." },
        { status: 400 },
      );
    }

    // Get the SHA of the source branch
    const sourceBranch = await getBranch(token, owner, repo, fromBranch);
    const sha = sourceBranch.data.commit.sha;

    // Create new branch
    const result = await createBranch(token, owner, repo, branchName, sha);
    return NextResponse.json(result.data);
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
