import { NextRequest, NextResponse } from "next/server";
import connectDB from "../../lib/mongoose";
import Project from "../../models/project";
import User from "../../models/User";
import Invitation from "../../models/Invitation";
import nodemailer from "nodemailer";

// Email helper
async function sendEmail(to: string, subject: string, text: string) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️ Missing EMAIL_USER or EMAIL_PASS in .env");
      return;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

// POST: Create a new project
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { title, ownerEmail, collaborators } = await req.json();

    if (!title || !ownerEmail) {
      return NextResponse.json(
        { error: "Title and owner email are required" },
        { status: 400 },
      );
    }

    const defaultStructure = {
      name: "root",
      type: "folder",
      children: [
        {
          name: "src",
          type: "folder",
          children: [
            {
              name: "index.js",
              type: "file",
              content: `console.log("Hello World");`,
            },
          ],
        },
        {
          name: "README.md",
          type: "file",
          content: "# New Project\nWelcome to your new project!",
        },
      ],
    };

    const newProject = await Project.create({
      title,
      owner: ownerEmail,
      collaborators: [],
      structure: defaultStructure,
    });

    await User.findOneAndUpdate(
      { email: ownerEmail },
      { $addToSet: { projects: newProject._id } },
      { upsert: true },
    );

    // Send invitations if any
    if (Array.isArray(collaborators) && collaborators.length > 0) {
      for (const collabEmail of collaborators) {
        await Invitation.create({
          projectId: newProject._id,
          projectTitle: title,
          ownerEmail,
          collaboratorEmail: collabEmail,
        });

        await sendEmail(
          collabEmail,
          `Invitation to Collaborate on "${title}"`,
          `You have been invited by ${ownerEmail} to collaborate on the project "${title}". Please accept the invitation in the app to access it.`,
        );
      }
    }

    return NextResponse.json({
      message: "Project created successfully",
      projectId: newProject._id,
    });
  } catch (error) {
    console.error("Error in /api/projects POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET: Fetch projects for user
export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail");

    if (!userEmail) return NextResponse.json([], { status: 400 });

    const projects = await Project.find({
      $or: [{ owner: userEmail }, { collaborators: userEmail }],
    });

    return NextResponse.json(projects);
  } catch (error) {
    console.error("Error in /api/projects GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
