import { NextRequest, NextResponse } from "next/server";
import { supabaseBrowser } from "@/lib/supabaseClient";

// GET - List all special work days
export async function GET() {
  try {
    const { data, error } = await supabaseBrowser
      .from("special_work_days")
      .select("*")
      .order("date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ ok: true, days: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to fetch special days" }, { status: 500 });
  }
}

// POST - Add a new special work day
export async function POST(req: NextRequest) {
  try {
    const { date, work_hours, lunch_minutes, description } = await req.json();

    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    if (work_hours === undefined || work_hours === null || isNaN(Number(work_hours))) {
      return NextResponse.json({ error: "work_hours is required and must be a number" }, { status: 400 });
    }

    const { data, error } = await supabaseBrowser
      .from("special_work_days")
      .upsert(
        {
          date,
          work_hours: Number(work_hours),
          lunch_minutes: lunch_minutes !== undefined ? Number(lunch_minutes) : 30,
          description: description || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "date" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, day: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to save special day" }, { status: 500 });
  }
}

// DELETE - Remove a special work day
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const date = searchParams.get("date");

    if (!id && !date) {
      return NextResponse.json({ error: "id or date is required" }, { status: 400 });
    }

    let query = supabaseBrowser.from("special_work_days").delete();
    
    if (id) {
      query = query.eq("id", id);
    } else if (date) {
      query = query.eq("date", date);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to delete special day" }, { status: 500 });
  }
}
