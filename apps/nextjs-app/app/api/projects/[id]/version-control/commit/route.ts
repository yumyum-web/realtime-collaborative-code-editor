// src/app/api/projects/[id]/version-control/commit/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB, VersionControl, Project } from "@repo/database";
import type { Commit, Branch, ProjectDocument } from "@repo/database";

// POST: Create a new commit (Saves current branch.lastStructure as a snapshot)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { message, author, branchName } = await req.json();

    if (!message || !author)
      return NextResponse.json(
        { error: "message & author required" },
        { status: 400 },
      );

    const vcDoc = await VersionControl.findOne({ projectId });
    if (!vcDoc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    const branchToUse = branchName || vcDoc.activeBranch;
    const branch: Branch | undefined = vcDoc.branches.find(
      (b: Branch) => b.name === branchToUse,
    );
    if (!branch)
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    // CRUCIAL: Deep copy the working structure before committing it
    const structureSnapshot = JSON.parse(
      JSON.stringify(
        branch.lastStructure || { name: "root", type: "folder", children: [] },
      ),
    );

    branch.commits.push({
      message,
      author,
      timestamp: new Date(),
      structure: structureSnapshot, // Use the deep copy
    } as Commit);

    vcDoc.markModified("branches");
    await vcDoc.save();

    return NextResponse.json({
      success: true,
      branch: branchToUse,
      commitCount: branch.commits.length,
    });
  } catch (err) {
    console.error("POST commit error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET: Get commits for a branch
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const url = new URL(req.url);
    const branchName = url.searchParams.get("branch");

    const vc = (await VersionControl.findOne({
      projectId,
    }).lean()) as unknown as { branches: Branch[]; activeBranch: string };
    if (!vc) return NextResponse.json({ commits: [] });

    const branch = branchName
      ? vc.branches.find((b) => b.name === branchName)
      : vc.branches.find((b) => b.name === vc.activeBranch);

    // Ensure _id is available for restoration on the frontend
    const commits = branch
      ? branch.commits.map((c) => ({
          _id: c._id,
          message: c.message,
          author: c.author,
          timestamp: c.timestamp,
        }))
      : [];

    return NextResponse.json({ commits });
  } catch (err) {
    console.error("GET commit error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT: Restore a commit (Overwrites branch.lastStructure and Project.structure if on main)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { commitId, branchName } = await req.json();

    if (!commitId)
      return NextResponse.json({ error: "commitId required" }, { status: 400 });

    const vcDoc = await VersionControl.findOne({ projectId });
    if (!vcDoc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    const branch = vcDoc.branches.find(
      (b: Branch) => b.name === (branchName || vcDoc.activeBranch),
    );
    if (!branch)
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    const commit = branch.commits.find(
      (c: { _id?: string }) => String(c._id) === String(commitId),
    );
    if (!commit)
      return NextResponse.json({ error: "Commit not found" }, { status: 404 });

    // CRUCIAL: Deep copy the commit's snapshot structure for restoration
    const restoredStructure = JSON.parse(JSON.stringify(commit.structure));

    // 1. Update Project (only if restoring on 'main' branch)
    if (branch.name === "main") {
      const project = (await Project.findById(
        projectId,
      )) as ProjectDocument | null;
      if (!project)
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );

      project.structure = restoredStructure;
      await project.save();
    }

    // 2. Update branch's working copy
    branch.lastStructure = restoredStructure;
    vcDoc.markModified("branches");
    await vcDoc.save();

    // Return the restored structure for the client to reload
    return NextResponse.json({
      success: true,
      restoredCommitId: commitId,
      structure: restoredStructure,
    });
  } catch (err) {
    console.error("PUT commit error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
