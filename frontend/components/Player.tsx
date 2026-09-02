"use client";

import Link from "next/link";
import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get, post, put } from "@/lib/http";
import { useAuth } from "@/components/AuthContext";
import { useMovieNight } from "@/lib/useMovieNight";
import type { Episode, PlaybackCue, SeasonEpisodes, TitleDetail } from "@/lib/types";

interface PlayerProps {
  streamUrl: string;
  contentType: string;
  provider?: string | null;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster?: string | null;
  season?: number | null;
  episode?: number | null;
  roomCode?: string | null;
}

interface PlaybackSession {
  provider: string;
  stream_url: string;
  content_type: string;
  expires_at: string;
}

const PROGRESS_KEY = "apollo:progress";
const PROVIDER_KEY = "apollo:provider";
const IDLE_HIDE_MS = 3000;
const NEXT_CARD_SECONDS = 15;
const NEXT_AUTO_MS = 10000;

const providerLabel = (p: string, list: string[] = []) => {
  const idx = list.indexOf(p);
  return idx >= 0 ? `Server ${idx + 1}` : "Server 1";
};

const isEmbed = (contentType: string) => contentType === "text/html";

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function Player({ streamUrl, contentType, provider: providerProp, tmdbId, mediaType, title, poster, season, episode, roomCode }: PlayerProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rate, setRate] = useState(1);
  const [savedPos, setSavedPos] = useState(0);
  const lastReport = useRef(0);
  const embed = isEmbed(contentType);
  const embedGotRealProgress = useRef(false);

  const [src, setSrc] = useState(streamUrl);
  const [seasonNum, setSeasonNum] = useState(season ?? 1);
  const [episodeNum, setEpisodeNum] = useState(episode ?? 1);
  const [busyResolve, setBusyResolve] = useState(false);

  const [providers, setProviders] = useState<string[]>(["videasy", "cinemaos"]);
  const [provider, setProvider] = useState<string>(providerProp || "cinemaos");

  const [seasons, setSeasons] = useState<{ season_number: number; name?: string }[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const [nextCard, setNextCard] = useState(false);
  const [countdown, setCountdown] = useState(10);

  const isHls = !embed && (contentType === "application/x-mpegURL" || /\.m3u8(\?|$)/i.test(src));
  const useHlsJs = !embed && isHls && typeof window !== "undefined" && Hls.isSupported();

  // Embed provider: supply the brand accent and resume from any saved position.
  const embedSrc = useMemo(() => {
    if (!embed) return src;
    const u = new URL(src, window.location.href);
    if (!u.searchParams.has("color")) u.searchParams.set("color", "FF0A47");
    if (savedPos > 5) u.searchParams.set("progress", String(Math.floor(savedPos)));
    return u.toString();
  }, [embed, src, savedPos]);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<{ index: number; height: number; label: string }[]>([]);
  const [curLevel, setCurLevel] = useState(-1);
  const [qualityOpen, setQualityOpen] = useState(false);

  const [cue, setCue] = useState<PlaybackCue | null>(null);
  const [cueMenuOpen, setCueMenuOpen] = useState(false);
  const [marking, setMarking] = useState<"intro" | "outro" | null>(null);
  const [markingStart, setMarkingStart] = useState(0);
  const skippedRef = useRef<string>("");

  const idleTimer = useRef<number>(0);
  const announceTimer = useRef<number>(0);

  // Movie Night sync room (optional).
  const room = useMovieNight({
    roomCode: roomCode || null,
    sender: user?.name || user?.email || "Guest",
    onRemoteState: (s) => {
      const video = videoRef.current;
      if (!video) return;
      if (typeof s.time === "number" && Math.abs(video.currentTime - s.time) > 2) {
        video.currentTime = s.time;
        setCurrentTime(s.time);
      }
      if (typeof s.rate === "number" && video.playbackRate !== s.rate) {
        video.playbackRate = s.rate;
        setRate(s.rate);
      }
      if (s.playing !== undefined) {
        if (s.playing) video.play().catch(() => { });
        else video.pause();
      }
    },
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const stateRef = useRef({ playing, currentTime, rate, season: seasonNum, episode: episodeNum });
  stateRef.current = { playing, currentTime, rate, season: seasonNum, episode: episodeNum };

  const syncState = useCallback(
    (partial: Record<string, unknown>) => {
      room.broadcastState({ ...stateRef.current, ...partial });
    },
    [room.broadcastState]
  );

  // Restore last position from localStorage (works pre-login too).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        const pos = Number(map[`${mediaType}:${tmdbId}`] || 0);
        if (pos > 5 && videoRef.current && videoRef.current.duration) {
          videoRef.current.currentTime = pos;
        } else {
          setSavedPos(pos);
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, [tmdbId, mediaType]);

  const announce = useCallback((text: string) => {
    setAnnouncement(text);
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(""), 2500);
  }, []);

  const saveProgress = useCallback(
    async (seconds: number, completed = false, force = false) => {
      try {
        const map = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
        map[`${mediaType}:${tmdbId}`] = seconds;
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
      } catch {
        /* ignore */
      }
      const now = Date.now();
      if (force || now - lastReport.current > 15000) {
        lastReport.current = now;
        // Watch history ("Continue Watching" / History page) requires an account.
        // Guests get full playback but progress is NOT tracked server-side —
        // it only lives in localStorage. Signed-in users also write to the API.
        if (user) {
          put("/api/v1/me/history", {
            tmdb_id: tmdbId,
            media_type: mediaType,
            progress_seconds: seconds,
            completed,
            ...(mediaType === "tv" ? { season_number: seasonNum, episode_number: episodeNum } : {}),
          }).catch(() => { });
        }
      }
    },
    [tmdbId, mediaType, user, seasonNum, episodeNum]
  );

  // Immediately log/sync watch history when opening a title or switching episodes
  useEffect(() => {
    if (!user) return;
    saveProgress(savedPos, false, true);
  }, [user, tmdbId, mediaType, seasonNum, episodeNum, savedPos, saveProgress]);

  useEffect(() => {
    if (embed) return;
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => saveProgress(Math.floor(video.currentTime));
    const onPause = () => saveProgress(Math.floor(video.currentTime), false, true);
    const onEnded = () => saveProgress(Math.floor(video.duration || 0), true, true);
    const flush = () => saveProgress(Math.floor(video.currentTime), false, true);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    window.addEventListener("pagehide", flush);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      window.removeEventListener("pagehide", flush);
    };
  }, [saveProgress]);

  useEffect(() => {
    if (!embed) return;
    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const data = JSON.parse(event.data);
        const secs = Number(data.timestamp ?? data.progress);
        if (Number.isFinite(secs) && secs > 0) {
          embedGotRealProgress.current = true;
          saveProgress(Math.floor(secs), Number(data.progress) >= 0.95);
        }
      } catch {
        /* non-JSON message, ignore */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed, saveProgress]);

  // Fallback for embeds that never postMessage progress: record elapsed time on
  // the watch page so history still fills in. Only fires while no real progress
  // has been reported, so it never overwrites accurate positions.
  useEffect(() => {
    if (!embed) return;
    const startedAt = Date.now();
    const flush = () => {
      if (embedGotRealProgress.current) return;
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      if (secs > 0) saveProgress(secs, false, true);
    };
    const iv = window.setInterval(flush, 15000);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [embed, saveProgress]);

  // Load skip-intro/outro cues for the current episode.
  useEffect(() => {
    if (embed || mediaType !== "tv") return;
    let cancelled = false;
    get<PlaybackCue | null>(
      `/api/v1/playback/cues?tmdb_id=${tmdbId}&media_type=tv&season=${seasonNum}&episode=${episodeNum}`
    )
      .then((c) => {
        if (!cancelled) setCue(c);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [embed, mediaType, tmdbId, seasonNum, episodeNum]);

  // Load season list once so the episode picker can switch seasons.
  useEffect(() => {
    if (mediaType !== "tv") return;
    let cancelled = false;
    get<TitleDetail>(`/api/v1/content/tv/${tmdbId}`)
      .then((d) => {
        if (cancelled) return;
        const list = (d.seasons || [])
          .filter((s) => s.season_number > 0)
          .map((s) => ({ season_number: s.season_number, name: s.name }));
        if (list.length) setSeasons(list);
        else if (typeof d.number_of_seasons === "number")
          setSeasons(Array.from({ length: d.number_of_seasons }, (_, i) => ({ season_number: i + 1 })));
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [mediaType, tmdbId]);

  // Load episodes for the current season.
  useEffect(() => {
    if (mediaType !== "tv") return;
    let cancelled = false;
    setEpisodesLoading(true);
    setEpisodes([]);
    get<SeasonEpisodes>(`/api/v1/content/tv/${tmdbId}/season/${seasonNum}`)
      .then((d) => {
        if (!cancelled) setEpisodes((d.episodes || []).filter((e) => e.episode_number > 0));
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setEpisodesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType, tmdbId, seasonNum]);

  // HLS playback with quality levels.
  useEffect(() => {
    if (embed || !isHls) return;
    const video = videoRef.current;
    if (!video) return;
    if (useHlsJs) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(
          data.levels.map((l, i) => ({ index: i, height: l.height || 0, label: l.height ? `${l.height}p` : `Level ${i + 1}` }))
        );
        setCurLevel(-1);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurLevel(data.level));
      return () => {
        hls.destroy();
        hlsRef.current = null;
        setLevels([]);
        setCurLevel(-1);
      };
    }
    return undefined;
  }, [src, isHls, embed, useHlsJs]);

  const pokeControls = useCallback(() => {
    setShowControls(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setShowControls(false), IDLE_HIDE_MS);
  }, []);

  useEffect(() => {
    if (!embed) pokeControls();
    return () => window.clearTimeout(idleTimer.current);
  }, [embed, pokeControls, src]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => { });
      announce("Playing");
    } else {
      video.pause();
      announce("Paused");
    }
    syncState({ playing: video.paused ? false : true });
  }, [announce, syncState]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    announce(video.muted ? "Muted" : "Unmuted");
  }, [announce]);

  const setVol = useCallback(
    (v: number) => {
      const video = videoRef.current;
      if (!video) return;
      const next = Math.max(0, Math.min(1, v));
      video.volume = next;
      video.muted = next === 0;
      setVolume(next);
      setMuted(next === 0);
      announce(`Volume ${Math.round(next * 100)}%`);
    },
    [announce]
  );

  const seek = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      const next = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
      video.currentTime = next;
      setCurrentTime(next);
      announce(`${delta > 0 ? "Forward" : "Backward"} ${Math.abs(delta)} seconds`);
      syncState({ time: next });
    },
    [announce, syncState]
  );

  const cycleRate = useCallback(() => {
    const next = rate >= 2 ? 0.5 : rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
    announce(`Playback speed ${next.toFixed(2)}x`);
    syncState({ rate: next });
  }, [rate, announce, syncState]);

  const fullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
    const inFs = document.fullscreenElement || doc.webkitFullscreenElement;
    try {
      if (inFs) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else doc.webkitExitFullscreen?.();
      } else {
        const c = container as HTMLDivElement & { webkitRequestFullscreen?: () => void };
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (c.webkitRequestFullscreen) c.webkitRequestFullscreen();
      }
    } catch (err) {
      // Chromium/Brave logs the exact reason here (e.g. "not allowed by the user
      // agent or the platform in the current context") — surface it so a
      // Shields/permissions-policy denial is visible in the console.
      console.warn("[fullscreen] request denied:", err);
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const setQuality = (index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index;
    setCurLevel(index);
    setQualityOpen(false);
    announce(index === -1 ? "Quality: Auto" : `Quality: ${levels.find((l) => l.index === index)?.label ?? index}p`);
  };

  const saveCue = useCallback(
    async (next: PlaybackCue) => {
      setCue(next);
      try {
        await put("/api/v1/playback/cues", {
          tmdb_id: tmdbId,
          mediaType,
          season: seasonNum,
          episode: episodeNum,
          intro_start: next.intro_start,
          intro_end: next.intro_end,
          outro_start: next.outro_start,
          outro_end: next.outro_end,
        });
      } catch {
        /* ignore save errors */
      }
    },
    [tmdbId, mediaType, seasonNum, episodeNum]
  );

  const skipCue = (kind: "intro" | "outro") => {
    const video = videoRef.current;
    if (!video || !cue) return;
    const end = kind === "intro" ? cue.intro_end : cue.outro_end;
    if (typeof end !== "number") return;
    video.currentTime = end;
    setCurrentTime(end);
    skippedRef.current = `${episodeNum}:${kind}`;
    pokeControls();
  };

  const inWindow = (kind: "intro" | "outro") => {
    if (!cue || mediaType !== "tv" || skippedRef.current === `${episodeNum}:${kind}`) return false;
    const start = kind === "intro" ? cue.intro_start : cue.outro_start;
    const end = kind === "intro" ? cue.intro_end : cue.outro_end;
    if (typeof start !== "number" || typeof end !== "number") return false;
    return currentTime > 0 && currentTime >= start && currentTime <= Math.max(start, end - 1);
  };

  const showSkipIntro = inWindow("intro");
  const showSkipOutro = inWindow("outro");

  const markCueStart = (kind: "intro" | "outro") => {
    const video = videoRef.current;
    if (!video) return;
    setMarking(kind);
    setMarkingStart(video.currentTime);
  };

  const markCueEnd = async (kind: "intro" | "outro") => {
    const video = videoRef.current;
    if (!video) return;
    const next: PlaybackCue = { tmdb_id: tmdbId, media_type: mediaType, season: seasonNum, episode: episodeNum };
    const start = markingStart;
    const end = video.currentTime;
    if (kind === "intro") {
      next.intro_start = Math.min(start, end);
      next.intro_end = Math.max(start, end);
      if (cue?.outro_start) next.outro_start = cue.outro_start;
      if (cue?.outro_end) next.outro_end = cue.outro_end;
    } else {
      next.outro_start = Math.min(start, end);
      next.outro_end = Math.max(start, end);
      if (cue?.intro_start) next.intro_start = cue.intro_start;
      if (cue?.intro_end) next.intro_end = cue.intro_end;
    }
    setMarking(null);
    setCueMenuOpen(false);
    announce(`Skip ${kind} set`);
    await saveCue(next);
  };

  const clearCue = async (kind: "intro" | "outro") => {
    const next: PlaybackCue = { tmdb_id: tmdbId, media_type: mediaType, season: seasonNum, episode: episodeNum };
    if (kind === "intro") {
      next.outro_start = cue?.outro_start ?? null;
      next.outro_end = cue?.outro_end ?? null;
    } else {
      next.intro_start = cue?.intro_start ?? null;
      next.intro_end = cue?.intro_end ?? null;
    }
    setMarking(null);
    setCueMenuOpen(false);
    await saveCue(next);
  };

  const switchEpisode = useCallback(
    async (targetSeason: number, targetEpisode: number) => {
      if (mediaType !== "tv" || busyResolve) return;
      setBusyResolve(true);
      setNextCard(false);
      try {
        const res = await post<PlaybackSession>("/api/v1/playback/resolve", {
          tmdb_id: tmdbId,
          media_type: "tv",
          season: targetSeason,
          episode: targetEpisode,
          provider,
        });
        setSrc(res.stream_url);
        setSeasonNum(targetSeason);
        setEpisodeNum(targetEpisode);
        setSavedPos(0);
        setCurrentTime(0);
        setNextCard(false);
        skippedRef.current = "";
        setBusyResolve(false);
        const video = videoRef.current;
        if (video) {
          video.currentTime = 0;
          video.play().catch(() => { });
          pokeControls();
        }
        syncState({ season: targetSeason, episode: targetEpisode, time: 0, playing: true });
      } catch {
        setBusyResolve(false);
        announce("Could not load that episode");
      }
    },
    [mediaType, busyResolve, tmdbId, announce, pokeControls, syncState, provider]
  );

  const playNextEpisode = useCallback(async () => {
    if (mediaType !== "tv" || busyResolve) return;
    await switchEpisode(seasonNum, episodeNum + 1);
  }, [mediaType, busyResolve, seasonNum, episodeNum, switchEpisode]);

  const changeProvider = useCallback(
    async (target: string) => {
      if (busyResolve || target === provider) return;
      setBusyResolve(true);
      try {
        const res = await post<PlaybackSession>("/api/v1/playback/resolve", {
          tmdb_id: tmdbId,
          media_type: mediaType,
          season: seasonNum,
          episode: episodeNum,
          provider: target,
        });
        setSrc(res.stream_url);
        setProvider(target);
        embedGotRealProgress.current = false;
        try {
          localStorage.setItem(PROVIDER_KEY, target);
        } catch {
          /* ignore */
        }
        announce(`Source: ${providerLabel(target, providers)}`);
      } catch {
        announce("Could not load that source");
      } finally {
        setBusyResolve(false);
      }
    },
    [busyResolve, provider, tmdbId, mediaType, seasonNum, episodeNum, announce]
  );

  // Load the registered providers and apply the user's stored preference once.
  useEffect(() => {
    let cancelled = false;
    get<string[]>("/api/v1/playback/providers")
      .then((list) => {
        if (cancelled) return;
        if (list.length) setProviders(list);
        let pref: string | null = null;
        try {
          pref = localStorage.getItem(PROVIDER_KEY);
        } catch {
          /* ignore */
        }
        const current = providerProp || "cinemaos";
        if (pref && pref !== current && list.includes(pref)) {
          changeProvider(pref);
        } else if (!list.includes(current)) {
          changeProvider(list[0]);
        }
      })
      .catch(() => {
        /* fall back to the built-in list */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (embed || mediaType !== "tv") return;
    if (duration > 0 && duration - currentTime <= NEXT_CARD_SECONDS && currentTime > 0) {
      setNextCard(true);
    } else if (duration > 0 && duration - currentTime > NEXT_CARD_SECONDS) {
      setNextCard(false);
    }
  }, [embed, mediaType, duration, currentTime]);

  useEffect(() => {
    if (!nextCard) {
      setCountdown(10);
      return;
    }
    const iv = window.setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearInterval(iv);
  }, [nextCard]);

  useEffect(() => {
    if (nextCard && countdown <= 0) playNextEpisode();
  }, [nextCard, countdown, playNextEpisode]);

  useEffect(() => {
    if (embed) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === " " || key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (key === "f") {
        e.preventDefault();
        fullscreen();
      } else if (key === "m") {
        e.preventDefault();
        toggleMute();
      } else if (key === "j") {
        seek(-10);
      } else if (key === "l") {
        seek(10);
      } else if (e.key === "ArrowLeft") {
        seek(-5);
      } else if (e.key === "ArrowRight") {
        seek(5);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setVol(volume + 0.1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setVol(volume - 0.1);
      } else if (key === "s") {
        e.preventDefault();
        if (showSkipOutro) skipCue("outro");
        else if (showSkipIntro) skipCue("intro");
      } else if (e.key === "N" && e.shiftKey) {
        e.preventDefault();
        playNextEpisode();
      }
      pokeControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embed, togglePlay, fullscreen, toggleMute, seek, volume, setVol, playNextEpisode, pokeControls, skipCue, showSkipIntro, showSkipOutro]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    room.sendChat(text);
    setChatInput("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-text-vivid">{title}</h1>
          {mediaType === "tv" ? (
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-text-muted">
                S{String(seasonNum).padStart(2, "0")} E{String(episodeNum).padStart(2, "0")}
              </p>
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-text-muted">
                Episode guide {episodes.length > 0 ? `- ${episodes.length}` : ""}
              </span>
            </div>
          ) : (
            <p className="font-mono text-xs text-text-muted">Playback source: {contentType}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {providers.length > 1 && (
            <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-black/20 p-1" role="group" aria-label="Playback source">
              {providers.map((p, idx) => (
                <button
                  key={p}
                  onClick={() => changeProvider(p)}
                  disabled={busyResolve || p === provider}
                  title={p === provider ? "Active source" : `Switch to Server ${idx + 1}`}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-default ${
                    p === provider ? "bg-brand text-white" : "text-text-muted hover:text-text-vivid"
                  }`}
                >
                  Server {idx + 1}
                </button>
              ))}
            </div>
          )}
          {roomCode && room.connected && (
            <button
              onClick={() => setChatOpen((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${chatOpen ? "border-accent text-brand-soft" : "border-white/10 text-text-muted hover:border-brand/50"
                }`}
            >
              Movie Night · {room.code} · {room.members} 👥
            </button>
          )}
          <Link
            href={mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`}
            className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-medium text-text-muted transition hover:border-brand/50 hover:text-text-vivid"
          >
            ← Back
          </Link>
        </div>
      </div>

      {embed ? (
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-card-hover"
          onDoubleClick={fullscreen}
        >
          <iframe
            src={embedSrc}
            title={title}
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            className="aspect-video w-full"
          />
          <button
            onClick={fullscreen}
            aria-label="Toggle fullscreen"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-glass backdrop-blur transition hover:bg-brand"
          >
            {isFullscreen ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`group relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-card-hover ${showControls ? "" : "player-idle"
            }`}
          onPointerMove={pokeControls}
          onPointerLeave={() => setShowControls(false)}
          onDoubleClick={fullscreen}
        >
          <video
            ref={videoRef}
            src={useHlsJs ? undefined : src}
            poster={poster || undefined}
            onClick={togglePlay}
            className="aspect-video w-full"
            autoPlay
            crossOrigin="anonymous"
            onPlay={() => {
              setPlaying(true);
              pokeControls();
            }}
            onPause={() => {
              setPlaying(false);
              setShowControls(true);
            }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              if (savedPos > 5 && e.currentTarget.duration > savedPos) {
                e.currentTarget.currentTime = savedPos;
              }
            }}
            onVolumeChange={(e) => {
              setVolume(e.currentTarget.volume);
              setMuted(e.currentTarget.muted);
            }}
            onEnded={() => {
              setPlaying(false);
              if (mediaType === "tv") {
                setNextCard(true);
                setCountdown(10);
              }
            }}
          >
          </video>

          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"
              }`}
          />

          {!playing && showControls && (
            <button
              onClick={togglePlay}
              aria-label="Play"
              className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand/90 text-2xl text-white shadow-brand-glow transition hover:scale-105"
            >
              ▶
            </button>
          )}

          {showSkipIntro && (
            <button
              onClick={() => skipCue("intro")}
              className="absolute bottom-24 right-4 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand-glow transition hover:bg-brand-soft"
            >
              Skip Intro ⏭
            </button>
          )}
          {showSkipOutro && (
            <button
              onClick={() => skipCue("outro")}
              className="absolute bottom-24 right-4 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand-glow transition hover:bg-brand-soft"
            >
              Skip Outro ⏭
            </button>
          )}

          {nextCard && mediaType === "tv" && (
            <div className="absolute bottom-24 right-4 w-72 overflow-hidden rounded-xl border border-white/10 glass shadow-glass">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <p className="text-xs font-semibold text-text-vivid">Up next</p>
                <button
                  onClick={() => setNextCard(false)}
                  aria-label="Cancel next episode"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white"
                >
                  <span className="font-mono">{countdown}</span>
                </button>
              </div>
              <div className="p-4">
                <p className="font-mono text-xs text-text-muted">
                  S{String(seasonNum).padStart(2, "0")} E{String(episodeNum + 1).padStart(2, "0")}
                </p>
                <button
                  onClick={playNextEpisode}
                  disabled={busyResolve}
                  className="mt-2 w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-soft disabled:opacity-50"
                >
                  {busyResolve ? "Loading…" : "▶ Play next episode"}
                </button>
              </div>
            </div>
          )}

          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-10 transition-opacity duration-300 ${showControls ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
          >
            <div className="relative">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                aria-label="Seek"
                aria-valuetext={`${fmtTime(currentTime)} of ${fmtTime(duration)}`}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCurrentTime(v);
                  if (videoRef.current) videoRef.current.currentTime = v;
                  syncState({ time: v });
                }}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-brand"
              />
              {duration > 0 &&
                cue &&
                (() => {
                  const marks = [
                    { t: cue.intro_start, kind: "intro" as const },
                    { t: cue.intro_end, kind: "intro" as const },
                    { t: cue.outro_start, kind: "outro" as const },
                    { t: cue.outro_end, kind: "outro" as const },
                  ].filter((m): m is { t: number; kind: "intro" | "outro" } => typeof m.t === "number");
                  return (
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex h-full items-center" aria-hidden="true">
                      {marks.map((m, i) => (
                        <span
                          key={i}
                          title={m.kind === "intro" ? "Intro" : "Outro"}
                          className={`absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 ${m.kind === "intro" ? "bg-accent-amber" : "bg-accent-emerald"
                            }`}
                          style={{ left: `${Math.min(100, Math.max(0, (m.t / duration) * 100))}%` }}
                        />
                      ))}
                    </div>
                  );
                })()}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="p-1.5 text-white hover:text-brand-soft">
                {playing ? "❚❚" : "▶"}
              </button>
              {mediaType === "tv" && (
                <button
                  onClick={playNextEpisode}
                  aria-label="Next episode"
                  className="p-1.5 text-white hover:text-brand-soft"
                  disabled={busyResolve}
                >
                  ⏭
                </button>
              )}
              <button onClick={toggleMute} aria-label="Mute" className="p-1.5 text-white hover:text-brand-soft">
                {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
              </button>
              <span className="font-mono text-xs tabular-nums text-text-muted">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </span>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={cycleRate}
                  aria-label="Playback speed"
                  className="rounded border border-white/10 px-2 py-0.5 font-mono text-[11px] text-text-muted hover:border-brand/50 hover:text-white"
                >
                  {rate.toFixed(2)}x
                </button>

                {isHls && levels.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setQualityOpen((v) => !v)}
                      aria-label="Quality"
                      aria-expanded={qualityOpen}
                      className="rounded border border-white/10 px-2 py-0.5 font-mono text-[11px] text-text-muted hover:border-brand/50 hover:text-white"
                    >
                      {curLevel === -1 ? "Auto" : levels.find((l) => l.index === curLevel)?.label ?? "Auto"}
                    </button>
                    {qualityOpen && (
                      <div className="absolute bottom-full right-0 z-20 mb-2 w-32 overflow-hidden rounded-lg border border-white/10 glass shadow-glass">
                        <button
                          onClick={() => setQuality(-1)}
                          className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/5 ${curLevel === -1 ? "font-semibold text-brand-soft" : "text-text-vivid"
                            }`}
                        >
                          Auto
                        </button>
                        {levels.map((l) => (
                          <button
                            key={l.index}
                            onClick={() => setQuality(l.index)}
                            className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/5 ${curLevel === l.index ? "font-semibold text-brand-soft" : "text-text-vivid"
                              }`}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {mediaType === "tv" && (
                  <div className="relative">
                    <button
                      onClick={() => setCueMenuOpen((v) => !v)}
                      aria-label="Skip intro/outro settings"
                      aria-expanded={cueMenuOpen}
                      className="rounded border border-white/10 px-2 py-0.5 font-mono text-[11px] text-text-muted hover:border-brand/50 hover:text-white"
                    >
                      Cues
                    </button>
                    {cueMenuOpen && (
                      <div className="absolute bottom-full right-0 z-20 mb-2 w-60 overflow-hidden rounded-lg border border-white/10 glass shadow-glass">
                        {marking === "intro" ? (
                          <button
                            onClick={() => markCueEnd("intro")}
                            className="block w-full px-3 py-2 text-left text-xs text-text-vivid hover:bg-white/5"
                          >
                            Set intro end (start {fmtTime(markingStart)})
                          </button>
                        ) : (
                          <button
                            onClick={() => markCueStart("intro")}
                            className="block w-full px-3 py-2 text-left text-xs text-text-vivid hover:bg-white/5"
                          >
                            Mark intro start
                          </button>
                        )}
                        {cue?.intro_start != null && (
                          <button
                            onClick={() => clearCue("intro")}
                            className="block w-full px-3 py-2 text-left text-xs text-brand-soft hover:bg-white/5"
                          >
                            Clear intro
                          </button>
                        )}
                        <div className="border-t border-white/10" />
                        {marking === "outro" ? (
                          <button
                            onClick={() => markCueEnd("outro")}
                            className="block w-full px-3 py-2 text-left text-xs text-text-vivid hover:bg-white/5"
                          >
                            Set outro end (start {fmtTime(markingStart)})
                          </button>
                        ) : (
                          <button
                            onClick={() => markCueStart("outro")}
                            className="block w-full px-3 py-2 text-left text-xs text-text-vivid hover:bg-white/5"
                          >
                            Mark outro start
                          </button>
                        )}
                        {cue?.outro_start != null && (
                          <button
                            onClick={() => clearCue("outro")}
                            className="block w-full px-3 py-2 text-left text-xs text-brand-soft hover:bg-white/5"
                          >
                            Clear outro
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}


              </div>
            </div>
          </div>
        </div>
      )}

      {mediaType === "tv" && (
        <section aria-label="Episode guide" className="glass mt-3 overflow-hidden rounded-2xl shadow-glass">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-text-vivid">Episodes</p>
              <p className="text-[11px] text-text-muted">Choose an episode without leaving the player.</p>
            </div>
            {seasons.length > 1 && (
              <div className="ml-auto flex max-w-full flex-wrap gap-1.5">
                {seasons.map((s) => (
                  <button key={s.season_number} onClick={() => setSeasonNum(s.season_number)} className={`rounded-full px-2.5 py-1 text-xs transition ${s.season_number === seasonNum ? "bg-brand text-white" : "border border-white/10 text-text-muted hover:border-brand/50"}`}>
                    {s.name || `Season ${s.season_number}`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="thin-scroll max-h-[28rem] overflow-y-auto p-2 sm:p-3">
            {episodesLoading ? (
              <p className="px-3 py-4 text-xs text-text-muted">Loading episodes...</p>
            ) : episodes.length === 0 ? (
              <p className="px-3 py-4 text-xs text-text-muted">Episodes are not available for this season yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {episodes.map((ep) => {
                  const current = ep.episode_number === episodeNum;
                  return (
                    <button key={ep.episode_number} onClick={() => switchEpisode(seasonNum, ep.episode_number)} disabled={busyResolve || current} className={`min-h-16 rounded-xl px-3 py-2.5 text-left text-xs transition ${current ? "border border-brand/50 bg-brand/15 font-semibold text-brand-soft shadow-brand-glow" : "border border-white/10 text-text-vivid hover:border-brand/50 hover:bg-white/5"} disabled:cursor-default`}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-text-muted">E{String(ep.episode_number).padStart(2, "0")}</span>
                        {current && <span className="text-[10px] font-bold uppercase tracking-wide">Playing</span>}
                      </span>
                      <span className="mt-1 block truncate text-sm">{ep.name || `Episode ${ep.episode_number}`}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {roomCode && chatOpen && (
        <div className="fixed bottom-4 right-4 z-30 flex h-80 w-72 flex-col overflow-hidden rounded-2xl border border-white/10 glass shadow-glass">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <p className="text-xs font-semibold text-text-vivid">Movie Night chat · {room.code}</p>
            <button onClick={() => setChatOpen(false)} className="text-text-muted hover:text-text-vivid" aria-label="Close chat">
              ✕
            </button>
          </div>
          <div className="thin-scroll flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {room.messages.map((msg, i) => (
              <div key={i} className="text-xs">
                <span className="font-semibold text-brand-soft">{msg.sender}: </span>
                <span className="text-text-vivid">{msg.text}</span>
              </div>
            ))}
            {room.messages.length === 0 && <p className="text-xs text-text-muted">Say hi to the room 👋</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
            className="flex gap-2 border-t border-white/10 p-2"
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message"
              aria-label="Chat message"
              className="flex-1 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-text-vivid outline-none focus:border-gray-500"
            />
            <button type="submit" className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white" disabled={!chatInput.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
