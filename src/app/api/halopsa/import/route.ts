import { NextRequest, NextResponse } from "next/server";
import { haloFetch, fiscalMonthIndex } from "@/lib/halo";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { randomUUID } from "crypto";

type FY = { id: string; label: string; start_date?: string; end_date?: string };

function deriveFyWindow(fy: FY) {
  if (fy.start_date && fy.end_date) return { start: fy.start_date, end: fy.end_date };
  // Derive from label "YYYY/YYYY+1": start Sep 1, endAug 31
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

    // 3) Fetch TimesheetEvent from HaloPSA (for logged/billed hours)
    // Params supported by Swagger: start_date, end_date, agents, utcoffset
    // Do not filter by 'agents' to avoid missing matches due to naming; rely on server-side mapping instead.
    // const agentNames = Object.keys(finalAgentMapByName);
    const query: Record<string, string> = {
      start_date: options?.from || start,
      end_date: options?.to || end,
    } as any;

    const events: any[] = await haloFetch("TimesheetEvent", { query });
    
    // 3b) Also fetch Timesheet for work_hours data (daily summary with auto-corrected hours)
    const timesheetData: any[] = await haloFetch("Timesheet", { query });
    
    // Build a map of work_hours by agent_id and date for merging
    const workedHoursMap: Record<string, number> = {}; // key: "agentId:YYYY-MM-DD"
    for (const ts of timesheetData) {
      const agentId = `${pick<any>(ts, ["agent_id", "agentId", "agentID"]) ?? ""}`.trim();
      const dateVal = pick<string>(ts, ["date", "day"]) || "";
      if (agentId && dateVal) {
        const dateStr = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
        const worked = Number(pick<any>(ts, ["work_hours", "workHours", "worked_hours", "workedHours"]) ?? 0);
        const mapKey = `${agentId}:${dateStr}`;
        workedHoursMap[mapKey] = (workedHoursMap[mapKey] || 0) + worked;
      }
    }

    // Load billable charge type allowlist from Supabase if present
    let billableTypeSet: Set<string> | null = null;
    // Load excluded-from-logged charge types from Supabase if present
    let excludedLoggedSet: Set<string> | null = null;
    // Load break types and holiday types to exclude from Logged
    let excludedBreakTypes: Set<string> | null = null;
    let excludedHolidayTypes: Set<string> | null = null;
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
      const { data: excludedCfg, error: exclErr } = await supabaseBrowser
        .from("halo_excluded_logged_types")
        .select("name");
      if (!exclErr && Array.isArray(excludedCfg)) {
        excludedLoggedSet = new Set(
          (excludedCfg as any[])
            .map((r) => `${(r as any).name ?? ""}`.trim().toLowerCase())
            .filter(Boolean)
        );
      }
      const { data: breakCfg, error: breakErr } = await supabaseBrowser
        .from("halo_excluded_break_types")
        .select("name");
      if (!breakErr && Array.isArray(breakCfg)) {
        excludedBreakTypes = new Set(
          (breakCfg as any[])
            .map((r) => `${(r as any).name ?? ""}`.trim().toLowerCase())
            .filter(Boolean)
        );
      }
      const { data: holCfg, error: holErr } = await supabaseBrowser
        .from("halo_excluded_holiday_types")
        .select("name");
      if (!holErr && Array.isArray(holCfg)) {
        excludedHolidayTypes = new Set(
          (holCfg as any[])
            .map((r) => `${(r as any).name ?? ""}`.trim().toLowerCase())
            .filter(Boolean)
        );
      }
    } catch {}

    // 4) Aggregate per agent + fiscal month (Logged from TimesheetEvent, Billed by charge_type_name, Worked from Timesheet)
    type Totals = { logged: number; billed: number; worked: number };
    const agg: Record<string, Totals> = {};
    // per-charge-type billed aggregation
    const aggTypes: Record<string, number> = {};
    // Track which agent+date combinations we've already added worked hours for (to avoid duplicates)
    const workedHoursAdded: Set<string> = new Set();
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
      const dateOnly = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
      const idx = fiscalMonthIndex(dateOnly);
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

      // Worked: pull from Timesheet work_hours field (auto-corrected by Halo)
      // Look up in the workedHoursMap using agent_id and date
      const mapKey = `${agentId}:${dateOnly}`;
      const worked = workedHoursMap[mapKey] || 0;

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
      const rawCt = `${pick<any>(ev, ["charge_type_name", "chargeTypeName"]) ?? ""}`.trim();
      const ct = rawCt.toLowerCase();
      const isBillable = billableTypes.has(ct);
      const billable = raw > 0 && isBillable ? raw : 0;

      // Logged exclusion for non-working types (holiday/vacation/break)
      const defaultExcludedLogged = new Set(["holiday", "vacation", "break"]);
      const defaultBreaks = new Set([
        "taking a breather",
        "lunch break",
        "non-working hours",
      ]);
      const defaultHolidays = new Set([
        "vacation",
        "dentist appointment",
        "doctors appointment",
        "vab",
        "permission",
        "parental leave",
        "leave of absence",
        "withdraw time (stored compensation)",
      ]);
      const breakTypeRaw = pick<any>(ev, ["break_type", "breakType"]);
      const breakType = `${breakTypeRaw ?? ""}`.trim().toLowerCase();
      const holidayId = pick<any>(ev, ["holiday_id", "holidayId"]);

      const isExcludedByCharge = (excludedLoggedSet ?? defaultExcludedLogged).has(ct);
      const breakTypeNum = Number(breakTypeRaw);
      const isExcludedByBreak = (Number.isFinite(breakTypeNum) && breakTypeNum > 0)
        || (!!breakType && (excludedBreakTypes ?? defaultBreaks).has(breakType));
      const holidayIdNum = Number(holidayId);
      const isExcludedByHolidayId = Number.isFinite(holidayIdNum) && holidayIdNum > 0;
      const excluded = isExcludedByCharge || isExcludedByBreak || isExcludedByHolidayId;
      const loggedAdd = raw > 0 && !excluded ? raw : 0;

      const cur = (agg[key] ||= { logged: 0, billed: 0, worked: 0 });
      cur.logged += Number.isFinite(loggedAdd) ? loggedAdd : 0;
      cur.billed += Number.isFinite(billable) ? billable : 0;
      
      // Only add worked hours once per agent+date (to avoid counting same day multiple times)
      const workedKey = `${agentId}:${dateOnly}`;
      if (!workedHoursAdded.has(workedKey) && worked > 0) {
        cur.worked += worked;
        workedHoursAdded.add(workedKey);
      }

      // Per charge type aggregation (store name lowercased for normalization)
      if (billable > 0 && ct) {
        const tkey = `${empId}:${idx}:${ct}`;
        aggTypes[tkey] = (aggTypes[tkey] || 0) + billable;
      }
    }

    // 5) Upsert into month_entries
    const keys = Object.keys(agg);
    if (keys.length === 0) {
      return NextResponse.json({ ok: true, message: "No matching rows to import", readRows, importedRows: 0 }, { status: 200 });
    }

    // Fetch existing to preserve IDs
    const { data: existing, error: exErr } = await supabaseBrowser
      .from("month_entries")
      .select("id, employee_id, fiscal_year_id, month_index")
      .eq("fiscal_year_id", fiscalYearId);
    if (exErr) throw exErr;
    const exMap: Record<string, any> = {};
    (existing || []).forEach((e) => (exMap[`${e.employee_id}:${e.month_index}`] = e));

    const payload = keys.map((k) => {
      const [empId, idxStr] = k.split(":");
      const idx = Number(idxStr);
      const totals = agg[k];
      const ex = exMap[k];
      const base: any = {
        id: ex?.id ?? randomUUID(),
        employee_id: empId,
        fiscal_year_id: fiscalYearId,
        month_index: idx,
        logged: Math.round(totals.logged * 100) / 100,
        billed: Math.round(totals.billed * 100) / 100,
        worked: Math.round(totals.worked * 100) / 100,
      };
      return base;
    });

    const { error: upErr } = await supabaseBrowser
      .from("month_entries")
      .upsert(payload, { onConflict: "employee_id,fiscal_year_id,month_index" });
    if (upErr) throw upErr;

    // 6) Upsert per-charge-type billed hours into month_entries_billed_types
    const typeKeys = Object.keys(aggTypes);
    if (typeKeys.length) {
      const payloadTypes = typeKeys.map((tk) => {
        const [empId, idxStr, ct] = tk.split(":");
        const idx = Number(idxStr);
        return {
          employee_id: empId,
          fiscal_year_id: fiscalYearId,
          month_index: idx,
          charge_type_name: ct, // stored lowercased
          hours: Math.round((aggTypes[tk] || 0) * 100) / 100,
        };
      });
      const { error: upErrTypes } = await supabaseBrowser
        .from("month_entries_billed_types")
        .upsert(payloadTypes, { onConflict: "employee_id,fiscal_year_id,month_index,charge_type_name" });
      if (upErrTypes) throw upErrTypes;
    }

    return NextResponse.json(
      {
        ok: true,
        readRows,
        importedRows: payload.length,
        importedBilledTypeRows: typeKeys ? typeKeys.length : 0,
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
