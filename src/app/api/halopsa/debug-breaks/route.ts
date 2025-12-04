import { NextResponse } from "next/server";
import { haloFetch } from "@/lib/halo";

export async function GET() {
  try {
    // Fetch recent timesheet events for December 2025 - just one day
    const data = await haloFetch("TimesheetEvent", { 
      query: { start_date: "2025-12-01", end_date: "2025-12-03", limit: "500" } 
    });
    const events = Array.isArray(data) ? data : (data.events || data.timesheetevents || []);
    
    // Show ALL events with break_type > 0
    const breakEntries = events.filter((ev: any) => {
      const bt = Number(ev.break_type);
      return Number.isFinite(bt) && bt > 0;
    });
    
    // Show sample of break entries with ALL their fields
    const sample = breakEntries.slice(0, 10).map((ev: any) => ev);
    
    // Also show first 3 regular events to see field names
    const regularSample = events.filter((ev: any) => {
      const bt = Number(ev.break_type);
      return !Number.isFinite(bt) || bt === 0;
    }).slice(0, 3);
    
    return NextResponse.json({
      totalEvents: events.length,
      breakEntries: breakEntries.length,
      breakSample: sample,
      regularSample,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
