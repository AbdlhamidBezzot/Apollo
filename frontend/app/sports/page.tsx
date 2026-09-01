"use client";

import React, { useEffect, useMemo, useState } from "react";
import { get } from "@/lib/http";
import { FootballMatch, FootballPlayerModal } from "@/components/FootballPlayerModal";

interface MatchesResponse {
  matches: FootballMatch[];
  pagination: {
    page: number;
    hasNext: boolean;
  };
  is_demo?: boolean;
  error_note?: string;
}

export default function SportsPage() {
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isDemo, setIsDemo] = useState<boolean>(false);
  const [errorNote, setErrorNote] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"live" | "vs" | "all">("live");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedLeague, setSelectedLeague] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(""); // DDMMYYYY format
  const [page, setPage] = useState<number>(1);
  const [hasNext, setHasNext] = useState<boolean>(false);

  const [selectedMatch, setSelectedMatch] = useState<FootballMatch | null>(null);

  // Fetch matches from FastAPI backend
  const fetchMatches = async (targetPage = 1, status = activeTab, date = selectedDate) => {
    setLoading(true);
    setError("");
    try {
      let endpoint = `/api/v1/football/matches?page=${targetPage}`;
      if (status !== "all") endpoint += `&status=${status}`;
      if (date) endpoint += `&date=${date}`;

      const res = await get<MatchesResponse>(endpoint);
      setMatches(res.matches || []);
      setHasNext(Boolean(res.pagination?.hasNext));
      setIsDemo(Boolean(res.is_demo));
      setErrorNote(res.error_note || "");
    } catch (err: any) {
      setError(err?.message || "Failed to load football matches. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches(page, activeTab, selectedDate);
  }, [page, activeTab, selectedDate]);

  // Extract unique leagues for filtering
  const leagues = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (m.league_name) set.add(m.league_name);
    });
    return Array.from(set);
  }, [matches]);

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const matchText = `${m.home_team_name} ${m.away_team_name} ${m.league_name || ""}`.toLowerCase();
      const matchesSearch = !searchQuery.trim() || matchText.includes(searchQuery.toLowerCase().trim());
      const matchesLeague = selectedLeague === "all" || m.league_name === selectedLeague;
      return matchesSearch && matchesLeague;
    });
  }, [matches, searchQuery, selectedLeague]);

  const liveCount = matches.filter((m) => m.match_status?.toLowerCase() === "live").length;
  const vsCount = matches.filter((m) => m.match_status?.toLowerCase() === "vs").length;

  return (
    <div className="min-h-screen pb-20 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Banner Alert for Demo Mode */}
        {isDemo && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 backdrop-blur">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚡</span>
              <div>
                <h4 className="font-bold text-amber-200">Demo Mode Active</h4>
                <p className="text-xs text-amber-300/90 mt-0.5">
                  Showing sample live matches. To connect to real-time streams from RapidAPI, add your{" "}
                  <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-amber-200">
                    RAPIDAPI_FOOTBALL_KEY
                  </code>{" "}
                  to <code className="font-mono text-amber-200">backend/.env</code>.
                </p>
                {errorNote && <p className="text-xs mt-1 text-amber-400 font-mono">{errorNote}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-950 via-slate-900 to-black p-8 sm:p-10 shadow-2xl">
          <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-400 mb-4">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE FOOTBALL STREAMING
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
              Watch Football Matches <span className="text-emerald-400">Live</span>
            </h1>
            <p className="mt-3 text-sm text-text-muted sm:text-base">
              Real-time streams from Premier League, La Liga, Serie A, Champions League, and more. Multiple
              failover servers updated live every minute.
            </p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-surface-dark p-1.5 shadow-glass">
              <button
                onClick={() => {
                  setActiveTab("live");
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                  activeTab === "live"
                    ? "bg-red-600 text-white shadow-lg shadow-red-600/30"
                    : "text-text-muted hover:text-white"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
                LIVE NOW ({liveCount})
              </button>
              <button
                onClick={() => {
                  setActiveTab("vs");
                  setPage(1);
                }}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  activeTab === "vs"
                    ? "bg-brand text-white shadow-lg shadow-brand/30"
                    : "text-text-muted hover:text-white"
                }`}
              >
                SCHEDULED ({vsCount})
              </button>
              <button
                onClick={() => {
                  setActiveTab("all");
                  setPage(1);
                }}
                className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                  activeTab === "all"
                    ? "bg-brand text-white shadow-lg shadow-brand/30"
                    : "text-text-muted hover:text-white"
                }`}
              >
                ALL MATCHES
              </button>
            </div>

            {/* Search Box */}
            <div className="flex items-center gap-3 flex-1 max-w-xs min-w-[220px]">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team or league..."
                  className="w-full rounded-full border border-white/10 bg-surface-dark px-4 py-2 pl-9 text-xs text-white placeholder-text-muted outline-none focus:border-emerald-500/50"
                />
                <span className="absolute left-3 top-2.5 text-xs text-text-muted">🔍</span>
              </div>
            </div>
          </div>

          {/* League Pills */}
          {leagues.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedLeague("all")}
                className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition ${
                  selectedLeague === "all"
                    ? "bg-white/20 text-white border border-white/30"
                    : "bg-surface-dark text-text-muted border border-white/10 hover:text-white"
                }`}
              >
                All Leagues
              </button>
              {leagues.map((lg) => (
                <button
                  key={lg}
                  onClick={() => setSelectedLeague(lg)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition ${
                    selectedLeague === lg
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : "bg-surface-dark text-text-muted border border-white/10 hover:text-white"
                  }`}
                >
                  {lg}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Match Grid */}
        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-44 rounded-2xl border border-white/10 bg-surface-dark p-4 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
              <p className="text-sm font-semibold text-red-400 mb-3">{error}</p>
              <button
                onClick={() => fetchMatches(1)}
                className="rounded-full bg-brand px-5 py-2 text-xs font-bold text-white shadow-brand-glow"
              >
                Retry Loading Matches
              </button>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-surface-dark p-12 text-center">
              <div className="text-4xl mb-3">⚽</div>
              <h3 className="text-lg font-bold text-white">No matches found</h3>
              <p className="text-xs text-text-muted mt-1">
                There are no matches currently matching your selected filters. Try switching tabs or clearing
                the search.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMatches.map((match, idx) => {
                const isMatchLive = match.match_status?.toLowerCase() === "live";
                const serversCount = match.servers?.length || 0;

                return (
                  <div
                    key={match.match_id || idx}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-surface-dark p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-card-hover"
                  >
                    {/* Card Top Row */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                      <span className="truncate text-xs font-semibold text-text-muted">
                        {match.league_name || "Match"}
                      </span>
                      {isMatchLive ? (
                        <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-bold text-red-400 border border-red-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />
                          LIVE
                        </span>
                      ) : (
                        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-text-muted">
                          SCHEDULED
                        </span>
                      )}
                    </div>

                    {/* Team vs Team Scoreboard */}
                    <div className="flex items-center justify-between gap-3 my-2">
                      {/* Home Team */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {match.home_team_logo ? (
                          <img
                            src={match.home_team_logo}
                            alt={match.home_team_name}
                            className="h-8 w-8 object-contain rounded shrink-0"
                            onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs shrink-0">
                            {match.home_team_name.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-bold text-white truncate">
                          {match.home_team_name}
                        </span>
                      </div>

                      {/* Score Badge */}
                      <div className="flex items-center justify-center rounded-lg bg-black/60 px-3 py-1 border border-white/10 shrink-0">
                        <span className="text-sm font-black text-white">
                          {match.homeTeamScore ?? "0"} - {match.awayTeamScore ?? "0"}
                        </span>
                      </div>

                      {/* Away Team */}
                      <div className="flex items-center justify-end gap-2.5 min-w-0 flex-1 text-right">
                        <span className="text-sm font-bold text-white truncate">
                          {match.away_team_name}
                        </span>
                        {match.away_team_logo ? (
                          <img
                            src={match.away_team_logo}
                            alt={match.away_team_name}
                            className="h-8 w-8 object-contain rounded shrink-0"
                            onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-emerald-500/20 flex items-center justify-center font-bold text-emerald-400 text-xs shrink-0">
                            {match.away_team_name.charAt(0)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Bottom / Action Row */}
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/10">
                      <span className="text-[11px] font-medium text-text-muted">
                        📺 {serversCount} {serversCount === 1 ? "Server" : "Servers"} Available
                      </span>

                      <button
                        onClick={() => setSelectedMatch(match)}
                        className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                          isMatchLive
                            ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
                            : "bg-brand text-white shadow-brand-glow hover:bg-brand/90"
                        }`}
                      >
                        Watch Stream ▶
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Video Player Modal */}
        {selectedMatch && (
          <FootballPlayerModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
        )}
      </div>
    </div>
  );
}
