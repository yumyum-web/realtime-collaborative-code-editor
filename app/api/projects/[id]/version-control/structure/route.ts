// src/app/api/projects/[id]/version-control/structure/route.ts

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import VersionControl, { Branch } from "@/app/models/VersionControl";

// GET: Get structure for a specific branch
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id: projectId } = await params;
    const url = new URL(req.url);
    const branchName = url.searchParams.get("branch");

    if (!branchName) {
      return NextResponse.json(
        { error: "branch parameter required" },
        { status: 400 },
      );
    }

    const vcDoc = await VersionControl.findOne({ projectId });
    if (!vcDoc) {
      return NextResponse.json(
        { error: "Version control not initialized" },
        { status: 404 },
      );
    }

    const branch = vcDoc.branches.find((b: Branch) => b.name === branchName);
    if (!branch) {
      return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    }

    return NextResponse.json({
      structure: branch.lastStructure,
      branch: branchName,
    });
  } catch (err) {
    console.error("GET structure error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
