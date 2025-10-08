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
    const { from, to, agentId, limit = 5000, entity = "TimesheetEvent" } = await req.json();
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

    for (const ev of events.slice(0, limit)) {
      total++;
      Object.keys(ev || {}).forEach((k) => keysSet.add(k));
      if (sample.length < 5) sample.push(ev);

      const rate = Number(pick<any>(ev, ["charge_rate", "chargeRate", "rate"]) ?? 0);
      const amt = Number(pick<any>(ev, ["chargeAmount", "charge_amount"]) ?? 0);
      if (!Number.isNaN(rate)) ratePresent += 1;
      if (Number.isFinite(rate) && rate > 0) rateGt0 += 1;
      if (!Number.isNaN(amt)) amountPresent += 1;
      if (Number.isFinite(amt) && amt > 0) amountGt0 += 1;
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
      },
      sample,
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid request" }, { status: 400 });
  }
}
