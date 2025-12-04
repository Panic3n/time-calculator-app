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
      limit: "10000" // Ensure we get all events for the month
    } as any;

    const events: any[] = await haloFetch("TimesheetEvent", { query });
    
    // Fetch Timesheet data (for actual clock-in/clock-out times)
    let timesheets: any[] = [];
    try {
      timesheets = await haloFetch("Timesheet", { query });
    } catch (e) {
      console.warn("Could not fetch Timesheet data, falling back to TimesheetEvent:", e);
    }
    
    // Fetch Holiday entries (agent absences: sickness, vacation, etc.)
    let holidays: any[] = [];
    try {
      holidays = await haloFetch("Holiday", { query });
      console.log(`Fetched ${holidays.length} holiday entries for absence tracking`);
    } catch (e) {
      console.warn("Could not fetch Holiday data:", e);
    }
    
    // Build a map of agent+date -> { workHours, unloggedHours } from Timesheet
    const timesheetMap: Record<string, { workHours: number; unloggedHours: number }> = {};
    for (const ts of timesheets) {
      const agentId = `${pick<any>(ts, ["agent_id", "agentId"]) ?? ""}`.trim();
      const dateVal = pick<string>(ts, ["date"]) || "";
      if (!agentId || !dateVal) continue;
      const dateOnly = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
      const workHours = Number(pick<any>(ts, ["work_hours", "workHours"]) ?? 0);
      const unloggedHours = Number(pick<any>(ts, ["unlogged_hours", "unloggedHours"]) ?? 0);
      const key = `${agentId}:${dateOnly}`;
      timesheetMap[key] = { workHours, unloggedHours };
    }
    
    // Build absence map from Holiday endpoint
    const absenceMap: Record<string, number> = {};
    // Also track daily absences to subtract from worked hours (empId:dateOnly -> hours)
    const dailyAbsenceMap: Record<string, number> = {};
    const todayForAbsence = new Date().toISOString().slice(0, 10);
    const WORK_HOURS_PER_DAY = 8;
    
    for (const hol of holidays) {
      const agentId = `${pick<any>(hol, ["agent_id", "agentId"]) ?? "0"}`.trim();
      if (agentId === "0" || agentId === "") continue;
      
      const empId = finalAgentMapById[agentId];
      if (!empId) continue;
      
      const startDate = pick<string>(hol, ["date", "start_date", "startDate"]) || "";
      const endDate = pick<string>(hol, ["end_date", "endDate"]) || "";
      const isAllDay = pick<any>(hol, ["allday", "all_day", "isAllDay"]);
      const duration = Number(pick<any>(hol, ["duration"]) ?? 0);
      
      if (!startDate) continue;
      const startDateOnly = startDate.length >= 10 ? startDate.slice(0, 10) : startDate;
      if (startDateOnly > todayForAbsence) continue;
      
      let absenceHours = 0;
      if (duration > 0) {
        if (duration > 9) {
          const approxDays = Math.round(duration / 9);
          absenceHours = approxDays * WORK_HOURS_PER_DAY;
        } else {
          absenceHours = Math.min(duration, WORK_HOURS_PER_DAY);
        }
      } else if (isAllDay) {
        if (endDate && endDate !== startDate) {
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
        const s = new Date(startDate).getTime();
        const e = new Date(endDate).getTime();
        if (!isNaN(s) && !isNaN(e) && e > s) {
          const rawHours = (e - s) / (1000 * 60 * 60);
          absenceHours = Math.min(rawHours, WORK_HOURS_PER_DAY);
        }
      }
      
      if (absenceHours > 0) {
        const monthIdx = fiscalMonthIndex(startDateOnly);
        const monthKey = `${empId}:${monthIdx}`;
        absenceMap[monthKey] = (absenceMap[monthKey] || 0) + absenceHours;
        
        // Also track daily absence for subtracting from worked hours
        const dailyKey = `${empId}:${startDateOnly}`;
        dailyAbsenceMap[dailyKey] = (dailyAbsenceMap[dailyKey] || 0) + absenceHours;
      }
    }
    
    // Load billable charge type allowlist from Supabase if present
    let billableTypeSet: Set<string> | null = null;
    // Load excluded-from-logged charge types from Supabase if present
    let excludedLoggedSet: Set<string> | null = null;
    // Load break types and holiday types to exclude from Logged
    let excludedBreakTypes: Set<string> | null = null;
    let excludedHolidayTypes: Set<string> | null = null;
    // Load special work days (red days, days before holidays, etc.)
    const specialDaysMap: Record<string, number> = {};
    
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
      // Load special work days
      const { data: specialDays } = await supabaseBrowser
        .from("special_work_days")
        .select("date, work_hours");
      if (Array.isArray(specialDays)) {
        for (const sd of specialDays) {
          if (sd.date) {
            specialDaysMap[sd.date] = Number(sd.work_hours) || 0;
          }
        }
      }
    } catch {}

    // Load employee shifts (employee_id -> work_hours)
    const employeeShiftHours: Record<string, number> = {};
    try {
      const { data: shiftAssignments } = await supabaseBrowser
        .from("employee_shifts")
        .select("employee_id, shift_id, shifts(work_hours)");
      if (Array.isArray(shiftAssignments)) {
        for (const sa of shiftAssignments as any[]) {
          const workHours = sa.shifts?.work_hours ?? 8;
          employeeShiftHours[sa.employee_id] = Number(workHours);
        }
      }
    } catch {}

    // 4) Aggregate per agent + fiscal month (Logged from TimesheetEvent, Billed by charge_type_name, Worked from Timesheet)
    type Totals = { logged: number; billed: number; worked: number; breakHours: number; absenceHours: number; unloggedHours: number; overtimeHours: number };
    const agg: Record<string, Totals> = {};
    // per-charge-type billed aggregation
    const aggTypes: Record<string, number> = {};
    
    // Daily aggregation for Worked Hours and Overtime calculation
    // Key: "empId:dateOnly" -> { start: number, end: number, breaks: number, loggedHours: number, monthIdx: number, agentId: string }
    const dailyAgg: Record<string, { start: number; end: number; breaks: number; loggedHours: number; empId: string; agentId: string; dateOnly: string; monthIdx: number }> = {};
    
    // Get today's date (UTC) to exclude future entries
    const todayUTC = new Date().toISOString().slice(0, 10);

    // Track which agent+date combinations we've already added worked hours for (to avoid duplicates)
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
      
      // Skip today and future dates - only count completed days
      // This ensures logged, billed, worked, breaks are all consistent
      if (dateOnly >= todayUTC) continue;
      
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
        "sp-agreement",
        "sales account",
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
        "lunch",
      ]);
      // Lunch break types - these should NOT be subtracted from worked hours
      // because the 8h shift already excludes the 1h lunch
      const lunchBreakTypes = new Set(["lunch break", "lunch", "lunchbreak", "lunch-break"]);
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
      const excluded = isExcludedByCharge || isExcludedByBreak || isExcludedByHolidayId;
      const loggedAdd = raw > 0 && !excluded ? raw : 0;

      const cur = (agg[key] ||= { logged: 0, billed: 0, worked: 0, breakHours: 0, absenceHours: 0, unloggedHours: 0, overtimeHours: 0 });
      cur.logged += Number.isFinite(loggedAdd) ? loggedAdd : 0;
      cur.billed += Number.isFinite(billable) ? billable : 0;
      
      // Track break hours (absence hours come from Holiday endpoint)
      // Exclude lunch breaks - they're already accounted for in the 8h work day
      // In Halo: break_type=1 is coffee/short break, break_type=2 is lunch
      const isLunchBreak = breakTypeNum === 2 || lunchBreakTypes.has(breakType) || breakType.includes("lunch") || ct.includes("lunch");
      if (isExcludedByBreak && raw > 0 && !isLunchBreak) {
        cur.breakHours += raw;
      }
      
      // Per charge type aggregation (store name lowercased for normalization)
      if (billable > 0 && ct) {
        const tkey = `${empId}:${idx}:${ct}`;
        aggTypes[tkey] = (aggTypes[tkey] || 0) + billable;
      }

      // Update Daily Aggregation for Worked Hours and Overtime
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
    
    // Merge absenceMap into agg
    for (const [key, hours] of Object.entries(absenceMap)) {
      const cur = (agg[key] ||= { logged: 0, billed: 0, worked: 0, breakHours: 0, absenceHours: 0, unloggedHours: 0, overtimeHours: 0 });
      cur.absenceHours += hours;
    }

    // 5) Upsert into month_entries
    const keys = Object.keys(agg);
    if (keys.length === 0) {
      return NextResponse.json({ ok: true, message: "No matching rows to import", readRows, importedRows: 0 }, { status: 200 });
    }

    // Fetch existing to preserve IDs and manually entered worked hours
    const { data: existing, error: exErr } = await supabaseBrowser
      .from("month_entries")
      .select("id, employee_id, fiscal_year_id, month_index, worked")
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
        id: ex?.id ?? randomUUID(),
        employee_id: empId,
        fiscal_year_id: fiscalYearId,
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
