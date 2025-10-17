// GitHub Repos API
import { NextRequest, NextResponse } from "next/server";
import { createRepo, listRepos } from "../githubService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, name, description, private: isPrivate } = body;

    if (!token || !name) {
      return NextResponse.json(
        { message: "Missing token or repo name." },
        { status: 400 },
      );
    }

    const createResult = await createRepo(token, name, description, isPrivate);
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

    if (!token) {
      return NextResponse.json({ message: "Missing token." }, { status: 400 });
    }

    const repos = await listRepos(token);
    return NextResponse.json(repos.data);
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
