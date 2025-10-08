// src/app/api/projects/[id]/version-control/merge/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl from "@/app/models/VersionControl";
import Project from "@/app/models/project";

// Define the Branch interface
interface Branch {
  name: string;
  lastStructure?: Record<string, unknown>;
  commits: Array<{
    message: string;
    author: string;
    timestamp: Date;
    structure: Record<string, unknown>;
  }>;
  lastMergedFrom?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // body: { action: "push"|"pull", sourceBranch: string, targetBranch: string, author }
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

    const vc = await VersionControl.findOne({ projectId });
    if (!vc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    const source: Branch | undefined = vc.branches.find(
      (b: Branch) => b.name === sourceBranch,
    );
    const target: Branch | undefined = vc.branches.find(
      (b: Branch) => b.name === targetBranch,
    );

    if (!source || !target)
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    // Simple merge strategy: overwrite target.lastStructure with source.lastStructure
    // Create a merge commit on target
    const mergedStructure = source.lastStructure || {};

    target.commits.push({
      message: `Merge (${action}) ${sourceBranch} → ${targetBranch}`,
      author,
      timestamp: new Date(),
      structure: mergedStructure,
    });
    target.lastStructure = mergedStructure;
    target.lastMergedFrom = sourceBranch;

    // if merging into main, update Project.structure too
    if (targetBranch === "main") {
      const project = await Project.findById(projectId);
      if (!project)
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );
      project.structure = mergedStructure;
      await project.save();
    }

    await vc.save();

    return NextResponse.json({
      success: true,
      message: `Merged ${sourceBranch} into ${targetBranch}`,
    });
  } catch (err) {
    console.error("POST merge error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
