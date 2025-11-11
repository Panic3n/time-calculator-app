import { NextRequest, NextResponse } from "next/server";
import { supabaseBrowser } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    const fy = req.nextUrl.searchParams.get("fiscal_year_id");
    const q = supabaseBrowser.from("team_included_employees").select("fiscal_year_id, employee_id");
    const { data, error } = fy ? await q.eq("fiscal_year_id", fy) : await q;
    if (error) throw error;
    return NextResponse.json({ ok: true, rows: data ?? [] }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message || "Unknown error";
    const missing = /relation .* does not exist/i.test(msg) || /Could not find the table/i.test(msg) || /does not exist/i.test(msg);
    if (missing) {
      return NextResponse.json({
        ok: false,
        error: "team_included_employees table missing",
        create_sql: `
create table public.team_included_employees (
  fiscal_year_id uuid not null references public.fiscal_years(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  primary key (fiscal_year_id, employee_id)
);
-- RLS (adjust to your auth scheme)
alter table public.team_included_employees enable row level security;
create policy "read team included" on public.team_included_employees for select using (true);
create policy "write team included" on public.team_included_employees for insert with check (true);
create policy "update team included" on public.team_included_employees for update using (true) with check (true);
create policy "delete team included" on public.team_included_employees for delete using (true);
        `,
      }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { fiscal_year_id, employee_ids } = await req.json();
    if (!fiscal_year_id || !Array.isArray(employee_ids)) {
      return NextResponse.json({ ok: false, error: "fiscal_year_id and employee_ids[] are required" }, { status: 400 });
    }
    // Replace rows for the FY: delete missing, insert new
    const { error: delErr } = await supabaseBrowser
      .from("team_included_employees")
      .delete()
      .eq("fiscal_year_id", fiscal_year_id);
    if (delErr) throw delErr;
    const rows = employee_ids.map((id: string) => ({ fiscal_year_id, employee_id: id }));
    if (rows.length) {
      const { error: insErr } = await supabaseBrowser.from("team_included_employees").upsert(rows, { onConflict: "fiscal_year_id,employee_id" });
      if (insErr) throw insErr;
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Invalid request" }, { status: 400 });
  }
}
