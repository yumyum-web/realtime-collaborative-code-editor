// src/app/api/projects/[id]/version-control/branch/route.ts

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl, {
  Branch,
  VersionControlDocument,
} from "@/app/models/VersionControl";
import Project, { ProjectDocument } from "@/app/models/project";

/**
 * Helper to ensure VersionControl document exists and is initialized with a 'main' branch.
 * If not found, it creates one using the project's current structure.
 * @returns The Mongoose document (not lean).
 */
async function ensureVersionControlDocument(
  projectId: string,
): Promise<VersionControlDocument | null> {
  let vcDoc = (await VersionControl.findOne({
    projectId,
  })) as VersionControlDocument | null;

  if (!vcDoc) {
    const project = (await Project.findById(
      projectId,
    ).lean()) as ProjectDocument | null;
    if (!project) return null;

    const initialStructure = project.structure || {
      name: "root",
      type: "folder",
      children: [],
    };

    vcDoc = await VersionControl.create({
      projectId,
      branches: [
        {
          name: "main",
          commits: [],
          lastStructure: initialStructure,
        } as Branch,
      ],
      activeBranch: "main",
    });
  }
  return vcDoc;
}

// POST: Create a new branch
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

    const vcDoc = await ensureVersionControlDocument(projectId);
    if (!vcDoc)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (vcDoc.branches.some((b) => b.name === branchName)) {
      return NextResponse.json(
        { error: "Branch already exists" },
        { status: 400 },
      );
    }

    const base = vcDoc.branches.find(
      (b) => b.name === (baseBranch || vcDoc.activeBranch),
    );

    if (!base)
      return NextResponse.json(
        { error: "Base branch not found" },
        { status: 404 },
      );

    // CRUCIAL: Deep copy the structure from the base branch's working copy
    const initialStructureSnapshot = JSON.parse(
      JSON.stringify(base.lastStructure),
    );

    const newBranch: Branch = {
      name: branchName,
      commits: [],
      lastStructure: initialStructureSnapshot,
      lastMergedFrom: base.name,
    };

    vcDoc.branches.push(newBranch);
    await vcDoc.save();

    return NextResponse.json({
      success: true,
      branches: vcDoc.branches.map((b) => b.name),
    });
  } catch (err) {
    console.error("POST branch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET: Get all branches and active branch
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const projectId = params.id;

    // Ensure VC document is initialized if it's the first time
    const vcDoc = await ensureVersionControlDocument(projectId);

    if (!vcDoc) {
      // Should be caught by ensureVersionControl, but as a fallback
      return NextResponse.json({ branches: ["main"], activeBranch: "main" });
    }

    return NextResponse.json({
      branches: vcDoc.branches.map((b) => b.name),
      activeBranch: vcDoc.activeBranch,
    });
  } catch (err) {
    console.error("GET branch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT: Switch active branch
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

    const vcDoc = await VersionControl.findOne({ projectId });
    if (!vcDoc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    const branch = vcDoc.branches.find((b: Branch) => b.name === branchName);
    if (!branch)
      return NextResponse.json(
        { error: "Branch does not exist" },
        { status: 404 },
      );

    vcDoc.activeBranch = branchName;
    await vcDoc.save();

    // Return the structure of the branch we're switching TO for client reload
    return NextResponse.json({
      success: true,
      activeBranch: vcDoc.activeBranch,
      structure: branch.lastStructure,
    });
  } catch (err) {
    console.error("PUT branch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE: Delete a branch
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

    const vcDoc = await VersionControl.findOne({ projectId });
    if (!vcDoc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    if (vcDoc.branches.length <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only branch" },
        { status: 400 },
      );
    }

    if (vcDoc.activeBranch === branchName) {
      return NextResponse.json(
        { error: "Switch to another branch before deleting" },
        { status: 400 },
      );
    }

    // Ensure 'main' branch cannot be deleted
    if (branchName === "main") {
      return NextResponse.json(
        { error: "Cannot delete the main branch" },
        { status: 400 },
      );
    }

    const initialLength = vcDoc.branches.length;
    vcDoc.branches = vcDoc.branches.filter(
      (b: Branch) => b.name !== branchName,
    ) as VersionControlDocument["branches"];

    if (vcDoc.branches.length === initialLength) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    await vcDoc.save();

    return NextResponse.json({
      success: true,
      branches: vcDoc.branches.map((b: Branch) => b.name),
    });
  } catch (err) {
    console.error("DELETE branch error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
