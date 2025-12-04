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

    // 4. Sync feedback scores (all-time, not fiscal year specific)
    const feedbackResult = await syncFeedbackScores(agentMap);

    console.log("Sync complete:", {
      fiscalYear: latestYear.label,
      readRows: importResult.readRows,
      importedRows: importResult.importedRows,
      feedbackSynced: feedbackResult.synced,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Sync completed successfully",
        fiscalYear: latestYear.label,
        readRows: importResult.readRows,
        importedRows: importResult.importedRows,
        feedbackSynced: feedbackResult.synced,
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
    
    // Fetch Holiday entries (agent absences: sickness, vacation, etc.)
    // The Holiday endpoint contains both:
    // - Agent-specific absences (agent_id > 0): sickness, vacation, etc.
    // - Company-wide holidays (agent_id = 0): public holidays like "All Saints' Day"
    // We only count agent-specific absences (agent_id > 0) for absence hours
    let holidays: any[] = [];
    try {
      holidays = await haloFetch("Holiday", { query });
      console.log(`Fetched ${holidays.length} holiday entries for absence tracking`);
    } catch (e) {
      console.warn("Could not fetch Holiday data:", e);
    }
    
    // Build a map of agent+date -> { workHours, unloggedHours } from Timesheet
    // Halo's Timesheet entity has pre-calculated work_hours and unlogged_hours
    const timesheetMap: Record<string, { workHours: number; unloggedHours: number }> = {};
    for (const ts of timesheets) {
      const agentId = `${pick<any>(ts, ["agent_id", "agentId"]) ?? ""}`.trim();
      const dateVal = pick<string>(ts, ["date"]) || "";
      if (!agentId || !dateVal) continue;
      const dateOnly = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
      
      // work_hours and unlogged_hours from Halo Timesheet
      const workHours = Number(pick<any>(ts, ["work_hours", "workHours"]) ?? 0);
      const unloggedHours = Number(pick<any>(ts, ["unlogged_hours", "unloggedHours"]) ?? 0);
      
      const key = `${agentId}:${dateOnly}`;
      timesheetMap[key] = { workHours, unloggedHours };
    }
    
    // Build a map of empId+monthIdx -> absenceHours from Holiday endpoint
    // Holiday entries with agent_id > 0 are agent-specific absences (sickness, vacation, etc.)
    // Holiday entries with agent_id = 0 are company-wide holidays (public holidays)
    const absenceMap: Record<string, number> = {};
    // Also track daily absences to subtract from worked hours (empId:dateOnly -> hours)
    const dailyAbsenceMap: Record<string, number> = {};
    const todayForAbsence = new Date().toISOString().slice(0, 10);
    let agentHolidayCount = 0;
    
    for (const hol of holidays) {
      // Only count agent-specific absences (agent_id > 0)
      // Skip company-wide holidays (agent_id = 0)
      const agentId = `${pick<any>(hol, ["agent_id", "agentId"]) ?? "0"}`.trim();
      if (agentId === "0" || agentId === "") continue;
      
      const empId = finalAgentMapById[agentId];
      if (!empId) continue;
      
      // Use "date" field (start date) from Holiday endpoint
      const startDate = pick<string>(hol, ["date", "start_date", "startDate"]) || "";
      const endDate = pick<string>(hol, ["end_date", "endDate"]) || "";
      const isAllDay = pick<any>(hol, ["allday", "all_day", "isAllDay"]);
      const duration = Number(pick<any>(hol, ["duration"]) ?? 0); // Duration in hours from Halo
      const holidayName = pick<string>(hol, ["name"]) || "";
      
      if (!startDate) continue;
      const startDateOnly = startDate.length >= 10 ? startDate.slice(0, 10) : startDate;
      
      // Skip future dates
      if (startDateOnly > todayForAbsence) continue;
      
      // Calculate hours for this absence
      // Work day = 8 hours (9h scheduled minus 1h lunch break)
      // Halo's duration field often includes the full 9h schedule, so we need to adjust
      const WORK_HOURS_PER_DAY = 8;
      let absenceHours = 0;
      
      if (duration > 0) {
        // Halo's duration is in hours but includes lunch breaks
        // For multi-day absences, calculate days and multiply by 8
        // For single-day, cap at 8 hours
        if (duration > 9) {
          // Multi-day absence: duration / 9 gives approximate days (Halo uses 9h/day)
          const approxDays = Math.round(duration / 9);
          absenceHours = approxDays * WORK_HOURS_PER_DAY;
        } else {
          // Single day or partial day - cap at 8 hours
          absenceHours = Math.min(duration, WORK_HOURS_PER_DAY);
        }
      } else if (isAllDay) {
        // All-day absence = 8 hours per day (excluding lunch)
        if (endDate && endDate !== startDate) {
          // Multi-day absence
          const s = new Date(startDateOnly).getTime();
          const eDate = endDate.length >= 10 ? endDate.slice(0, 10) : endDate;
          const e = new Date(eDate).getTime();
          if (!isNaN(s) && !isNaN(e) && e >= s) {
            const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
            absenceHours = days * WORK_HOURS_PER_DAY;
          } else {
            absenceHours = WORK_HOURS_PER_DAY;
          }
        } else {
          absenceHours = WORK_HOURS_PER_DAY;
        }
      } else if (startDate && endDate) {
        // Calculate duration from start to end time, cap at 8h per day
        const s = new Date(startDate).getTime();
        const e = new Date(endDate).getTime();
        if (!isNaN(s) && !isNaN(e) && e > s) {
          const rawHours = (e - s) / (1000 * 60 * 60);
          absenceHours = Math.min(rawHours, WORK_HOURS_PER_DAY);
        }
      }
      
      if (absenceHours > 0) {
        agentHolidayCount++;
        const monthIdx = fiscalMonthIndex(startDateOnly);
        const monthKey = `${empId}:${monthIdx}`;
        absenceMap[monthKey] = (absenceMap[monthKey] || 0) + absenceHours;
        
        // Also track daily absence for subtracting from worked hours
        const dailyKey = `${empId}:${startDateOnly}`;
        dailyAbsenceMap[dailyKey] = (dailyAbsenceMap[dailyKey] || 0) + absenceHours;
        
        console.log(`Holiday absence: ${holidayName} for agent ${agentId} -> emp ${empId}, ${absenceHours}h on ${startDateOnly}`);
      }
    }
    console.log(`Processed ${agentHolidayCount} agent-specific holiday entries into ${Object.keys(absenceMap).length} month buckets`);

    // Load billable charge types
    let billableTypeSet: Set<string> | null = null;
    let excludedLoggedSet: Set<string> | null = null;
    let excludedBreakTypes: Set<string> | null = null;
    
    // Load special work days (red days, days before holidays, etc.)
    // Key: date string (YYYY-MM-DD) -> work hours for that day
    const specialDaysMap: Record<string, number> = {};

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
      
      // Load special work days
      const { data: specialDays } = await supabaseServer
        .from("special_work_days")
        .select("date, work_hours");
      if (Array.isArray(specialDays)) {
        for (const sd of specialDays) {
          if (sd.date) {
            specialDaysMap[sd.date] = Number(sd.work_hours) || 0;
          }
        }
        console.log(`Loaded ${Object.keys(specialDaysMap).length} special work days`);
      }
    } catch {}

    // Load employee shifts (employee_id -> work_hours)
    // This determines how many hours each employee works per day (default 8)
    const employeeShiftHours: Record<string, number> = {};
    try {
      const { data: shiftAssignments } = await supabaseServer
        .from("employee_shifts")
        .select("employee_id, shift_id, shifts(work_hours)");
      if (Array.isArray(shiftAssignments)) {
        for (const sa of shiftAssignments as any[]) {
          const workHours = sa.shifts?.work_hours ?? 8;
          employeeShiftHours[sa.employee_id] = Number(workHours);
        }
        console.log(`Loaded ${Object.keys(employeeShiftHours).length} employee shift assignments`);
      }
    } catch {}

    // Aggregate per agent + fiscal month
    type Totals = { logged: number; billed: number; worked: number; breakHours: number; absenceHours: number; unloggedHours: number; overtimeHours: number };
    const agg: Record<string, Totals> = {};
    // Daily aggregation now also tracks total logged hours for overtime calculation
    const dailyAgg: Record<string, { start: number; end: number; breaks: number; loggedHours: number; empId: string; agentId: string; dateOnly: string; monthIdx: number }> = {};

    const defaultBillableTypes = new Set([
      "remote support", "on-site support", "project", "documentation",
      "overtime remote support", "overtime on-site support", "overtime project",
      "int support (other department)", "travel time (zone 2)", "travel time (zone 1)",
      "overtime travel time", "included (agreement)", "finance deal", "travel only", "int pre-sale",
      "sp-agreement", "sales account",
    ]);
    const defaultExcludedLogged = new Set(["holiday", "vacation", "break"]);
    // Breaks that count as non-working time (excluded from logged hours)
    // Note: "lunch break" is NOT counted as a break for tracking purposes
    // because the 8h work day already excludes the 1h lunch
    const defaultBreaks = new Set(["taking a breather", "lunch break", "non-working hours", "lunch"]);
    // Lunch break types - these should NOT be subtracted from worked hours
    // because the 8h shift already excludes the 1h lunch
    const lunchBreakTypes = new Set(["lunch break", "lunch", "lunchbreak", "lunch-break"]);

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
      
      // Skip today and future dates - only count completed days
      // This ensures logged, billed, worked, breaks are all consistent
      if (dateOnly >= todayUTC) {
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
      // Also check break_type_name for the actual name (Halo uses this)
      const breakTypeName = pick<string>(ev, ["break_type_name", "breakTypeName", "breaktype_name"]) || "";
      const breakType = breakTypeName ? breakTypeName.trim().toLowerCase() : `${breakTypeRaw ?? ""}`.trim().toLowerCase();
      const holidayId = pick<any>(ev, ["holiday_id", "holidayId"]);

      const isExcludedByCharge = (excludedLoggedSet ?? defaultExcludedLogged).has(ct);
      const breakTypeNum = Number(breakTypeRaw);
      const isExcludedByBreak = (Number.isFinite(breakTypeNum) && breakTypeNum > 0)
        || (!!breakType && (excludedBreakTypes ?? defaultBreaks).has(breakType));
      const holidayIdNum = Number(holidayId);
      const isExcludedByHolidayId = Number.isFinite(holidayIdNum) && holidayIdNum > 0;
      
      // Note: Absence hours are tracked from the Holiday endpoint (absenceMap), not from TimesheetEvent
      // This avoids double-counting since Holiday entries are the authoritative source for absences
      
      const excluded = isExcludedByCharge || isExcludedByBreak || isExcludedByHolidayId;
      const loggedAdd = raw > 0 && !excluded ? raw : 0;

      const cur = (agg[key] ||= { logged: 0, billed: 0, worked: 0, breakHours: 0, absenceHours: 0, unloggedHours: 0, overtimeHours: 0 });
      cur.logged += Number.isFinite(loggedAdd) ? loggedAdd : 0;
      cur.billed += Number.isFinite(billable) ? billable : 0;
      
      // Track break hours (absence hours come from Holiday endpoint, not here)
      // Exclude lunch breaks from tracking - lunch is already accounted for in the 8h work day
      // In Halo: break_type=1 is coffee/short break, break_type=2 is lunch
      const isLunchBreak = breakTypeNum === 2 || lunchBreakTypes.has(breakType) || breakType.includes("lunch") || ct.includes("lunch");
      
      if (isExcludedByBreak && raw > 0 && !isLunchBreak) {
        cur.breakHours += raw;
      }

      // Daily aggregation for Worked Hours and Overtime calculation
      // Track total logged hours per day to calculate overtime (hours > 8h)
      const startVal = pick<string>(ev, ["start_date", "startdate", "startDate"]);
      const endVal = pick<string>(ev, ["end_date", "enddate", "endDate"]);
      if (startVal && endVal) {
        const s = new Date(startVal).getTime();
        const e = new Date(endVal).getTime();
        if (!isNaN(s) && !isNaN(e)) {
          const dayKey = `${empId}:${dateOnly}`;
          const d = (dailyAgg[dayKey] ||= { start: Infinity, end: -Infinity, breaks: 0, loggedHours: 0, empId, agentId, dateOnly, monthIdx: idx });
          if (s < d.start) d.start = s;
          if (e > d.end) d.end = e;
          // Track breaks for subtraction from worked hours (exclude lunch - already in 8h)
          // In Halo: break_type=1 is coffee/short break, break_type=2 is lunch
          const isLunchBreakForDaily = breakTypeNum === 2 || lunchBreakTypes.has(breakType) || breakType.includes("lunch") || ct.includes("lunch");
          if (isExcludedByBreak && raw > 0 && !isLunchBreakForDaily) {
            d.breaks += raw;
          }
          // Track logged hours for overtime calculation (exclude breaks/holidays)
          if (!excluded && raw > 0) {
            d.loggedHours += raw;
          }
        }
      }
    }

    // Sum up daily worked hours using SHIFT-BASED calculation
    // If an employee logged any time on a day, they get their shift's work hours (default 8h)
    // Special work days override the shift hours
    // Absence hours are subtracted from the daily work hours
    // IMPORTANT: Skip the current day - it's not complete yet
    for (const d of Object.values(dailyAgg)) {
      // Skip today - the day isn't complete
      if (d.dateOnly === todayUTC) {
        continue;
      }
      
      // Get the employee's shift work hours (default 8h if not assigned)
      const shiftHours = employeeShiftHours[d.empId] ?? 8;
      
      // Check if this is a special work day (red day, day before holiday, etc.)
      // Special days override the shift hours
      const specialDayHours = specialDaysMap[d.dateOnly];
      const dailyWorkHours = specialDayHours !== undefined ? specialDayHours : shiftHours;
      
      // If it's a full holiday (0 hours), skip adding worked hours
      if (dailyWorkHours <= 0) {
        continue;
      }
      
      // Subtract daily absence hours AND break hours from worked hours
      // Worked = shift hours (8h) - breaks - absences
      const dailyAbsenceKey = `${d.empId}:${d.dateOnly}`;
      const dailyAbsence = dailyAbsenceMap[dailyAbsenceKey] || 0;
      const workedHours = Math.max(0, dailyWorkHours - dailyAbsence - d.breaks);
      
      // Calculate overtime: if logged hours exceed the daily work hours, the excess is overtime
      const overtimeHours = d.loggedHours > dailyWorkHours ? d.loggedHours - dailyWorkHours : 0;
      
      // Get unlogged hours from Timesheet if available
      const tsKey = `${d.agentId}:${d.dateOnly}`;
      const tsData = timesheetMap[tsKey];
      const unloggedHours = tsData?.unloggedHours ?? 0;
      
      const key = `${d.empId}:${d.monthIdx}`;
      const cur = (agg[key] ||= { logged: 0, billed: 0, worked: 0, breakHours: 0, absenceHours: 0, unloggedHours: 0, overtimeHours: 0 });
      if (workedHours > 0) {
        cur.worked += workedHours;
      }
      if (unloggedHours > 0) {
        cur.unloggedHours += unloggedHours;
      }
      if (overtimeHours > 0) {
        cur.overtimeHours += overtimeHours;
      }
    }
    
    // Merge absenceMap (from Appointments + HolidayRequest) into agg
    // This is critical - the absenceMap was being built but never added to the final aggregation!
    for (const [key, hours] of Object.entries(absenceMap)) {
      const cur = (agg[key] ||= { logged: 0, billed: 0, worked: 0, breakHours: 0, absenceHours: 0, unloggedHours: 0, overtimeHours: 0 });
      cur.absenceHours += hours;
    }
    console.log(`Merged ${Object.keys(absenceMap).length} absence entries into aggregation`);

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
        break_hours: Math.round(totals.breakHours * 100) / 100,
        absence_hours: Math.round(totals.absenceHours * 100) / 100,
        unlogged_hours: Math.round(totals.unloggedHours * 100) / 100,
        overtime_hours: Math.round(totals.overtimeHours * 100) / 100,
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

/**
 * Sync feedback scores from HaloPSA
 * Calculates all-time average feedback score per agent
 */
async function syncFeedbackScores(agentMap: Record<string, string>): Promise<{ ok: boolean; synced: number; error?: string }> {
  try {
    // Build reverse map: halo agent_id -> employee_id
    const agentToEmployee: Record<number, string> = {};
    
    // Load persisted mappings
    try {
      const { data: persisted } = await supabaseServer
        .from("halo_agent_map")
        .select("employee_id, agent_id");
      for (const row of persisted || []) {
        if ((row as any).agent_id && (row as any).employee_id) {
          agentToEmployee[Number((row as any).agent_id)] = String((row as any).employee_id);
        }
      }
    } catch {}
    
    // Also add from passed agentMap
    for (const [agentId, empId] of Object.entries(agentMap)) {
      if (/^\d+$/.test(agentId)) {
        agentToEmployee[Number(agentId)] = empId;
      }
    }
    
    // Fetch all feedback from HaloPSA
    let allFeedback: any[] = [];
    try {
      const feedbackData = await haloFetch("Feedback", { query: { pageinate: "false", count: "10000" } });
      allFeedback = Array.isArray(feedbackData) ? feedbackData : (feedbackData?.records || []);
      console.log(`Fetched ${allFeedback.length} feedback entries from HaloPSA`);
    } catch (e) {
      console.warn("Could not fetch Feedback data:", e);
      return { ok: true, synced: 0 };
    }
    
    if (allFeedback.length === 0) {
      return { ok: true, synced: 0 };
    }
    
    // Get unique ticket IDs from feedback
    const feedbackTicketIds = new Set(allFeedback.map(fb => fb.ticket_id).filter(Boolean));
    console.log(`Need agent info for ${feedbackTicketIds.size} unique tickets from feedback`);
    
    // Fetch individual tickets by ID to get agent_id
    // This is slower but ensures we get all tickets with feedback
    const ticketAgentMap: Record<number, number> = {};
    const ticketIdArray = Array.from(feedbackTicketIds);
    
    try {
      // Fetch tickets in parallel batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < ticketIdArray.length; i += BATCH_SIZE) {
        const batchIds = ticketIdArray.slice(i, i + BATCH_SIZE);
        
        // Fetch each ticket individually in parallel
        const ticketPromises = batchIds.map(async (ticketId) => {
          try {
            const ticketData = await haloFetch(`Tickets/${ticketId}`, {});
            if (ticketData && ticketData.agent_id) {
              return { id: ticketId, agent_id: ticketData.agent_id };
            }
          } catch {
            // Ticket may not exist anymore
          }
          return null;
        });
        
        const results = await Promise.all(ticketPromises);
        for (const r of results) {
          if (r) {
            ticketAgentMap[r.id] = r.agent_id;
          }
        }
        
        // Log progress every 200 tickets
        if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= ticketIdArray.length) {
          console.log(`Fetched ${Math.min(i + BATCH_SIZE, ticketIdArray.length)}/${ticketIdArray.length} tickets...`);
        }
      }
      console.log(`Built ticket->agent map with ${Object.keys(ticketAgentMap).length} entries from ${ticketIdArray.length} feedback tickets`);
    } catch (e) {
      console.warn("Could not fetch Tickets for feedback mapping:", e);
      return { ok: true, synced: 0 };
    }
    
    // Calculate positive feedback percentage per agent
    // In HaloPSA: score 1 = best (positive), higher scores = worse
    // We calculate: (count of score=1) / (total count) * 100 = positive %
    const agentScores: Record<number, { positiveCount: number; totalCount: number }> = {};
    
    for (const fb of allFeedback) {
      const ticketId = fb.ticket_id;
      const score = Number(fb.score);
      if (!ticketId || isNaN(score)) continue;
      
      const agentId = ticketAgentMap[ticketId];
      if (!agentId) continue;
      
      if (!agentScores[agentId]) {
        agentScores[agentId] = { positiveCount: 0, totalCount: 0 };
      }
      agentScores[agentId].totalCount++;
      if (score === 1) {
        agentScores[agentId].positiveCount++;
      }
    }
    
    // Build upsert payload for employee_feedback table
    // average_score now represents positive feedback percentage (0-100)
    const payload: { employee_id: string; average_score: number; feedback_count: number; last_synced_at: string }[] = [];
    
    for (const [agentId, data] of Object.entries(agentScores)) {
      const empId = agentToEmployee[Number(agentId)];
      if (!empId) continue;
      
      // Calculate percentage of positive (score=1) feedback
      const positivePct = data.totalCount > 0 
        ? Math.round((data.positiveCount / data.totalCount) * 1000) / 10 
        : 0;
      payload.push({
        employee_id: empId,
        average_score: positivePct, // Now stores percentage (0-100)
        feedback_count: data.totalCount,
        last_synced_at: new Date().toISOString(),
      });
    }
    
    if (payload.length === 0) {
      console.log("No feedback scores to sync (no matching employees)");
      return { ok: true, synced: 0 };
    }
    
    // Upsert to employee_feedback table
    const { error: upErr } = await supabaseServer
      .from("employee_feedback")
      .upsert(payload, { onConflict: "employee_id" });
    
    if (upErr) {
      console.error("Failed to upsert feedback scores:", upErr);
      return { ok: false, synced: 0, error: upErr.message };
    }
    
    console.log(`Synced feedback scores for ${payload.length} employees`);
    return { ok: true, synced: payload.length };
  } catch (e: any) {
    console.error("Feedback sync error:", e);
    return { ok: false, synced: 0, error: e?.message };
  }
}
