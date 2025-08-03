import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';

export async function POST(req: Request) {
  const { username, email, password } = await req.json();
  try {
    const user = await registerUser(username, email, password);
    return NextResponse.json({ message: 'User registered', user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
