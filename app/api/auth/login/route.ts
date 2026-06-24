import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username.trim() || !password.trim()) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  const session = await createSessionToken(username, password);

  if ("error" in session) {
    const status = session.error === "Unknown user" ? 404 : 401;
    return NextResponse.json({ error: session.error }, { status });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });

  return response;
}
