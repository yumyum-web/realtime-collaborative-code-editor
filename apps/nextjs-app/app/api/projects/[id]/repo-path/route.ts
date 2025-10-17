// API route to get repository path for a project
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const REPOS_BASE_PATH = path.join(process.cwd(), "repos");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { message: "Project ID is required" },
        { status: 400 },
      );
    }

    const repoPath = path.join(REPOS_BASE_PATH, projectId);

    return NextResponse.json({
      repoPath,
      projectId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
