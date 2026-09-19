"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export interface FootballServer {
  name: string;
  url: string;
  type?: "direct" | "referer" | "drm" | string;
  header?: Record<string, string>;
}

export interface FootballMatch {
  match_id?: string;
  match_time?: string;
  match_status?: "live" | "vs" | string;
  league_name?: string;
  home_team_name: string;
  home_team_logo?: string;
  homeTeamScore?: string;
  away_team_name: string;
  away_team_logo?: string;
  awayTeamScore?: string;
  servers: FootballServer[];
}

interface FootballPlayerModalProps {
  match: FootballMatch | null;
  onClose: () => void;
}

export function FootballPlayerModal({ match, onClose }: FootballPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [activeServerIdx, setActiveServerIdx] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(true);
  const [muted, setMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [levels, setLevels] = useState<{ index: number; label: string }[]>([]);
  const [curLevel, setCurLevel] = useState<number>(-1);

  const servers = match?.servers || [];
  const currentServer = servers[activeServerIdx] || null;

  // Resolve Effective Stream URL (handling Proxy for referer-restricted streams)
  const getEffectiveStreamUrl = useCallback((server: FootballServer | null) => {
    if (!server || !server.url) return "";
    const rawUrl = server.url.trim();

    // If server type is referer or has specific referer headers, route through backend proxy
    const refererHeader = server.header?.referer || server.header?.Referer;
    if (server.type === "referer" || refererHeader) {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const proxyUrl = `${apiBase}/api/v1/football/proxy?url=${encodeURIComponent(rawUrl)}${
        refererHeader ? `&referer=${encodeURIComponent(refererHeader)}` : ""
      }`;
      return proxyUrl;
    }
    return rawUrl;
  }, []);

  const streamUrl = getEffectiveStreamUrl(currentServer);

  // Initialize HLS.js or HTML5 Video
  useEffect(() => {
    if (!match || !currentServer || !streamUrl) return;
    const video = videoRef.current;
    if (!video) return;

    setErrorMsg("");
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = /\.m3u8(\?|$)/i.test(streamUrl) || currentServer.type === "direct";

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(
          data.levels.map((l, i) => ({
            index: i,
            label: l.height ? `${l.height}p` : `Level ${i + 1}`,
          }))
        );
        video.play().catch(() => setPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          logger_warn("HLS fatal error: " + data.type);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setErrorMsg("Network error trying to load stream. Try switching servers.");
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setErrorMsg("Stream unavailable on this server. Please try another server.");
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl") || !isHls) {
      video.src = streamUrl;
      video.play().catch(() => setPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [match, currentServer, streamUrl]);

  const logger_warn = (msg: string) => console.warn("[FootballPlayer]", msg);

  // Keyboard shortcut listener (Escape to close, F for fullscreen, Space for play/pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const handleVolume = (v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    video.muted = v === 0;
    setVolume(v);
    setMuted(v === 0);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    } else {
      await container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    }
  };

  if (!match) return null;

  const isLive = match.match_status?.toLowerCase() === "live";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-surface-dark shadow-2xl"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-black/40">
          <div className="flex items-center gap-4 min-w-0">
            {isLive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-500 border border-red-500/30">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                LIVE STREAM
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-text-muted">
                SCHEDULED
              </span>
            )}
            <span className="truncate text-sm font-semibold text-text-muted">
              {match.league_name || "Football Match"}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close player"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-red-600"
          >
            ✕
          </button>
        </div>

        {/* Scoreboard Overlay Banner */}
        <div className="flex items-center justify-center gap-6 border-b border-white/10 bg-gradient-to-r from-emerald-950/40 via-black to-emerald-950/40 py-4 px-6">
          <div className="flex items-center gap-3 text-right flex-1 justify-end">
            <span className="text-lg font-bold text-white truncate">{match.home_team_name}</span>
            {match.home_team_logo && (
              // eslint-disable-next-javascript-ignore
              <img
                src={match.home_team_logo}
                alt={match.home_team_name}
                className="h-10 w-10 object-contain rounded"
                onError={(e) => ((e.target as HTMLElement).style.display = "none")}
              />
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-black/60 px-4 py-1.5 border border-white/10 shadow-inner">
            <span className="text-2xl font-black text-white">{match.homeTeamScore ?? "0"}</span>
            <span className="text-sm font-bold text-text-muted px-1">:</span>
            <span className="text-2xl font-black text-white">{match.awayTeamScore ?? "0"}</span>
          </div>

          <div className="flex items-center gap-3 text-left flex-1 justify-start">
            {match.away_team_logo && (
              <img
                src={match.away_team_logo}
                alt={match.away_team_name}
                className="h-10 w-10 object-contain rounded"
                onError={(e) => ((e.target as HTMLElement).style.display = "none")}
              />
            )}
            <span className="text-lg font-bold text-white truncate">{match.away_team_name}</span>
          </div>
        </div>

        {/* Server Selector Bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-2.5 overflow-x-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-text-muted mr-2">Stream Source:</span>
            {servers.length === 0 ? (
              <span className="text-xs text-red-400">No servers returned for this match</span>
            ) : (
              servers.map((server, idx) => {
                const isActive = idx === activeServerIdx;
                const typeLabel = server.type?.toUpperCase() || "DIRECT";
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveServerIdx(idx)}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "bg-brand text-white shadow-lg shadow-brand/30"
                        : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>{server.name || `Server ${idx + 1}`}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-mono ${
                        server.type === "referer"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : server.type === "drm"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {typeLabel}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {levels.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-text-muted font-mono">Quality:</span>
              <select
                value={curLevel}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurLevel(val);
                  if (hlsRef.current) hlsRef.current.currentLevel = val;
                }}
                className="bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none"
              >
                <option value={-1}>Auto</option>
                {levels.map((lvl) => (
                  <option key={lvl.index} value={lvl.index}>
                    {lvl.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Video Canvas Container */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          {errorMsg ? (
            <div className="p-8 text-center max-w-md">
              <div className="mb-3 font-bold text-xs uppercase text-red-400">Playback Error</div>
              <p className="text-sm font-semibold text-red-400 mb-4">{errorMsg}</p>
              {servers.length > 1 && (
                <button
                  onClick={() => setActiveServerIdx((prev) => (prev + 1) % servers.length)}
                  className="rounded-full bg-brand px-5 py-2 text-xs font-bold text-white shadow-brand-glow transition hover:scale-105"
                >
                  Switch to Next Server
                </button>
              )}
            </div>
          ) : currentServer?.type === "drm" ? (
            <div className="p-8 text-center max-w-lg">
              <span className="inline-block mb-3 rounded-full bg-purple-500/20 p-3 text-purple-400 text-2xl">
                🔒
              </span>
              <h4 className="text-base font-bold text-white mb-2">DRM Protected Stream</h4>
              <p className="text-xs text-text-muted mb-4">
                This server uses DRM key protection. If direct playback fails, please select one of the
                Direct or Referer servers above.
              </p>
              <a
                href={currentServer.url}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                Open Direct Stream Link ↗
              </a>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="h-full w-full object-contain"
              playsInline
              onClick={togglePlay}
            />
          )}

          {/* Floating Player Controls Bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 opacity-90 transition-opacity hover:opacity-100">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-brand"
              >
                {playing ? "⏸" : "▶"}
              </button>

              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="text-text-muted hover:text-white text-sm">
                  {muted || volume === 0 ? "🔇" : "🔊"}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={muted ? 0 : volume}
                  onChange={(e) => handleVolume(Number(e.target.value))}
                  className="w-16 accent-brand cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-text-muted">
                {currentServer?.name || `Server ${activeServerIdx + 1}`}
              </span>
              <button
                onClick={toggleFullscreen}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
                title="Toggle Fullscreen (F)"
              >
                ⤢
              </button>
            </div>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="flex items-center justify-between bg-black/60 px-6 py-3 text-[11px] text-text-muted border-t border-white/10">
          <span>Streams updated every minute with auto-failover servers</span>
          <span>Press ESC or ✕ to exit player</span>
        </div>
      </div>
    </div>
  );
}
