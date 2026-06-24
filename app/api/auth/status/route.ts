import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthorizedUser();

  return NextResponse.json({
    authenticated: Boolean(user),
    user
  });
}
