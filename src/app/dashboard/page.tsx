"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type MonthEntry = {
  id?: string;
  employee_id: string;
  fiscal_year_id: string;
  month_index: number;
  worked: number;
  logged: number;
  billed: number;
  break_hours?: number;
  absence_hours?: number;
};

type FiscalYear = { id: string; label: string; start_date: string; end_date: string; available_hours?: number };

function decimalToHM(dec: number): string {
  if (!Number.isFinite(dec)) return "0:00";
  const sign = dec < 0 ? -1 : 1;
  const abs = Math.abs(dec);
  const hours = Math.floor(abs);
  const minutes = Math.round((abs - hours) * 60);
  const mm = minutes.toString().padStart(2, '0');
  return `${sign < 0 ? '-' : ''}${hours}:${mm}`;
}

function getMetricColor(value: number, goal: number): string {
  if (!goal) return "text-[var(--color-text)]";
  const diff = goal - value;
  const pctDiff = (diff / goal) * 100;
  if (pctDiff >= 20) return "text-red-500";
  if (pctDiff >= 1) return "text-yellow-500";
  return "text-green-500";
}

type TeamGoals = {
  personal_billed_pct_goal: number;
  personal_logged_pct_goal: number;
  personal_attendance_pct_goal: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<{ id: string; name: string } | null>(null);
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [entries, setEntries] = useState<MonthEntry[]>([]);
  const [goals, setGoals] = useState<TeamGoals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyHours, setMonthlyHours] = useState<Record<number, number>>({});
  const [completedBadges, setCompletedBadges] = useState<any[]>([]);

  const months = fiscalMonths();

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

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: sess } = await supabaseBrowser.auth.getSession();
        const userId = sess?.session?.user?.id;
        const userEmail = sess?.session?.user?.email;

        if (!userId) {
          router.push("/auth");
          return;
        }

        // Get employee linked to this user
        const { data: profiles, error: profErr } = await supabaseBrowser
          .from("app_profiles")
          .select("employee_id")
          .eq("user_id", userId)
          .single();

        if (profErr || !profiles?.employee_id) {
          setError("Employee profile not found. Contact your administrator.");
          setLoading(false);
          return;
        }

        // Get employee details
        const { data: emp, error: empErr } = await supabaseBrowser
          .from("employees")
          .select("id, name")
          .eq("id", profiles.employee_id)
          .single();

        if (empErr || !emp) {
          setError("Employee not found.");
          setLoading(false);
          return;
        }

        setEmployee({ id: emp.id, name: emp.name });

        // Load fiscal years
        const { data: fya, error: fyErr } = await supabaseBrowser
          .from("fiscal_years")
          .select("id, label, start_date, end_date, available_hours")
          .order("start_date", { ascending: false });

        if (fyErr) throw fyErr;
        setYears(fya as any);
        const preferred = (fya as any[])[0]?.id as string | undefined;
        if (preferred) setYearId(preferred);
      } catch (e: any) {
        setError(e?.message || "Failed to load user");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [router]);

  useEffect(() => {
    const loadEntries = async () => {
      if (!employee?.id || !yearId) return;
      try {
        const { data, error } = await supabaseBrowser
          .from("month_entries")
          .select("id, employee_id, fiscal_year_id, month_index, worked, logged, billed, break_hours, absence_hours")
          .eq("employee_id", employee.id)
          .eq("fiscal_year_id", yearId);

        if (error) throw error;

        const map: Record<number, MonthEntry> = {};
        (data as MonthEntry[]).forEach((d) => (map[d.month_index] = d));
        const full: MonthEntry[] = months.map((m) =>
          map[m.index] ?? {
            employee_id: employee.id,
            fiscal_year_id: yearId,
            month_index: m.index,
            worked: 0,
            logged: 0,
            billed: 0,
            break_hours: 0,
            absence_hours: 0,
          }
        );
        setEntries(full);
      } catch (e: any) {
        setError(e?.message || "Failed to load entries");
      }
    };

    loadEntries();
  }, [employee?.id, yearId]);

  useEffect(() => {
    const loadGoals = async () => {
      if (!yearId) {
        setGoals(null);
        return;
      }
      try {
        const { data, error } = await supabaseBrowser
          .from("team_goals")
          .select("personal_billed_pct_goal, personal_logged_pct_goal, personal_attendance_pct_goal")
          .eq("fiscal_year_id", yearId)
          .limit(1);
        if (error) throw error;
        const row = (data as any[])?.[0];
        setGoals(row || { personal_billed_pct_goal: 0, personal_logged_pct_goal: 0, personal_attendance_pct_goal: 0 });
      } catch (e: any) {
        // Goals not found, use defaults
        setGoals({ personal_billed_pct_goal: 0, personal_logged_pct_goal: 0, personal_attendance_pct_goal: 0 });
      }
    };
    loadGoals();
  }, [yearId]);

  useEffect(() => {
    const loadBadges = async () => {
      if (!employee?.id) return;
      const { data } = await supabaseBrowser
        .from("employee_badges")
        .select("assigned_at, badge:badges(*)")
        .eq("employee_id", employee.id)
        .order("assigned_at", { ascending: false });
      
      const formatted = (data || []).map((item: any) => item.badge);
      setCompletedBadges(formatted);
    };
    loadBadges();
  }, [employee?.id]);

  const chartData = months.map((m) => {
    const e = entries.find((x) => x.month_index === m.index);
    const worked = e?.worked ?? 0;
    const logged = e?.logged ?? 0;
    const billed = e?.billed ?? 0;
    const loggedPct = worked ? Math.round((logged / worked) * 1000) / 10 : 0;
    const billedPct = worked ? Math.round((billed / worked) * 1000) / 10 : 0;
    return { name: m.label, loggedPct, billedPct };
  });

  const totals = entries.reduce(
    (acc, e) => {
      acc.worked += e.worked || 0;
      acc.logged += e.logged || 0;
      acc.billed += e.billed || 0;
      acc.breakHours += e.break_hours || 0;
      acc.absenceHours += e.absence_hours || 0;
      return acc;
    },
    { worked: 0, logged: 0, billed: 0, breakHours: 0, absenceHours: 0 }
  );

  const pct = {
    loggedPct: totals.worked ? Math.round((totals.logged / totals.worked) * 1000) / 10 : 0,
    billedPct: totals.worked ? Math.round((totals.billed / totals.worked) * 1000) / 10 : 0,
  };

  const attendancePct = (() => {
    const fy = years.find(y => y.id === yearId);
    if (!fy) return 0;
    
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
    
    return availSum > 0 ? Math.round((workedSum / availSum) * 1000) / 10 : 0;
  })();

  if (loading) return <p className="p-6">Loading...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!employee) return <p className="p-6">Not found</p>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">{employee.name}</h1>
            <p className="text-sm text-[var(--color-text)]/60 font-medium">Your time tracking dashboard</p>
          </div>
          {years.length > 0 ? (
            <select
              className="border border-[var(--color-surface)] bg-[var(--color-bg)]/80 backdrop-blur-sm text-[var(--color-text)] rounded-lg h-10 px-3 text-sm font-medium shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
            </select>
          ) : null}
        </div>

        {/* Completed Quests Section */}
        {completedBadges.length > 0 && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Completed Quests</h2>
              <p className="text-sm text-[var(--color-text)]/60 font-medium mt-1">Badges earned by {employee?.name}</p>
              <div className="h-1 w-12 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/50 rounded-full mt-2" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {completedBadges.map((badge) => (
                <div key={badge.id} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl p-4 flex flex-col items-center text-center space-y-2 group-hover:border-[var(--color-primary)]/30 h-full">
                    <div className="w-12 h-12 relative group-hover:scale-110 transition-transform duration-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={badge.image_url} alt={badge.name} className="w-full h-full object-contain drop-shadow-sm" />
                    </div>
                    <div className="space-y-1 w-full">
                      <p className="text-xs font-bold text-[var(--color-text)] line-clamp-2 leading-tight">{badge.name}</p>
                      <p className="text-[10px] text-[var(--color-text)]/50 line-clamp-2 leading-tight">{badge.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Yearly Summary</h2>
            <p className="text-sm text-[var(--color-text)]/60 font-medium mt-1">Total hours and percentages for {years.find(y => y.id === yearId)?.label}</p>
            <div className="h-1 w-12 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/50 rounded-full mt-2" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-5 space-y-3 group-hover:border-[var(--color-primary)]/30 flex flex-col h-full">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10">
                  <span className="text-base">⏰</span>
                </div>
                <h3 className="text-xs font-semibold text-[var(--color-text)]/80">Worked</h3>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-2xl font-bold text-[var(--color-text)]">
                    {totals.worked.toFixed(1)}h
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-5 space-y-3 group-hover:border-[var(--color-primary)]/30 flex flex-col h-full">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10">
                  <span className="text-base">☕</span>
                </div>
                <h3 className="text-xs font-semibold text-[var(--color-text)]/80">Breaks</h3>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-2xl font-bold text-[var(--color-text)]">
                    {totals.breakHours.toFixed(1)}h
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-5 space-y-3 group-hover:border-[var(--color-primary)]/30 flex flex-col h-full">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10">
                  <span className="text-base">🏖️</span>
                </div>
                <h3 className="text-xs font-semibold text-[var(--color-text)]/80">Absence</h3>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-2xl font-bold text-[var(--color-text)]">
                    {totals.absenceHours.toFixed(1)}h
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-5 space-y-3 group-hover:border-[var(--color-primary)]/30 flex flex-col h-full">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10">
                  <span className="text-base">📝</span>
                </div>
                <h3 className="text-xs font-semibold text-[var(--color-text)]/80">Logged</h3>
                <div className="flex-1 flex flex-col justify-center">
                  <div className={`text-2xl font-bold ${getMetricColor(pct.loggedPct, goals?.personal_logged_pct_goal ?? 0)}`}>
                    {pct.loggedPct}%
                  </div>
                  <div className="text-xs text-[var(--color-text)]/60 font-medium mt-1">{totals.logged.toFixed(1)}h</div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-5 space-y-3 group-hover:border-[var(--color-primary)]/30 flex flex-col h-full">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10">
                  <span className="text-base">💼</span>
                </div>
                <h3 className="text-xs font-semibold text-[var(--color-text)]/80">Billed</h3>
                <div className="flex-1 flex flex-col justify-center">
                  <div className={`text-2xl font-bold ${getMetricColor(pct.billedPct, goals?.personal_billed_pct_goal ?? 0)}`}>
                    {pct.billedPct}%
                  </div>
                  <div className="text-xs text-[var(--color-text)]/60 font-medium mt-1">{totals.billed.toFixed(1)}h</div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-5 space-y-3 group-hover:border-[var(--color-primary)]/30 flex flex-col h-full">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-primary)]/10">
                  <span className="text-base">📊</span>
                </div>
                <h3 className="text-xs font-semibold text-[var(--color-text)]/80">Attendance</h3>
                <div className="flex-1 flex flex-col justify-center">
                  <div className={`text-2xl font-bold ${getMetricColor(
                    attendancePct,
                    goals?.personal_attendance_pct_goal ?? 0
                  )}`}>
                    {attendancePct}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Monthly Breakdown</h2>
            <div className="h-1 w-12 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/50 rounded-full mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {months.map((m) => {
              const e = entries.find((x) => x.month_index === m.index) ?? {
                employee_id: employee.id,
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
              const billedPct = e.worked ? Math.round((e.billed / e.worked) * 1000) / 10 : 0;
              return (
                <div key={m.index} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-5 space-y-3 group-hover:border-[var(--color-primary)]/30">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[var(--color-text)]">{m.label}</p>
                      <p className="text-xs text-[var(--color-text)]/60 font-medium">Avail: {availHours}h</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div>
                        <p className="text-[var(--color-text)]/60 text-xs font-medium">Worked</p>
                        <p className="font-semibold text-[var(--color-text)]">{(e.worked || 0).toFixed(1)}h</p>
                        <p className="text-xs text-[var(--color-text)]/50">{workedPct}%</p>
                      </div>
                      <div>
                        <p className="text-[var(--color-text)]/60 text-xs font-medium">Breaks</p>
                        <p className="font-semibold text-[var(--color-text)]">{(e.break_hours || 0).toFixed(1)}h</p>
                        <p className="text-xs text-[var(--color-text)]/50">{breakPct}%</p>
                      </div>
                      <div>
                        <p className="text-[var(--color-text)]/60 text-xs font-medium">Absence</p>
                        <p className="font-semibold text-[var(--color-text)]">{(e.absence_hours || 0).toFixed(1)}h</p>
                        <p className="text-xs text-[var(--color-text)]/50">{absencePct}%</p>
                      </div>
                      <div>
                        <p className="text-[var(--color-text)]/60 text-xs font-medium">Billed</p>
                        <p className="font-semibold text-[var(--color-text)]">{billedPct}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
