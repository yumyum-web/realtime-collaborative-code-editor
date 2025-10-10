// src/app/api/projects/[id]/version-control/branch/update/route.ts

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl, { Branch } from "@/app/models/VersionControl";
import { FileEntity } from "@/app/models/project";

// PATCH: Update a branch's working structure (used by frontend autosave/manual save on non-main branch)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const { branchName, structure } = await req.json();

    if (!branchName || structure === undefined) {
      return NextResponse.json(
        { error: "branchName and structure required" },
        { status: 400 },
      );
    }

    const vcDoc = await VersionControl.findOne({ projectId });
    if (!vcDoc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    const branch = vcDoc.branches.find((b: Branch) => b.name === branchName);
    if (!branch)
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    // Update the working copy of the branch (lastStructure)
    branch.lastStructure = structure as FileEntity;

    // Mark the branches array modified to ensure Mongoose saves nested changes
    vcDoc.markModified("branches");
    await vcDoc.save();

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
