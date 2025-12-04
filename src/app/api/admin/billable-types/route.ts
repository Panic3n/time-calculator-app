import { NextResponse } from "next/server";
import { supabaseBrowser } from "@/lib/supabaseClient";

export async function GET() {
  const { data, error } = await supabaseBrowser
    .from("halo_billable_charge_types")
    .select("*")
    .order("name");
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ types: data });
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  
  const { error } = await supabaseBrowser
    .from("halo_billable_charge_types")
    .insert({ name: name.toLowerCase().trim() });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  
  const { error } = await supabaseBrowser
    .from("halo_billable_charge_types")
    .delete()
    .eq("name", name.toLowerCase().trim());
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ ok: true });
}
