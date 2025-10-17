// GitHub Commits API
import { NextRequest, NextResponse } from "next/server";
import { getCommitHistory } from "../githubService";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get("token");
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const branch = searchParams.get("branch");

    if (!token || !owner || !repo) {
      return NextResponse.json(
        { message: "Missing required parameters." },
        { status: 400 },
      );
    }

    const commits = await getCommitHistory(
      token,
      owner,
      repo,
      branch || undefined,
    );
    return NextResponse.json(commits.data);
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
