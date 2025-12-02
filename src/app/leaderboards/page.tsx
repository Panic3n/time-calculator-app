"use client";

import { useEffect, useState, useMemo } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type FiscalYear = { id: string; label: string; start_date: string; end_date: string };
type Employee = { id: string; name: string };

export default function LeaderboardsPage() {
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearId, setYearId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // Data states
  const [entries, setEntries] = useState<any[]>([]);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [teamGoal, setTeamGoal] = useState<number>(0);

  // Modal states
  const [selectedAgent, setSelectedAgent] = useState<{id: string, name: string} | null>(null);
  const [agentBadges, setAgentBadges] = useState<any[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);

  // Load initial data (years + employees)
  useEffect(() => {
    const init = async () => {
      const [{ data: fys }, { data: emps }] = await Promise.all([
        supabaseBrowser.from("fiscal_years").select("*").order("start_date", { ascending: false }),
        supabaseBrowser.from("employees").select("id, name")
      ]);
      
      setYears(fys || []);
      if (fys && fys.length > 0) setYearId(fys[0].id);
      setEmployees(emps || []);
      setLoading(false);
    };
    init();
  }, []);

  // Load leaderboard data when yearId changes
  useEffect(() => {
    const loadData = async () => {
      if (!yearId) return;
      
      // 1. Entries for billable/contribution
      const { data: entriesData } = await supabaseBrowser
        .from("month_entries")
        .select("employee_id, worked, billed")
        .eq("fiscal_year_id", yearId);
      setEntries(entriesData || []);

      // 2. Team Goal (for context)
      const { data: goalsData } = await supabaseBrowser
        .from("team_goals")
        .select("team_billable_hours_goal")
        .eq("fiscal_year_id", yearId)
        .single();
      setTeamGoal(goalsData?.team_billable_hours_goal || 0);

      // 3. Badges (Lifetime)
      const { data: badgesData } = await supabaseBrowser
        .from("employee_badges")
        .select("employee_id");
        
      const counts: Record<string, number> = {};
      (badgesData || []).forEach((r: any) => {
        counts[r.employee_id] = (counts[r.employee_id] || 0) + 1;
      });
      setBadgeCounts(counts);
    };
    loadData();
  }, [yearId]);

  // Calculations
  const topBilledPct = useMemo(() => {
    const map: Record<string, { worked: number; billed: number }> = {};
    entries.forEach(e => {
      if (!map[e.employee_id]) map[e.employee_id] = { worked: 0, billed: 0 };
      map[e.employee_id].worked += Number(e.worked || 0);
      map[e.employee_id].billed += Number(e.billed || 0);
    });

    let top = { id: "", val: -1 };
    Object.entries(map).forEach(([id, d]) => {
      if (d.worked > 0) {
        const pct = (d.billed / d.worked) * 100;
        if (pct > top.val) {
          top = { id, val: pct };
        }
      }
    });
    return top.val !== -1 ? top : null;
  }, [entries]);

  const topContribution = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(e => {
      map[e.employee_id] = (map[e.employee_id] || 0) + Number(e.billed || 0);
    });

    let top = { id: "", val: -1 };
    Object.entries(map).forEach(([id, val]) => {
      if (val > top.val) {
        top = { id, val };
      }
    });
    return top.val !== -1 ? top : null;
  }, [entries]);

  const badgeLeaderboard = useMemo(() => {
    return Object.entries(badgeCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([id, count]) => ({ id, count }));
  }, [badgeCounts]);

  const getName = (id: string) => employees.find(e => e.id === id)?.name || "Unknown Agent";

  const handleAgentClick = async (agentId: string) => {
    const name = getName(agentId);
    setSelectedAgent({ id: agentId, name });
    setLoadingBadges(true);
    try {
      const { data } = await supabaseBrowser
        .from("employee_badges")
        .select("badge:badges(*)")
        .eq("employee_id", agentId);
      setAgentBadges((data || []).map((x: any) => x.badge));
    } catch {
      setAgentBadges([]);
    } finally {
      setLoadingBadges(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10 flex items-center justify-center">
        <p className="text-[var(--color-text)]/60">Loading leaderboards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-2 text-center sm:text-left">
            <h1 className="text-4xl font-bold text-[var(--color-text)] tracking-tight">Leaderboards 🏆</h1>
            <p className="text-lg text-[var(--color-text)]/60">Top performers and achievements</p>
          </div>
          <div className="w-full sm:w-auto">
            <select
              className="w-full sm:w-64 border border-[var(--color-surface)] bg-[var(--color-bg)]/80 backdrop-blur-sm text-[var(--color-text)] rounded-lg h-10 px-3 text-sm font-medium shadow-md hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/50"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 1. Most Billable % (Premium Card) */}
          <div className="space-y-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[var(--color-text)]">Efficiency Champion ⚡</h2>
              <p className="text-sm text-[var(--color-text)]/60">Highest billable percentage</p>
            </div>
            
            <div className="group relative h-64">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 via-orange-500/20 to-yellow-400/20 rounded-3xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity duration-500 animate-pulse" />
              <div className="relative h-full backdrop-blur-md bg-[var(--color-surface)]/40 border border-yellow-500/30 shadow-2xl rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 group-hover:border-yellow-500/50 group-hover:scale-[1.02] transition-all duration-300">
                {topBilledPct ? (
                  <>
                    <div className="text-6xl mb-2">👑</div>
                    <div>
                      <h3 className="text-3xl font-bold text-[var(--color-text)]">{getName(topBilledPct.id)}</h3>
                      <p className="text-[var(--color-primary)] font-medium mt-1">#1 Efficiency</p>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-extrabold text-yellow-500 drop-shadow-sm">{topBilledPct.val.toFixed(1)}%</span>
                      <span className="text-sm text-[var(--color-text)]/60">billable</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[var(--color-text)]/60">No data available</p>
                )}
              </div>
            </div>
          </div>

          {/* 2. Highest Contribution (Premium Card) */}
          <div className="space-y-6">
             <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[var(--color-text)]">The MVP 🌟</h2>
              <p className="text-sm text-[var(--color-text)]/60">Highest contribution to team goals</p>
            </div>

            <div className="group relative h-64">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 via-indigo-500/20 to-blue-400/20 rounded-3xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity duration-500 animate-pulse" />
              <div className="relative h-full backdrop-blur-md bg-[var(--color-surface)]/40 border border-blue-500/30 shadow-2xl rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4 group-hover:border-blue-500/50 group-hover:scale-[1.02] transition-all duration-300">
                {topContribution ? (
                  <>
                    <div className="text-6xl mb-2">🚀</div>
                    <div>
                      <h3 className="text-3xl font-bold text-[var(--color-text)]">{getName(topContribution.id)}</h3>
                      <p className="text-blue-400 font-medium mt-1">#1 Contributor</p>
                    </div>
                    <div className="mt-2">
                      <span className="text-xl font-bold text-blue-400 drop-shadow-sm">Top Billable Performance</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[var(--color-text)]/60">No data available</p>
                )}
              </div>
            </div>
          </div>

        </div>

        <div className="h-px w-full bg-[var(--color-border)]" />

        {/* 3. Badge Leaderboard (List) */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-[var(--color-text)]">Badge Collectors 🎖️</h2>
            <p className="text-[var(--color-text)]/60">Most badges earned (All time). Click to view details.</p>
          </div>

          <Card className="max-w-3xl mx-auto bg-[var(--color-surface)]/50 backdrop-blur-sm border-[var(--color-border)] shadow-xl overflow-hidden">
            <CardContent className="p-0">
              {badgeLeaderboard.length > 0 ? (
                <div className="divide-y divide-[var(--color-border)]">
                  {badgeLeaderboard.map((item, index) => (
                    <div 
                      key={item.id} 
                      onClick={() => handleAgentClick(item.id)}
                      className={`flex items-center justify-between p-6 hover:bg-[var(--color-surface)] transition-colors cursor-pointer ${
                        index === 0 ? "bg-yellow-500/5" : 
                        index === 1 ? "bg-gray-400/5" : 
                        index === 2 ? "bg-orange-500/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-6">
                        <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg ${
                          index === 0 ? "bg-yellow-500/20 text-yellow-500" :
                          index === 1 ? "bg-gray-400/20 text-gray-400" :
                          index === 2 ? "bg-orange-500/20 text-orange-500" :
                          "bg-[var(--color-surface)] text-[var(--color-text)]/60"
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className={`font-bold text-lg ${index < 3 ? "text-[var(--color-text)]" : "text-[var(--color-text)]/80"}`}>
                            {getName(item.id)}
                          </span>
                          {index === 0 && <span className="text-xs text-yellow-500 font-medium">Grandmaster Collector</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-[var(--color-bg)] px-4 py-2 rounded-full border border-[var(--color-border)]">
                        <span className="text-2xl">🛡️</span>
                        <span className="font-bold text-xl text-[var(--color-text)]">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-[var(--color-text)]/60">
                  No badges collected yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Agent Badge Modal */}
        {selectedAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedAgent(null)}>
            <div 
              className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-8 animate-in zoom-in-95 duration-200" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8 sticky top-0 bg-[var(--color-bg)] z-10 pb-4 border-b border-[var(--color-border)]">
                <div>
                  <h2 className="text-3xl font-bold text-[var(--color-text)]">{selectedAgent.name}&apos;s Trophy Case</h2>
                  <p className="text-[var(--color-text)]/60 mt-1">Total Badges: {agentBadges.length}</p>
                </div>
                <button 
                  onClick={() => setSelectedAgent(null)} 
                  className="p-2 hover:bg-[var(--color-surface)] rounded-full transition-colors"
                >
                  <span className="text-2xl">✕</span>
                </button>
              </div>
              
              {loadingBadges ? (
                <div className="py-20 text-center text-[var(--color-text)]/60">Loading badges...</div>
              ) : agentBadges.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {agentBadges.map((badge) => (
                    <div key={badge.id} className="group relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl p-4 flex flex-col items-center text-center space-y-3 group-hover:border-[var(--color-primary)]/30 h-full">
                        <div className="w-20 h-20 relative group-hover:scale-110 transition-transform duration-300">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={badge.image_url} alt={badge.name} className="w-full h-full object-contain drop-shadow-md" />
                        </div>
                        <div className="space-y-1 w-full">
                          <p className="font-bold text-sm text-[var(--color-text)] leading-tight">{badge.name}</p>
                          <p className="text-xs text-[var(--color-text)]/50 line-clamp-2 leading-tight">{badge.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-[var(--color-text)]/40 italic">
                  No badges found for this agent.
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
