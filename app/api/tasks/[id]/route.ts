import { NextRequest, NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getNextDueDate } from "@/lib/dates";

type Frequency = "one_time" | "daily" | "weekly" | "monthly";

type TaskRecord = {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  frequency: Frequency;
  due_date: string | null;
  done: boolean;
  last_completed_at: string | null;
  created_at: string;
};

const allowedFrequencies = new Set(["one_time", "daily", "weekly", "monthly"]);

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function taskSelect() {
  return `
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
  `;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuthorization();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = getSupabaseAdmin();

  if (body.action === "complete") {
    const { data: currentTask, error: readError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 400 });
    }

    const task = currentTask as TaskRecord;
    const now = new Date().toISOString();
    const isRepeating = task.frequency !== "one_time";

    if (isRepeating) {
      const nextDueDate = getNextDueDate(task.due_date, task.frequency);

      const { data: nextTask, error: insertError } = await supabase
        .from("tasks")
        .insert({
          title: task.title,
          description: task.description,
          assigned_to: task.assigned_to,
          frequency: task.frequency,
          due_date: nextDueDate,
          done: false
        })
        .select(taskSelect())
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }

      const nextTaskId =
        nextTask && typeof nextTask === "object" && "id" in nextTask ? nextTask.id : null;

      if (!nextTaskId) {
        return NextResponse.json({ error: "Unable to create the next recurring task." }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("tasks")
        .update({
          done: true,
          last_completed_at: now
        })
        .eq("id", id)
        .select(taskSelect())
        .single();

      if (error) {
        await supabase.from("tasks").delete().eq("id", nextTaskId);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ task: data, nextTask });
    }

    const updatePayload = {
      done: true,
      last_completed_at: now
    };

    const { data, error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", id)
      .select(taskSelect())
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ task: data });
  }

  if (body.action === "reopen") {
    const { data, error } = await supabase
      .from("tasks")
      .update({ done: false })
      .eq("id", id)
      .select(taskSelect())
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ task: data });
  }

  const updatePayload: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updatePayload.title = title;
  }

  if ("description" in body) {
    updatePayload.description = normalizeNullableString(body.description);
  }

  if ("assigned_to" in body) {
    updatePayload.assigned_to = normalizeNullableString(body.assigned_to);
  }

  if (typeof body.frequency === "string" && allowedFrequencies.has(body.frequency)) {
    updatePayload.frequency = body.frequency;
  }

  if ("due_date" in body) {
    updatePayload.due_date = normalizeNullableString(body.due_date);
  }

  if (typeof body.done === "boolean") {
    updatePayload.done = body.done;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", id)
    .select(taskSelect())
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuthorization();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
