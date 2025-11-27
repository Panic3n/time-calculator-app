"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fiscalMonths } from "@/lib/fiscal";

type FiscalYear = { id: string; label: string; available_hours: number | null };

type TeamGoals = {
  id?: string;
  fiscal_year_id: string;
  department_tb_goal: number;
  team_billed_pct_goal: number;
  team_billable_hours_goal: number;
  team_avg_rate_goal: number;
  personal_billed_pct_goal: number;
  personal_attendance_pct_goal: number;
  personal_feedback_score_goal: number;
};

export default function TeamGoalsPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<{ id: string; name: string } | null>(null);
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [goals, setGoals] = useState<TeamGoals | null>(null);
  const [entriesTeam, setEntriesTeam] = useState<any[]>([]);
  const [entriesPersonal, setEntriesPersonal] = useState<any[]>([]);
  const [includedIds, setIncludedIds] = useState<string[]>([]);
  const [feedbackScore, setFeedbackScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const months = fiscalMonths();

  useEffect(() => {
    const loadUserAndYears = async () => {
      try {
        const { data: sess } = await supabaseBrowser.auth.getSession();
        const userId = sess?.session?.user?.id;
        if (!userId) {
          router.push("/auth");
          return;
        }

        const { data: profile, error: profErr } = await supabaseBrowser
          .from("app_profiles")
          .select("employee_id")
          .eq("user_id", userId)
          .single();
        if (profErr || !profile?.employee_id) {
          setError("Employee profile not found. Contact your administrator.");
          setLoading(false);
          return;
        }

        const { data: emp, error: empErr } = await supabaseBrowser
          .from("employees")
          .select("id, name")
          .eq("id", profile.employee_id)
          .single();
        if (empErr || !emp) {
          setError("Employee not found.");
          setLoading(false);
          return;
        }
        setEmployee({ id: emp.id, name: emp.name });

        const { data: fys, error: fyErr } = await supabaseBrowser
          .from("fiscal_years")
          .select("id, label, available_hours")
          .order("start_date", { ascending: false });
        if (fyErr) throw fyErr;
        setYears(fys as any);
        const preferred = (fys as any[])?.[0]?.id as string | undefined;
        if (preferred) setYearId(preferred);
      } catch (e: any) {
        setError(e?.message || "Failed to load data");
        setLoading(false);
      }
    };
    loadUserAndYears();
  }, [router]);

  // Load goals when fiscal year changes
  useEffect(() => {
    const loadGoals = async () => {
      if (!yearId) return;
      try {
        const { data, error } = await supabaseBrowser
          .from("team_goals")
          .select("id, fiscal_year_id, department_tb_goal, team_billed_pct_goal, team_billable_hours_goal, team_avg_rate_goal, personal_billed_pct_goal, personal_attendance_pct_goal, personal_feedback_score_goal")
          .eq("fiscal_year_id", yearId)
          .limit(1);
        if (error) throw error;
        const row = (data as any[])?.[0];
        setGoals(row || null);
      } catch (e: any) {
        setError(e?.message || "Failed to load goals");
      }
    };
    loadGoals();
  }, [yearId]);

  // Load included employees and team entries
  useEffect(() => {
    const loadTeamEntries = async () => {
      if (!yearId) return;
      try {
        const resp = await fetch(`/api/admin/team-included?fiscal_year_id=${yearId}`, { cache: "no-store" });
        const json = await resp.json();
        const ids: string[] = (json?.rows || []).map((r: any) => String(r.employee_id));
        setIncludedIds(ids);
        if (!ids.length) {
          setEntriesTeam([]);
          return;
        }
        const { data, error } = await supabaseBrowser
          .from("month_entries")
          .select("employee_id, fiscal_year_id, month_index, worked, logged, billed")
          .eq("fiscal_year_id", yearId)
          .in("employee_id", ids);
        if (error) throw error;
        setEntriesTeam(data as any[]);
      } catch (e: any) {
        setError(e?.message || "Failed to load team entries");
      }
    };
    loadTeamEntries();
  }, [yearId]);

  // Load personal entries and feedback
  useEffect(() => {
    const loadPersonal = async () => {
      if (!employee?.id || !yearId) return;
      try {
        const { data, error } = await supabaseBrowser
          .from("month_entries")
          .select("employee_id, fiscal_year_id, month_index, worked, logged, billed")
          .eq("employee_id", employee.id)
          .eq("fiscal_year_id", yearId);
        if (error) throw error;
        setEntriesPersonal(data as any[]);

        // Optional: feedback score stored in employee_feedback table (if you sync it from Halo)
        const { data: fb } = await supabaseBrowser
          .from("employee_feedback")
          .select("score")
          .eq("employee_id", employee.id)
          .eq("fiscal_year_id", yearId)
          .maybeSingle?.();
        const scoreVal = (fb as any)?.score;
        setFeedbackScore(typeof scoreVal === "number" ? scoreVal : null);
      } catch (e: any) {
        // Feedback is optional; only surface hard errors from entries
        setError(e?.message || "Failed to load personal data");
      } finally {
        setLoading(false);
      }
    };
    loadPersonal();
  }, [employee?.id, yearId]);

  const teamTotals = useMemo(() => {
    if (!entriesTeam.length || !includedIds.length) return { worked: 0, billed: 0, billedPct: 0 };
    const agg = entriesTeam.reduce(
      (acc, e) => {
        if (!includedIds.includes(e.employee_id)) return acc;
        acc.worked += Number(e.worked || 0);
        acc.billed += Number(e.billed || 0);
        return acc;
      },
      { worked: 0, billed: 0 }
    );
    const billedPct = agg.worked ? Math.round((agg.billed / agg.worked) * 1000) / 10 : 0;
    return { ...agg, billedPct };
  }, [entriesTeam, includedIds]);

  const personalTotals = useMemo(() => {
    if (!entriesPersonal.length) return { worked: 0, logged: 0, billed: 0, billedPct: 0 };
    const agg = entriesPersonal.reduce(
      (acc, e) => {
        acc.worked += Number(e.worked || 0);
        acc.logged += Number(e.logged || 0);
        acc.billed += Number(e.billed || 0);
        return acc;
      },
      { worked: 0, logged: 0, billed: 0 }
    );
    const billedPct = agg.worked ? Math.round((agg.billed / agg.worked) * 1000) / 10 : 0;
    return { ...agg, billedPct };
  }, [entriesPersonal]);

  const attendancePct = useMemo(() => {
    const fy = years.find((y) => y.id === yearId);
    const avail = Number(fy?.available_hours ?? 0);
    if (!avail) return 0;
    return Math.round(((personalTotals.worked || 0) / avail) * 1000) / 10;
  }, [years, yearId, personalTotals.worked]);

  // For avg billed rate we reuse the same idea as Budgets: TB / billed hours, if available
  const [avgRate, setAvgRate] = useState<number>(0);
  useEffect(() => {
    const loadBudgetRate = async () => {
      if (!yearId) return;
      try {
        const { data, error } = await supabaseBrowser
          .from("it_budgets")
          .select("teckningsbidrag")
          .eq("fiscal_year_id", yearId)
          .eq("department", "IT")
          .limit(1);
        if (error) throw error;
        const tb = Number(((data as any[])?.[0]?.teckningsbidrag) || 0);
        const hrs = Number(teamTotals.billed || 0);
        if (!hrs) {
          setAvgRate(0);
        } else {
          setAvgRate(Math.round((tb / hrs) * 100) / 100);
        }
      } catch {
        setAvgRate(0);
      }
    };
    loadBudgetRate();
  }, [yearId, teamTotals.billed]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!employee) return <p className="p-6">Not found</p>;

  const currentYearLabel = years.find((y) => y.id === yearId)?.label || "";

  const teamBilledGoal = goals?.team_billed_pct_goal ?? 0;
  const teamRateGoal = goals?.team_avg_rate_goal ?? 0;
  // Calculate billable hours needed from department TB goal and avg rate
  const teamHoursGoal =
    goals?.department_tb_goal && goals.team_avg_rate_goal && goals.team_avg_rate_goal > 0
      ? goals.department_tb_goal / goals.team_avg_rate_goal
      : goals?.team_billable_hours_goal ?? 0;

  const personalBilledGoal = goals?.personal_billed_pct_goal ?? 0;
  const personalAttendanceGoal = goals?.personal_attendance_pct_goal ?? 0;
  const personalFeedbackGoal = goals?.personal_feedback_score_goal ?? 0;

  const pctProgress = (value: number, goal: number) => {
    if (!goal) return 0;
    return Math.max(0, Math.min(100, Math.round((value / goal) * 100)));
  };

  const getMetricColor = (value: number, goal: number) => {
    if (!goal) return "text-[var(--color-text)]";
    const diff = goal - value;
    const pctDiff = (diff / goal) * 100;
    if (pctDiff >= 20) return "text-red-500";
    if (pctDiff >= 1) return "text-yellow-500";
    return "text-green-500";
  };

  const ProgressBar = ({ value }: { value: number }) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    return (
      <div className="space-y-2">
        <div className="relative h-2.5 w-48 rounded-full bg-gradient-to-r from-[var(--color-surface)]/30 to-[var(--color-surface)]/50 overflow-hidden shadow-md">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/5 to-transparent" />
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)] to-[var(--color-primary)]/70 shadow-lg transition-all duration-500 ease-out relative"
            style={{ width: `${clampedValue}%` }}
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-[var(--color-text)]/50">0%</span>
          <span className="text-xs font-semibold text-[var(--color-primary)]">{clampedValue.toFixed(0)}%</span>
          <span className="text-xs font-medium text-[var(--color-text)]/50">100%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text)]">Team Goals</h1>
            <p className="text-sm text-[var(--color-text)]/60 font-medium">
              {employee.name} · <span className="text-[var(--color-primary)]">{currentYearLabel}</span>
            </p>
          </div>
          {years.length > 0 && (
            <select
              className="border border-[var(--color-surface)] bg-[var(--color-bg)]/80 backdrop-blur-sm text-[var(--color-text)] rounded-lg h-10 px-3 text-sm font-medium shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-8">
          {/* Team Section */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Team Performance</h2>
              <div className="h-1 w-12 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/50 rounded-full mt-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Card className="aspect-square relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:border-[var(--color-primary)]/30">
                  <CardContent className="h-full flex items-center justify-center p-6">
                    <div className="space-y-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-primary)]/10">
                        <span className="text-lg">💰</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--color-text)]/80">Department TB Goal</h3>
                      <div className="text-3xl font-bold text-[var(--color-text)]">
                        {(goals?.department_tb_goal ?? 0).toLocaleString("sv-SE", { maximumFractionDigits: 0 })} SEK
                      </div>
                      <div className="text-xs text-[var(--color-text)]/60 font-medium">
                        {goals?.team_avg_rate_goal && goals.team_avg_rate_goal > 0
                          ? `${(goals.department_tb_goal / goals.team_avg_rate_goal).toFixed(1)} h needed`
                          : "Set avg rate"}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Card className="aspect-square relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:border-[var(--color-primary)]/30">
                  <CardContent className="h-full flex items-center justify-center p-6">
                    <div className="space-y-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-primary)]/10">
                        <span className="text-lg">📊</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--color-text)]/80">Team Billed %</h3>
                      <div className={`text-3xl font-bold ${getMetricColor(teamTotals.billedPct, teamBilledGoal)}`}>
                        {teamTotals.billedPct.toFixed(1)}%
                      </div>
                      <div className="text-xs text-[var(--color-text)]/60 font-medium">Goal: {teamBilledGoal.toFixed(1)}%</div>
                      <ProgressBar value={pctProgress(teamTotals.billedPct, teamBilledGoal)} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Card className="aspect-square relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:border-[var(--color-primary)]/30">
                  <CardContent className="h-full flex items-center justify-center p-6">
                    <div className="space-y-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-primary)]/10">
                        <span className="text-lg">⏱️</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--color-text)]/80">Billable Hours</h3>
                      <div className={`text-3xl font-bold ${getMetricColor(teamTotals.billed, teamHoursGoal)}`}>
                        {teamTotals.billed.toFixed(1)} h
                      </div>
                      <div className="text-xs text-[var(--color-text)]/60 font-medium">Goal: {teamHoursGoal.toFixed(1)} h</div>
                      <ProgressBar value={pctProgress(teamTotals.billed, teamHoursGoal)} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Card className="aspect-square relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:border-[var(--color-primary)]/30">
                  <CardContent className="h-full flex items-center justify-center p-6">
                    <div className="space-y-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-primary)]/10">
                        <span className="text-lg">💵</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--color-text)]/80">Avg Hourly Rate</h3>
                      <div className={`text-3xl font-bold ${getMetricColor(avgRate, teamRateGoal)}`}>
                        {avgRate.toFixed(2)} SEK/h
                      </div>
                      <div className="text-xs text-[var(--color-text)]/60 font-medium">Goal: {teamRateGoal.toFixed(2)} SEK/h</div>
                      <ProgressBar value={pctProgress(avgRate, teamRateGoal)} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Personal Section */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">Personal Metrics</h2>
              <div className="h-1 w-12 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary)]/50 rounded-full mt-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Card className="aspect-square relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:border-[var(--color-primary)]/30">
                  <CardContent className="h-full flex items-center justify-center p-6">
                    <div className="space-y-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-primary)]/10">
                        <span className="text-lg">👤</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--color-text)]/80">Your Billed %</h3>
                      <div className={`text-3xl font-bold ${getMetricColor(personalTotals.billedPct, personalBilledGoal)}`}>
                        {personalTotals.billedPct.toFixed(1)}%
                      </div>
                      <div className="text-xs text-[var(--color-text)]/60 font-medium">Goal: {personalBilledGoal.toFixed(1)}%</div>
                      <ProgressBar value={pctProgress(personalTotals.billedPct, personalBilledGoal)} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Card className="aspect-square relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:border-[var(--color-primary)]/30">
                  <CardContent className="h-full flex items-center justify-center p-6">
                    <div className="space-y-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-primary)]/10">
                        <span className="text-lg">📅</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--color-text)]/80">Attendance %</h3>
                      <div className={`text-3xl font-bold ${getMetricColor(attendancePct, personalAttendanceGoal)}`}>
                        {attendancePct.toFixed(1)}%
                      </div>
                      <div className="text-xs text-[var(--color-text)]/60 font-medium">Goal: {personalAttendanceGoal.toFixed(1)}%</div>
                      <ProgressBar value={pctProgress(attendancePct, personalAttendanceGoal)} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <Card className="aspect-square relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 group-hover:border-[var(--color-primary)]/30">
                  <CardContent className="h-full flex items-center justify-center p-6">
                    <div className="space-y-4 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-primary)]/10">
                        <span className="text-lg">⭐</span>
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--color-text)]/80">Feedback Score</h3>
                      <div className={`text-3xl font-bold ${getMetricColor(feedbackScore ?? 0, personalFeedbackGoal)}`}>
                        {feedbackScore != null ? feedbackScore.toFixed(1) : "--"}
                      </div>
                      <div className="text-xs text-[var(--color-text)]/60 font-medium">Goal: {personalFeedbackGoal.toFixed(1)}</div>
                      <ProgressBar
                        value={
                          feedbackScore != null ? pctProgress(feedbackScore, personalFeedbackGoal || (feedbackScore || 1)) : 0
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
