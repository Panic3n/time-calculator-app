import { NextRequest, NextResponse } from "next/server";
import { supabaseBrowser } from "@/lib/supabaseClient";

export async function GET() {
  try {
    const { data, error } = await supabaseBrowser
      .from("halo_agent_map")
      .select("employee_id, agent_id");
    if (error) throw error;
    return NextResponse.json({ ok: true, mappings: data ?? [] }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message || "Unknown error";
    const missing = /relation .* does not exist/i.test(msg);
    if (missing) {
      return NextResponse.json({
        ok: false,
        error: "halo_agent_map table missing",
        create_sql: `
          create table public.halo_agent_map (
            employee_id uuid primary key references public.employees(id) on delete cascade,
            agent_id text unique not null,
            created_at timestamptz default now()
          );
          -- RLS (adjust to your auth scheme)
          alter table public.halo_agent_map enable row level security;
          create policy "read map" on public.halo_agent_map for select using (true);
          create policy "write map" on public.halo_agent_map for insert with check (true);
          create policy "update map" on public.halo_agent_map for update using (true) with check (true);
        `,
      }, { status: 200 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { employee_id, agent_id } = await req.json();
    if (!employee_id || !agent_id) {
      return NextResponse.json({ ok: false, error: "employee_id and agent_id are required" }, { status: 400 });
    }
    const { error } = await supabaseBrowser
      .from("halo_agent_map")
      .upsert({ employee_id, agent_id }, { onConflict: "employee_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Invalid request" }, { status: 400 });
  }
}
