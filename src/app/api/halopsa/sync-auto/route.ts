import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client
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
    // Verify this is a Vercel cron request
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn("Unauthorized cron request");
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

    // 3. Call the import endpoint
    const importUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/halopsa/import`;
    
    const importRes = await fetch(importUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fiscalYearId: latestYear.id,
        agentMap: agentMap,
      }),
    });

    const importData = await importRes.json();

    if (!importRes.ok) {
      console.error("Import failed:", importData);
      return NextResponse.json(
        { ok: false, error: importData?.error || "Import failed" },
        { status: 400 }
      );
    }

    console.log("Sync complete:", {
      fiscalYear: latestYear.label,
      readRows: importData.readRows,
      importedRows: importData.importedRows,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Sync completed successfully",
        fiscalYear: latestYear.label,
        readRows: importData.readRows,
        importedRows: importData.importedRows,
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

    // Call the import endpoint
    const importUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/api/halopsa/import`;
    
    const importRes = await fetch(importUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fiscalYearId,
        agentMap,
      }),
    });

    const importData = await importRes.json();

    if (!importRes.ok) {
      throw new Error(importData?.error || "Import failed");
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Manual sync triggered",
        importedRows: importData.importedRows,
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
