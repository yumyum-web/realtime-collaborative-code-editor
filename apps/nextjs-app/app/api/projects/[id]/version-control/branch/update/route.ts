// src/app/api/projects/[id]/version-control/branch/update/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getGitRepo, writeFilesToRepo } from "@/app/lib/gitUtils";

// PATCH: Update a branch's working structure (used by frontend autosave/manual save on non-main branch)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;
    const { branchName, structure } = await req.json();

    if (!branchName || structure === undefined) {
      return NextResponse.json(
        { error: "branchName and structure required" },
        { status: 400 },
      );
    }

    const git = await getGitRepo(projectId);
    const currentBranch = (await git.branchLocal()).current;

    // Ensure we are on the correct branch before writing files
    if (currentBranch !== branchName) {
      const allBranches = await git.branchLocal();
      if (allBranches.all.includes(branchName)) {
        await git.checkout(branchName);
      } else {
        return NextResponse.json(
          { error: `Branch ${branchName} not found in repository.` },
          { status: 404 },
        );
      }
    }

    // Write the updated structure to the filesystem for this branch
    await writeFilesToRepo(projectId, structure);

    return NextResponse.json({
      success: true,
      branch: branchName,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("PATCH branch update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
