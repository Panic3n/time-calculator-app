import { NextRequest, NextResponse } from "next/server";
import { supabaseBrowser } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    const fy = req.nextUrl.searchParams.get("fiscal_year_id");
    const q = supabaseBrowser.from("included_charge_types").select("fiscal_year_id, charge_type_name");
    const { data, error } = fy ? await q.eq("fiscal_year_id", fy) : await q;
    if (error) throw error;
    return NextResponse.json({ ok: true, rows: data ?? [] }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message || "Unknown error";
    const missing = /relation .* does not exist/i.test(msg);
    if (missing) {
      return NextResponse.json({
        ok: false,
        error: "included_charge_types table missing",
        create_sql: `
create table public.included_charge_types (
  fiscal_year_id uuid not null references public.fiscal_years(id) on delete cascade,
  charge_type_name text not null,
  primary key (fiscal_year_id, charge_type_name)
);
-- RLS (adjust to your auth scheme)
alter table public.included_charge_types enable row level security;
create policy "read included charge types" on public.included_charge_types for select using (true);
create policy "write included charge types" on public.included_charge_types for insert with check (true);
create policy "update included charge types" on public.included_charge_types for update using (true) with check (true);
create policy "delete included charge types" on public.included_charge_types for delete using (true);
        `,
      }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { fiscal_year_id, charge_type_names } = await req.json();
    if (!fiscal_year_id || !Array.isArray(charge_type_names)) {
      return NextResponse.json({ ok: false, error: "fiscal_year_id and charge_type_names[] are required" }, { status: 400 });
    }
    // Replace rows for the FY: delete missing, insert new
    const { error: delErr } = await supabaseBrowser
      .from("included_charge_types")
      .delete()
      .eq("fiscal_year_id", fiscal_year_id);
    if (delErr) throw delErr;
    const rows = charge_type_names.map((n: string) => ({ fiscal_year_id, charge_type_name: String(n || '').toLowerCase() }));
    if (rows.length) {
      const { error: insErr } = await supabaseBrowser.from("included_charge_types").upsert(rows, { onConflict: "fiscal_year_id,charge_type_name" });
      if (insErr) throw insErr;
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Invalid request" }, { status: 400 });
  }
}
