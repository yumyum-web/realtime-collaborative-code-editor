// GitHub Pull Requests API
import { NextRequest, NextResponse } from "next/server";
import { listPullRequests, createPullRequest } from "../githubService";

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

    const prs = await listPullRequests(token, owner, repo);
    return NextResponse.json(prs.data);
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
    const { token, owner, repo, title, head, base, body: prBody } = body;

    if (!token || !owner || !repo || !title || !head || !base) {
      return NextResponse.json(
        { message: "Missing required parameters." },
        { status: 400 },
      );
    }

    const result = await createPullRequest(
      token,
      owner,
      repo,
      title,
      head,
      base,
      prBody,
    );
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
