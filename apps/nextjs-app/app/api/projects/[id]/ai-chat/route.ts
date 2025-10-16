import { NextRequest, NextResponse } from "next/server";
import { connectDB, Project } from "@repo/database";

// GET: Fetch AI chat history for a project
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await context.params;

    const project = await Project.findById(id).select("aiChats");
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ aiChats: project.aiChats || [] });
  } catch (error) {
    console.error("Error fetching AI chat history:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI chat history" },
      { status: 500 },
    );
  }
}

// POST: Add a new AI chat message
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await context.params;
    const { role, content, userEmail } = await req.json();

    if (!role || !content || !userEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const aiChatMessage = {
      role,
      content,
      userEmail,
      timestamp: new Date(),
    };

    const project = await Project.findByIdAndUpdate(
      id,
      { $push: { aiChats: aiChatMessage } },
      { new: true },
    ).select("aiChats");

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ message: aiChatMessage });
  } catch (error) {
    console.error("Error saving AI chat message:", error);
    return NextResponse.json(
      { error: "Failed to save AI chat message" },
      { status: 500 },
    );
  }
}
