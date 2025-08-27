import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/app/lib/mongoose";
import Project from "@/app/models/project";
import User from "@/app/models/User";
import Invitation from "@/app/models/Invitation";
import nodemailer from "nodemailer";

// helper: send email
async function sendEmail(to: string, subject: string, text: string) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("Missing EMAIL_USER or EMAIL_PASS");
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
    console.error("Email error:", err);
  }
}

// POST: create project
export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const { title, description, ownerEmail, collaborators } = await req.json();

    if (!title || !ownerEmail) {
      return NextResponse.json(
        { error: "Title and owner email required" },
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
        { name: "README.md", type: "file", content: "# New Project\nWelcome!" },
      ],
    };

    const newProject = await Project.create({
      title,
      description: description || "",
      members: [{ email: ownerEmail, role: "owner" }],
      structure: defaultStructure,
    });

    // add to owner’s account
    await User.findOneAndUpdate(
      { email: ownerEmail },
      { $addToSet: { projects: newProject._id } },
      { upsert: true },
    );

    // send invitations but DO NOT add members until accepted
    if (Array.isArray(collaborators)) {
      for (const collabEmail of collaborators) {
        await Invitation.create({
          projectId: newProject._id,
          projectTitle: title,
          ownerEmail,
          collaboratorEmail: collabEmail,
          role: "editor",
          status: "pending",
        });

        await sendEmail(
          collabEmail,
          `Invitation to collaborate on "${title}"`,
          `${ownerEmail} invited you to join "${title}". Please accept the invitation in the app.`,
        );
      }
    }

    return NextResponse.json({
      message: "Project created",
      project: {
        ...newProject.toObject(),
        owner: ownerEmail,
        collaborators: [],
      },
    });
  } catch (err) {
    console.error("Project POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET: fetch projects where user is member
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail");
    if (!userEmail) return NextResponse.json([], { status: 400 });

    const projects = await Project.find({ "members.email": userEmail }).lean();

    const projectsWithOwner = projects.map((p) => ({
      ...p,
      owner:
        p.members.find(
          (m: { email: string; role: string }) => m.role === "owner",
        )?.email || "",
      collaborators: p.members
        .filter((m: { email: string; role: string }) => m.role === "editor")
        .map((m: { email: string }) => m.email),
    }));

    return NextResponse.json(projectsWithOwner);
  } catch (err) {
    console.error("Project GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
