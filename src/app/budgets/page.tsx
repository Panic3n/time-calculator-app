"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FiscalYear = { id: string; label: string };
type Employee = { id: string; name: string };

type Budget = {
  id?: string;
  fiscal_year_id: string;
  department: string;
  teckningsbidrag: number;
};

export default function BudgetsPage() {
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearId, setYearId] = useState<string>(""); // Budget FY
  const [billedYearId, setBilledYearId] = useState<string>(""); // FY used to compute billed hours
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [budget, setBudget] = useState<Budget | null>(null);
  const [busySave, setBusySave] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [includedMap, setIncludedMap] = useState<Record<string, boolean>>({}); // from team_included_employees
  const [billedEntries, setBilledEntries] = useState<{ employee_id: string; billed: number; worked: number; logged: number }[]>([]);
  // Per charge type rows for billed
  const [billedTypeRows, setBilledTypeRows] = useState<{ employee_id: string; charge_type_name: string; hours: number }[]>([]);
  // Available billable charge types and selection map
  const [chargeTypes, setChargeTypes] = useState<string[]>([]);
  const [includedTypes, setIncludedTypes] = useState<Record<string, boolean>>({}); // from included_charge_types
  const billedHoursTotal = useMemo(() => {
    return Math.round(
      billedEntries.filter(e => includedMap[e.employee_id]).reduce((acc, r) => acc + Number(r.billed || 0), 0) * 100
    ) / 100;
  }, [billedEntries, includedMap]);
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
    const loadYears = async () => {
      try {
        const { data, error } = await supabaseBrowser
          .from("fiscal_years")
          .select("id, label")
          .order("start_date", { ascending: false });
        if (error) throw error;
        setYears(data as any);
        const preferred = (data as any[])[0]?.id as string | undefined;
        if (preferred) setYearId(preferred);
        if (preferred) setBilledYearId(preferred);
        // Load employees
        const { data: emps, error: eErr } = await supabaseBrowser
          .from("employees")
          .select("id, name")
          .order("name");
        if (eErr) throw eErr;
        setEmployees(emps as any);
        // load included employees for preferred billed FY
        const fy = (data as any[])[0]?.id as string | undefined;
        if (fy) {
          try {
            const resp = await fetch(`/api/admin/team-included?fiscal_year_id=${fy}`, { cache: "no-store" });
            const json = await resp.json();
            const map: Record<string, boolean> = {};
            (json?.rows || []).forEach((r: any) => { map[String(r.employee_id)] = true; });
            setIncludedMap(map);
          } catch {}
        }
      } catch (e: any) {
        setError(e?.message || "Failed to load fiscal years");
      } finally {
        setLoading(false);
      }
    };
    loadYears();
  }, []);

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

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="bg-[var(--color-bg)] border-b border-[var(--color-surface)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Budgets</h1>
          <div className="flex items-center gap-2">
            {years.length > 0 && (
              <select
                className="border border-[var(--color-surface)] bg-[var(--color-bg)] text-[var(--color-text)] rounded-md h-9 px-2 text-sm"
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>
            )}
            {years.length > 0 && (
              <select
                className="border border-[var(--color-surface)] bg-[var(--color-bg)] text-[var(--color-text)] rounded-md h-9 px-2 text-sm"
                value={billedYearId}
                onChange={(e) => setBilledYearId(e.target.value)}
                title="Billed hours fiscal year"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>Billed FY: {y.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>IT Teckningsbidrag</CardTitle>
            <CardDescription>Store the department's teckningsbidrag for the selected fiscal year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Employee inclusion is managed in Admin. Using DB selections for billed calculations. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-sm block mb-1">Teckningsbidrag (SEK)</label>
                <Input
                  inputMode="decimal"
                  value={String(budget?.teckningsbidrag ?? 0)}
                  onChange={(e) => setBudget((b) => ({ ...(b as Budget), teckningsbidrag: Number((e.target.value || '0').replace(',', '.')) }))}
                />
              </div>
              <div>
                <label className="text-sm block mb-1">Total billed hours (selected employees, {years.find(y=>y.id===billedYearId)?.label || ''})</label>
                <Input value={billedHours.toFixed(2)} readOnly />
              </div>
              <div>
                <label className="text-sm block mb-1">Avg billed hourly rate (SEK/h)</label>
                <Input value={avgBilledRate.toFixed(2)} readOnly />
              </div>
            </div>
            {/* Charge types included are managed in Admin and applied from DB; none => none allowed */}
            <div className="space-y-2">
              <label className="text-sm block">Included billable charge types</label>
              <div className="flex flex-wrap gap-3 p-3 border rounded-md">
                {chargeTypes.length === 0 && (
                  <span className="text-sm text-gray-500">No charge types found</span>
                )}
                {chargeTypes.map((ct) => (
                  <span key={ct} className={includedTypes[ct] ? "text-sm" : "text-sm opacity-50"}>{ct}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="text-sm block mb-1">Total worked hours (selected employees, {years.find(y=>y.id===billedYearId)?.label || ''})</label>
                <Input value={workedHours.toFixed(2)} readOnly />
              </div>
              <div>
                <label className="text-sm block mb-1">%-billed hours (billed/worked)</label>
                <Input value={`${pctBilled.toFixed(1)}%`} readOnly />
              </div>
            </div>
            <div>
              <Button onClick={saveBudget} disabled={busySave || !budget}>Save</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Simulation</CardTitle>
            <CardDescription>How much would teckningsbidrag increase if we log more billable time at the current average rate?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm block mb-1">Extra billable hours: {extraHours} h</label>
              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={extraHours}
                onChange={(e) => setExtraHours(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm block mb-1">Projected teckningsbidrag (SEK)</label>
                <Input value={projected.newTB.toFixed(2)} readOnly />
              </div>
              <div>
                <label className="text-sm block mb-1">TB increase (SEK)</label>
                <Input value={projected.deltaTB.toFixed(2)} readOnly />
              </div>
              <div>
                <label className="text-sm block mb-1">Projected billed hours</label>
                <Input value={projected.newHours.toFixed(2)} readOnly />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm block mb-1">Projected %-billed hours</label>
                <Input value={`${(workedHours ? Math.round((((billedHours + extraHours) / workedHours) * 100) * 10) / 10 : 0).toFixed(1)}%`} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
