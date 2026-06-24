import { NextResponse } from "next/server";
import { isPasswordEnabled, isRequestAuthorized } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({
    passwordEnabled: isPasswordEnabled(),
    authenticated: await isRequestAuthorized()
  });
}
