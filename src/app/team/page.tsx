"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
type FiscalYear = { id: string; label: string; available_hours: number | null };
type MonthEntry = { employee_id: string; fiscal_year_id: string; month_index: number; worked: number; logged: number; billed: number };

type Row = {
  id: string;
  name: string;
  role: string | null;
  worked: number;
  logged: number;
  billed: number;
  pctLogged: number;
  pctBilled: number;
  attendancePct: number;
};

export default function TeamPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [entries, setEntries] = useState<MonthEntry[]>([]);
  const [compareYearId, setCompareYearId] = useState<string>("");
  const [entriesCompare, setEntriesCompare] = useState<MonthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CSV import state
  const [showImport, setShowImport] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({}); // Agent -> employee_id
  const [importBusy, setImportBusy] = useState(false);
  const [importYearId, setImportYearId] = useState<string>("");
  const [selectedCols, setSelectedCols] = useState<{
    agent: string; day: string; raw: string; bill?: string; invoice?: string; plan?: string;
  }>({ agent: "Agent", day: "Day", raw: "Raw Time", bill: "Billable Time", invoice: "Invoice Number", plan: "Billing Plan" });

  const importStats = useMemo(() => {
    if (!showImport || csvHeaders.length === 0) return null as null | {
      mappedRows: number; months: number; employees: number; loggedHours: number; billedHours: number;
    };
    const lower = csvHeaders.map(h => h.toLowerCase());
    const agentIdx = lower.indexOf('agent');
    const rawIdx = lower.indexOf('raw time');
    const billIdx = lower.findIndex(h => h.includes('billable time'));
    const dayIdx = lower.indexOf('day');
    const invoiceIdx = lower.indexOf('invoice number');
    const planIdx = lower.indexOf('billing plan');
    if (agentIdx < 0 || rawIdx < 0 || dayIdx < 0) return null;
    const fy = years.find(y => y.id === importYearId);
    if (!fy) return null;
    const start = new Date(((fy as any).start_date || new Date(Date.UTC(Number((fy.label||'').split('/')[0]), 8, 1)).toISOString().slice(0,10)) + 'T00:00:00Z');
    const end = new Date(((fy as any).end_date || new Date(Date.UTC(Number((fy.label||'').split('/')[1]), 7, 31)).toISOString().slice(0,10)) + 'T23:59:59Z');
    const empSet = new Set<string>();
    const monthSet = new Set<string>();
    let mappedRows = 0, loggedHours = 0, billedHours = 0;
    for (const row of csvRows) {
      const agent = (row[agentIdx] || '').trim();
      const empId = agentMap[agent];
      if (!empId) continue;
      const dayIso = toISODate(row[dayIdx] || '');
      if (!dayIso) continue;
      const dt = new Date(dayIso + 'T00:00:00Z');
      if (dt < start || dt > end) continue;
      mappedRows++;
      empSet.add(empId);
      const fiscalIndex = ((dt.getUTCMonth() + 12) - 8) % 12;
      monthSet.add(`${empId}:${fiscalIndex}`);
      const rawStr = String(row[rawIdx] || '0').replace(',', '.');
      const rawH = Number(rawStr);
      if (Number.isFinite(rawH)) loggedHours += rawH;
      if (billIdx >= 0 && invoiceIdx >= 0 && planIdx >= 0) {
        const invoicePresent = String(row[invoiceIdx] || '').trim().length > 0;
        const planVal = String(row[planIdx] || '').trim().toLowerCase();
        if (invoicePresent && planVal === 'pay as you go') {
          const billStr = String(row[billIdx] || '0').replace(',', '.');
          const billH = Number(billStr);
          if (Number.isFinite(billH)) billedHours += billH;
        }
      }
    }
    return { mappedRows, months: monthSet.size, employees: empSet.size, loggedHours: Math.round(loggedHours*100)/100, billedHours: Math.round(billedHours*100)/100 };
  }, [showImport, csvHeaders, csvRows, agentMap, years, importYearId]);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: emps, error: e1 }, { data: fys, error: e2 }] = await Promise.all([
          supabaseBrowser.from("employees").select("id, name, role").order("name"),
          supabaseBrowser.from("fiscal_years").select("id, label, available_hours").order("start_date", { ascending: false }),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        setEmployees(emps as any);
        setYears(fys as any);
        const preferred = (fys as any[])[0]?.id as string | undefined;
        if (preferred) setYearId(preferred);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load team data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // CSV helpers moved to component scope
  function parseCsvFile(file: File) {
    return new Promise<{ headers: string[]; rows: string[][] }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || "");
          const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
          if (lines.length === 0) return resolve({ headers: [], rows: [] });
          const splitCsv = (line: string) => {
            const parts: string[] = [];
            let cur = '';
            let inQ = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (ch === '"') { inQ = !inQ; cur += ch; }
              else if (ch === ',' && !inQ) { parts.push(cur); cur = ''; }
              else { cur += ch; }
            }
            parts.push(cur);
            return parts.map(s => s.replace(/^\"|\"$/g, '').replace(/\"\"/g, '"'));
          };
          const headers = splitCsv(lines[0]).map(h => h.trim());
          const rows = lines.slice(1).map(splitCsv);
          resolve({ headers, rows });
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  const startImport = async (file: File) => {
    const { headers, rows } = await parseCsvFile(file);
    setCsvHeaders(headers);
    setCsvRows(rows);
    const agentIdx = headers.findIndex(h => h.toLowerCase() === 'agent');
    const m: Record<string, string> = {};
    if (agentIdx >= 0) {
      const uniqueAgents = Array.from(new Set(rows.map(r => (r[agentIdx] || '').trim()).filter(Boolean)));
      for (const a of uniqueAgents) {
        const emp = employees.find(e => e.name.toLowerCase() === a.toLowerCase());
        if (emp) m[a] = emp.id;
      }
    }
    // Merge with any saved mappings from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem('agent_map') || '{}') as Record<string,string>;
      Object.assign(m, saved);
    } catch {}
    setAgentMap(m);
    setImportYearId(yearId || (years[0]?.id ?? ''));
    // Initialize column picker with detected headers if present
    const lower = headers.map(h => h.toLowerCase());
    const detect = (keys: string[], fallback: string) => {
      for (const k of keys) { const i = lower.indexOf(k.toLowerCase()); if (i >= 0) return headers[i]; }
      return fallback;
    };
    setSelectedCols({
      agent: detect(["agent"], "Agent"),
      day: detect(["day", "date"], "Day"),
      raw: detect(["raw time", "raw", "time"], "Raw Time"),
      bill: detect(["billable time", "billable"], "Billable Time"),
      invoice: detect(["invoice number", "invoice"], "Invoice Number"),
      plan: detect(["billing plan", "plan"], "Billing Plan"),
    });
    setShowImport(true);
  };

  function toISODate(s: string) {
    const t = s.trim();
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]);
      const y = Number(m[3]);
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return dt.toISOString().slice(0,10);
    }
    const dt = new Date(t);
    if (isNaN(dt.getTime())) return '';
    return new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())).toISOString().slice(0,10);
  }

  const importLogged = async () => {
    if (!importYearId) { alert('Select a fiscal year'); return; }
    const idxOf = (name?: string) => name ? csvHeaders.findIndex(h => h === name) : -1;
    const agentIdx = idxOf(selectedCols.agent);
    const rawIdx = idxOf(selectedCols.raw);
    const billIdx = idxOf(selectedCols.bill);
    const dayIdx = idxOf(selectedCols.day);
    const invoiceIdx = idxOf(selectedCols.invoice);
    const planIdx = idxOf(selectedCols.plan);
    if (agentIdx < 0 || rawIdx < 0 || dayIdx < 0) { alert('CSV missing required columns: Agent, Raw Time, Day'); return; }

    const fy = years.find(y => y.id === importYearId);
    if (!fy) { alert('Fiscal year not found'); return; }
    const fyStart = new Date((fy as any).start_date || '');
    const fyEnd = new Date((fy as any).end_date || '');
    if (isNaN(fyStart.getTime()) || isNaN(fyEnd.getTime())) {
      const [y1, y2] = (fy.label || '').split('/').map(Number);
      (fy as any).start_date = new Date(Date.UTC(y1, 8, 1)).toISOString().slice(0,10);
      (fy as any).end_date = new Date(Date.UTC(y2, 7, 31)).toISOString().slice(0,10);
    }
    const start = new Date((fy as any).start_date + 'T00:00:00Z');
    const end = new Date((fy as any).end_date + 'T23:59:59Z');

    const agg: Record<string, number> = {};
    for (const row of csvRows) {
      const agent = (row[agentIdx] || '').trim();
      const empId = agentMap[agent];
      if (!empId) continue;
      const dayIso = toISODate(row[dayIdx] || '');
      if (!dayIso) continue;
      const dt = new Date(dayIso + 'T00:00:00Z');
      if (dt < start || dt > end) continue;
      const month = dt.getUTCMonth();
      const fiscalIndex = ((month + 12) - 8) % 12;
      const billedStr = String(row[billIdx] || '0').replace(',', '.');
      const hours = Number(billedStr);
      if (!Number.isFinite(hours)) continue;
      const key = `${empId}:${fiscalIndex}`;
      agg[key] = (agg[key] || 0) + hours;
    }

    const upserts: any[] = [];
    for (const key of Object.keys(agg)) {
      const [empId, idxStr] = key.split(':');
      upserts.push({
        employee_id: empId,
        fiscal_year_id: importYearId,
        month_index: Number(idxStr),
        logged: Math.round(agg[key] * 100) / 100,
      });
    }
    if (upserts.length === 0) { alert('Nothing to import for the selected mappings and year.'); return; }

    setImportBusy(true);
    try {
      const { data: existing, error: exErr } = await supabaseBrowser
        .from('month_entries')
        .select('id, employee_id, fiscal_year_id, month_index, worked, logged, billed')
        .eq('fiscal_year_id', importYearId);
      if (exErr) throw exErr;
      const map: Record<string, any> = {};
      (existing || []).forEach((e) => { map[`${e.employee_id}:${e.month_index}`] = e; });
      const payload = upserts.map((u) => {
        const ex = map[`${u.employee_id}:${u.month_index}`];
        return {
          ...(ex?.id ? { id: ex.id } : {}),
          employee_id: u.employee_id,
          fiscal_year_id: importYearId,
          month_index: u.month_index,
          worked: Number(ex?.worked || 0),
          logged: u.logged !== undefined ? Number(u.logged) : Number(ex?.logged || 0),
          billed: u.billed !== undefined ? Number(u.billed) : Number(ex?.billed || 0),
        };
      });
      const { error: upErr } = await supabaseBrowser
        .from('month_entries')
        .upsert(payload, { onConflict: 'employee_id,fiscal_year_id,month_index' });
      if (upErr) throw upErr;
      // Verify by reading back and comparing deltas
      const { data: after, error: afterErr } = await supabaseBrowser
        .from('month_entries')
        .select('employee_id, fiscal_year_id, month_index, worked, logged, billed')
        .eq('fiscal_year_id', importYearId);
      if (afterErr) throw afterErr;
      const afterMap: Record<string, any> = {};
      (after || []).forEach((e) => { afterMap[`${e.employee_id}:${e.month_index}`] = e; });
      let changed = 0, loggedSum = 0, billedSum = 0;
      for (const rec of payload) {
        const key = `${rec.employee_id}:${rec.month_index}`;
        const a = afterMap[key];
        const b = map[key];
        const beforeLogged = Number(b?.logged || 0);
        const beforeBilled = Number(b?.billed || 0);
        const afterLogged = Number(a?.logged || 0);
        const afterBilled = Number(a?.billed || 0);
        if (afterLogged !== beforeLogged || afterBilled !== beforeBilled) changed++;
        loggedSum += Math.max(0, afterLogged - beforeLogged);
        billedSum += Math.max(0, afterBilled - beforeBilled);
      }
      alert(`Import complete: changed ${changed} month rows · +${loggedSum.toFixed(2)} h logged · +${billedSum.toFixed(2)} h billed`);
      setShowImport(false);
      if (yearId === importYearId) {
        const { data, error } = await supabaseBrowser
          .from('month_entries')
          .select('employee_id, fiscal_year_id, month_index, worked, logged, billed')
          .eq('fiscal_year_id', yearId);
        if (!error) setEntries(data as any);
      }
    } catch (e: any) {
      alert(e?.message ?? 'Import failed');
    } finally {
      setImportBusy(false);
    }
  };

  useEffect(() => {
    const loadEntries = async () => {
      if (!yearId) { setEntries([]); return; }
      const { data, error } = await supabaseBrowser
        .from("month_entries")
        .select("employee_id, fiscal_year_id, month_index, worked, logged, billed")
        .eq("fiscal_year_id", yearId);
      if (error) {
        setError(error.message);
        return;
      }
      setEntries(data as any);
    };
    loadEntries();
  }, [yearId]);

  useEffect(() => {
    const loadEntries = async () => {
      if (!compareYearId) { setEntriesCompare([]); return; }
      const { data, error } = await supabaseBrowser
        .from("month_entries")
        .select("employee_id, fiscal_year_id, month_index, worked, logged, billed")
        .eq("fiscal_year_id", compareYearId);
      if (error) {
        setError(error.message);
        return;
      }
      setEntriesCompare(data as any);
    };
    loadEntries();
  }, [compareYearId]);

  const rows: Row[] = useMemo(() => {
    const fy = years.find((y) => y.id === yearId);
    const available = Number(fy?.available_hours ?? 0);
    const byEmp: Record<string, { worked: number; logged: number; billed: number }> = {};
    for (const e of entries) {
      const b = (byEmp[e.employee_id] ||= { worked: 0, logged: 0, billed: 0 });
      b.worked += Number(e.worked || 0);
      b.logged += Number(e.logged || 0);
      b.billed += Number(e.billed || 0);
    }
    return employees.map((emp) => {
      const agg = byEmp[emp.id] || { worked: 0, logged: 0, billed: 0 };
      const pctLogged = agg.worked ? Math.round((agg.logged / agg.worked) * 1000) / 10 : 0;
      const pctBilled = agg.worked ? Math.round((agg.billed / agg.worked) * 1000) / 10 : 0;
      const attendancePct = available > 0 ? Math.round((agg.worked / available) * 1000) / 10 : 0;
      return { id: emp.id, name: emp.name, role: emp.role, worked: agg.worked, logged: agg.logged, billed: agg.billed, pctLogged, pctBilled, attendancePct };
    });
  }, [employees, entries, years, yearId]);

  const teamAverages = useMemo(() => {
    if (rows.length === 0) return { pctLogged: 0, pctBilled: 0, attendancePct: 0 };
    const sum = rows.reduce((acc, r) => {
      acc.pctLogged += r.pctLogged;
      acc.pctBilled += r.pctBilled;
      acc.attendancePct += r.attendancePct;
      return acc;
    }, { pctLogged: 0, pctBilled: 0, attendancePct: 0 });
    return {
      pctLogged: Math.round((sum.pctLogged / rows.length) * 10) / 10,
      pctBilled: Math.round((sum.pctBilled / rows.length) * 10) / 10,
      attendancePct: Math.round((sum.attendancePct / rows.length) * 10) / 10,
    };
  }, [rows]);

  const monthlyChartData = useMemo(() => {
    const months = fiscalMonths();
    return months.map((m) => {
      const monthRowsA = entries.filter(e => e.month_index === m.index);
      const sumWorkedA = monthRowsA.reduce((acc, e) => acc + Number(e.worked || 0), 0);
      const sumLoggedA = monthRowsA.reduce((acc, e) => acc + Number(e.logged || 0), 0);
      const sumBilledA = monthRowsA.reduce((acc, e) => acc + Number(e.billed || 0), 0);
      const loggedPctA = sumWorkedA ? Math.round((sumLoggedA / sumWorkedA) * 1000) / 10 : 0;
      const billedPctA = sumWorkedA ? Math.round((sumBilledA / sumWorkedA) * 1000) / 10 : 0;

      const monthRowsB = entriesCompare.filter(e => e.month_index === m.index);
      const sumWorkedB = monthRowsB.reduce((acc, e) => acc + Number(e.worked || 0), 0);
      const sumLoggedB = monthRowsB.reduce((acc, e) => acc + Number(e.logged || 0), 0);
      const sumBilledB = monthRowsB.reduce((acc, e) => acc + Number(e.billed || 0), 0);
      const loggedPctB = sumWorkedB ? Math.round((sumLoggedB / sumWorkedB) * 1000) / 10 : 0;
      const billedPctB = sumWorkedB ? Math.round((sumBilledB / sumWorkedB) * 1000) / 10 : 0;

      return {
        name: m.label,
        loggedPct: loggedPctA,
        billedPct: billedPctA,
        loggedPctCompare: loggedPctB,
        billedPctCompare: billedPctB,
        loggedPctDelta: Math.round((loggedPctA - loggedPctB) * 10) / 10,
        billedPctDelta: Math.round((billedPctA - billedPctB) * 10) / 10,
      };
    });
  }, [entries, entriesCompare]);

  const exportCsv = () => {
    const fyLabel = years.find((y) => y.id === yearId)?.label || "";
    const header = ["Employee","Role","Worked","Logged","Billed","% Logged","% Billed","Attendance %","FY"].join(",");
    const lines = rows.map(r => [
      r.name,
      r.role ?? "",
      r.worked,
      r.logged,
      r.billed,
      r.pctLogged,
      r.pctBilled,
      r.attendancePct,
      fyLabel
    ].join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team_${fyLabel.replace(/\//g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDeltasCsv = () => {
    if (!compareYearId) return;
    const aLabel = years.find((y) => y.id === yearId)?.label || "";
    const bLabel = years.find((y) => y.id === compareYearId)?.label || "";
    const header = ["Month", `% Logged (${aLabel})`, `% Logged (${bLabel})`, `Δ % Logged`, `% Billed (${aLabel})`, `% Billed (${bLabel})`, `Δ % Billed`].join(",");
    const lines = monthlyChartData.map((m: any) => [
      m.name,
      m.loggedPct,
      m.loggedPctCompare,
      m.loggedPctDelta,
      m.billedPct,
      m.billedPctCompare,
      m.billedPctDelta,
    ].join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team_deltas_${aLabel.replace(/\//g,'-')}_vs_${bLabel.replace(/\//g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <nav className="bg-[var(--color-bg)] border-b border-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Team Overview</h1>
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
            {years.length > 0 ? (
              <select
                className="border border-[var(--color-surface)] bg-[var(--color-bg)] text-[var(--color-text)] rounded-md h-9 px-2 text-sm"
                value={compareYearId}
                onChange={(e) => setCompareYearId(e.target.value)}
              >
                <option value="">Compare year…</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>
            ) : null}
            <Button onClick={exportCsv}>Export CSV</Button>
            <Button variant="outline" onClick={exportDeltasCsv} disabled={!compareYearId}>Export Deltas CSV</Button>
            <Button variant="secondary" onClick={async () => {
              try {
                const agentMap = (() => {
                  try { return JSON.parse(localStorage.getItem('agent_map') || '{}'); } catch { return {}; }
                })();
                const res = await fetch('/api/halopsa/import', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fiscalYearId: yearId, agentMap }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json?.error || 'Sync failed');
                alert('HaloPSA sync started. Check server logs / Next.js route for progress.');
              } catch (e: any) {
                alert(e?.message || 'Failed to start sync');
              }
            }}>Sync from HaloPSA</Button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <div className="bg-red-900/30 text-red-300 p-3 rounded text-sm">{error}</div>
        ) : (
          <>
            {/* Import UI removed in favor of API-based sync */}
            <Card>
              <CardHeader>
                <CardTitle>Team Monthly %</CardTitle>
                <CardDescription>Average % Logged and % Billed per month (based on totals). Select a compare year to see differences.</CardDescription>
              </CardHeader>
              <CardContent style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyChartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', color: '#fff' }} />
                    <Legend />
                    <Line type="monotone" dataKey="loggedPct" stroke="#7ef9ff" strokeWidth={2} dot={false} name="% Logged" />
                    <Line type="monotone" dataKey="billedPct" stroke="#afff5f" strokeWidth={2} dot={false} name="% Billed" />
                    {compareYearId ? (
                      <>
                        <Line type="monotone" dataKey="loggedPctCompare" stroke="#ff9dff" strokeWidth={2} dot={false} name="% Logged (Compare)" />
                        <Line type="monotone" dataKey="billedPctCompare" stroke="#ffd166" strokeWidth={2} dot={false} name="% Billed (Compare)" />
                        <Line type="monotone" dataKey="loggedPctDelta" stroke="#00f5d4" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Δ % Logged" />
                        <Line type="monotone" dataKey="billedPctDelta" stroke="#f15bb5" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Δ % Billed" />
                      </>
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {compareYearId ? (
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Differences</CardTitle>
                  <CardDescription>Delta (primary - compare) per month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-[var(--color-surface)]">
                          <th className="py-2">Month</th>
                          <th className="py-2">Δ % Logged</th>
                          <th className="py-2">Δ % Billed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyChartData.map((m) => (
                          <tr key={m.name} className="border-b border-[var(--color-surface)]/60">
                            <td className="py-2">{m.name}</td>
                            <td className="py-2">{(m as any).loggedPctDelta}%</td>
                            <td className="py-2">{(m as any).billedPctDelta}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Team Metrics</CardTitle>
                <CardDescription>Yearly totals and percentages per employee</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-[var(--color-surface)]">
                        <th className="py-2">Employee</th>
                        <th className="py-2">Role</th>
                        <th className="py-2">Worked</th>
                        <th className="py-2">Logged</th>
                        <th className="py-2">Billed</th>
                        <th className="py-2">% Logged</th>
                        <th className="py-2">% Billed</th>
                        <th className="py-2">Attendance %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-[var(--color-surface)]/60">
                          <td className="py-2">{r.name}</td>
                          <td className="py-2">{r.role ?? "—"}</td>
                          <td className="py-2">{r.worked.toFixed(1)}</td>
                          <td className="py-2">{r.logged.toFixed(1)}</td>
                          <td className="py-2">{r.billed.toFixed(1)}</td>
                          <td className="py-2">{r.pctLogged}%</td>
                          <td className="py-2">{r.pctBilled}%</td>
                          <td className="py-2">{r.attendancePct}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="pt-3 font-semibold" colSpan={5}>Team average</td>
                        <td className="pt-3 font-semibold">{teamAverages.pctLogged}%</td>
                        <td className="pt-3 font-semibold">{teamAverages.pctBilled}%</td>
                        <td className="pt-3 font-semibold">{teamAverages.attendancePct}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
