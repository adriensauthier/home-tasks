import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser, requireAuthorization } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Frequency = "one_time" | "daily" | "weekly" | "monthly";

const allowedFrequencies = new Set(["one_time", "daily", "weekly", "monthly"]);

function normalizeFrequency(value: unknown): Frequency {
  if (typeof value === "string" && allowedFrequencies.has(value)) {
    return value as Frequency;
  }

  return "one_time";
}

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  const unauthorized = await requireAuthorization();
  if (unauthorized) return unauthorized;

  const currentUser = await getAuthorizedUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      description,
      assigned_to,
      frequency,
      due_date,
      done,
      last_completed_at,
      created_at,
      person:people(id, name)
    `)
    .eq("assigned_to", currentUser.personId)
    .order("done", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAuthorization();
  if (unauthorized) return unauthorized;

  const currentUser = await getAuthorizedUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = normalizeNullableString(body.title);

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title,
      description: normalizeNullableString(body.description),
      assigned_to: currentUser.personId,
      frequency: normalizeFrequency(body.frequency),
      due_date: normalizeNullableString(body.due_date),
      done: false
    })
    .select(`
      id,
      title,
      description,
      assigned_to,
      frequency,
      due_date,
      done,
      last_completed_at,
      created_at,
      person:people(id, name)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}
