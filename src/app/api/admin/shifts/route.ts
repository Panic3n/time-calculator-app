import { NextRequest, NextResponse } from "next/server";
import { supabaseBrowser } from "@/lib/supabaseClient";

// GET - List all shifts and employee assignments
export async function GET() {
  try {
    const [{ data: shifts, error: shiftsErr }, { data: assignments, error: assignErr }] = await Promise.all([
      supabaseBrowser.from("shifts").select("*").order("start_time"),
      supabaseBrowser.from("employee_shifts").select("employee_id, shift_id"),
    ]);

    if (shiftsErr) throw shiftsErr;
    if (assignErr) throw assignErr;

    // Build a map of employee_id -> shift_id
    const employeeShiftMap: Record<string, string> = {};
    for (const a of assignments || []) {
      employeeShiftMap[a.employee_id] = a.shift_id;
    }

    return NextResponse.json({ ok: true, shifts: shifts || [], employeeShiftMap });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to fetch shifts" }, { status: 500 });
  }
}

// POST - Create a new shift or assign shift to employee
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // If assigning shift to employee
    if (body.employee_id && body.shift_id) {
      const { data, error } = await supabaseBrowser
        .from("employee_shifts")
        .upsert(
          { employee_id: body.employee_id, shift_id: body.shift_id },
          { onConflict: "employee_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, assignment: data });
    }
    
    // If creating a new shift
    if (body.name && body.start_time && body.end_time) {
      const { data, error } = await supabaseBrowser
        .from("shifts")
        .insert({
          name: body.name,
          start_time: body.start_time,
          end_time: body.end_time,
          work_hours: body.work_hours ?? 8,
          lunch_minutes: body.lunch_minutes ?? 60,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ ok: true, shift: data });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to save" }, { status: 500 });
  }
}

// DELETE - Remove a shift or unassign employee
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shiftId = searchParams.get("shift_id");
    const employeeId = searchParams.get("employee_id");

    if (employeeId) {
      // Unassign employee from shift
      const { error } = await supabaseBrowser
        .from("employee_shifts")
        .delete()
        .eq("employee_id", employeeId);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (shiftId) {
      // Delete shift (will cascade delete assignments)
      const { error } = await supabaseBrowser
        .from("shifts")
        .delete()
        .eq("id", shiftId);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "shift_id or employee_id required" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to delete" }, { status: 500 });
  }
}
