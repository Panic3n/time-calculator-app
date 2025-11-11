"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// Types
type Employee = { id: string; name: string; role: string | null };
type FiscalYear = { id: string; label: string; start_date?: string; end_date?: string; available_hours?: number | null };

export default function AdminPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearId, setYearId] = useState<string>("");

  // Employees: create/edit
  const [newEmployee, setNewEmployee] = useState<{ name: string; role: string }>({ name: "", role: "" });
  const [editing, setEditing] = useState<Record<string, { name: string; role: string | null }>>({});
  const [busyEmp, setBusyEmp] = useState(false);

  // Fiscal years: create/edit
  const [newFY, setNewFY] = useState<{ label: string; start: string; end: string; available: string }>(
    { label: "", start: "", end: "", available: "" }
  );
  const [editingFY, setEditingFY] = useState<Record<string, { available: string }>>({});
  const [busyFY, setBusyFY] = useState(false);

  // Team selection for active FY
  const [teamIncluded, setTeamIncluded] = useState<Record<string, boolean>>({});
  const [busyTeam, setBusyTeam] = useState(false);

  // Charge types selection for active FY
  const [chargeTypes, setChargeTypes] = useState<string[]>([]);
  const [includedTypes, setIncludedTypes] = useState<Record<string, boolean>>({});
  const [busyCT, setBusyCT] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data: emps }, { data: fys }] = await Promise.all([
        supabaseBrowser.from("employees").select("id, name, role").order("name"),
        supabaseBrowser.from("fiscal_years").select("id, label, start_date, end_date, available_hours").order("start_date", { ascending: false }),
      ]);
      setEmployees((emps as any[]) || []);
      setYears((fys as any[]) || []);
      const pref = ((fys as any[]) || [])[0]?.id as string | undefined;
      if (pref) setYearId(pref);
    };
    load();
  }, []);

  // Load selections for active FY
  useEffect(() => {
    const loadSelected = async () => {
      if (!yearId) { setTeamIncluded({}); setIncludedTypes({}); return; }
      try {
        const [teamRes, ctRes, typesFromTables, typesFromBilled] = await Promise.all([
          fetch(`/api/admin/team-included?fiscal_year_id=${yearId}`),
          fetch(`/api/admin/charge-types?fiscal_year_id=${yearId}`),
          supabaseBrowser.from("halo_billable_charge_types").select("name").order("name"),
          supabaseBrowser.from("month_entries_billed_types").select("charge_type_name").eq("fiscal_year_id", yearId),
        ]);
        const teamJson = await teamRes.json();
        const ctJson = await ctRes.json();
        const namesA = (((typesFromTables.data as any[])||[]).map(r => String(r.name||"").toLowerCase()).filter(Boolean));
        const namesB = (((typesFromBilled.data as any[])||[]).map(r => String(r.charge_type_name||"").toLowerCase()).filter(Boolean));
        const allNames = Array.from(new Set([...namesA, ...namesB])).sort();
        setChargeTypes(allNames);
        const includedEmp: Record<string, boolean> = {};
        (teamJson?.rows || []).forEach((r: any) => { includedEmp[String(r.employee_id)] = true; });
        setTeamIncluded(includedEmp);
        const includedCt: Record<string, boolean> = {};
        (ctJson?.rows || []).forEach((r: any) => { includedCt[String(r.charge_type_name||"").toLowerCase()] = true; });
        setIncludedTypes(includedCt);
      } catch {}
    };
    loadSelected();
  }, [yearId]);

  // Create new employee
  const createEmployee = async () => {
    if (!newEmployee.name.trim()) return;
    setBusyEmp(true);
    try {
      const { error } = await supabaseBrowser.from("employees").insert({ name: newEmployee.name.trim(), role: newEmployee.role.trim() || null });
      if (error) throw error;
      setNewEmployee({ name: "", role: "" });
      const { data } = await supabaseBrowser.from("employees").select("id, name, role").order("name");
      setEmployees((data as any[]) || []);
    } catch (e: any) {
      alert(e?.message || "Failed to create employee");
    } finally {
      setBusyEmp(false);
    }
  };

  // Save edited employee rows
  const saveEmployee = async (id: string) => {
    setBusyEmp(true);
    try {
      const p = editing[id];
      if (!p) return;
      const { error } = await supabaseBrowser.from("employees").update({ name: p.name.trim(), role: (p.role||"").trim() || null }).eq("id", id);
      if (error) throw error;
      setEditing((e) => { const n = { ...e }; delete n[id]; return n; });
      const { data } = await supabaseBrowser.from("employees").select("id, name, role").order("name");
      setEmployees((data as any[]) || []);
    } catch (e: any) {
      alert(e?.message || "Failed to save employee");
    } finally {
      setBusyEmp(false);
    }
  };

  // Create fiscal year
  const createFY = async () => {
    const label = newFY.label.trim();
    if (!label) return;
    setBusyFY(true);
    try {
      const payload: any = { label };
      if (newFY.start) payload.start_date = newFY.start;
      if (newFY.end) payload.end_date = newFY.end;
      if (newFY.available) payload.available_hours = Number((newFY.available||"0").replace(",","."));
      const { error } = await supabaseBrowser.from("fiscal_years").insert(payload);
      if (error) throw error;
      setNewFY({ label: "", start: "", end: "", available: "" });
      const { data } = await supabaseBrowser.from("fiscal_years").select("id, label, start_date, end_date, available_hours").order("start_date", { ascending: false });
      setYears((data as any[]) || []);
    } catch (e: any) {
      alert(e?.message || "Failed to create fiscal year");
    } finally {
      setBusyFY(false);
    }
  };

  // Save available hours
  const saveFYAvailable = async (id: string) => {
    setBusyFY(true);
    try {
      const v = Number((editingFY[id]?.available || "0").replace(",","."));
      const { error } = await supabaseBrowser.from("fiscal_years").update({ available_hours: v }).eq("id", id);
      if (error) throw error;
      setEditingFY((e) => { const n = { ...e }; delete n[id]; return n; });
      const { data } = await supabaseBrowser.from("fiscal_years").select("id, label, start_date, end_date, available_hours").order("start_date", { ascending: false });
      setYears((data as any[]) || []);
    } catch (e: any) {
      alert(e?.message || "Failed to save available hours");
    } finally {
      setBusyFY(false);
    }
  };

  // Save team inclusion
  const saveTeamIncluded = async () => {
    if (!yearId) return;
    setBusyTeam(true);
    try {
      const ids = Object.keys(teamIncluded).filter(k => !!teamIncluded[k]);
      const res = await fetch("/api/admin/team-included", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscal_year_id: yearId, employee_ids: ids }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to save team selection");
      alert("Saved team selection");
    } catch (e: any) {
      alert(e?.message || "Failed to save");
    } finally {
      setBusyTeam(false);
    }
  };

  // Save included charge types
  const saveChargeTypes = async () => {
    if (!yearId) return;
    setBusyCT(true);
    try {
      const names = Object.keys(includedTypes).filter(k => !!includedTypes[k]);
      const res = await fetch("/api/admin/charge-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscal_year_id: yearId, charge_type_names: names }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Failed to save charge types");
      alert("Saved included charge types");
    } catch (e: any) {
      alert(e?.message || "Failed to save");
    } finally {
      setBusyCT(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="bg-[var(--color-bg)] border-b border-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Admin</h1>
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
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Employees */}
        <Card>
          <CardHeader>
            <CardTitle>Employees</CardTitle>
            <CardDescription>Create and edit employees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-sm block mb-1">Name</label>
                <Input value={newEmployee.name} onChange={(e) => setNewEmployee((s) => ({ ...s, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm block mb-1">Role</label>
                <Input value={newEmployee.role} onChange={(e) => setNewEmployee((s) => ({ ...s, role: e.target.value }))} />
              </div>
              <div>
                <Button onClick={createEmployee} disabled={busyEmp || !newEmployee.name.trim()}>Create</Button>
              </div>
            </div>
            <Separator />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-[var(--color-surface)]">
                    <th className="py-2">Name</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--color-surface)]/60">
                      <td className="py-2">
                        <Input value={(editing[e.id]?.name ?? e.name) || ""} onChange={(ev) => setEditing((s)=>({ ...s, [e.id]: { ...(s[e.id]||{ name: e.name, role: e.role }), name: ev.target.value } }))} />
                      </td>
                      <td className="py-2">
                        <Input value={(editing[e.id]?.role ?? (e.role||"")) || ""} onChange={(ev) => setEditing((s)=>({ ...s, [e.id]: { ...(s[e.id]||{ name: e.name, role: e.role }), role: ev.target.value } }))} />
                      </td>
                      <td className="py-2">
                        <Button variant="outline" onClick={() => saveEmployee(e.id)} disabled={busyEmp || !editing[e.id]}>Save</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Fiscal Years */}
        <Card>
          <CardHeader>
            <CardTitle>Fiscal Years</CardTitle>
            <CardDescription>Create and set available hours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-sm block mb-1">Label (e.g. 2024/2025)</label>
                <Input value={newFY.label} onChange={(e) => setNewFY((s)=>({ ...s, label: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm block mb-1">Start date (YYYY-MM-DD)</label>
                <Input value={newFY.start} onChange={(e) => setNewFY((s)=>({ ...s, start: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm block mb-1">End date (YYYY-MM-DD)</label>
                <Input value={newFY.end} onChange={(e) => setNewFY((s)=>({ ...s, end: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm block mb-1">Available hours</label>
                <Input value={newFY.available} onChange={(e) => setNewFY((s)=>({ ...s, available: e.target.value }))} />
              </div>
              <div>
                <Button onClick={createFY} disabled={busyFY || !newFY.label.trim()}>Create</Button>
              </div>
            </div>
            <Separator />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-[var(--color-surface)]">
                    <th className="py-2">Label</th>
                    <th className="py-2">Available hours</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.id} className="border-b border-[var(--color-surface)]/60">
                      <td className="py-2">{y.label}</td>
                      <td className="py-2">
                        <Input value={(editingFY[y.id]?.available ?? String(y.available_hours ?? "")) || ""} onChange={(ev)=> setEditingFY((s)=>({ ...s, [y.id]: { available: ev.target.value } }))} />
                      </td>
                      <td className="py-2">
                        <Button variant="outline" onClick={() => saveFYAvailable(y.id)} disabled={busyFY || !editingFY[y.id]}>Save</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Team Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Team Selection</CardTitle>
            <CardDescription>Select which employees appear on Teams for the selected fiscal year</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                const all: Record<string, boolean> = {};
                employees.forEach((e) => { all[e.id] = true; });
                setTeamIncluded(all);
              }}>Select all</Button>
              <Button variant="outline" onClick={() => {
                const none: Record<string, boolean> = {};
                employees.forEach((e) => { none[e.id] = false; });
                setTeamIncluded(none);
              }}>Select none</Button>
              <Button onClick={saveTeamIncluded} disabled={busyTeam || !yearId}>Save</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-auto p-2 border rounded">
              {employees.map((e) => (
                <label key={e.id} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!teamIncluded[e.id]} onChange={(ev) => setTeamIncluded((s)=>({ ...s, [e.id]: ev.target.checked }))} />
                  <span>{e.name}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charge Types */}
        <Card>
          <CardHeader>
            <CardTitle>Included Charge Types</CardTitle>
            <CardDescription>Which billable charge types count for Teams/Budgets for the selected FY (default: none)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                const all: Record<string, boolean> = {};
                chargeTypes.forEach((n) => { all[n] = true; });
                setIncludedTypes(all);
              }}>Select all</Button>
              <Button variant="outline" onClick={() => setIncludedTypes({})}>Select none</Button>
              <Button onClick={saveChargeTypes} disabled={busyCT || !yearId}>Save</Button>
            </div>
            <div className="flex flex-wrap gap-3 p-3 border rounded">
              {chargeTypes.length === 0 && (
                <span className="text-sm text-gray-500">No charge types found</span>
              )}
              {chargeTypes.map((ct) => (
                <label key={ct} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!includedTypes[ct]} onChange={(e) => setIncludedTypes((prev) => ({ ...prev, [ct]: e.target.checked }))} />
                  <span>{ct}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
