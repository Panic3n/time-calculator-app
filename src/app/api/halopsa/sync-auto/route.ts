import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { haloFetch, fiscalMonthIndex } from "@/lib/halo";
import { randomUUID } from "crypto";

// Server-side Supabase client with service role key to bypass RLS
const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
);

/**
 * Automatic sync endpoint for Vercel Cron Jobs
 * Runs every hour to sync the latest fiscal year
 * Also triggered when a new fiscal year is created
 */
export async function GET(req: NextRequest) {
  try {
    // Verify this is a Vercel cron request using the standard header
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(req.url);
    const secretParam = url.searchParams.get("secret");
    
    // Debug logging
    console.log("Cron request received:", {
      hasAuthHeader: !!authHeader,
      hasCronSecret: !!cronSecret,
      hasSecretParam: !!secretParam,
    });
    
    // Allow if:
    // 1. No CRON_SECRET is set (dev mode)
    // 2. Auth header matches (Vercel cron)
    // 3. Query param ?secret=XXX matches (manual trigger)
    const isAuthorized = !cronSecret 
      || authHeader === `Bearer ${cronSecret}`
      || secretParam === cronSecret;
    
    if (!isAuthorized) {
      console.warn("Unauthorized cron request - no valid auth");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting automatic Halo sync...");

    // 1. Get the latest fiscal year
    const { data: years, error: yearErr } = await supabaseServer
      .from("fiscal_years")
      .select("id, label, start_date, end_date")
      .order("start_date", { ascending: false })
      .limit(1);

    if (yearErr || !years || years.length === 0) {
      console.warn("No fiscal years found");
      return NextResponse.json(
        { ok: true, message: "No fiscal years to sync" },
        { status: 200 }
      );
    }

    const latestYear = years[0];
    console.log(`Syncing latest fiscal year: ${latestYear.label} (${latestYear.id})`);

    // 2. Get agent map from database
    let agentMap: Record<string, string> = {};
    try {
      const { data: mappings, error: mapErr } = await supabaseServer
        .from("halo_agent_map")
        .select("employee_id, agent_id");
      
      if (!mapErr && mappings) {
        for (const m of mappings) {
          agentMap[(m as any).agent_id] = (m as any).employee_id;
        }
      }
    } catch (e) {
      console.warn("Could not load agent map:", e);
    }

    // 3. Run the import logic directly (instead of calling another endpoint)
    // This avoids issues with internal fetch calls and RLS
    const importResult = await runImport(latestYear, agentMap);

    if (!importResult.ok) {
      console.error("Import failed:", importResult.error);
      return NextResponse.json(
        { ok: false, error: importResult.error || "Import failed" },
        { status: 400 }
      );
    }

    console.log("Sync complete:", {
      fiscalYear: latestYear.label,
      readRows: importResult.readRows,
      importedRows: importResult.importedRows,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Sync completed successfully",
        fiscalYear: latestYear.label,
        readRows: importResult.readRows,
        importedRows: importResult.importedRows,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Auto sync error:", error?.message);
    return NextResponse.json(
      { ok: false, error: error?.message || "Sync failed" },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to manually trigger sync for a specific fiscal year
 * Used when creating a new fiscal year
 */
export async function POST(req: NextRequest) {
  try {
    const { fiscalYearId } = await req.json();

    if (!fiscalYearId) {
      return NextResponse.json(
        { error: "fiscalYearId is required" },
        { status: 400 }
      );
    }

    console.log(`Triggering manual sync for fiscal year: ${fiscalYearId}`);

    // Get fiscal year details
    const { data: years, error: yearErr } = await supabaseServer
      .from("fiscal_years")
      .select("id, label, start_date, end_date")
      .eq("id", fiscalYearId)
      .limit(1);

    if (yearErr || !years || years.length === 0) {
      return NextResponse.json(
        { error: "Fiscal year not found" },
        { status: 404 }
      );
    }

    const fiscalYear = years[0];

    // Get agent map
    let agentMap: Record<string, string> = {};
    try {
      const { data: mappings, error: mapErr } = await supabaseServer
        .from("halo_agent_map")
        .select("employee_id, agent_id");
      
      if (!mapErr && mappings) {
        for (const m of mappings) {
          agentMap[(m as any).agent_id] = (m as any).employee_id;
        }
      }
    } catch (e) {
      console.warn("Could not load agent map:", e);
    }

    // Run import directly
    const importResult = await runImport(fiscalYear, agentMap);

    if (!importResult.ok) {
      throw new Error(importResult.error || "Import failed");
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Manual sync triggered",
        importedRows: importResult.importedRows,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Manual sync error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Sync failed" },
      { status: 400 }
    );
  }
}

// ============================================================================
// Import Logic (moved here to run directly with service role key)
// ============================================================================

type FY = { id: string; label: string; start_date?: string; end_date?: string };

function deriveFyWindow(fy: FY) {
  if (fy.start_date && fy.end_date) return { start: fy.start_date, end: fy.end_date };
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

async function runImport(fy: FY, agentMap: Record<string, string>): Promise<{ ok: boolean; error?: string; readRows?: number; skippedFuture?: number; importedRows?: number }> {
  try {
    const { start, end } = deriveFyWindow(fy);

    // Build agent map
    const { data: emps, error: empErr } = await supabaseServer
      .from("employees")
      .select("id, name");
    if (empErr) throw empErr;

    const byName: Record<string, string> = {};
    for (const e of emps || []) {
      byName[(e as any).name?.toLowerCase?.() || ""] = (e as any).id;
    }

    const finalAgentMapByName: Record<string, string> = {};
    const finalAgentMapById: Record<string, string> = {};

    // Load persisted mappings
    try {
      const { data: persisted } = await supabaseServer
        .from("halo_agent_map")
        .select("employee_id, agent_id");
      for (const row of persisted || []) {
        if ((row as any).agent_id && (row as any).employee_id) {
          finalAgentMapById[String((row as any).agent_id)] = String((row as any).employee_id);
        }
      }
    } catch {}

    for (const [agentKey, value] of Object.entries(agentMap)) {
      if (!agentKey) continue;
      const v = (value || "").trim();
      if (!v) continue;
      const lowerVal = v.toLowerCase();
      const isUuidLike = /[0-9a-f-]{16,}/i.test(v);
      const empId = (isUuidLike && (emps || []).some((x: any) => x.id === v)) ? v : (byName[lowerVal] || "");
      if (!empId) continue;
      if (/^\d+$/.test(agentKey)) {
        finalAgentMapById[agentKey] = empId;
      } else {
        finalAgentMapByName[agentKey] = empId;
      }
    }

    // Fetch TimesheetEvent from HaloPSA (for logged/billed hours)
    const query: Record<string, string> = {
      start_date: start,
      end_date: end,
      limit: "10000"
    };

    const events: any[] = await haloFetch("TimesheetEvent", { query });
    
    // Fetch Timesheet data (for actual clock-in/clock-out times)
    // Timesheet has start_time and end_time which are manually entered by agents
    let timesheets: any[] = [];
    try {
      timesheets = await haloFetch("Timesheet", { query });
    } catch (e) {
      console.warn("Could not fetch Timesheet data, falling back to TimesheetEvent:", e);
    }
    
    // Build a map of agent+date -> { start_time, end_time, break_hours } from Timesheet
    const timesheetMap: Record<string, { start: number; end: number; breaks: number }> = {};
    for (const ts of timesheets) {
      const agentId = `${pick<any>(ts, ["agent_id", "agentId"]) ?? ""}`.trim();
      const dateVal = pick<string>(ts, ["date"]) || "";
      if (!agentId || !dateVal) continue;
      const dateOnly = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
      
      const startTime = pick<string>(ts, ["start_time", "startTime"]);
      const endTime = pick<string>(ts, ["end_time", "endTime"]);
      const breakHours = Number(pick<any>(ts, ["break_hours", "breakHours"]) ?? 0);
      
      if (startTime && endTime) {
        const s = new Date(startTime).getTime();
        const e = new Date(endTime).getTime();
        if (!isNaN(s) && !isNaN(e)) {
          const key = `${agentId}:${dateOnly}`;
          timesheetMap[key] = { start: s, end: e, breaks: breakHours };
        }
      }
    }

    // Load billable charge types
    let billableTypeSet: Set<string> | null = null;
    let excludedLoggedSet: Set<string> | null = null;
    let excludedBreakTypes: Set<string> | null = null;

    try {
      const { data: billableCfg } = await supabaseServer
        .from("halo_billable_charge_types")
        .select("name");
      if (Array.isArray(billableCfg)) {
        billableTypeSet = new Set(
          billableCfg.map((r: any) => `${r.name ?? ""}`.trim().toLowerCase()).filter(Boolean)
        );
      }
      const { data: excludedCfg } = await supabaseServer
        .from("halo_excluded_logged_types")
        .select("name");
      if (Array.isArray(excludedCfg)) {
        excludedLoggedSet = new Set(
          excludedCfg.map((r: any) => `${r.name ?? ""}`.trim().toLowerCase()).filter(Boolean)
        );
      }
      const { data: breakCfg } = await supabaseServer
        .from("halo_excluded_break_types")
        .select("name");
      if (Array.isArray(breakCfg)) {
        excludedBreakTypes = new Set(
          breakCfg.map((r: any) => `${r.name ?? ""}`.trim().toLowerCase()).filter(Boolean)
        );
      }
    } catch {}

    // Aggregate per agent + fiscal month
    type Totals = { logged: number; billed: number; worked: number };
    const agg: Record<string, Totals> = {};
    const dailyAgg: Record<string, { start: number; end: number; breaks: number; empId: string; agentId: string; dateOnly: string; monthIdx: number }> = {};

    const defaultBillableTypes = new Set([
      "remote support", "on-site support", "project", "documentation",
      "overtime remote support", "overtime on-site support", "overtime project",
      "int support (other department)", "travel time (zone 2)", "travel time (zone 1)",
      "overtime travel time", "included (agreement)", "finance deal", "travel only", "int pre-sale",
    ]);
    const defaultExcludedLogged = new Set(["holiday", "vacation", "break"]);
    const defaultBreaks = new Set(["taking a breather", "lunch break", "non-working hours"]);

    // Get today's date (UTC) to exclude future entries
    const todayUTC = new Date().toISOString().slice(0, 10);

    let readRows = 0;
    let skippedFuture = 0;
    for (const ev of events) {
      readRows++;
      const agentName = pick<string>(ev, ["agentName", "agent_name", "user_name", "agent", "username", "uname", "name"]) || "";
      const agentId = `${pick<any>(ev, ["agent_id", "agentId", "agentID"]) ?? ""}`.trim();
      const empId = finalAgentMapById[agentId]
        || finalAgentMapByName[agentName]
        || finalAgentMapByName[agentName.trim()]
        || finalAgentMapByName[agentName.toLowerCase?.() || ""];
      if (!empId) continue;

      const dateVal = pick<string>(ev, ["day", "date", "entryDate", "start_date", "end_date", "created_at"]) || "";
      if (!dateVal) continue;
      const dateOnly = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
      
      // Skip future dates (entries scheduled for dates after today)
      if (dateOnly > todayUTC) {
        skippedFuture++;
        continue;
      }
      const idx = fiscalMonthIndex(dateOnly);
      const key = `${empId}:${idx}`;

      const raw = Number(pick<any>(ev, ["timeTakenHours", "rawTime", "raw_time", "timeTaken", "time_taken", "timetaken"]) ?? 0);
      const billableTypes = billableTypeSet ?? defaultBillableTypes;
      const rawCt = `${pick<any>(ev, ["charge_type_name", "chargeTypeName"]) ?? ""}`.trim();
      const ct = rawCt.toLowerCase();
      const isBillable = billableTypes.has(ct);
      const billable = raw > 0 && isBillable ? raw : 0;

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

      // Daily aggregation for Worked Hours (fallback if no Timesheet data)
      // Store agentId so we can look up Timesheet data later
      const startVal = pick<string>(ev, ["start_date", "startdate", "startDate"]);
      const endVal = pick<string>(ev, ["end_date", "enddate", "endDate"]);
      if (startVal && endVal) {
        const s = new Date(startVal).getTime();
        const e = new Date(endVal).getTime();
        if (!isNaN(s) && !isNaN(e)) {
          const dayKey = `${empId}:${dateOnly}`;
          const d = (dailyAgg[dayKey] ||= { start: Infinity, end: -Infinity, breaks: 0, empId, agentId, dateOnly, monthIdx: idx });
          if (s < d.start) d.start = s;
          if (e > d.end) d.end = e;
          if (isExcludedByBreak) d.breaks += raw;
        }
      }
    }

    // Sum up daily worked hours
    // Priority: Use Timesheet data (manual clock-in/out) if available, otherwise fall back to TimesheetEvent
    for (const d of Object.values(dailyAgg)) {
      // Check if we have Timesheet data for this agent+date
      const tsKey = `${d.agentId}:${d.dateOnly}`;
      const tsData = timesheetMap[tsKey];
      
      let workedHours = 0;
      
      if (tsData && tsData.end > tsData.start) {
        // Use Timesheet data (manual clock-in/clock-out)
        const spanMs = tsData.end - tsData.start;
        const spanHours = spanMs / (1000 * 60 * 60);
        workedHours = Math.max(0, spanHours - tsData.breaks);
      } else if (d.start !== Infinity && d.end !== -Infinity) {
        // Fall back to TimesheetEvent data (earliest/latest logged entry)
        const spanMs = d.end - d.start;
        if (spanMs >= 0) {
          const spanHours = spanMs / (1000 * 60 * 60);
          workedHours = Math.max(0, spanHours - d.breaks);
        }
      }
      
      if (workedHours > 0) {
        const key = `${d.empId}:${d.monthIdx}`;
        const cur = (agg[key] ||= { logged: 0, billed: 0, worked: 0 });
        cur.worked += workedHours;
      }
    }

    // Upsert into month_entries
    const keys = Object.keys(agg);
    if (keys.length === 0) {
      return { ok: true, readRows, importedRows: 0 };
    }

    const { data: existing } = await supabaseServer
      .from("month_entries")
      .select("id, employee_id, fiscal_year_id, month_index, worked")
      .eq("fiscal_year_id", fy.id);
    const exMap: Record<string, any> = {};
    (existing || []).forEach((e) => (exMap[`${e.employee_id}:${e.month_index}`] = e));

    const payload = keys.map((k) => {
      const [empId, idxStr] = k.split(":");
      const idx = Number(idxStr);
      const totals = agg[k];
      const ex = exMap[k];
      return {
        id: ex?.id ?? randomUUID(),
        employee_id: empId,
        fiscal_year_id: fy.id,
        month_index: idx,
        logged: Math.round(totals.logged * 100) / 100,
        billed: Math.round(totals.billed * 100) / 100,
        worked: Math.round(totals.worked * 100) / 100,
      };
    });

    const { error: upErr } = await supabaseServer
      .from("month_entries")
      .upsert(payload, { onConflict: "employee_id,fiscal_year_id,month_index" });
    if (upErr) throw upErr;

    return { ok: true, readRows, skippedFuture, importedRows: payload.length };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Import failed" };
  }
}
