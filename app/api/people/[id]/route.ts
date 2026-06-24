import { NextRequest, NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAuthorization();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("people").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
