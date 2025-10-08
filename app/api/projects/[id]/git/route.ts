import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../../../lib/mongoose";
import Project from "../../../../models/project";
import simpleGit, { SimpleGit } from "simple-git";
import path from "path";
import fs from "fs";

// Initialize Git for a project
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const { userEmail } = await req.json();
    const projectId = params.id;

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is a member
    const isMember = project.members.some((m: any) => m.email === userEmail);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Create Git repo path
    const repoPath = path.join(process.cwd(), "repos", projectId);
    try {
      if (!fs.existsSync(repoPath)) {
        fs.mkdirSync(repoPath, { recursive: true });
      }
    } catch (dirError) {
      console.error("Error creating repo directory:", dirError);
      return NextResponse.json(
        { error: "Failed to create repository directory" },
        { status: 500 },
      );
    }

    let git: SimpleGit;
    try {
      git = simpleGit(repoPath);
    } catch (gitError) {
      console.error("Error initializing simple-git:", gitError);
      return NextResponse.json(
        { error: "Failed to initialize Git client" },
        { status: 500 },
      );
    }

    // Initialize Git if not already
    const gitDir = path.join(repoPath, ".git");
    if (!fs.existsSync(gitDir)) {
      try {
        await git.init();
        await git.addConfig("user.name", userEmail);
        await git.addConfig("user.email", userEmail);

        // Create a README file and make initial commit
        const readmePath = path.join(repoPath, "README.md");
        fs.writeFileSync(
          readmePath,
          `# ${project.title}\n\nProject initialized with Git.`,
        );
        await git.add("README.md");
        await git.commit("Initial commit");
      } catch (initError) {
        console.error("Error initializing Git repository:", initError);
        // Clean up on failure
        if (fs.existsSync(repoPath)) {
          fs.rmSync(repoPath, { recursive: true, force: true });
        }
        return NextResponse.json(
          {
            error:
              "Failed to initialize Git repository. Ensure Git is installed.",
          },
          { status: 500 },
        );
      }
    } else {
      // If .git exists but no commits, try to fix it
      try {
        const log = await git.log();
        if (log.all.length === 0) {
          // No commits - create initial commit
          const readmePath = path.join(repoPath, "README.md");
          if (!fs.existsSync(readmePath)) {
            fs.writeFileSync(
              readmePath,
              `# ${project.title}\n\nProject initialized with Git.`,
            );
          }
          await git.add(".");
          await git.commit("Initial commit");
        }
      } catch (fixError) {
        console.error("Error fixing Git repository:", fixError);
        // Remove broken repo and recreate
        fs.rmSync(repoPath, { recursive: true, force: true });
        fs.mkdirSync(repoPath, { recursive: true });
        const newGit = simpleGit(repoPath);
        await newGit.init();
        await newGit.addConfig("user.name", userEmail);
        await newGit.addConfig("user.email", userEmail);
        const readmePath = path.join(repoPath, "README.md");
        fs.writeFileSync(
          readmePath,
          `# ${project.title}\n\nProject initialized with Git.`,
        );
        await newGit.add("README.md");
        await newGit.commit("Initial commit");
      }
    }

    // Update project with repo path
    try {
      project.gitRepoPath = repoPath;
      await project.save();
    } catch (saveError) {
      console.error("Error saving project:", saveError);
      return NextResponse.json(
        { error: "Failed to update project" },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Git initialized" });
  } catch (error) {
    console.error("Error initializing Git:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Commit changes
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const { userEmail, message, files } = await req.json();
    const projectId = params.id;

    const project = await Project.findById(projectId);
    if (!project || !project.gitRepoPath) {
      return NextResponse.json(
        { error: "Git not initialized" },
        { status: 404 },
      );
    }

    const isMember = project.members.some((m: any) => m.email === userEmail);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const git: SimpleGit = simpleGit(project.gitRepoPath);

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
      date: new Date(commit.date),
      filesChanged: [], // TODO: get changed files
    }));
    await project.save();

    return NextResponse.json({ message: "Committed" });
  } catch (error) {
    console.error("Error committing:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Get Git status
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail");
    const projectId = params.id;

    const project = await Project.findById(projectId);
    if (!project || !project.gitRepoPath) {
      return NextResponse.json(
        { error: "Git not initialized" },
        { status: 404 },
      );
    }

    const isMember = project.members.some((m: any) => m.email === userEmail);
    if (!isMember) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let git: SimpleGit;
    try {
      git = simpleGit(project.gitRepoPath);
    } catch (gitError) {
      console.error("Error initializing simple-git for status:", gitError);
      return NextResponse.json(
        { error: "Failed to access Git repository" },
        { status: 500 },
      );
    }

    let status;
    try {
      status = await git.status();
    } catch (statusError) {
      console.error("Error getting Git status:", statusError);
      return NextResponse.json(
        { error: "Failed to get Git status" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status,
      commits: project.gitCommits,
      branches: project.gitBranches,
    });
  } catch (error) {
    console.error("Error getting Git status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
