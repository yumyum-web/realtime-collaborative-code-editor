// src/app/api/projects/[id]/version-control/branch/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl from "@/app/models/VersionControl";
import Project from "@/app/models/project";

interface Branch {
  name: string;
  commits: { message: string; timestamp: Date; author: string }[];
  lastStructure: Record<string, unknown>;
}

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

    if (!vc) {
      const project = await Project.findById(projectId).lean();
      if (!project)
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );

      vc = await VersionControl.create({
        projectId,
        branches: [
          {
            name: "main",
            commits: [],
            lastStructure:
              !Array.isArray(project) && project.structure
                ? project.structure
                : {},
          },
        ],
        activeBranch: "main",
      });
    }

    if (vc.branches.find((b: Branch) => b.name === branchName)) {
      return NextResponse.json(
        { error: "Branch already exists" },
        { status: 400 },
      );
    }

    const base: Branch | undefined =
      baseBranch && vc.branches.find((b: Branch) => b.name === baseBranch);
    const newBranch: Branch = {
      name: branchName,
      commits: [],
      lastStructure: base
        ? base.lastStructure
        : vc.branches.find((b: Branch) => b.name === "main")?.lastStructure ||
          {},
    };

    vc.branches.push(newBranch);
    await vc.save();

    return NextResponse.json({
      success: true,
      branches: vc.branches.map((b: Branch) => b.name),
    });
  } catch (err) {
    console.error("POST branch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const projectId = params.id;
    const vc = await VersionControl.findOne({ projectId }).lean();
    if (!vc)
      return NextResponse.json({ branches: ["main"], activeBranch: "main" });
    if (!Array.isArray(vc) && vc.branches) {
      return NextResponse.json({
        branches: vc.branches.map((b: Branch) => b.name),
        activeBranch: vc.activeBranch,
      });
    }
    return NextResponse.json(
      { error: "Invalid version control data" },
      { status: 500 },
    );
  } catch (err) {
    console.error("GET branch error:", err);
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

    const branch = vc.branches.find((b: Branch) => b.name === branchName);
    if (!branch)
      return NextResponse.json(
        { error: "Branch does not exist" },
        { status: 404 },
      );

    vc.activeBranch = branchName;
    await vc.save();

    return NextResponse.json({
      success: true,
      activeBranch: vc.activeBranch,
      structure: branch.lastStructure || {},
    });
  } catch (err) {
    console.error("PUT branch error:", err);
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

    if (vc.branches.length <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only branch" },
        { status: 400 },
      );
    }

    if (vc.activeBranch === branchName) {
      return NextResponse.json(
        { error: "Switch to another branch before deleting" },
        { status: 400 },
      );
    }

    vc.branches = vc.branches.filter((b: Branch) => b.name !== branchName);
    await vc.save();

    return NextResponse.json({
      success: true,
      branches: vc.branches.map((b: Branch) => b.name),
    });
  } catch (err) {
    console.error("DELETE branch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
