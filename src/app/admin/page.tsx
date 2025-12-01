"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// Types
type Employee = { id: string; name: string; role: string | null };
type FiscalYear = { id: string; label: string; start_date?: string; end_date?: string; available_hours?: number | null };
type Budget = { id?: string; fiscal_year_id: string; department: string; teckningsbidrag: number };
type TeamGoals = {
  id?: string;
  fiscal_year_id: string;
  department_tb_goal: number;
  team_billed_pct_goal: number;
  team_billable_hours_goal: number;
  team_avg_rate_goal: number;
  personal_billed_pct_goal: number;
  personal_logged_pct_goal: number;
  personal_attendance_pct_goal: number;
  personal_feedback_score_goal: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [section, setSection] = useState<"employees" | "fiscal" | "team" | "charge" | "budgets" | "goals" | "calculations" | "message-board">("employees");

  // Employees: create/edit/delete
  const [newEmployee, setNewEmployee] = useState<{ name: string; role: string }>({ name: "", role: "" });
  const [editing, setEditing] = useState<Record<string, { name: string; role: string | null }>>({});
  const [busyEmp, setBusyEmp] = useState(false);
  const [deletingEmp, setDeletingEmp] = useState<Record<string, boolean>>({});

  // Fiscal years: create/edit
  const [newFY, setNewFY] = useState<{ label: string; start: string; end: string; available: string }>(
    { label: "", start: "", end: "", available: "" }
  );
  const [editingFY, setEditingFY] = useState<Record<string, { available: string }>>({});
  const [busyFY, setBusyFY] = useState(false);

  // Team selection for active FY
  const [teamIncluded, setTeamIncluded] = useState<Record<string, boolean>>({});
  const [busyTeam, setBusyTeam] = useState(false);

  // Charge types selection for active FY (for Teams/Budgets inclusion)
  const [chargeTypes, setChargeTypes] = useState<string[]>([]);
  const [includedTypes, setIncludedTypes] = useState<Record<string, boolean>>({});
  const [busyCT, setBusyCT] = useState(false);

  // Budgets: state (separate from above to avoid collisions)
  const [budgetYearId, setBudgetYearId] = useState<string>("");
  const [budgetBilledYearId, setBudgetBilledYearId] = useState<string>("");
  const [budgetLoading, setBudgetLoading] = useState<boolean>(true);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [busyBudgetSave, setBusyBudgetSave] = useState(false);
  const [budgetIncludedMap, setBudgetIncludedMap] = useState<Record<string, boolean>>({});
  const [budgetBilledEntries, setBudgetBilledEntries] = useState<{ employee_id: string; billed: number; worked: number; logged: number }[]>([]);
  const [budgetBilledTypeRows, setBudgetBilledTypeRows] = useState<{ employee_id: string; charge_type_name: string; hours: number }[]>([]);
  const [budgetChargeTypes, setBudgetChargeTypes] = useState<string[]>([]);
  const [budgetIncludedTypes, setBudgetIncludedTypes] = useState<Record<string, boolean>>({});
  const [budgetExtraHours, setBudgetExtraHours] = useState<number>(0);

  // Team goals: state
  const [goalsYearId, setGoalsYearId] = useState<string>("");
  const [goalsLoading, setGoalsLoading] = useState<boolean>(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);
  const [goals, setGoals] = useState<TeamGoals | null>(null);
  const [busyGoalsSave, setBusyGoalsSave] = useState(false);

  // Message board: state
  const [messageTitle, setMessageTitle] = useState<string>("");
  const [messageContent, setMessageContent] = useState<string>("");
  const [messageBusySave, setMessageBusySave] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // Check if user is admin
        const { data: sess } = await supabaseBrowser.auth.getSession();
        const userId = sess?.session?.user?.id;
        if (!userId) {
          router.push("/auth");
          return;
        }
        const { data: prof } = await supabaseBrowser
          .from("app_profiles")
          .select("is_admin")
          .eq("user_id", userId)
          .single();
        if (!prof?.is_admin) {
          router.push("/dashboard");
          return;
        }

        const [{ data: emps }, { data: fys }] = await Promise.all([
          supabaseBrowser.from("employees").select("id, name, role").order("name"),
          supabaseBrowser.from("fiscal_years").select("id, label, start_date, end_date, available_hours").order("start_date", { ascending: false }),
        ]);
        setEmployees((emps as any[]) || []);
        setYears((fys as any[]) || []);
        const pref = ((fys as any[]) || [])[0]?.id as string | undefined;
        if (pref) {
          setYearId(pref);
          setBudgetYearId((prev) => prev || pref);
          setBudgetBilledYearId((prev) => prev || pref);
          setGoalsYearId((prev) => prev || pref);
        }
      } catch {
        router.push("/dashboard");
      }
    };
    load();
  }, [router]);

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

  // Delete employee
  const deleteEmployee = async (id: string) => {
    if (!confirm("Delete this employee? This will remove their time entries.")) return;
    setDeletingEmp((s) => ({ ...s, [id]: true }));
    try {
      const { error } = await supabaseBrowser.from("employees").delete().eq("id", id);
      if (error) throw error;
      const { data } = await supabaseBrowser.from("employees").select("id, name, role").order("name");
      setEmployees((data as any[]) || []);
    } catch (e: any) {
      alert(e?.message || "Failed to delete employee");
    } finally {
      setDeletingEmp((s) => ({ ...s, [id]: false }));
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
      const names = Object.keys(includedTypes).filter((k) => !!includedTypes[k]);
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

  // Budgets: effects (ported from /budgets)
  // Load budgets-related initial data when budgetYearId / budgetBilledYearId change
  useEffect(() => {
    const loadBudgetYear = async () => {
      if (!budgetYearId) {
        setBudget(null);
        return;
      }
      try {
        setBudgetLoading(true);
        setBudgetError(null);
        const { data: budgets, error: bErr } = await supabaseBrowser
          .from("it_budgets")
          .select("id, fiscal_year_id, department, teckningsbidrag")
          .eq("fiscal_year_id", budgetYearId)
          .eq("department", "IT")
          .limit(1);
        if (bErr) throw bErr;
        const b = (budgets || [])[0] as any;
        setBudget(b ?? { fiscal_year_id: budgetYearId, department: "IT", teckningsbidrag: 0 });
      } catch (e: any) {
        setBudgetError(e?.message || "Failed to load budget data");
      } finally {
        setBudgetLoading(false);
      }
    };
    loadBudgetYear();
  }, [budgetYearId]);

  // Load charge types for budgets (per billed FY)
  useEffect(() => {
    const loadBudgetTypes = async () => {
      try {
        const [{ data: base }, { data: rows }] = await Promise.all([
          supabaseBrowser.from("halo_billable_charge_types").select("name").order("name", { ascending: true }),
          supabaseBrowser.from("included_charge_types").select("charge_type_name").eq("fiscal_year_id", budgetBilledYearId),
        ]);
        const names = ((base as any[]) || []).map((r) => String((r as any).name || "").toLowerCase()).filter(Boolean);
        setBudgetChargeTypes(names);
        const inc: Record<string, boolean> = {};
        ((rows as any[]) || []).forEach((r) => {
          inc[String((r as any).charge_type_name || "").toLowerCase()] = true;
        });
        setBudgetIncludedTypes(inc);
      } catch {
        setBudgetChargeTypes([]);
        setBudgetIncludedTypes({});
      }
    };
    if (budgetBilledYearId) loadBudgetTypes();
    else {
      setBudgetChargeTypes([]);
      setBudgetIncludedTypes({});
    }
  }, [budgetBilledYearId]);

  // Load billed + worked + logged entries for budgets when billed FY changes
  useEffect(() => {
    const loadBudgetBilled = async () => {
      if (!budgetBilledYearId) {
        setBudgetBilledEntries([]);
        setBudgetIncludedMap({});
        return;
      }
      const { data, error } = await supabaseBrowser
        .from("month_entries")
        .select("employee_id, billed, worked, logged")
        .eq("fiscal_year_id", budgetBilledYearId);
      if (!error) {
        setBudgetBilledEntries(
          ((data as any[]) || []).map((r) => ({
            employee_id: r.employee_id,
            billed: Number(r.billed || 0),
            worked: Number(r.worked || 0),
            logged: Number(r.logged || 0),
          }))
        );
      }
      try {
        const resp = await fetch(`/api/admin/team-included?fiscal_year_id=${budgetBilledYearId}`, { cache: "no-store" });
        const json = await resp.json();
        const map: Record<string, boolean> = {};
        (json?.rows || []).forEach((r: any) => {
          map[String(r.employee_id)] = true;
        });
        setBudgetIncludedMap(map);
      } catch {
        setBudgetIncludedMap({});
      }
    };
    loadBudgetBilled();
  }, [budgetBilledYearId]);

  // Load per-type billed rows for budgets when billed FY changes
  useEffect(() => {
    const loadBudgetTypeRows = async () => {
      if (!budgetBilledYearId) {
        setBudgetBilledTypeRows([]);
        return;
      }
      const { data, error } = await supabaseBrowser
        .from("month_entries_billed_types")
        .select("employee_id, charge_type_name, hours")
        .eq("fiscal_year_id", budgetBilledYearId);
      if (!error) {
        setBudgetBilledTypeRows(
          ((data as any[]) || []).map((r) => ({
            employee_id: r.employee_id,
            charge_type_name: String(r.charge_type_name || "").toLowerCase(),
            hours: Number(r.hours || 0),
          }))
        );
      }
    };
    loadBudgetTypeRows();
  }, [budgetBilledYearId]);

  // Budgets derived values
  const budgetBilledHoursFromTypes = useMemo(() => {
    if (!budgetBilledTypeRows.length) return 0;
    const sum = budgetBilledTypeRows.reduce((acc, r) => {
      if (!budgetIncludedMap[r.employee_id]) return acc;
      const ct = r.charge_type_name || "";
      if (!ct || !budgetIncludedTypes[ct]) return acc;
      return acc + Number(r.hours || 0);
    }, 0);
    return Math.round(sum * 100) / 100;
  }, [budgetBilledTypeRows, budgetIncludedMap, budgetIncludedTypes]);

  const budgetBilledHours = useMemo(() => {
    const hasTypes = Object.keys(budgetIncludedTypes).length > 0;
    return hasTypes ? budgetBilledHoursFromTypes : 0;
  }, [budgetIncludedTypes, budgetBilledHoursFromTypes]);

  const budgetWorkedHours = useMemo(() => {
    return (
      Math.round(
        budgetBilledEntries
          .filter((e) => budgetIncludedMap[e.employee_id])
          .reduce((acc, r) => acc + Number(r.worked || 0), 0) * 100
      ) / 100
    );
  }, [budgetBilledEntries, budgetIncludedMap]);

  const budgetPctBilled = useMemo(() => {
    if (!budgetWorkedHours) return 0;
    return Math.round(((budgetBilledHours / budgetWorkedHours) * 100) * 10) / 10;
  }, [budgetBilledHours, budgetWorkedHours]);

  const budgetAvgBilledRate = useMemo(() => {
    const tb = Number(budget?.teckningsbidrag || 0);
    const hrs = Number(budgetBilledHours || 0);
    if (!hrs) return 0;
    return Math.round((tb / hrs) * 100) / 100;
  }, [budget, budgetBilledHours]);

  const budgetProjected = useMemo(() => {
    const rate = budgetAvgBilledRate;
    const deltaTB = Math.round(rate * budgetExtraHours * 100) / 100;
    const newTB = Math.round(((budget?.teckningsbidrag || 0) + deltaTB) * 100) / 100;
    const newHours = Math.round(((budgetBilledHours || 0) + budgetExtraHours) * 100) / 100;
    const projectedRate = newHours > 0 ? newTB / newHours : 0;
    return {
      deltaTB,
      newTB,
      newHours,
      projectedRate,
    };
  }, [budgetAvgBilledRate, budgetExtraHours, budget, budgetBilledHours]);

  const saveBudget = async () => {
    if (!budget) return;
    setBusyBudgetSave(true);
    try {
      const payload = {
        id: budget.id,
        fiscal_year_id: budgetYearId,
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
      setBusyBudgetSave(false);
    }
  };

  // Load and save team goals
  useEffect(() => {
    const loadGoals = async () => {
      if (!goalsYearId) {
        setGoals(null);
        return;
      }
      try {
        setGoalsLoading(true);
        setGoalsError(null);
        const { data, error } = await supabaseBrowser
          .from("team_goals")
          .select("id, fiscal_year_id, department_tb_goal, team_billed_pct_goal, team_billable_hours_goal, team_avg_rate_goal, personal_billed_pct_goal, personal_logged_pct_goal, personal_attendance_pct_goal, personal_feedback_score_goal")
          .eq("fiscal_year_id", goalsYearId)
          .limit(1);
        if (error) throw error;
        const row = (data as any[])?.[0];
        setGoals(
          row ?? {
            fiscal_year_id: goalsYearId,
            department_tb_goal: 0,
            team_billed_pct_goal: 0,
            team_billable_hours_goal: 0,
            team_avg_rate_goal: 0,
            personal_billed_pct_goal: 0,
            personal_logged_pct_goal: 0,
            personal_attendance_pct_goal: 0,
            personal_feedback_score_goal: 0,
          }
        );
      } catch (e: any) {
        setGoalsError(e?.message || "Failed to load team goals");
      } finally {
        setGoalsLoading(false);
      }
    };
    loadGoals();
  }, [goalsYearId]);

  const saveGoals = async () => {
    if (!goals) return;
    setBusyGoalsSave(true);
    try {
      const payload: any = {
        id: goals.id,
        fiscal_year_id: goalsYearId,
        department_tb_goal: Number(goals.department_tb_goal || 0),
        team_billed_pct_goal: Number(goals.team_billed_pct_goal || 0),
        team_billable_hours_goal: Number(goals.team_billable_hours_goal || 0),
        team_avg_rate_goal: Number(goals.team_avg_rate_goal || 0),
        personal_billed_pct_goal: Number(goals.personal_billed_pct_goal || 0),
        personal_logged_pct_goal: Number(goals.personal_logged_pct_goal || 0),
        personal_attendance_pct_goal: Number(goals.personal_attendance_pct_goal || 0),
        personal_feedback_score_goal: Number(goals.personal_feedback_score_goal || 0),
      };
      const { data, error } = await supabaseBrowser
        .from("team_goals")
        .upsert(payload, { onConflict: "fiscal_year_id" })
        .select("id, fiscal_year_id, department_tb_goal, team_billed_pct_goal, team_billable_hours_goal, team_avg_rate_goal, personal_billed_pct_goal, personal_logged_pct_goal, personal_attendance_pct_goal, personal_feedback_score_goal")
        .single();
      if (error) throw error;
      setGoals(data as any);
    } catch (e: any) {
      alert(e?.message || "Failed to save team goals");
    } finally {
      setBusyGoalsSave(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex gap-8">
        <aside className="w-64 shrink-0 border-r border-[var(--color-surface)]/40 pr-6 flex flex-col gap-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)]">Admin</h1>
            <div className="h-1 w-12 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/50 rounded-full" />
            {years.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-xs font-semibold text-[var(--color-text)]/60 uppercase tracking-wider">Active Fiscal Year</span>
                <select
                  className="border border-[var(--color-surface)] bg-[var(--color-bg)]/80 backdrop-blur-sm text-[var(--color-text)] rounded-lg h-10 px-3 text-sm font-medium shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
                  value={yearId}
                  onChange={(e) => setYearId(e.target.value)}
                >
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>{y.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            <button
              type="button"
              onClick={() => setSection("employees")}
              className={`text-left px-3 py-2 rounded-lg font-medium transition-all ${section === "employees" ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-md" : "text-[var(--color-text)]/70 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50"}`}
            >
              Employees (CMS)
            </button>
            <button
              type="button"
              onClick={() => setSection("fiscal")}
              className={`text-left px-3 py-2 rounded-lg font-medium transition-all ${section === "fiscal" ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-md" : "text-[var(--color-text)]/70 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50"}`}
            >
              Fiscal years
            </button>
            <button
              type="button"
              onClick={() => setSection("team")}
              className={`text-left px-3 py-2 rounded-lg font-medium transition-all ${section === "team" ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-md" : "text-[var(--color-text)]/70 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50"}`}
            >
              Team selection
            </button>
            <button
              type="button"
              onClick={() => setSection("charge")}
              className={`text-left px-3 py-2 rounded-lg font-medium transition-all ${section === "charge" ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-md" : "text-[var(--color-text)]/70 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50"}`}
            >
              Charge types
            </button>
            <button
              type="button"
              onClick={() => setSection("budgets")}
              className={`text-left px-3 py-2 rounded-lg font-medium transition-all ${section === "budgets" ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-md" : "text-[var(--color-text)]/70 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50"}`}
            >
              Budgets
            </button>
            <button
              type="button"
              onClick={() => setSection("goals")}
              className={`text-left px-3 py-2 rounded-lg font-medium transition-all ${section === "goals" ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-md" : "text-[var(--color-text)]/70 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50"}`}
            >
              Team goals
            </button>
            <button
              type="button"
              onClick={() => setSection("calculations")}
              className={`text-left px-3 py-2 rounded-lg font-medium transition-all ${section === "calculations" ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-md" : "text-[var(--color-text)]/70 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50"}`}
            >
              Calculations Guide
            </button>
            <button
              type="button"
              onClick={() => setSection("message-board")}
              className={`text-left px-3 py-2 rounded-lg font-medium transition-all ${section === "message-board" ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 shadow-md" : "text-[var(--color-text)]/70 hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]/50"}`}
            >
              Message Board
            </button>
          </nav>
        </aside>
        <main className="flex-1 space-y-8">
          {section === "employees" && (
            <>
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
                              <Input
                                value={(editing[e.id]?.name ?? e.name) || ""}
                                onChange={(ev) =>
                                  setEditing((s) => ({
                                    ...s,
                                    [e.id]: {
                                      ...(s[e.id] || { name: e.name, role: e.role }),
                                      name: ev.target.value,
                                    },
                                  }))
                                }
                              />
                            </td>
                            <td className="py-2">
                              <Input
                                value={(editing[e.id]?.role ?? (e.role || "")) || ""}
                                onChange={(ev) =>
                                  setEditing((s) => ({
                                    ...s,
                                    [e.id]: {
                                      ...(s[e.id] || { name: e.name, role: e.role }),
                                      role: ev.target.value,
                                    },
                                  }))
                                }
                              />
                            </td>
                            <td className="py-2 flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => saveEmployee(e.id)}
                                disabled={busyEmp || !editing[e.id]}
                              >
                                Save
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => router.push(`/employees/${e.id}`)}
                              >
                                Open card
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => deleteEmployee(e.id)}
                                disabled={!!deletingEmp[e.id]}
                              >
                                {deletingEmp[e.id] ? "Deleting..." : "Delete"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {section === "team" && (
            <>
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
            </>
          )}

          {section === "charge" && (
            <>
              {/* Charge Types */}
              <Card>
                <CardHeader>
                  <CardTitle>Included Charge Types</CardTitle>
                  <CardDescription>Which billable charge types count for Teams/Budgets for the selected FY (default: none)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const all: Record<string, boolean> = {};
                        chargeTypes.forEach((n) => {
                          all[n] = true;
                        });
                        setIncludedTypes(all);
                      }}
                    >
                      Select all
                    </Button>
                    <Button variant="outline" onClick={() => setIncludedTypes({})}>
                      Select none
                    </Button>
                    <Button onClick={saveChargeTypes} disabled={busyCT || !yearId}>
                      Save
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3 p-3 border rounded">
                    {chargeTypes.length === 0 && (
                      <span className="text-sm text-gray-500">No charge types found</span>
                    )}
                    {chargeTypes.map((ct) => (
                      <label key={ct} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!includedTypes[ct]}
                          onChange={(e) => setIncludedTypes((prev) => ({ ...prev, [ct]: e.target.checked }))}
                        />
                        <span>{ct}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {section === "budgets" && (
            <>
              {/* Budgets */}
              <Card>
                <CardHeader>
                  <CardTitle>IT Teckningsbidrag</CardTitle>
                  <CardDescription>
                    Store the department's teckningsbidrag for the selected budget fiscal year.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="text-sm block mb-1">Budget fiscal year</label>
                      <select
                        className="mt-1 w-full border border-[var(--color-surface)] bg-[var(--color-bg)] text-[var(--color-text)] rounded-md h-9 px-2 text-sm"
                        value={budgetYearId}
                        onChange={(e) => setBudgetYearId(e.target.value)}
                      >
                        {years.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm block mb-1">Billed hours fiscal year</label>
                      <select
                        className="mt-1 w-full border border-[var(--color-surface)] bg-[var(--color-bg)] text-[var(--color-text)] rounded-md h-9 px-2 text-sm"
                        value={budgetBilledYearId}
                        onChange={(e) => setBudgetBilledYearId(e.target.value)}
                        title="Billed hours fiscal year"
                      >
                        {years.map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {budgetLoading ? (
                    <p className="text-sm">Loading budget…</p>
                  ) : budgetError ? (
                    <p className="text-sm text-red-600">{budgetError}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="text-sm block mb-1">Teckningsbidrag (SEK)</label>
                          <Input
                            inputMode="decimal"
                            value={String(budget?.teckningsbidrag ?? 0)}
                            onChange={(e) =>
                              setBudget((b) => ({
                                ...(b as Budget),
                                teckningsbidrag: Number((e.target.value || "0").replace(",", ".")),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="text-sm block mb-1">
                            Total billed hours (selected employees, {years.find((y) => y.id === budgetBilledYearId)?.label || ""})
                          </label>
                          <Input value={budgetBilledHours.toFixed(2)} readOnly />
                        </div>
                        <div>
                          <label className="text-sm block mb-1">Avg billed hourly rate (SEK/h)</label>
                          <Input value={budgetAvgBilledRate.toFixed(2)} readOnly />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm block">Included billable charge types</label>
                        <div className="flex flex-wrap gap-3 p-3 border rounded-md">
                          {budgetChargeTypes.length === 0 && (
                            <span className="text-sm text-gray-500">No charge types found</span>
                          )}
                          {budgetChargeTypes.map((ct) => (
                            <span
                              key={ct}
                              className={budgetIncludedTypes[ct] ? "text-sm" : "text-sm opacity-50"}
                            >
                              {ct}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="text-sm block mb-1">
                            Total worked hours (selected employees, {years.find((y) => y.id === budgetBilledYearId)?.label || ""})
                          </label>
                          <Input value={budgetWorkedHours.toFixed(2)} readOnly />
                        </div>
                        <div>
                          <label className="text-sm block mb-1">%-billed hours (billed/worked)</label>
                          <Input value={`${budgetPctBilled.toFixed(1)}%`} readOnly />
                        </div>
                      </div>

                      <div>
                        <Button onClick={saveBudget} disabled={busyBudgetSave || !budget}>
                          Save
                        </Button>
                      </div>

                      <Separator className="my-4" />

                      <Card>
                        <CardHeader>
                          <CardTitle>Simulation</CardTitle>
                          <CardDescription>
                            How much would teckningsbidrag increase if we log more billable time at the current average
                            rate?
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <label className="text-sm block mb-1">
                              Extra billable hours: {budgetExtraHours} h
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={5000}
                              step={1}
                              value={budgetExtraHours}
                              onChange={(e) => setBudgetExtraHours(Number(e.target.value))}
                              className="w-full"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm block mb-1">Projected teckningsbidrag (SEK)</label>
                              <Input value={budgetProjected.newTB.toFixed(2)} readOnly />
                            </div>
                            <div>
                              <label className="text-sm block mb-1">TB increase (SEK)</label>
                              <Input value={budgetProjected.deltaTB.toFixed(2)} readOnly />
                            </div>
                            <div>
                              <label className="text-sm block mb-1">Projected billed hours</label>
                              <Input value={budgetProjected.newHours.toFixed(2)} readOnly />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm block mb-1">Projected %-billed hours</label>
                              <Input
                                value={`${(
                                  budgetWorkedHours
                                    ? Math.round(
                                        (((budgetBilledHours + budgetExtraHours) / budgetWorkedHours) * 100) * 10
                                      ) / 10
                                    : 0
                                ).toFixed(1)}%`}
                                readOnly
                              />
                            </div>
                            <div>
                              <label className="text-sm block mb-1">Projected avg billed rate (SEK/h)</label>
                              <Input
                                value={budgetProjected.projectedRate.toFixed(2)}
                                readOnly
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {section === "goals" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Team goals</CardTitle>
                  <CardDescription>
                    Set yearly goals for team and personal metrics. These are used on the Team goals page for all users.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="w-full max-w-xs">
                    <label className="text-sm block mb-1">Fiscal year</label>
                    <select
                      className="mt-1 w-full border border-[var(--color-surface)] bg-[var(--color-bg)] text-[var(--color-text)] rounded-md h-9 px-2 text-sm"
                      value={goalsYearId}
                      onChange={(e) => setGoalsYearId(e.target.value)}
                    >
                      {years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {goalsLoading ? (
                    <p className="text-sm">Loading goals…</p>
                  ) : goalsError ? (
                    <p className="text-sm text-red-600">{goalsError}</p>
                  ) : (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Department Teckningsbidrag Goal</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                          <div>
                            <label className="text-sm block mb-1">Department TB goal (SEK)</label>
                            <Input
                              inputMode="decimal"
                              value={String(goals?.department_tb_goal ?? 0)}
                              onChange={(e) =>
                                setGoals((g) => ({
                                  ...(g as TeamGoals),
                                  department_tb_goal: Number((e.target.value || "0").replace(",", ".")),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-sm block mb-1">Billable hours needed (at avg rate)</label>
                            <Input
                              value={
                                goals?.team_avg_rate_goal && goals.team_avg_rate_goal > 0
                                  ? (goals.department_tb_goal / goals.team_avg_rate_goal).toFixed(2)
                                  : "0.00"
                              }
                              readOnly
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Team</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                          <div>
                            <label className="text-sm block mb-1">Team billed % goal</label>
                            <Input
                              inputMode="decimal"
                              value={String(goals?.team_billed_pct_goal ?? 0)}
                              onChange={(e) =>
                                setGoals((g) => ({
                                  ...(g as TeamGoals),
                                  team_billed_pct_goal: Number((e.target.value || "0").replace(",", ".")),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-sm block mb-1">Avg billed rate goal (SEK/h)</label>
                            <Input
                              inputMode="decimal"
                              value={String(goals?.team_avg_rate_goal ?? 0)}
                              onChange={(e) =>
                                setGoals((g) => ({
                                  ...(g as TeamGoals),
                                  team_avg_rate_goal: Number((e.target.value || "0").replace(",", ".")),
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Personal (default goals)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                          <div>
                            <label className="text-sm block mb-1">Billed % goal</label>
                            <Input
                              inputMode="decimal"
                              value={String(goals?.personal_billed_pct_goal ?? 0)}
                              onChange={(e) =>
                                setGoals((g) => ({
                                  ...(g as TeamGoals),
                                  personal_billed_pct_goal: Number((e.target.value || "0").replace(",", ".")),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-sm block mb-1">Logged % goal</label>
                            <Input
                              inputMode="decimal"
                              value={String(goals?.personal_logged_pct_goal ?? 0)}
                              onChange={(e) =>
                                setGoals((g) => ({
                                  ...(g as TeamGoals),
                                  personal_logged_pct_goal: Number((e.target.value || "0").replace(",", ".")),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-sm block mb-1">Attendance % goal</label>
                            <Input
                              inputMode="decimal"
                              value={String(goals?.personal_attendance_pct_goal ?? 0)}
                              onChange={(e) =>
                                setGoals((g) => ({
                                  ...(g as TeamGoals),
                                  personal_attendance_pct_goal: Number((e.target.value || "0").replace(",", ".")),
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-sm block mb-1">Feedback score goal</label>
                            <Input
                              inputMode="decimal"
                              value={String(goals?.personal_feedback_score_goal ?? 0)}
                              onChange={(e) =>
                                setGoals((g) => ({
                                  ...(g as TeamGoals),
                                  personal_feedback_score_goal: Number((e.target.value || "0").replace(",", ".")),
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Button onClick={saveGoals} disabled={busyGoalsSave || !goals}>
                          Save goals
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
          {section === "calculations" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Calculations Guide</h2>
                <p className="text-sm text-[var(--color-text)]/60 font-medium mt-1">Documentation of all calculations throughout the application</p>
                <div className="h-1 w-12 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/50 rounded-full mt-2" />
              </div>

              {/* Dashboard Section */}
              <Card>
                <CardHeader>
                  <CardTitle>📊 Dashboard Page</CardTitle>
                  <CardDescription>Yearly summary and monthly breakdown calculations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-[var(--color-text)]">Yearly Summary</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">Worked Hours</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Sum of all worked hours from month_entries</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">SUM(worked)</code>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">Logged %</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Percentage of logged vs worked hours</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">(SUM(logged) / SUM(worked)) * 100</code>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">Billed %</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Percentage of billed vs worked hours</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">(SUM(billed) / SUM(worked)) * 100</code>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">Attendance %</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Percentage of worked vs available hours</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">(SUM(worked) / available_hours) * 100</code>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Section */}
              <Card>
                <CardHeader>
                  <CardTitle>👥 Team Page</CardTitle>
                  <CardDescription>Individual employee and team average calculations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-[var(--color-text)]">Individual Employees</h3>
                    <p className="text-sm text-[var(--color-text)]/70">Same calculations as Dashboard (Logged %, Billed %, Attendance %)</p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-[var(--color-text)]">Team Averages</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">% Logged (Team)</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Total logged ÷ total worked across all employees</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">(SUM(all_logged) / SUM(all_worked)) * 100</code>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">% Billed (Team)</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Total billed ÷ total worked across all employees</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">(SUM(all_billed) / SUM(all_worked)) * 100</code>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40 lg:col-span-2">
                        <p className="font-medium text-[var(--color-text)]">Attendance % (Team)</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">MEDIAN of all individual employee attendance percentages</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">MEDIAN(emp1.attendance%, emp2.attendance%, ...)</code>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Team Goals Section */}
              <Card>
                <CardHeader>
                  <CardTitle>🎯 Team Goals Page</CardTitle>
                  <CardDescription>Goal displays and progress calculations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-[var(--color-text)]">Key Calculations</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">Billable Hours Needed</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Department TB goal ÷ average billed rate goal</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">department_tb_goal / team_avg_rate_goal</code>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">Progress Bar %</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Current value ÷ goal value</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">(actual / goal) * 100</code>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Admin Section */}
              <Card>
                <CardHeader>
                  <CardTitle>⚙️ Admin Page</CardTitle>
                  <CardDescription>Goal settings and auto-calculated values</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-[var(--color-text)]">Auto-Calculated Fields</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">Billable Hours Needed</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Auto-calculated from Department TB goal ÷ Average rate goal</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">department_tb_goal / team_avg_rate_goal</code>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--color-surface)]/20 border border-[var(--color-surface)]/40">
                        <p className="font-medium text-[var(--color-text)]">Projected Avg Rate</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">Shows what rate would be with current settings</p>
                        <code className="text-xs bg-[var(--color-bg)] p-2 rounded mt-2 block text-[var(--color-primary)]">new_tb_goal / new_billable_hours_goal</code>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Color Coding Section */}
              <Card>
                <CardHeader>
                  <CardTitle>🎨 Color Coding Logic</CardTitle>
                  <CardDescription>RED / YELLOW / GREEN thresholds</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--color-text)]/70">All percentage values use the same color-coding logic based on goal comparison:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                        <p className="font-medium text-red-500">🔴 RED</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">20%+ below goal</p>
                        <p className="text-xs text-[var(--color-text)]/60 mt-1">Needs attention</p>
                      </div>
                      <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                        <p className="font-medium text-yellow-500">🟡 YELLOW</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">1-19% below goal</p>
                        <p className="text-xs text-[var(--color-text)]/60 mt-1">Slightly below target</p>
                      </div>
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                        <p className="font-medium text-green-500">🟢 GREEN</p>
                        <p className="text-sm text-[var(--color-text)]/70 mt-2">At or above goal</p>
                        <p className="text-xs text-[var(--color-text)]/60 mt-1">On track</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-xs text-[var(--color-text)]/50 text-right">
                Last updated: November 27, 2025
              </div>
            </div>
          )}

          {section === "message-board" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Message Board</CardTitle>
                  <CardDescription>Edit the message displayed on the home page</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm block mb-2 font-medium">Title</label>
                    <Input
                      value={messageTitle}
                      onChange={(e) => setMessageTitle(e.target.value)}
                      placeholder="e.g., Important Announcement"
                    />
                  </div>
                  <div>
                    <label className="text-sm block mb-2 font-medium">Message Content</label>
                    <textarea
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      placeholder="Enter your message here..."
                      className="w-full p-3 rounded-lg border border-[var(--color-text)]/20 bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]/50 min-h-[200px]"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      setMessageBusySave(true);
                      try {
                        const res = await fetch("/api/message-board", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: messageTitle, content: messageContent }),
                        });
                        if (!res.ok) throw new Error("Failed to save");
                        alert("Message saved successfully!");
                      } catch (err: unknown) {
                        const error = err as { message?: string };
                        alert(error?.message || "Failed to save message");
                      } finally {
                        setMessageBusySave(false);
                      }
                    }}
                    disabled={messageBusySave || !messageTitle || !messageContent}
                  >
                    {messageBusySave ? "Saving..." : "Save Message"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
