import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';

export async function POST(req: Request) {
  const { email, password } = await req.json();
  try {
    const { token, username } = await loginUser(email, password);
    return NextResponse.json({ message: 'Login successful', token, username });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
}
