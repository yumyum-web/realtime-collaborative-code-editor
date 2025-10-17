// GitHub OAuth disconnect handler
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    const response = NextResponse.json({ success: true });

    // Clear the main GitHub token
    response.cookies.delete("github_token");

    // Clear project-specific token if provided
    if (projectId) {
      response.cookies.delete(`github_token_${projectId}`);
    }

    return response;
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to disconnect" },
      { status: 500 },
    );
  }
}
