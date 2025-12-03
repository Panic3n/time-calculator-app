import { NextResponse } from "next/server";
import { haloFetch } from "@/lib/halo";

// Debug endpoint to inspect what feedback data HaloPSA returns
// GET /api/halopsa/debug-feedback?agent_id=5
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id") || "";
  
  const results: Record<string, any> = {
    agentId,
    endpoints: {},
    agentFeedbackScores: {},
  };
  
  // Fetch all feedback
  let allFeedback: any[] = [];
  try {
    const feedbackData = await haloFetch("Feedback", { query: { pageinate: "false", count: "5000" } });
    allFeedback = Array.isArray(feedbackData) ? feedbackData : (feedbackData?.records || []);
    results.endpoints.Feedback = {
      success: true,
      totalCount: allFeedback.length,
      sample: allFeedback.slice(0, 5),
    };
  } catch (e: any) {
    results.endpoints.Feedback = { success: false, error: e?.message };
  }
  
  // Fetch all agents
  let allAgents: any[] = [];
  try {
    const agentData = await haloFetch("Agent", { query: {} });
    allAgents = Array.isArray(agentData) ? agentData : (agentData?.records || []);
    results.endpoints.Agent = {
      success: true,
      count: allAgents.length,
      sample: allAgents.slice(0, 3).map((a: any) => ({ id: a.id, name: a.name })),
    };
  } catch (e: any) {
    results.endpoints.Agent = { success: false, error: e?.message };
  }
  
  // Build ticket_id -> agent_id map by fetching tickets with feedback
  // We need to get tickets that have feedback to link feedback scores to agents
  const ticketAgentMap: Record<number, number> = {};
  try {
    // Fetch tickets - we'll need to batch this or use a report
    // For now, fetch recent tickets and build a map
    const ticketsData = await haloFetch("Tickets", { 
      query: { 
        count: "5000",
        includeclosed: "true"
      } 
    });
    const tickets = Array.isArray(ticketsData) ? ticketsData : (ticketsData?.tickets || []);
    for (const t of tickets) {
      if (t.id && t.agent_id) {
        ticketAgentMap[t.id] = t.agent_id;
      }
    }
    results.ticketCount = tickets.length;
  } catch (e: any) {
    results.ticketError = e?.message;
  }
  
  // Calculate average feedback score per agent (all time)
  const agentScores: Record<number, { total: number; count: number; scores: number[] }> = {};
  
  for (const fb of allFeedback) {
    const ticketId = fb.ticket_id;
    const score = Number(fb.score);
    if (!ticketId || isNaN(score)) continue;
    
    const agentIdForTicket = ticketAgentMap[ticketId];
    if (!agentIdForTicket) continue;
    
    if (!agentScores[agentIdForTicket]) {
      agentScores[agentIdForTicket] = { total: 0, count: 0, scores: [] };
    }
    agentScores[agentIdForTicket].total += score;
    agentScores[agentIdForTicket].count++;
    agentScores[agentIdForTicket].scores.push(score);
  }
  
  // Build final agent feedback scores with names
  const agentNameMap: Record<number, string> = {};
  for (const a of allAgents) {
    agentNameMap[a.id] = a.name;
  }
  
  for (const [aid, data] of Object.entries(agentScores)) {
    const agentIdNum = Number(aid);
    const avgScore = data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0;
    results.agentFeedbackScores[aid] = {
      agent_id: agentIdNum,
      agent_name: agentNameMap[agentIdNum] || `Agent ${aid}`,
      average_score: avgScore,
      feedback_count: data.count,
      score_distribution: {
        1: data.scores.filter(s => s === 1).length,
        2: data.scores.filter(s => s === 2).length,
        3: data.scores.filter(s => s === 3).length,
        4: data.scores.filter(s => s === 4).length,
        5: data.scores.filter(s => s === 5).length,
      }
    };
  }
  
  return NextResponse.json(results, { status: 200 });
}
