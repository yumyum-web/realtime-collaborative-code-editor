// src/app/api/projects/[id]/version-control/merge/route.ts

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl, { Branch, Commit } from "@/app/models/VersionControl";
import Project, { ProjectDocument } from "@/app/models/project";

// POST: Merge (Push or Pull)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const projectId = params.id;
    const { action, sourceBranch, targetBranch, author } = await req.json();

    if (!action || !sourceBranch || !targetBranch || !author) {
      return NextResponse.json(
        { error: "action, sourceBranch, targetBranch, author required" },
        { status: 400 },
      );
    }

    const vcDoc = await VersionControl.findOne({ projectId });
    if (!vcDoc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    const source = vcDoc.branches.find((b: Branch) => b.name === sourceBranch);
    const target = vcDoc.branches.find((b: Branch) => b.name === targetBranch);

    if (!source || !target)
      return NextResponse.json(
        { error: "Source or Target branch not found" },
        { status: 404 },
      );

    // Simple merge strategy: overwrite target's working copy with source's working copy
    const mergedStructure = JSON.parse(JSON.stringify(source.lastStructure)); // CRUCIAL: Deep copy

    // Create a merge commit on the target branch
    target.commits.push({
      message: `Merge (${action}) ${sourceBranch} → ${targetBranch}`,
      author,
      timestamp: new Date(),
      structure: mergedStructure, // Snapshot of the merged state
    } as Commit);

    // Update the target's working copy
    target.lastStructure = mergedStructure;
    target.lastMergedFrom = sourceBranch;

    // If merging into 'main', update the main Project document too (persisting to main db state)
    if (targetBranch === "main") {
      const project = (await Project.findById(
        projectId,
      )) as ProjectDocument | null;
      if (!project)
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );

      project.structure = mergedStructure;
      await project.save();
    }

    vcDoc.markModified("branches");
    await vcDoc.save();

    return NextResponse.json({
      success: true,
      message: `Merged ${sourceBranch} into ${targetBranch}`,
      structure: mergedStructure, // Return merged structure for immediate client update (Pull operation)
    });
  } catch (err) {
    console.error("POST merge error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
