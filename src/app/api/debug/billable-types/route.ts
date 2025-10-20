import { NextResponse } from "next/server";
import { supabaseBrowser } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const { data, error } = await supabaseBrowser
      .from("halo_billable_charge_types")
      .select("name")
      .order("name", { ascending: true });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, count: (data || []).length, items: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 400 });
  }
}
