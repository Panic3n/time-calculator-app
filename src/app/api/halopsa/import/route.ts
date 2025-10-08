import { NextRequest, NextResponse } from "next/server";
import { haloFetch, fiscalMonthIndex } from "@/lib/halo";
import { supabaseBrowser } from "@/lib/supabaseClient";

type FY = { id: string; label: string; start_date?: string; end_date?: string };

function deriveFyWindow(fy: FY) {
  if (fy.start_date && fy.end_date) return { start: fy.start_date, end: fy.end_date };
  // Derive from label "YYYY/YYYY+1": start Sep 1, end Aug 31
  const [a, b] = (fy.label || "").split("/").map(Number);
  const start = new Date(Date.UTC(a, 8, 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(b, 7, 31)).toISOString().slice(0, 10);
  return { start, end };
}

function pick<T=any>(obj: any, keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k] as T;
    const alt = Object.keys(obj || {}).find((p) => p.toLowerCase() === k.toLowerCase());
    if (alt) return obj[alt] as T;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const { fiscalYearId, agentMap, options } = await req.json();
    if (!fiscalYearId || typeof fiscalYearId !== "string") {
      return NextResponse.json({ error: "fiscalYearId is required" }, { status: 400 });
    }
    if (!agentMap || typeof agentMap !== "object") {
      return NextResponse.json({ error: "agentMap is required" }, { status: 400 });
    }

    // 1) Resolve FY window
    const { data: fys, error: fyErr } = await supabaseBrowser
      .from("fiscal_years")
      .select("id, label, start_date, end_date")
      .eq("id", fiscalYearId)
      .limit(1);
    if (fyErr) throw fyErr;
    const fy = (fys?.[0] as FY) || null;
    if (!fy) return NextResponse.json({ error: "Fiscal year not found" }, { status: 404 });
    const { start, end } = deriveFyWindow(fy);

    // 2) Build final agent->employee_id map (accept id or name, and auto-match by name for missing mappings)
    const { data: emps, error: empErr } = await supabaseBrowser
      .from("employees")
      .select("id, name");
    if (empErr) throw empErr;
    const byName: Record<string, string> = {};
    for (const e of emps || []) {
      byName[(e as any).name?.toLowerCase?.() || ""] = (e as any).id;
    }
    const finalAgentMapByName: Record<string, string> = {};
    const finalAgentMapById: Record<string, string> = {};

    // Load persisted mappings (employee_id <-> agent_id)
    try {
      const { data: persisted, error: mapErr } = await supabaseBrowser
        .from("halo_agent_map")
        .select("employee_id, agent_id");
      if (mapErr) {
        // ignore if table missing; API /agent-map exposes SQL to create it
      } else {
        for (const row of persisted || []) {
          if ((row as any).agent_id && (row as any).employee_id) {
            finalAgentMapById[String((row as any).agent_id)] = String((row as any).employee_id);
          }
        }
      }
    } catch {}
    for (const [agentKey, value] of Object.entries(agentMap as Record<string, string>)) {
      if (!agentKey) continue;
      const v = (value || "").trim();
      if (!v) continue;
      // Resolve employee id
      const lowerVal = v.toLowerCase();
      const isUuidLike = /[0-9a-f-]{16,}/i.test(v);
      const empId = (isUuidLike && (emps || []).some((x: any) => x.id === v)) ? v : (byName[lowerVal] || "");
      if (!empId) continue;
      // Numeric key means Halo agent_id mapping
      if (/^\d+$/.test(agentKey)) {
        finalAgentMapById[agentKey] = empId;
      } else {
        finalAgentMapByName[agentKey] = empId;
      }
    }
    // Auto-match any missing agents by exact employee name
    for (const a of Object.keys(agentMap || {})) {
      if (finalAgentMapByName[a] || /^\d+$/.test(a)) continue;
      const empId = byName[a.toLowerCase?.() || ""];
      if (empId) finalAgentMapByName[a] = empId;
    }

    // 3) Fetch TimesheetEvent from HaloPSA
    // Params supported by Swagger: start_date, end_date, agents, utcoffset
    // Do not filter by 'agents' to avoid missing matches due to naming; rely on server-side mapping instead.
    // const agentNames = Object.keys(finalAgentMapByName);
    const query: Record<string, string> = {
      start_date: options?.from || start,
      end_date: options?.to || end,
    } as any;


    const events: any[] = await haloFetch("TimesheetEvent", { query });

    // Load billable charge type allowlist from Supabase if present
    let billableTypeSet: Set<string> | null = null;
    try {
      const { data: billableCfg, error: billableErr } = await supabaseBrowser
        .from("halo_billable_charge_types")
        .select("name");
      if (!billableErr && Array.isArray(billableCfg)) {
        billableTypeSet = new Set(
          (billableCfg as any[])
            .map((r) => `${(r as any).name ?? ""}`.trim().toLowerCase())
            .filter(Boolean)
        );
      }
    } catch {}

    // 4) Aggregate per agent + fiscal month (Logged from TimesheetEvent, Billed by charge_type_name)
    type Totals = { logged: number; billed: number };
    const agg: Record<string, Totals> = {};
    let readRows = 0;
    for (const ev of events) {
      readRows++;
      const agentName =
        pick<string>(ev, ["agentName", "agent_name", "user_name", "agent", "username", "uname", "name"]) || "";
      const agentId = `${pick<any>(ev, ["agent_id", "agentId", "agentID"]) ?? ""}`.trim();
      // Prefer ID mapping, fallback to name mapping (case-insensitive)
      const empId = finalAgentMapById[agentId]
        || finalAgentMapByName[agentName]
        || finalAgentMapByName[agentName.trim()]
        || finalAgentMapByName[agentName.toLowerCase?.() || ""];
      if (!empId) continue;

      const dateVal =
        pick<string>(ev, ["day", "date", "entryDate", "start_date", "end_date", "created_at"]) || "";
      if (!dateVal) continue;
      const idx = fiscalMonthIndex(dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal);
      const key = `${empId}:${idx}`;

      // Logged: capture ALL time. Treat values as hours.
      const raw = Number(
        pick<any>(ev, [
          "timeTakenHours",
          "rawTime",
          "raw_time",
          "timeTaken",
          "time_taken",
          "timetaken",
        ]) ?? 0
      );

      // Billed by charge type allowlist (case-insensitive)
      const defaultBillableTypes = new Set([
        "remote support",
        "on-site support",
        "project",
        "documentation",
        "overtime remote support",
        "overtime on-site support",
        "overtime project",
        "int support (other department)",
        "travel time (zone 2)",
        "travel time (zone 1)",
        "overtime travel time",
        "included (agreement)",
        "finance deal",
        "travel only",
        "int pre-sale",
      ]);
      const billableTypes = billableTypeSet ?? defaultBillableTypes;
      const ct = `${pick<any>(ev, ["charge_type_name", "chargeTypeName"]) ?? ""}`.trim().toLowerCase();
      const isBillable = billableTypes.has(ct);
      const billable = raw > 0 && isBillable ? raw : 0;

      const cur = (agg[key] ||= { logged: 0, billed: 0 });
      cur.logged += Number.isFinite(raw) ? raw : 0;
      cur.billed += Number.isFinite(billable) ? billable : 0;
    }

    // 5) Upsert into month_entries
    const keys = Object.keys(agg);
    if (keys.length === 0) {
      return NextResponse.json({ ok: true, message: "No matching rows to import", readRows, importedRows: 0 }, { status: 200 });
    }

    // Fetch existing to preserve worked
    const { data: existing, error: exErr } = await supabaseBrowser
      .from("month_entries")
      .select("id, employee_id, fiscal_year_id, month_index, worked, logged, billed")
      .eq("fiscal_year_id", fiscalYearId);
    if (exErr) throw exErr;
    const exMap: Record<string, any> = {};
    (existing || []).forEach((e) => (exMap[`${e.employee_id}:${e.month_index}`] = e));

    const payload = keys.map((k) => {
      const [empId, idxStr] = k.split(":");
      const idx = Number(idxStr);
      const totals = agg[k];
      const ex = exMap[k];
      return {
        ...(ex?.id ? { id: ex.id } : {}),
        employee_id: empId,
        fiscal_year_id: fiscalYearId,
        month_index: idx,
        worked: Number(ex?.worked || 0),
        logged: Math.round(totals.logged * 100) / 100,
        billed: Math.round(totals.billed * 100) / 100,
      };
    });

    const { error: upErr } = await supabaseBrowser
      .from("month_entries")
      .upsert(payload, { onConflict: "employee_id,fiscal_year_id,month_index" });
    if (upErr) throw upErr;

    return NextResponse.json(
      {
        ok: true,
        readRows,
        importedRows: payload.length,
        fiscalYearId,
        from: query.start_date,
        to: query.end_date,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Invalid request" }, { status: 400 });
  }
}
