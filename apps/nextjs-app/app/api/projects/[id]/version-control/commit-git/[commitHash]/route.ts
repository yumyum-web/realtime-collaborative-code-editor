import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@repo/database";
import { getGitRepo } from "@/app/lib/gitUtils";

// GET: Get detailed information about a specific commit
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; commitHash: string }> },
) {
  try {
    await connectDB();
    const { id: projectId, commitHash } = await context.params;

    if (!commitHash) {
      return NextResponse.json(
        { error: "commitHash required" },
        { status: 400 },
      );
    }

    console.log(
      `📊 Fetching commit details for ${commitHash} (project: ${projectId})`,
    );

    const git = await getGitRepo(projectId);

    // Get commit details
    const show = await git.show([
      commitHash,
      "--stat",
      "--format=%H%n%h%n%an%n%ae%n%ai%n%s%n%b",
    ]);

    // Parse the output
    const lines = show.split("\n");
    const [
      fullHash,
      shortHash,
      authorName,
      authorEmail,
      date,
      subject,
      ...bodyAndStats
    ] = lines;

    // Find where the stats start (after empty line following commit message)
    let statsStartIndex = 6; // Start after the main fields
    while (
      statsStartIndex < bodyAndStats.length &&
      bodyAndStats[statsStartIndex].trim() !== ""
    ) {
      statsStartIndex++;
    }
    statsStartIndex++; // Skip the empty line

    const body = bodyAndStats
      .slice(0, statsStartIndex - 7)
      .join("\n")
      .trim();
    const statsLines = bodyAndStats.slice(statsStartIndex);

    // Parse file changes from stats
    const files: Array<{
      path: string;
      status: "added" | "modified" | "deleted";
      additions?: number;
      deletions?: number;
    }> = [];

    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const line of statsLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.includes("file") || trimmed.includes("changed"))
        continue;

      // Parse lines like: "src/file.js | 10 ++++------"
      const match = trimmed.match(/^(.+?)\s+\|\s+(\d+)\s+([+-]+)$/);
      if (match) {
        const [, filePath, , changes] = match;
        const additions = (changes.match(/\+/g) || []).length;
        const deletions = (changes.match(/-/g) || []).length;

        // Determine status
        let status: "added" | "modified" | "deleted" = "modified";
        if (deletions === 0 && additions > 0) {
          status = "added";
        } else if (additions === 0 && deletions > 0) {
          status = "deleted";
        }

        files.push({
          path: filePath.trim(),
          status,
          additions,
          deletions,
        });

        totalAdditions += additions;
        totalDeletions += deletions;
      }
    }

    // Get list of changed files using diff-tree
    try {
      const diffTree = await git.raw([
        "diff-tree",
        "--no-commit-id",
        "--name-status",
        "-r",
        commitHash,
      ]);

      const diffLines = diffTree.trim().split("\n");
      for (const line of diffLines) {
        const [status, ...pathParts] = line.split("\t");
        const filePath = pathParts.join("\t");

        if (!filePath) continue;

        // Check if we already have this file from stats
        const existingFile = files.find((f) => f.path === filePath);

        if (!existingFile) {
          let fileStatus: "added" | "modified" | "deleted" = "modified";
          if (status === "A") fileStatus = "added";
          else if (status === "D") fileStatus = "deleted";
          else if (status === "M") fileStatus = "modified";

          files.push({
            path: filePath,
            status: fileStatus,
          });
        }
      }
    } catch (diffErr) {
      console.warn("Failed to get diff-tree, using stats only:", diffErr);
    }

    const commitDetails = {
      hash: fullHash.trim(),
      shortHash: shortHash.trim(),
      message: subject.trim() + (body ? "\n\n" + body : ""),
      author: authorName.trim(),
      email: authorEmail.trim(),
      date: date.trim(),
      files,
      stats: {
        total: files.length,
        additions: totalAdditions,
        deletions: totalDeletions,
      },
    };

    console.log(
      `✅ Fetched details for commit ${shortHash}: ${files.length} files changed`,
    );

    return NextResponse.json(commitDetails);
  } catch (err) {
    console.error("GET commit details error:", err);
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
