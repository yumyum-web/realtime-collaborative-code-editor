import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/app/lib/auth";
import sendEmail from "@/app/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();
    const user = await registerUser(username, email, password);

    // send a welcome email (non-blocking)
    const appBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";
    sendEmail({
      to: email,
      subject: "Welcome to the Real-time Collaborative Code Editor",
      text: `Hi ${username}, welcome! Visit ${appBaseUrl} to get started.`,
      html: `<p>Hi <strong>${username}</strong>, welcome!</p><p>Visit <a href="${appBaseUrl}">${appBaseUrl}</a> to get started.</p>`,
    });

    return NextResponse.json({ message: "User registered", user });
  } catch (err: unknown) {
    const errorMessage =
      typeof err === "object" && err !== null && "message" in err
        ? (err as { message: string }).message
        : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
