import { NextResponse } from "next/server";
import { registerUser } from "@/app/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, email, password } = await req.json();
    const user = await registerUser(username, email, password);

    return NextResponse.json({ message: "User registered", user });
  } catch (err: unknown) {
    const errorMessage =
      typeof err === "object" && err !== null && "message" in err
        ? (err as { message: string }).message
        : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
