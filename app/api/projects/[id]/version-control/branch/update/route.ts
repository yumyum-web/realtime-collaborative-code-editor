// src/app/api/projects/[id]/version-control/branch/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl from "@/app/models/VersionControl";

interface Branch {
  name: string;
  lastStructure: unknown; // Replace 'unknown' with the appropriate type for 'lastStructure' if known
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await connectDB();
    const projectId = params.id;
    const { branchName, structure } = await req.json();

    if (!branchName || structure === undefined) {
      return NextResponse.json(
        { error: "branchName and structure required" },
        { status: 400 },
      );
    }

    const vc = await VersionControl.findOne({ projectId });
    if (!vc)
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );

    const branch = vc.branches.find((b: Branch) => b.name === branchName);
    if (!branch)
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    branch.lastStructure = structure;
    await vc.save();

    return NextResponse.json({ success: true, branch: branchName });
  } catch (err) {
    console.error("PATCH branch update error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
