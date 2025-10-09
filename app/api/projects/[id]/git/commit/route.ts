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
    const { userEmail, message, files, branch } = await req.json();

    await connectDB();

    const project = await Project.findById(projectId);
    if (!project || !project.gitRepoPath) {
      return NextResponse.json(
        { error: "Git not initialized" },
        { status: 404 },
      );
    }

    const isMember = project.members.some((m: Member) => m.email === userEmail);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const git = simpleGit(project.gitRepoPath);

    // Switch to the specified branch if provided
    if (branch) {
      await git.checkout(branch);
    }

    // Check if repo has commits
    let hasCommits = false;
    try {
      const log = await git.log();
      hasCommits = log.all.length > 0;
    } catch {
      hasCommits = false;
    }

    if (!hasCommits) {
      // Make initial commit if none
      await git.commit("Initial commit", ["--allow-empty"]);
    }

    // Write files to repo
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(project.gitRepoPath, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content as string);
    }

    // Add and commit
    await git.add(".");
    await git.commit(message || "Update project");

    // Update project commits
    const log = await git.log();
    project.gitCommits = log.all.map((commit) => ({
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      date: commit.date,
      filesChanged: [], // TODO: get changed files
    }));

    // Update branches
    const branches = await git.branch();
    project.gitBranches = Object.keys(branches.branches).map((branchName) => ({
      name: branchName,
      current: branchName === branches.current,
    }));

    await project.save();

    return NextResponse.json({ message: "Committed" });
  } catch (error) {
    console.error("Error committing:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
