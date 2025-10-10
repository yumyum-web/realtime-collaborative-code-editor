import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl, { Branch, Commit } from "@/app/models/VersionControl";
import Project, { ProjectDocument } from "@/app/models/project";

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

    // Use workingTree (current state) with fallback to lastStructure
    const sourceStructure = source.workingTree || source.lastStructure;
    if (!sourceStructure) {
      return NextResponse.json(
        { error: "Source branch has no structure" },
        { status: 400 },
      );
    }

    // Deep copy to prevent reference issues
    const mergedStructure = JSON.parse(JSON.stringify(sourceStructure));

    // Create a merge commit on the target branch
    target.commits.push({
      message: `Merge (${action}) ${sourceBranch} → ${targetBranch}`,
      author,
      timestamp: new Date(),
      structure: mergedStructure,
    } as Commit);

    // Update BOTH workingTree and lastStructure
    target.workingTree = mergedStructure;
    target.lastStructure = mergedStructure;
    target.lastMergedFrom = sourceBranch;

    // If merging into 'main', update the main Project document
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
      console.log(`✅ Updated main project structure`);
    }

    vcDoc.markModified("branches");
    await vcDoc.save();

    console.log(`✅ Merge complete: ${sourceBranch} → ${targetBranch}`);

    return NextResponse.json({
      success: true,
      message: `Merged ${sourceBranch} into ${targetBranch}`,
      structure: mergedStructure,
      targetBranch,
    });
  } catch (err) {
    console.error("POST merge error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
