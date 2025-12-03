"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fiscalMonths } from "@/lib/fiscal";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type Employee = { id: string; name: string; role: string | null };
type FiscalYear = { id: string; label: string; start_date: string; end_date: string; available_hours?: number };
type MonthEntry = {
  id?: string;
  employee_id: string;
  fiscal_year_id: string;
  month_index: number; // 0..11 (Sep..Aug)
  worked: number;
  logged: number;
  billed: number;
  break_hours?: number;
  absence_hours?: number;
};


export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = (params?.id as string) || "";

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [entries, setEntries] = useState<MonthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string>("");
  const [savingAgent, setSavingAgent] = useState(false);

  const months = fiscalMonths();

  // Display map for worked (decimal as string), and logged/billed (H:MM strings)
  const [display, setDisplay] = useState<Record<number, { worked: string; logged: string; billed: string }>>({});

  // Edit mode: month-by-month or yearly totals
  const [editMode, setEditMode] = useState<"month" | "year">("month");
  const [yearWorked, setYearWorked] = useState<string>("0");
  const [yearLoggedText, setYearLoggedText] = useState<string>("0:00");
  const [yearBilledText, setYearBilledText] = useState<string>("0:00");
  const [monthlyHours, setMonthlyHours] = useState<Record<number, number>>({});

  // Load monthly available hours
  useEffect(() => {
    const loadMonthly = async () => {
      if (!yearId) { setMonthlyHours({}); return; }
      try {
        const { data } = await supabaseBrowser
          .from("monthly_available_hours")
          .select("month_index, available_hours")
          .eq("fiscal_year_id", yearId);
        const map: Record<number, number> = {};
        (data || []).forEach((r: any) => {
          map[r.month_index] = Number(r.available_hours || 0);
        });
        setMonthlyHours(map);
      } catch {
        setMonthlyHours({});
      }
    };
    loadMonthly();
  }, [yearId]);

  function decimalToHM(dec: number): string {
    if (!Number.isFinite(dec)) return "0:00";
    const sign = dec < 0 ? -1 : 1;
    const abs = Math.abs(dec);
    const hours = Math.floor(abs);
    const minutes = Math.round((abs - hours) * 60);
    const mm = minutes.toString().padStart(2, '0');
    return `${sign < 0 ? '-' : ''}${hours}:${mm}`;
  }

  function parseHoursInput(s: string): number {
    if (!s) return 0;
    const t = s.trim();
    if (t.includes(':')) {
      const [hStr, mStr = '0'] = t.split(':');
      const h = parseInt(hStr.replace(/[^0-9-]/g, ''), 10);
      const m = parseInt(mStr.replace(/[^0-9]/g, ''), 10);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
      return h + (m / 60);
    }
    // decimal with dot or comma
    const dec = parseFloat(t.replace(',', '.'));
    return Number.isFinite(dec) ? dec : 0;
  }

  // Derived chart data
  const chartData = useMemo(() => {
    return months.map((m) => {
      const e = entries.find((x) => x.month_index === m.index);
      const worked = e?.worked ?? 0;
      const logged = e?.logged ?? 0;
      const billed = e?.billed ?? 0;
      const loggedPct = worked ? Math.round((logged / worked) * 1000) / 10 : 0;
      const billedPct = worked ? Math.round((billed / worked) * 1000) / 10 : 0;
      return { name: m.label, loggedPct, billedPct };
    });
  }, [entries, months]);

  const totals = useMemo(() => {
    const sum = entries.reduce(
      (acc, e) => {
        acc.worked += e.worked || 0;
        acc.logged += e.logged || 0;
        acc.billed += e.billed || 0;
        return acc;
      },
      { worked: 0, logged: 0, billed: 0 }
    );
    const pct = {
      loggedPct: sum.worked ? Math.round((sum.logged / sum.worked) * 1000) / 10 : 0,
      billedPct: sum.worked ? Math.round((sum.billed / sum.worked) * 1000) / 10 : 0,
    };
    return { ...sum, ...pct };
  }, [entries]);

  useEffect(() => {
    const loadBase = async () => {
      try {
        // Load employee
        const { data: emp, error: empErr } = await supabaseBrowser
          .from("employees")
          .select("id, name, role")
          .eq("id", employeeId)
          .single();
        if (empErr) throw empErr;
        setEmployee(emp as Employee);

        // Load fiscal years
        const { data: fya, error: fyErr } = await supabaseBrowser
          .from("fiscal_years")
          .select("id, label, start_date, end_date, available_hours")
          .order("start_date", { ascending: false });
        if (fyErr) throw fyErr;
        setYears((fya as FiscalYear[]) || []);
        const preferred = ((fya as FiscalYear[]) || [])[0]?.id as string | undefined;
        if (preferred) setYearId(preferred);
      } catch (err: unknown) {
        const error = err as { message?: string };
        setError(error?.message ?? "Failed to load employee");
      } finally {
        setLoading(false);
      }
    };
    if (employeeId) loadBase();
  }, [employeeId]);

  // Load Halo Agent ID mapping for this employee
  useEffect(() => {
    const loadMap = async () => {
      try {
        if (!employeeId) return;
        const res = await fetch("/api/halopsa/agent-map", { cache: "no-store" });
        const json = await res.json();
        if (json?.mappings) {
          const row = (json.mappings as any[]).find((r) => r.employee_id === employeeId);
          if (row?.agent_id) setAgentId(String(row.agent_id));
        }
      } catch {
        // Silently fail if agent map cannot be loaded
      }
    };
    loadMap();
  }, [employeeId]);

  const saveAgentId = async () => {
    if (!employeeId) return;
    setSavingAgent(true);
    try {
      const res = await fetch("/api/halopsa/agent-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId, agent_id: agentId.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to save agent id");
      alert("Halo Agent ID saved");
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error?.message || "Failed to save");
    } finally {
      setSavingAgent(false);
    }
  };

  useEffect(() => {
    const loadEntries = async () => {
      if (!employeeId || !yearId) return;
      const { data, error } = await supabaseBrowser
        .from("month_entries")
        .select("id, employee_id, fiscal_year_id, month_index, worked, logged, billed, break_hours, absence_hours")
        .eq("employee_id", employeeId)
        .eq("fiscal_year_id", yearId);
      if (error) {
        setError(error.message);
        return;
      }
      // Ensure we have all 12 months in state
      const map: Record<number, MonthEntry> = {};
      (data as MonthEntry[]).forEach((d) => (map[d.month_index] = d));
      const full: MonthEntry[] = months.map((m) =>
        map[m.index] ?? {
          employee_id: employeeId,
          fiscal_year_id: yearId,
          month_index: m.index,
          worked: 0,
          logged: 0,
          billed: 0,
        }
      );
      setEntries(full);
      // Initialize display map from numeric values
      setDisplay((prev) => {
        const next: Record<number, { worked: string; logged: string; billed: string }> = { ...prev };
        for (const e of full) {
          next[e.month_index] = {
            worked: String(Number(e.worked || 0)),
            logged: decimalToHM(Number(e.logged || 0)),
            billed: decimalToHM(Number(e.billed || 0)),
          };
        }
        return next;
      });
      // Initialize yearly totals from loaded data
      const totalWorked = full.reduce((a, e) => a + Number(e.worked || 0), 0);
      const totalLogged = full.reduce((a, e) => a + Number(e.logged || 0), 0);
      const totalBilled = full.reduce((a, e) => a + Number(e.billed || 0), 0);
      setYearWorked(String(Math.round(totalWorked * 10) / 10));
      setYearLoggedText(decimalToHM(totalLogged));
      setYearBilledText(decimalToHM(totalBilled));
    };
    loadEntries();
  }, [employeeId, yearId, months]);

  const updateEntry = (idx: number, patch: Partial<MonthEntry>) => {
    setEntries((list) => list.map((e) => (e.month_index === idx ? { ...e, ...patch } : e)));
  };

  const saveAll = async () => {
    if (!yearId || !employeeId) return;
    setSaving(true);
    try {
      // Upsert all entries. For new rows (no id), provide a generated UUID to satisfy NOT NULL id on some DBs.
      const payload = entries.map((e) => ({
        id: e.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : undefined),
        employee_id: e.employee_id,
        fiscal_year_id: e.fiscal_year_id,
        month_index: e.month_index,
        worked: Number.isFinite(e.worked) ? e.worked : 0,
        logged: Number.isFinite(e.logged) ? e.logged : 0,
        billed: Number.isFinite(e.billed) ? e.billed : 0,
      }));
      const { data, error } = await supabaseBrowser
        .from("month_entries")
        .upsert(payload, { onConflict: "employee_id,fiscal_year_id,month_index" })
        .select("id, employee_id, fiscal_year_id, month_index, worked, logged, billed");
      if (error) throw error;
      setEntries((data as MonthEntry[]) || []);
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error?.message ?? "Failed to save entries");
    } finally {
      setSaving(false);
    }
  };

  // Export per-month data (worked, logged, billed, percentages) for the selected fiscal year
  const exportCsv = () => {
    if (!yearId) return;
    const fyLabel = years.find((y) => y.id === yearId)?.label || "";
    const header = [
      "Month",
      "Worked",
      "Logged",
      "Billed",
      "% Logged",
      "% Billed",
      "FY",
    ].join(",");
    const lines = months.map((m) => {
      const e = entries.find((x) => x.month_index === m.index);
      const worked = Number(e?.worked ?? 0);
      const logged = Number(e?.logged ?? 0);
      const billed = Number(e?.billed ?? 0);
      const loggedPct = worked ? Math.round((logged / worked) * 1000) / 10 : 0;
      const billedPct = worked ? Math.round((billed / worked) * 1000) / 10 : 0;
      return [m.label, worked, logged, billed, loggedPct, billedPct, fyLabel].join(",");
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${employee?.name || "employee"}_${fyLabel.replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Apply yearly totals evenly across all 12 months
  const applyYearlyEvenly = () => {
    const totalWorked = parseHoursInput(yearWorked.replace(",", "."));
    const totalLogged = parseHoursInput(yearLoggedText);
    const totalBilled = parseHoursInput(yearBilledText);
    const perWorked = totalWorked / 12;
    const perLogged = totalLogged / 12;
    const perBilled = totalBilled / 12;
    setEntries((list) =>
      list.map((e) => ({
        ...e,
        worked: Math.round(perWorked * 100) / 100,
        logged: Math.round(perLogged * 100) / 100,
        billed: Math.round(perBilled * 100) / 100,
      }))
    );
    setDisplay((prev) => {
      const next: Record<number, { worked: string; logged: string; billed: string }> = { ...prev };
      for (const m of months) {
        next[m.index] = {
          worked: String(Math.round(perWorked * 100) / 100),
          logged: decimalToHM(perLogged),
          billed: decimalToHM(perBilled),
        };
      }
      return next;
    });
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!employee) return <p className="p-6">Not found</p>;
  const hasYear = !!yearId && years.length > 0;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push("/employees")}>← Back</Button>
            <div>
              <h1 className="text-xl font-semibold">{employee.name}</h1>
              <p className="text-sm text-[var(--color-text)]/70">{employee.role ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {years.length > 0 ? (
              <select
                className="border border-[var(--color-surface)] bg-[var(--color-bg)] text-[var(--color-text)] rounded-md h-9 px-2 text-sm"
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>
            ) : null}
            <Button onClick={saveAll} disabled={saving || !hasYear}>{saving ? "Saving..." : "Save All"}</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!hasYear}>Export CSV</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Label htmlFor="haloAgentId">Halo Agent ID</Label>
            <Input id="haloAgentId" inputMode="numeric" value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="e.g. 5" />
          </div>
          <Button onClick={saveAgentId} disabled={savingAgent}>{savingAgent ? "Saving..." : "Save Agent ID"}</Button>
        </div>
        {!hasYear && (
          <Card>
            <CardHeader>
              <CardTitle>No fiscal year found</CardTitle>
              <CardDescription>
                Create a fiscal year first on the Years page to enable monthly editing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/years')}>Go to Years</Button>
            </CardContent>
          </Card>
        )}
        {hasYear && (
          <Card>
            <CardHeader>
              <CardTitle>Edit Mode</CardTitle>
              <CardDescription>Choose how to enter this year&apos;s values</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Button variant={editMode === 'month' ? 'default' : 'outline'} onClick={() => setEditMode('month')}>Month-by-month</Button>
              <Button variant={editMode === 'year' ? 'default' : 'outline'} onClick={() => setEditMode('year')}>Yearly totals</Button>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Yearly Summary</CardTitle>
            <CardDescription>Total hours and percentages</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Worked</p>
              <p className="text-lg font-semibold">{totals.worked.toFixed(1)} h</p>
            </div>
            <div>
              <p className="text-slate-500">Logged</p>
              <p className="text-lg font-semibold">{totals.logged.toFixed(1)} h ({totals.loggedPct}%)</p>
            </div>
            <div>
              <p className="text-slate-500">Billed</p>
              <p className="text-lg font-semibold">{totals.billed.toFixed(1)} h ({totals.billedPct}%)</p>
            </div>
            <div>
              <p className="text-slate-500">Attendance</p>
              <p className="text-lg font-semibold">
                {(() => {
                  const fy = years.find(y => y.id === yearId);
                  if (!fy) return "0%";
                  
                  let cutoffIndex = 12;
                  const now = new Date();
                  const start = new Date(fy.start_date); 
                  const end = new Date(fy.end_date);
                  
                  if (now < start) cutoffIndex = 0;
                  else if (now > end) cutoffIndex = 12;
                  else cutoffIndex = ((now.getUTCMonth() + 12) - 8) % 12;

                  let availSum = 0;
                  let workedSum = 0;
                  for (let i = 0; i < cutoffIndex; i++) {
                    availSum += (monthlyHours[i] ?? 160);
                    const e = entries.find(x => x.month_index === i);
                    workedSum += (e?.worked || 0);
                  }
                  
                  const pct = availSum > 0 ? Math.round((workedSum / availSum) * 1000) / 10 : 0;
                  return `${pct}%`;
                })()}
              </p>
            </div>
          </CardContent>
        </Card>

        {editMode === 'year' && (
          <Card>
            <CardHeader>
              <CardTitle>Yearly Totals</CardTitle>
              <CardDescription>Enter full-year values and distribute evenly across months</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="yw">Worked (hours)</Label>
                <Input id="yw" inputMode="decimal" value={yearWorked} onChange={(e) => setYearWorked(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="yl">Logged (H:MM or decimal)</Label>
                <Input id="yl" inputMode="text" value={yearLoggedText} onChange={(e) => setYearLoggedText(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="yb">Billed (H:MM or decimal)</Label>
                <Input id="yb" inputMode="text" value={yearBilledText} onChange={(e) => setYearBilledText(e.target.value)} />
              </div>
              <div>
                <Button onClick={applyYearlyEvenly}>Apply yearly totals</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {editMode === 'month' && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Editor</CardTitle>
            <CardDescription>Enter worked, logged, and billed for each month</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {months.map((m) => {
              const e = entries.find((x) => x.month_index === m.index) ?? {
                employee_id: employeeId,
                fiscal_year_id: yearId,
                month_index: m.index,
                worked: 0,
                logged: 0,
                billed: 0,
                break_hours: 0,
                absence_hours: 0,
              };
              const availHours = monthlyHours[m.index] ?? 160;
              const workedPct = availHours ? Math.round((e.worked / availHours) * 1000) / 10 : 0;
              const breakPct = availHours ? Math.round(((e.break_hours || 0) / availHours) * 1000) / 10 : 0;
              const absencePct = availHours ? Math.round(((e.absence_hours || 0) / availHours) * 1000) / 10 : 0;
              const loggedPct = e.worked ? Math.round((e.logged / e.worked) * 1000) / 10 : 0;
              const billedPct = e.worked ? Math.round((e.billed / e.worked) * 1000) / 10 : 0;
              return (
                <div key={m.index} className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-black">{m.label}</p>
                    <p className="text-xs text-slate-500">Avail: {availHours}h</p>
                  </div>
                  {/* Monthly metrics summary */}
                  <div className="grid grid-cols-4 gap-1 text-xs text-slate-600 bg-slate-50 rounded p-2">
                    <div className="text-center">
                      <p className="font-medium">{e.worked.toFixed(1)}h</p>
                      <p className="text-slate-400">Worked ({workedPct}%)</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{(e.break_hours || 0).toFixed(1)}h</p>
                      <p className="text-slate-400">Breaks ({breakPct}%)</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{(e.absence_hours || 0).toFixed(1)}h</p>
                      <p className="text-slate-400">Absence ({absencePct}%)</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium">{billedPct}%</p>
                      <p className="text-slate-400">Billed</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <Label htmlFor={`w-${m.index}`}>Worked</Label>
                      <Input
                        id={`w-${m.index}`}
                        inputMode="decimal"
                        value={display[m.index]?.worked ?? String(e.worked ?? 0)}
                        onChange={(ev) => {
                          const val = ev.target.value;
                          setDisplay((d) => ({ ...d, [m.index]: { ...(d[m.index] || { logged: decimalToHM(Number(e.logged||0)), billed: decimalToHM(Number(e.billed||0)) }), worked: val } }));
                          const dec = parseHoursInput(val);
                          updateEntry(m.index, { worked: dec });
                        }}
                        onBlur={() => {
                          const dec = Number(entries.find(x => x.month_index === m.index)?.worked || 0);
                          setDisplay((d) => ({ ...d, [m.index]: { ...(d[m.index] || { logged: decimalToHM(Number(e.logged||0)), billed: decimalToHM(Number(e.billed||0)) }), worked: String(Math.round(dec * 100) / 100) } }));
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`l-${m.index}`}>Logged</Label>
                      <Input
                        id={`l-${m.index}`}
                        inputMode="text"
                        value={display[m.index]?.logged ?? decimalToHM(Number(e.logged || 0))}
                        onChange={(ev) => {
                          const val = ev.target.value;
                          setDisplay((d) => ({
                            ...d,
                            [m.index]: {
                              ...(d[m.index] || {
                                worked: String(Number(e.worked || 0)),
                                logged: decimalToHM(Number(e.logged || 0)),
                                billed: decimalToHM(Number(e.billed || 0)),
                              }),
                              logged: val,
                            },
                          }));
                          const dec = parseHoursInput(val);
                          updateEntry(m.index, { logged: dec });
                        }}
                        onBlur={() => {
                          const dec = Number(entries.find(x => x.month_index === m.index)?.logged || 0);
                          setDisplay((d) => ({
                            ...d,
                            [m.index]: {
                              ...(d[m.index] || {
                                worked: String(Number(e.worked || 0)),
                                logged: decimalToHM(Number(e.logged || 0)),
                                billed: decimalToHM(Number(e.billed || 0)),
                              }),
                              logged: decimalToHM(dec),
                            },
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`b-${m.index}`}>Billed</Label>
                      <Input
                        id={`b-${m.index}`}
                        inputMode="text"
                        value={display[m.index]?.billed ?? decimalToHM(Number(e.billed || 0))}
                        onChange={(ev) => {
                          const val = ev.target.value;
                          setDisplay((d) => ({
                            ...d,
                            [m.index]: {
                              ...(d[m.index] || {
                                worked: String(Number(e.worked || 0)),
                                logged: decimalToHM(Number(e.logged || 0)),
                                billed: decimalToHM(Number(e.billed || 0)),
                              }),
                              billed: val,
                            },
                          }));
                          const dec = parseHoursInput(val);
                          updateEntry(m.index, { billed: dec });
                        }}
                        onBlur={() => {
                          const dec = Number(entries.find(x => x.month_index === m.index)?.billed || 0);
                          setDisplay((d) => ({
                            ...d,
                            [m.index]: {
                              ...(d[m.index] || {
                                worked: String(Number(e.worked || 0)),
                                logged: decimalToHM(Number(e.logged || 0)),
                                billed: decimalToHM(Number(e.billed || 0)),
                              }),
                              billed: decimalToHM(dec),
                            },
                          }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Logged vs Billed</CardTitle>
            <CardDescription>Percentages per month over the fiscal year</CardDescription>
          </CardHeader>
          <CardContent style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', color: '#fff' }} />
                <Legend />
                <Line type="monotone" dataKey="loggedPct" stroke="#7ef9ff" strokeWidth={2} dot={false} name="% Logged" />
                <Line type="monotone" dataKey="billedPct" stroke="#afff5f" strokeWidth={2} dot={false} name="% Billed" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
