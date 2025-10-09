import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../../../lib/mongoose";
import Project, { Member } from "../../../../../models/project";
import simpleGit from "simple-git";
import path from "path";
import fs from "fs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const projectId = params.id;
    const { userEmail, filePath, resolution, content } = await req.json();

    await connectDB();

    const project = await Project.findById(projectId);
    if (!project || !project.gitRepoPath) {
      return NextResponse.json(
        { error: "Project not found or Git not initialized" },
        { status: 404 },
      );
    }

    // Verify user is a member
    const isMember = project.members.some((m: Member) => m.email === userEmail);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const git = simpleGit(project.gitRepoPath);

    // Handle conflict resolution
    const fullPath = path.join(project.gitRepoPath, filePath);

    switch (resolution) {
      case "ours":
        // Use our version (current working directory)
        await git.checkout(["--ours", filePath]);
        break;

      case "theirs":
        // Use their version (incoming branch)
        await git.checkout(["--theirs", filePath]);
        break;

      case "manual":
        // Write the manually resolved content
        fs.writeFileSync(fullPath, content);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid resolution method" },
          { status: 400 },
        );
    }

    // Mark file as resolved and continue merge
    await git.add(filePath);

    return NextResponse.json({
      success: true,
      message: `Conflict resolved for ${filePath}`,
    });
  } catch (error) {
    console.error("Conflict resolution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const projectId = params.id;
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail");

    await connectDB();

    const project = await Project.findById(projectId);
    if (!project || !project.gitRepoPath) {
      return NextResponse.json(
        { error: "Project not found or Git not initialized" },
        { status: 404 },
      );
    }

    // Verify user is a member
    const isMember = project.members.some((m: Member) => m.email === userEmail);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const git = simpleGit(project.gitRepoPath);

    // Check for merge conflicts
    const status = await git.status();

    if (status.conflicted.length === 0) {
      return NextResponse.json({ conflicts: [] });
    }

    // Get conflict details for each conflicted file
    const conflicts = await Promise.all(
      status.conflicted.map(async (filePath) => {
        const fullPath = path.join(project.gitRepoPath, filePath);
        const content = fs.readFileSync(fullPath, "utf8");

        return {
          file: filePath,
          content: content,
        };
      }),
    );

    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error("Conflict check error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
