import { NextRequest, NextResponse } from "next/server";
import { haloFetch, fiscalMonthIndex } from "@/lib/halo";
import { createClient } from "@supabase/supabase-js";

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

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
    const { employeeName, from, to } = await req.json();
    if (!employeeName || !from || !to) {
      return NextResponse.json({ error: "employeeName, from, to required" }, { status: 400 });
    }

    // Get agent mapping
    const { data: mappings } = await supabaseServer
      .from("halo_agent_map")
      .select("employee_id, agent_id");
    
    const { data: employees } = await supabaseServer
      .from("employees")
      .select("id, name");
    
    const employee = employees?.find(e => 
      (e as any).name?.toLowerCase().includes(employeeName.toLowerCase())
    );
    
    if (!employee) {
      return NextResponse.json({ error: `Employee "${employeeName}" not found` }, { status: 404 });
    }

    const agentIds = (mappings || [])
      .filter((m: any) => m.employee_id === (employee as any).id)
      .map((m: any) => m.agent_id);

    // Fetch all timesheet events
    const events: any[] = await haloFetch("TimesheetEvent", { 
      query: { start_date: from, end_date: to, limit: "10000" } 
    });
    
    // Fetch Timesheet data (for actual clock-in/clock-out times)
    let timesheets: any[] = [];
    try {
      timesheets = await haloFetch("Timesheet", { 
        query: { start_date: from, end_date: to, limit: "10000" } 
      });
    } catch (e) {
      console.warn("Could not fetch Timesheet data:", e);
    }
    
    // Build a map of agentId+date -> { start, end, breaks } from Timesheet
    const timesheetMap: Record<string, { start: number; end: number; breaks: number }> = {};
    for (const ts of timesheets) {
      const tsAgentId = `${pick<any>(ts, ["agent_id", "agentId"]) ?? ""}`.trim();
      const dateVal = pick<string>(ts, ["date"]) || "";
      if (!tsAgentId || !dateVal) continue;
      const dateOnly = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
      
      const startTime = pick<string>(ts, ["start_time", "startTime"]);
      const endTime = pick<string>(ts, ["end_time", "endTime"]);
      const breakHours = Number(pick<any>(ts, ["break_hours", "breakHours"]) ?? 0);
      
      if (startTime && endTime) {
        const s = new Date(startTime).getTime();
        const e = new Date(endTime).getTime();
        if (!isNaN(s) && !isNaN(e)) {
          timesheetMap[`${tsAgentId}:${dateOnly}`] = { start: s, end: e, breaks: breakHours };
        }
      }
    }

    // Filter to this employee's events
    const empEvents = events.filter(ev => {
      const agentId = `${pick<any>(ev, ["agent_id", "agentId"]) ?? ""}`.trim();
      const agentName = pick<string>(ev, ["agentName", "agent_name", "user_name", "name"]) || "";
      return agentIds.includes(agentId) || 
             agentName.toLowerCase().includes(employeeName.toLowerCase());
    });

    // Group by date (exclude future dates)
    const todayUTC = new Date().toISOString().slice(0, 10);
    const byDate: Record<string, any[]> = {};
    let skippedFuture = 0;
    for (const ev of empEvents) {
      const dateVal = pick<string>(ev, ["day", "date", "entryDate", "start_date"]) || "";
      const dateOnly = dateVal.length >= 10 ? dateVal.slice(0, 10) : dateVal;
      if (!dateOnly) continue;
      if (dateOnly > todayUTC) {
        skippedFuture++;
        continue;
      }
      (byDate[dateOnly] ||= []).push(ev);
    }

    // Calculate worked hours per day (same logic as sync)
    const defaultBreaks = new Set(["taking a breather", "lunch break", "non-working hours"]);
    
    const dailyBreakdown: any[] = [];
    
    for (const [date, dayEvents] of Object.entries(byDate).sort()) {
      let earliest = Infinity;
      let latest = -Infinity;
      let totalBreaks = 0;
      const entries: any[] = [];
      let dayAgentId = "";
      
      for (const ev of dayEvents) {
        const startVal = pick<string>(ev, ["start_date", "startdate", "startDate"]);
        const endVal = pick<string>(ev, ["end_date", "enddate", "endDate"]);
        const raw = Number(pick<any>(ev, ["timeTakenHours", "rawTime", "raw_time", "timeTaken"]) ?? 0);
        const breakTypeRaw = pick<any>(ev, ["break_type", "breakType"]);
        const breakType = `${breakTypeRaw ?? ""}`.trim().toLowerCase();
        const chargeType = `${pick<any>(ev, ["charge_type_name", "chargeTypeName"]) ?? ""}`.trim();
        const note = pick<string>(ev, ["note", "notes", "summary", "description"]) || "";
        
        // Capture agentId for Timesheet lookup
        if (!dayAgentId) {
          dayAgentId = `${pick<any>(ev, ["agent_id", "agentId"]) ?? ""}`.trim();
        }
        
        const breakTypeNum = Number(breakTypeRaw);
        const isBreak = (Number.isFinite(breakTypeNum) && breakTypeNum > 0)
          || (!!breakType && defaultBreaks.has(breakType));
        
        if (startVal) {
          const s = new Date(startVal).getTime();
          if (!isNaN(s) && s < earliest) earliest = s;
        }
        if (endVal) {
          const e = new Date(endVal).getTime();
          if (!isNaN(e) && e > latest) latest = e;
        }
        
        if (isBreak) {
          totalBreaks += raw;
        }
        
        entries.push({
          start: startVal,
          end: endVal,
          hours: raw,
          chargeType,
          breakType: breakTypeRaw,
          isBreak,
          note: note.substring(0, 50),
        });
      }
      
      // Check for Timesheet data (manual clock-in/clock-out)
      const tsKey = `${dayAgentId}:${date}`;
      const tsData = timesheetMap[tsKey];
      
      let spanHours = 0;
      let worked = 0;
      let usedTimesheet = false;
      let timesheetStart: string | null = null;
      let timesheetEnd: string | null = null;
      let timesheetBreaks = 0;
      
      if (tsData && tsData.end > tsData.start) {
        // Use Timesheet data (manual clock-in/clock-out)
        usedTimesheet = true;
        timesheetStart = new Date(tsData.start).toISOString();
        timesheetEnd = new Date(tsData.end).toISOString();
        timesheetBreaks = tsData.breaks;
        const spanMs = tsData.end - tsData.start;
        spanHours = spanMs / (1000 * 60 * 60);
        worked = Math.max(0, spanHours - tsData.breaks);
      } else {
        // Fall back to TimesheetEvent data
        const spanMs = latest - earliest;
        spanHours = spanMs > 0 ? spanMs / (1000 * 60 * 60) : 0;
        worked = Math.max(0, spanHours - totalBreaks);
      }
      
      dailyBreakdown.push({
        date,
        usedTimesheet,
        timesheetStart,
        timesheetEnd,
        timesheetBreaks,
        earliestStart: earliest !== Infinity ? new Date(earliest).toISOString() : null,
        latestEnd: latest !== -Infinity ? new Date(latest).toISOString() : null,
        spanHours: Math.round(spanHours * 100) / 100,
        totalBreaks: Math.round((usedTimesheet ? timesheetBreaks : totalBreaks) * 100) / 100,
        workedHours: Math.round(worked * 100) / 100,
        entryCount: entries.length,
        entries,
      });
    }

    const totalWorked = dailyBreakdown.reduce((sum, d) => sum + d.workedHours, 0);

    return NextResponse.json({
      ok: true,
      employee: { id: (employee as any).id, name: (employee as any).name },
      agentIds,
      dateRange: { from, to },
      totalEvents: empEvents.length,
      skippedFuture,
      totalWorkedHours: Math.round(totalWorked * 100) / 100,
      dailyBreakdown,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}
