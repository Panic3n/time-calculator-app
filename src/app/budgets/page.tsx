"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

export default function BudgetsPage() {
  const router = useRouter();
  const billedHoursFromTypes = useMemo(() => {
    if (!billedTypeRows.length) return 0;
    // Sum hours for selected employees and selected charge types
    const sum = billedTypeRows.reduce((acc, r) => {
      if (!includedMap[r.employee_id]) return acc;
      const ct = r.charge_type_name?.toLowerCase?.() || '';
      if (!ct || !includedTypes[ct]) return acc;
      return acc + Number(r.hours || 0);
    }, 0);
    return Math.round(sum * 100) / 100;
  }, [billedTypeRows, includedMap, includedTypes]);
  // Effective billed hours
  // Requirement: If no rows in included_charge_types for FY => none allowed => 0 billed.
  // If rows exist, use per-type aggregation only.
  const billedHours = useMemo(() => {
    const hasTypes = Object.keys(includedTypes).length > 0;
    return hasTypes ? billedHoursFromTypes : 0;
  }, [includedTypes, billedHoursFromTypes]);
  const workedHours = useMemo(() => {
    return Math.round(
      billedEntries.filter(e => includedMap[e.employee_id]).reduce((acc, r) => acc + Number(r.worked || 0), 0) * 100
    ) / 100;
  }, [billedEntries, includedMap]);
  const pctBilled = useMemo(() => {
    if (!workedHours) return 0;
    return Math.round(((billedHours / workedHours) * 100) * 10) / 10;
  }, [billedHours, workedHours]);
  const [extraHours, setExtraHours] = useState<number>(0);

  useEffect(() => {
    router.push("/admin");
  }, [router]);

  // Load budget when budget FY changes
  useEffect(() => {
    const load = async () => {
      if (!yearId) { setBudget(null); return; }
      try {
        // Load budget
        const { data: budgets, error: bErr } = await supabaseBrowser
          .from("it_budgets")
          .select("id, fiscal_year_id, department, teckningsbidrag")
          .eq("fiscal_year_id", yearId)
          .eq("department", "IT")
          .limit(1);
        if (bErr) throw bErr;
        const b = (budgets || [])[0] as any;
        setBudget(b ?? { fiscal_year_id: yearId, department: "IT", teckningsbidrag: 0 });
      } catch (e: any) {
        setError(e?.message || "Failed to load budget data");
      }
    };
    load();
  }, [yearId]);

  // Load charge types available (union) and included for billed FY
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const [{ data: base }, { data: rows }] = await Promise.all([
          supabaseBrowser.from("halo_billable_charge_types").select("name").order("name", { ascending: true }),
          supabaseBrowser.from("included_charge_types").select("charge_type_name").eq("fiscal_year_id", billedYearId),
        ]);
        const names = ((base as any[]) || []).map(r => String((r as any).name || '').toLowerCase()).filter(Boolean);
        setChargeTypes(names);
        const inc: Record<string, boolean> = {};
        ((rows as any[]) || []).forEach(r => { inc[String((r as any).charge_type_name || '').toLowerCase()] = true; });
        setIncludedTypes(inc);
      } catch {}
    };
    if (billedYearId) loadTypes(); else { setChargeTypes([]); setIncludedTypes({}); }
  }, [billedYearId]);

  // Load billed + worked + logged entries when billed FY changes, and included employees map
  useEffect(() => {
    const loadBilled = async () => {
      if (!billedYearId) { setBilledEntries([]); return; }
      const { data, error } = await supabaseBrowser
        .from("month_entries")
        .select("employee_id, billed, worked, logged")
        .eq("fiscal_year_id", billedYearId);
      if (!error) setBilledEntries(((data as any[]) || []).map(r => ({ employee_id: r.employee_id, billed: Number(r.billed||0), worked: Number(r.worked||0), logged: Number(r.logged||0) })));
      try {
        const resp = await fetch(`/api/admin/team-included?fiscal_year_id=${billedYearId}`, { cache: "no-store" });
        const json = await resp.json();
        const map: Record<string, boolean> = {};
        (json?.rows || []).forEach((r: any) => { map[String(r.employee_id)] = true; });
        setIncludedMap(map);
      } catch {}
    };
    loadBilled();
  }, [billedYearId]);

  // Load per-type billed rows when billed FY changes
  useEffect(() => {
    const loadTypesRows = async () => {
      if (!billedYearId) { setBilledTypeRows([]); return; }
      const { data, error } = await supabaseBrowser
        .from("month_entries_billed_types")
        .select("employee_id, charge_type_name, hours")
        .eq("fiscal_year_id", billedYearId);
      if (!error) setBilledTypeRows(((data as any[]) || []).map(r => ({ employee_id: r.employee_id, charge_type_name: String(r.charge_type_name || '').toLowerCase(), hours: Number(r.hours || 0) })));
    };
    loadTypesRows();
  }, [billedYearId]);

  const avgBilledRate = useMemo(() => {
    const tb = Number(budget?.teckningsbidrag || 0);
    const hrs = Number(billedHours || 0);
    if (!hrs) return 0;
    return Math.round((tb / hrs) * 100) / 100;
  }, [budget, billedHours]);

  const projected = useMemo(() => {
    const rate = avgBilledRate;
    const deltaTB = Math.round(rate * extraHours * 100) / 100;
    return {
      deltaTB,
      newTB: Math.round(((budget?.teckningsbidrag || 0) + deltaTB) * 100) / 100,
      newHours: Math.round(((billedHours || 0) + extraHours) * 100) / 100,
    };
  }, [avgBilledRate, extraHours, budget, billedHours]);

  const saveBudget = async () => {
    if (!budget) return;
    setBusySave(true);
    try {
      const payload = {
        id: budget.id,
        fiscal_year_id: yearId,
        department: "IT",
        teckningsbidrag: Number(budget.teckningsbidrag || 0),
      } as any;
      const { data, error } = await supabaseBrowser
        .from("it_budgets")
        .upsert(payload, { onConflict: "fiscal_year_id,department" })
        .select("id, fiscal_year_id, department, teckningsbidrag")
        .single();
      if (error) throw error;
      setBudget(data as any);
    } catch (e: any) {
      alert(e?.message || "Failed to save budget");
    } finally {
      setBusySave(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <p className="text-sm text-[var(--color-text)]/80">Redirecting to Admin…</p>
    </div>
  );
}
