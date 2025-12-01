import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client using service role key
const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
);

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from("message_board")
      .select("id, title, content, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found, which is okay
      throw error;
    }

    return NextResponse.json({ message: data || null }, { status: 200 });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Failed to fetch message board:", error);
    return NextResponse.json(
      { message: null, error: error?.message || "Failed to fetch message" },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, content } = await req.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: "title and content are required" },
        { status: 400 }
      );
    }

    // Upsert message (keep only one message)
    const { data, error } = await supabaseServer
      .from("message_board")
      .upsert(
        {
          id: "main", // Fixed ID to keep only one message
          title,
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("id, title, content, updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ message: data }, { status: 200 });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Failed to save message board:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save message" },
      { status: 400 }
    );
  }
}
