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

    const query: Record<string, string> = { start_date: from, end_date: to };
    if (agentId) query["agent_id"] = String(agentId);

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
