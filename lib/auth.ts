import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "home_tasks_auth";

function getAppPassword() {
  return process.env.APP_PASSWORD?.trim() ?? "";
}

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || getAppPassword() || "home-tasks-local-secret";
}

export function isPasswordEnabled() {
  return getAppPassword().length > 0;
}

export function createAuthToken() {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`home-tasks:${getAppPassword()}`)
    .digest("hex");
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export async function isRequestAuthorized() {
  if (!isPasswordEnabled()) {
    return true;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return false;
  }

  return safeEqual(token, createAuthToken());
}

export async function requireAuthorization() {
  const authorized = await isRequestAuthorized();

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function validatePassword(password: string) {
  const expected = getAppPassword();

  if (!expected) {
    return true;
  }

  return safeEqual(password, expected);
}
