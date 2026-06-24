import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const AUTH_COOKIE_NAME = "home_tasks_auth";

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  personId: string;
};

type AuthRecord = {
  id: string;
  username: string;
  password_hash: string | null;
  person_id: string;
  person: {
    id: string;
    name: string;
  }[] | null;
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || "home-tasks-local-secret";
}

function getPasswordHash(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, expectedHash] = passwordHash.split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return safeEqual(actualHash, expectedHash);
}

function createSessionSignature(userId: string, passwordHash: string) {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(`${userId}:${passwordHash}`)
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

function parseSessionToken(token: string) {
  const [userId, signature] = token.split(".");

  if (!userId || !signature) {
    return null;
  }

  return { userId, signature };
}

async function getAuthRecord(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select(
      `
        id,
        username,
        password_hash,
        person_id,
        person:people(id, name)
      `
    )
    .eq("id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as AuthRecord;
}

function toAuthUser(record: AuthRecord): AuthUser {
  const person = record.person?.[0] ?? null;

  return {
    id: record.id,
    username: record.username,
    name: person?.name ?? record.username,
    personId: record.person_id
  };
}

export async function getAuthorizedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const parsed = parseSessionToken(token);
  if (!parsed) {
    return null;
  }

  const record = await getAuthRecord(parsed.userId);
  if (!record?.password_hash) {
    return null;
  }

  const expectedSignature = createSessionSignature(record.id, record.password_hash);
  if (!safeEqual(parsed.signature, expectedSignature)) {
    return null;
  }

  return toAuthUser(record);
}

export async function isRequestAuthorized() {
  return Boolean(await getAuthorizedUser());
}

export async function requireAuthorization() {
  const authorized = await isRequestAuthorized();

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function createSessionToken(username: string, password: string) {
  const supabase = getSupabaseAdmin();
  const normalizedUsername = normalizeUsername(username);

  const { data: record, error } = await supabase
    .from("app_users")
    .select(
      `
        id,
        username,
        password_hash,
        person_id,
        person:people(id, name)
      `
    )
    .eq("username", normalizedUsername)
    .single();

  if (error || !record) {
    return { error: "Unknown user" as const };
  }

  const authRecord = record as AuthRecord;

  if (authRecord.password_hash) {
    if (!verifyPassword(password, authRecord.password_hash)) {
      return { error: "Invalid password" as const };
    }
  } else {
    if (password.trim().length < 4) {
      return { error: "Password must be at least 4 characters" as const };
    }

    const passwordHash = getPasswordHash(password);
    const { data: updatedRecord, error: updateError } = await supabase
      .from("app_users")
      .update({
        password_hash: passwordHash,
        password_set_at: new Date().toISOString()
      })
      .eq("id", authRecord.id)
      .select(
        `
          id,
          username,
          password_hash,
          person_id,
          person:people(id, name)
        `
      )
      .single();

    if (updateError || !updatedRecord) {
      return { error: updateError?.message ?? "Unable to set password" };
    }

    authRecord.password_hash = (updatedRecord as AuthRecord).password_hash;
  }

  if (!authRecord.password_hash) {
    return { error: "Unable to create session" as const };
  }

  return {
    user: toAuthUser(authRecord),
    token: `${authRecord.id}.${createSessionSignature(authRecord.id, authRecord.password_hash)}`
  };
}
