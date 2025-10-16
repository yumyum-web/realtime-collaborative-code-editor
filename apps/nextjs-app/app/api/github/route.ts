// GitHub API integration - Next.js 13+ App Router format
import { NextRequest, NextResponse } from "next/server";
import { createRepo, listRepos, getCommitHistory } from "./githubService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, name, description } = body;

    if (!token || !name) {
      return NextResponse.json(
        { message: "Missing token or repo name." },
        { status: 400 },
      );
    }

    const createResult = await createRepo(token, name, description);
    return NextResponse.json(createResult.data);
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

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = searchParams.get("token");
    const commits = searchParams.get("commits");
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (commits && owner && repo && token) {
      const commitHistory = await getCommitHistory(token, owner, repo);
      return NextResponse.json(commitHistory.data);
    } else if (token) {
      const repos = await listRepos(token);
      return NextResponse.json(repos.data);
    } else {
      return NextResponse.json({ message: "Missing token." }, { status: 400 });
    }
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
