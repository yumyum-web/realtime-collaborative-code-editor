import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../../../lib/mongoose";
import Project, { Member } from "../../../../../models/project";
import simpleGit from "simple-git";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const projectId = params.id;
    const { userEmail, branchName, createFrom = "main" } = await req.json();

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

    // Create and switch to new branch from specified branch
    await git.checkoutBranch(branchName, createFrom);

    // Update database with new branch info
    const branches = await git.branch();
    project.gitBranches = Object.keys(branches.branches).map((branchName) => ({
      name: branchName,
      current: branchName === branches.current,
    }));
    await project.save();

    return NextResponse.json({
      success: true,
      branch: branchName,
      branches: project.gitBranches,
    });
  } catch (error) {
    console.error("Branch creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const projectId = params.id;
    const { branchName } = await req.json();

    await connectDB();

    const project = await Project.findById(projectId);
    if (!project || !project.gitRepoPath) {
      return NextResponse.json(
        { error: "Project not found or Git not initialized" },
        { status: 404 },
      );
    }

    const git = simpleGit(project.gitRepoPath);

    // Switch to branch
    await git.checkout(branchName);

    // Update current branch in database
    const status = await git.status();
    const branches = await git.branch();
    project.gitBranches = Object.keys(branches.branches).map((branchName) => ({
      name: branchName,
      current: branchName === status.current,
    }));
    await project.save();

    return NextResponse.json({
      success: true,
      branch: branchName,
    });
  } catch (error) {
    console.error("Branch switch error:", error);
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

    await connectDB();

    const project = await Project.findById(projectId);
    if (!project || !project.gitRepoPath) {
      return NextResponse.json(
        { error: "Project not found or Git not initialized" },
        { status: 404 },
      );
    }

    const git = simpleGit(project.gitRepoPath);
    const branches = await git.branch();

    return NextResponse.json({
      current: branches.current,
      branches: Object.keys(branches.branches),
      all: branches.all,
    });
  } catch (error) {
    console.error("Branch list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
