// src/app/api/projects/[id]/version-control/branch/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl from "@/app/models/VersionControl";
import Project from "@/app/models/project"; // adjust path if different

// POST -> create new branch
// GET -> list branches & activeBranch
// PUT -> switch active branch { branchName }
// DELETE -> delete branch { branchName }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const projectId = params.id;
    const { branchName, baseBranch } = await req.json();

    if (!branchName)
      return NextResponse.json(
        { error: "branchName required" },
        { status: 400 },
      );

    let vc = await VersionControl.findOne({ projectId });

    // Initialize VC doc if not exists
    if (!vc) {
      // ensure project exists
      const project = await Project.findById(projectId).lean();
      if (!project)
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );

      vc = await VersionControl.create({
        projectId,
        branches: [{ name: "main", commits: [] }],
        activeBranch: "main",
      });
    }

    // Prevent duplicate branch name
    if (vc.branches.find((b: { name: string }) => b.name === branchName)) {
      return NextResponse.json(
        { error: "Branch already exists" },
        { status: 400 },
      );
    }

    // If baseBranch provided, copy latest commit from base
    type Commit = {
      message: string;
      author: string;
      timestamp: Date;
      structure: Record<string, unknown>;
    };

    let commitsToCopy: Commit[] = [];
    if (baseBranch) {
      const base = vc.branches.find((b: Branch) => b.name === baseBranch);
      if (base && base.commits.length > 0) {
        // clone last commit into new branch as an initial commit (optional)
        const last = base.commits[base.commits.length - 1];
        commitsToCopy = [
          {
            message: `branch ${branchName} created from ${baseBranch}`,
            author: last.author,
            timestamp: new Date(),
            structure: last.structure,
          },
        ];
      }
    }

    vc.branches.push({ name: branchName, commits: commitsToCopy });
    await vc.save();

    interface Branch {
      name: string;
      commits: {
        message: string;
        author: string;
        timestamp: Date;
        structure: Record<string, unknown>;
      }[];
    }

    return NextResponse.json({
      success: true,
      branches: vc.branches.map((b: Branch) => b.name),
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
  try {
    await connectDB();
    const projectId = params.id;
    const vc = (await VersionControl.findOne({ projectId }).lean()) as {
      branches: { name: string }[];
      activeBranch: string;
    } | null;
    if (!vc) return NextResponse.json({ branches: [], activeBranch: "main" });
    return NextResponse.json({
      branches: vc.branches.map((b) => b.name),
      activeBranch: vc.activeBranch,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const projectId = params.id;
    const { branchName } = await req.json();

    if (!branchName)
      return NextResponse.json(
        { error: "branchName required" },
        { status: 400 },
      );

    const vc = await VersionControl.findOne({ projectId });
    if (!vc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    interface Branch {
      name: string;
      commits: {
        message: string;
        author: string;
        timestamp: Date;
        structure: Record<string, unknown>;
      }[];
    }

    if (!vc.branches.find((b: Branch) => b.name === branchName)) {
      return NextResponse.json(
        { error: "Branch does not exist" },
        { status: 404 },
      );
    }

    vc.activeBranch = branchName;
    await vc.save();

    return NextResponse.json({ success: true, activeBranch: vc.activeBranch });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const projectId = params.id;
    const { branchName } = await req.json();

    if (!branchName)
      return NextResponse.json(
        { error: "branchName required" },
        { status: 400 },
      );

    const vc = await VersionControl.findOne({ projectId });
    if (!vc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    // prevent deleting last branch
    if (vc.branches.length <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only branch" },
        { status: 400 },
      );
    }

    // cannot delete active branch (require switching first)
    if (vc.activeBranch === branchName) {
      return NextResponse.json(
        { error: "Switch to another branch before deleting" },
        { status: 400 },
      );
    }

    vc.branches = vc.branches.filter(
      (b: { name: string }) => b.name !== branchName,
    );
    await vc.save();

    return NextResponse.json({
      success: true,
      branches: vc.branches.map((b: { name: string }) => b.name),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
