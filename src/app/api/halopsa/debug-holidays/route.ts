import { NextResponse } from "next/server";
import { haloFetch } from "@/lib/halo";

// Debug endpoint to inspect what holiday/absence data HaloPSA returns
// GET /api/halopsa/debug-holidays?start_date=2024-09-01&end_date=2024-12-31
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get("start_date") || "2024-09-01";
  const endDate = searchParams.get("end_date") || "2024-12-31";
  
  const query = { start_date: startDate, end_date: endDate, limit: "100" };
  
  const results: Record<string, any> = {
    query,
    endpoints: {},
  };
  
  // Try various endpoints that might contain holiday/absence data
  const endpointsToTry = [
    "Appointments",
    "HolidayRequest",
    "Holiday",
    "Holidays",
    "AgentHoliday",
    "Leave",
    "LeaveRequest",
    "Absence",
    "TimeOff",
  ];
  
  for (const endpoint of endpointsToTry) {
    try {
      const data = await haloFetch(endpoint, { query });
      const items = Array.isArray(data) ? data : (data?.records || data?.items || []);
      
      // For Appointments, filter to show only those with holiday_type > 0
      if (endpoint === "Appointments") {
        const holidayAppointments = items.filter((apt: any) => {
          const holidayType = apt.holiday_type ?? apt.holidayType ?? 0;
          return Number(holidayType) > 0;
        });
        results.endpoints[endpoint] = {
          success: true,
          totalCount: items.length,
          holidayCount: holidayAppointments.length,
          sampleHolidayAppointments: holidayAppointments.slice(0, 5),
          sampleAllAppointments: items.slice(0, 3),
        };
      } else {
        results.endpoints[endpoint] = {
          success: true,
          count: items.length,
          sample: items.slice(0, 5),
        };
      }
    } catch (e: any) {
      results.endpoints[endpoint] = {
        success: false,
        error: e?.message || String(e),
      };
    }
  }
  
  // Also check TimesheetEvent for entries with holiday_id
  try {
    const events = await haloFetch("TimesheetEvent", { query });
    const items = Array.isArray(events) ? events : (events?.records || events?.items || []);
    const holidayEvents = items.filter((ev: any) => {
      const holidayId = ev.holiday_id ?? ev.holidayId ?? 0;
      return Number(holidayId) > 0;
    });
    results.endpoints["TimesheetEvent (holiday_id > 0)"] = {
      success: true,
      totalCount: items.length,
      holidayCount: holidayEvents.length,
      sampleHolidayEvents: holidayEvents.slice(0, 5),
    };
  } catch (e: any) {
    results.endpoints["TimesheetEvent (holiday_id > 0)"] = {
      success: false,
      error: e?.message || String(e),
    };
  }
  
  return NextResponse.json(results, { status: 200 });
}
