// src/app/api/projects/[id]/version-control/commit/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl from "@/app/models/VersionControl";
import Project from "@/app/models/project";

// Define the Commit type
interface Commit {
  message: string;
  author: string;
  timestamp: Date;
  structure: Record<string, unknown>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Create a commit on the active branch (or branch specified)
  try {
    await connectDB();
    const projectId = params.id;
    const { message, author, branchName } = await req.json();

    if (!message || !author)
      return NextResponse.json(
        { error: "message & author required" },
        { status: 400 },
      );

    const project = (await Project.findById(projectId).lean()) as {
      structure: Record<string, unknown>;
    } | null;
    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });

    let vc = await VersionControl.findOne({ projectId });
    if (!vc) {
      // initialize VC with main if missing
      vc = await VersionControl.create({
        projectId,
        branches: [{ name: "main", commits: [] }],
        activeBranch: "main",
      });
    }

    const branchToUse = branchName || vc.activeBranch;
    const branch = vc.branches.find(
      (b: { name: string; commits: Array<Commit> }) => b.name === branchToUse,
    );
    if (!branch)
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    branch.commits.push({
      message,
      author,
      timestamp: new Date(),
      structure: project.structure,
    });

    await vc.save();
    return NextResponse.json({
      success: true,
      branch: branchToUse,
      commitCount: branch.commits.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // GET commits for a branch: ?branch=branchName
  try {
    await connectDB();
    const projectId = params.id;
    const url = new URL(req.url);
    const branchName = url.searchParams.get("branch");
    const vc = (await VersionControl.findOne({ projectId }).lean()) as {
      branches: Array<{ name: string; commits: Array<Commit> }>;
      activeBranch: string;
    } | null;
    if (!vc) return NextResponse.json({ commits: [] });

    const branch = branchName
      ? vc.branches.find((b) => b.name === branchName)
      : vc.branches.find((b) => b.name === vc.activeBranch);
    return NextResponse.json({ commits: branch ? branch.commits : [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT -> restore a commit by commitId
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const projectId = params.id;
    const { commitId, branchName } = await req.json();
    if (!commitId)
      return NextResponse.json({ error: "commitId required" }, { status: 400 });

    const vc = await VersionControl.findOne({ projectId });
    if (!vc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    const branch = vc.branches.find(
      (b: { name: string; commits: Array<Commit> }) =>
        b.name === (branchName || vc.activeBranch),
    );
    if (!branch)
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    const commit =
      branch.commits.id(commitId) ??
      branch.commits.find(
        (c: Commit & { _id: string }) => String(c._id) === String(commitId),
      );
    if (!commit)
      return NextResponse.json({ error: "Commit not found" }, { status: 404 });

    // Restore: update Project.structure to commit.structure
    const project = await Project.findById(projectId);
    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });

    project.structure = commit.structure;
    await project.save();

    return NextResponse.json({ success: true, restoredCommitId: commitId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
