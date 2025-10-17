// Local Git Operations API
import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

// Helper to execute git commands
async function executeGitCommand(command: string, repoPath: string) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: repoPath,
      encoding: "utf-8",
    });
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, output: "", error: errorMessage };
  }
}

// Get local Git status
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const repoPath = searchParams.get("repoPath");
    const action = searchParams.get("action");

    if (!repoPath) {
      return NextResponse.json(
        { message: "Repository path is required" },
        { status: 400 },
      );
    }

    // Verify .git folder exists
    try {
      await fs.access(path.join(repoPath, ".git"));
    } catch {
      return NextResponse.json(
        { message: "Not a git repository" },
        { status: 400 },
      );
    }

    switch (action) {
      case "status": {
        const result = await executeGitCommand(
          "git status --porcelain",
          repoPath,
        );
        const branchResult = await executeGitCommand(
          "git branch --show-current",
          repoPath,
        );
        const remoteResult = await executeGitCommand("git remote -v", repoPath);

        return NextResponse.json({
          changes: result.output,
          currentBranch: branchResult.output.trim(),
          remotes: remoteResult.output,
        });
      }

      case "branches": {
        const localBranches = await executeGitCommand("git branch", repoPath);
        const remoteBranches = await executeGitCommand(
          "git branch -r",
          repoPath,
        );

        return NextResponse.json({
          local: localBranches.output,
          remote: remoteBranches.output,
        });
      }

      case "log": {
        const result = await executeGitCommand(
          'git log --pretty=format:"%H|%an|%ae|%ad|%s" --date=iso -n 50',
          repoPath,
        );

        const commits = result.output
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [hash, author, email, date, message] = line.split("|");
            return { hash, author, email, date, message };
          });

        return NextResponse.json({ commits });
      }

      case "diff": {
        const staged = await executeGitCommand("git diff --cached", repoPath);
        const unstaged = await executeGitCommand("git diff", repoPath);

        return NextResponse.json({
          staged: staged.output,
          unstaged: unstaged.output,
        });
      }

      case "remotes": {
        const result = await executeGitCommand("git remote -v", repoPath);
        return NextResponse.json({ remotes: result.output });
      }

      default:
        return NextResponse.json(
          { message: "Invalid action" },
          { status: 400 },
        );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}

// Execute Git operations (commit, push, pull, etc.)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoPath, action, message, branchName, files, remote } = body;

    if (!repoPath) {
      return NextResponse.json(
        { message: "Repository path is required" },
        { status: 400 },
      );
    }

    switch (action) {
      case "stage": {
        if (!files || files.length === 0) {
          return NextResponse.json(
            { message: "Files array is required" },
            { status: 400 },
          );
        }

        const fileList = files.join(" ");
        const result = await executeGitCommand(`git add ${fileList}`, repoPath);

        return NextResponse.json({
          success: result.success,
          message: result.success ? "Files staged" : result.error,
        });
      }

      case "unstage": {
        if (!files || files.length === 0) {
          return NextResponse.json(
            { message: "Files array is required" },
            { status: 400 },
          );
        }

        const fileList = files.join(" ");
        const result = await executeGitCommand(
          `git reset HEAD ${fileList}`,
          repoPath,
        );

        return NextResponse.json({
          success: result.success,
          message: result.success ? "Files unstaged" : result.error,
        });
      }

      case "commit": {
        if (!message) {
          return NextResponse.json(
            { message: "Commit message is required" },
            { status: 400 },
          );
        }

        const result = await executeGitCommand(
          `git commit -m "${message.replace(/"/g, '\\"')}"`,
          repoPath,
        );

        return NextResponse.json({
          success: result.success,
          message: result.success ? "Committed successfully" : result.error,
          output: result.output,
        });
      }

      case "push": {
        const branch = branchName || "main";
        const remoteName = remote || "origin";
        const result = await executeGitCommand(
          `git push ${remoteName} ${branch}`,
          repoPath,
        );

        return NextResponse.json({
          success: result.success,
          message: result.success ? "Pushed successfully" : result.error,
          output: result.output + result.error,
        });
      }

      case "pull": {
        const branch = branchName || "main";
        const remoteName = remote || "origin";
        const result = await executeGitCommand(
          `git pull ${remoteName} ${branch}`,
          repoPath,
        );

        return NextResponse.json({
          success: result.success,
          message: result.success ? "Pulled successfully" : result.error,
          output: result.output + result.error,
        });
      }

      case "checkout": {
        if (!branchName) {
          return NextResponse.json(
            { message: "Branch name is required" },
            { status: 400 },
          );
        }

        const result = await executeGitCommand(
          `git checkout ${branchName}`,
          repoPath,
        );

        return NextResponse.json({
          success: result.success,
          message: result.success ? `Switched to ${branchName}` : result.error,
        });
      }

      case "create-branch": {
        if (!branchName) {
          return NextResponse.json(
            { message: "Branch name is required" },
            { status: 400 },
          );
        }

        const result = await executeGitCommand(
          `git checkout -b ${branchName}`,
          repoPath,
        );

        return NextResponse.json({
          success: result.success,
          message: result.success
            ? `Created and switched to ${branchName}`
            : result.error,
        });
      }

      case "fetch": {
        const remoteName = remote || "origin";
        const result = await executeGitCommand(
          `git fetch ${remoteName}`,
          repoPath,
        );

        return NextResponse.json({
          success: result.success,
          message: result.success ? "Fetched successfully" : result.error,
        });
      }

      case "set-remote": {
        if (!remote) {
          return NextResponse.json(
            { message: "Remote URL is required" },
            { status: 400 },
          );
        }

        // Check if origin exists
        const checkRemote = await executeGitCommand(
          "git remote get-url origin",
          repoPath,
        );

        let result;
        if (checkRemote.success) {
          // Update existing remote
          result = await executeGitCommand(
            `git remote set-url origin ${remote}`,
            repoPath,
          );
        } else {
          // Add new remote
          result = await executeGitCommand(
            `git remote add origin ${remote}`,
            repoPath,
          );
        }

        return NextResponse.json({
          success: result.success,
          message: result.success ? "Remote configured" : result.error,
        });
      }

      default:
        return NextResponse.json(
          { message: "Invalid action" },
          { status: 400 },
        );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
