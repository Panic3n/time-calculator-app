import { NextRequest, NextResponse } from "next/server";
import { haloFetch } from "@/lib/halo";

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
    const { from, to, agentId, limit = 5000, entity = "TimesheetEvent", mode } = await req.json();
    if (!from || !to) {
      return NextResponse.json({ error: "from and to (YYYY-MM-DD) are required" }, { status: 400 });
    }

    const query: Record<string, string> = { 
      start_date: from, 
      end_date: to,
      limit: "10000" 
    };
    // If debugging specific agent, filter by it
    // But for import logic, we usually fetch all and filter in memory.
    // Let's keep it consistent with import logic if mode is set?
    // Import logic fetches ALL then filters. 
    // But diagnostic usually fetches filtered. 
    // Let's use query filter if agentId provided, it's faster.
    if (agentId) query["agent_id"] = String(agentId);

    // Special mode for debugging worked hours calculation
    if (mode === "calculation_debug") {
      // Fetch TimesheetEvent for breaks
      const events = await haloFetch("TimesheetEvent", { query });
      // Fetch Timesheet for start/end
      const timesheetData = await haloFetch("Timesheet", { query });
      
      const dailyBreakdown: any[] = [];
      
      // 1. Build actual breaks map
      const actualBreaksMap: Record<string, number> = {};
      for (const ev of events) {
        const aId = `${pick<any>(ev, ["agent_id", "agentId", "agentID"]) ?? ""}`.trim();
        // Filter by agent if provided
        if (agentId && aId !== String(agentId)) continue;
        
        const dateVal = pick<string>(ev, ["day", "date", "entryDate", "start_date", "end_date", "created_at"]) || "";
        if (dateVal) {
          const dateStr = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
          const mapKey = `${aId}:${dateStr}`;
          
          const breakTypeRaw = pick<any>(ev, ["break_type", "breakType"]);
          const breakTypeNum = Number(breakTypeRaw);
          const isBreak = Number.isFinite(breakTypeNum) && breakTypeNum > 0;
          
          if (isBreak) {
            const breakHours = Number(pick<any>(ev, ["timeTakenHours", "rawTime", "raw_time", "timeTaken", "time_taken", "timetaken"]) ?? 0);
            actualBreaksMap[mapKey] = (actualBreaksMap[mapKey] || 0) + breakHours;
          }
        }
      }
      
      // 2. Calculate worked hours
      for (const ts of timesheetData) {
        const aId = `${pick<any>(ts, ["agent_id", "agentId", "agentID"]) ?? ""}`.trim();
        // Filter by agent if provided
        if (agentId && aId !== String(agentId)) continue;
        
        const dateVal = pick<string>(ts, ["date", "day"]) || "";
        const dateStr = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
        const mapKey = `${aId}:${dateStr}`;
        
        const startTime = pick<string>(ts, ["estimated_start_time", "estimatedStartTime", "start_time", "startTime"]);
        const endTime = pick<string>(ts, ["estimated_end_time", "estimatedEndTime", "end_time", "endTime"]);
        
        let worked = 0;
        let start = null;
        let end = null;
        let diffHours = 0;
        let deduction = 0;
        let actualBreaks = 0;
        let allowedBreaks = 0;
        
        if (startTime && endTime) {
          start = new Date(startTime);
          end = new Date(endTime);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diffMs = end.getTime() - start.getTime();
            diffHours = diffMs / (1000 * 60 * 60);
            
            actualBreaks = actualBreaksMap[mapKey] || 0;
            // allowedBreaks = Number(pick<any>(ts, ["allowed_break_hours", "allowedBreakHours", "break_hours", "breakHours"]) ?? 0);
            // deduction = Math.max(actualBreaks, allowedBreaks);
            deduction = actualBreaks;
            
            worked = Math.max(0, diffHours - deduction);
          }
        }
        
        dailyBreakdown.push({
          date: dateStr,
          agentId: aId,
          startTime,
          endTime,
          diffHours,
          actualBreaks,
          allowedBreaks,
          deduction,
          calculatedWorked: worked
        });
      }
      
      // Sort by date
      dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));
      
      const totalWorked = dailyBreakdown.reduce((sum, d) => sum + d.calculatedWorked, 0);
      
      return NextResponse.json({
        totalWorked,
        breakdown: dailyBreakdown
      });
    }

    // Original diagnostic code continues...
    const raw = await haloFetch(String(entity), { query });
    const events: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as any)?.items)
        ? (raw as any).items
        : Array.isArray((raw as any)?.data)
          ? (raw as any).data
          : [];
    if (!Array.isArray(events)) {
      return NextResponse.json({
        error: "Unexpected response shape from Halo",
        entity,
        typeof: typeof raw,
        keys: raw && typeof raw === 'object' ? Object.keys(raw) : null,
      }, { status: 400 });
    }

    // Aggregate diagnostics
    const keysSet = new Set<string>();
    const sample: any[] = [];

    let total = 0;
    let ratePresent = 0;
    let rateGt0 = 0;
    let amountPresent = 0;
    let amountGt0 = 0;

    // Aggregations for Logged exclusion analysis
    const freqBreak: Record<string, { count: number; hours: number }> = {};
    const freqCharge: Record<string, { count: number; hours: number }> = {};
    let holidayIdCount = 0;
    let holidayIdHours = 0;
    let totalHours = 0;
    let totalWorkedHours = 0;
    let workedHoursPresent = 0;
    let workedHoursGt0 = 0;

    for (const ev of events) {
      total++;
      Object.keys(ev || {}).forEach((k) => keysSet.add(k));
      if (sample.length < 5) sample.push(ev);

      const rate = Number(pick<any>(ev, ["charge_rate", "chargeRate", "rate"]) ?? 0);
      const amt = Number(pick<any>(ev, ["chargeAmount", "charge_amount"]) ?? 0);
      if (!Number.isNaN(rate)) ratePresent += 1;
      if (Number.isFinite(rate) && rate > 0) rateGt0 += 1;
      if (!Number.isNaN(amt)) amountPresent += 1;
      if (Number.isFinite(amt) && amt > 0) amountGt0 += 1;

      const hours = Number(pick<any>(ev, ["timeTakenHours", "rawTime", "raw_time", "timeTaken", "time_taken", "timetaken"]) ?? 0) || 0;
      totalHours += hours;
      
      const worked = Number(pick<any>(ev, ["work_hours", "workHours", "worked_hours", "workedHours"]) ?? 0) || 0;
      totalWorkedHours += worked;
      if (worked > 0) workedHoursGt0 += 1;
      if (!Number.isNaN(worked)) workedHoursPresent += 1;
      
      const btype = `${pick<any>(ev, ["break_type", "breakType"]) ?? ""}`.trim().toLowerCase();
      const ctype = `${pick<any>(ev, ["charge_type_name", "chargeTypeName"]) ?? ""}`.trim().toLowerCase();
      const holidayId = Number(pick<any>(ev, ["holiday_id", "holidayId"])) || 0;
      if (btype) {
        const fb = (freqBreak[btype] ||= { count: 0, hours: 0 });
        fb.count += 1; fb.hours += hours;
      }
      if (ctype) {
        const fc = (freqCharge[ctype] ||= { count: 0, hours: 0 });
        fc.count += 1; fc.hours += hours;
      }
      if (holidayId > 0) { holidayIdCount += 1; holidayIdHours += hours; }
      if (total >= limit) break;
    }

    return NextResponse.json({
      ok: true,
      window: { from, to },
      events_count: events.length,
      inspected: total,
      fields_seen: Array.from(keysSet).sort(),
      counters: {
        rate_present_rows: ratePresent,
        rate_gt0_rows: rateGt0,
        amount_present_rows: amountPresent,
        amount_gt0_rows: amountGt0,
        total_rows: total,
        total_hours: Math.round(totalHours * 100) / 100,
        worked_hours_present_rows: workedHoursPresent,
        worked_hours_gt0_rows: workedHoursGt0,
        total_worked_hours: Math.round(totalWorkedHours * 100) / 100,
        holiday_id_rows: holidayIdCount,
        holiday_id_hours: Math.round(holidayIdHours * 100) / 100,
      },
      break_types: Object.entries(freqBreak).map(([name, v]) => ({ name, count: v.count, hours: Math.round(v.hours * 100) / 100 })).sort((a,b)=>b.hours-a.hours).slice(0,50),
      charge_types: Object.entries(freqCharge).map(([name, v]) => ({ name, count: v.count, hours: Math.round(v.hours * 100) / 100 })).sort((a,b)=>b.hours-a.hours).slice(0,50),
      sample,
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid request" }, { status: 400 });
  }
}
