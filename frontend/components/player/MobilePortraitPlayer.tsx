"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/lib/playerContext";
import { PlayerControls } from "@/components/player/PlayerControls";
import { GestureLayer } from "@/components/player/GestureLayer";
import { SettingsSheet } from "@/components/player/SettingsSheet";
import { NextEpisodeCard } from "@/components/player/NextEpisodeCard";
import { del, get, post, put } from "@/lib/http";
import { useAuth } from "@/components/AuthContext";
import { useMovieNight } from "@/lib/useMovieNight";
import type {
  ApolloStream,
  ApolloSubtitle,
  ContentListResponse,
  Episode,
  MediaComment,
  MediaReactionResponse,
  MediaStreamsResponse,
  MediaSubtitlesResponse,
  PlaybackCue,
  SeasonEpisodes,
  Title,
  TitleDetail,
} from "@/lib/types";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const PROGRESS_KEY = "apollo:progress";
const IDLE_HIDE_MS = 3000;
const NEXT_CARD_SECONDS = 15;

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const sec = Math.floor(s % 60);
  const min = Math.floor((s / 60) % 60);
  const hr = Math.floor(s / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return hr > 0 ? `${hr}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`;
}

const isEmbed = (ct: string) => ct === "text/html";
const providerLabel = (p: string, list: string[] = []) => {
  const idx = list.indexOf(p);
  return `Server ${idx >= 0 ? idx + 1 : 1}`;
};

interface PlaybackSession {
  provider: string;
  stream_url: string;
  content_type: string;
  expires_at: string;
}

interface MobilePortraitPlayerProps {
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

/**
 * MobilePortraitPlayer — the full YouTube-mobile-style watch experience.
 *
 * Layout:
 *   ┌──────────────────────────────┐ ← sticky top
 *   │   VIDEO  (16:9)             │
 *   │   + controls overlay        │
 *   └──────────────────────────────┘
 *   │  scrollable below           │
 *   │  title / actions / episodes │
 *   └──────────────────────────────┘
 *
 * On desktop (≥ 768px) this component is not rendered — the old
 * Player.tsx is used instead. See WatchClient.tsx.
 */
export function MobilePortraitPlayer({
  streamUrl,
  contentType,
  provider: providerProp,
  tmdbId,
  mediaType,
  title: titleProp,
  poster: posterProp,
  season,
  episode,
  roomCode,
}: MobilePortraitPlayerProps) {
  const { user } = useAuth();
  const router = useRouter();
  const playerCtx = usePlayer();

  /* ── Refs ──────────────────────────────────────────────────────────────── */
  const videoRef = playerCtx.videoRef;
  const containerRef = useRef<HTMLDivElement>(null);
  const videoSlotRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const idleTimer = useRef<number>(0);
  const announceTimer = useRef<number>(0);
  const lastReport = useRef(0);
  const embedGotRealProgress = useRef(false);
  const skippedRef = useRef<string>("");

  /* ── Teleport global video into this player slot ────────────────────────── */
  /* The <video> element lives in GlobalPlayer's portal. We move it here on
     mount so React never remounts it, preserving playback state. */
  useEffect(() => {
    const slot = videoSlotRef.current;
    const video = document.getElementById("apollo-global-video") as HTMLVideoElement | null;
    if (!slot || !video) return;

    // Style the video to fill the slot
    video.style.position = "static";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.opacity = "1";
    video.style.pointerEvents = "auto";
    video.style.zIndex = "auto";
    video.style.objectFit = "contain";

    // Apply poster + video attributes
    const backdropPoster = detail?.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}`
      : undefined;
    if (posterProp || backdropPoster) {
      video.poster = posterProp || backdropPoster || "";
    }
    video.playsInline = true;
    video.preload = "metadata";
    (video as any).crossOrigin = "anonymous";

    // Wire events
    const onPlay = () => { playerCtx.setPlaying(true); pokeControls(); };
    const onPause = () => { playerCtx.setPlaying(false); setShowControls(true); };
    const onTimeUpdate = () => playerCtx.setCurrentTime(video.currentTime);
    const onMeta = () => {
      playerCtx.setDuration(video.duration || 0);
      if (savedPos > 5 && video.duration > savedPos) video.currentTime = savedPos;
    };
    const onVolChange = () => { playerCtx.setVolume(video.volume); playerCtx.setMuted(video.muted); };
    const onEnded = () => { playerCtx.setPlaying(false); setNextCard(true); setCountdown(10); };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("volumechange", onVolChange);
    video.addEventListener("ended", onEnded);

    slot.appendChild(video);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("volumechange", onVolChange);
      video.removeEventListener("ended", onEnded);

      // Return the video to document.body
      video.style.position = "fixed";
      video.style.width = "1px";
      video.style.height = "1px";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
      video.style.zIndex = "-1";
      document.body.appendChild(video);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /* ── Open the player context so mini player has state ───────────────────── */
  useEffect(() => {
    playerCtx.open({
      src: streamUrl,
      contentType,
      provider: providerProp || "framextv",
      tmdbId,
      mediaType,
      title: titleProp,
      poster: posterProp || null,
      season: season ?? 1,
      episode: episode ?? 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tmdbId, season, episode]);

  /* ── Provider / stream state ───────────────────────────────────────────── */
  const [src, setSrc] = useState(streamUrl);
  const [activeContentType, setActiveContentType] = useState(contentType);
  const [provider, setProvider] = useState(providerProp || "framextv");
  const [providers, setProviders] = useState<string[]>(["framextv", "stellar", "cinemaos", "videasy", "vidsrc"]);
  const [busyResolve, setBusyResolve] = useState(false);
  const [addonStreams, setAddonStreams] = useState<ApolloStream[]>([]);
  const [addonSubtitles, setAddonSubtitles] = useState<ApolloSubtitle[]>([]);
  const [selectedAddonStream, setSelectedAddonStream] = useState<ApolloStream | null>(null);
  const [addonStreamMenuOpen, setAddonStreamMenuOpen] = useState(false);

  const [seasonNum, setSeasonNum] = useState(season ?? 1);
  const [episodeNum, setEpisodeNum] = useState(episode ?? 1);
  const [savedPos, setSavedPos] = useState(0);

  const embed = !selectedAddonStream && isEmbed(activeContentType);
  const isHls = !embed && (activeContentType === "application/x-mpegURL" || /\.m3u8(\?|$)/i.test(src));
  const useHlsJs = !embed && isHls && typeof window !== "undefined" && Hls.isSupported();

  /* ── Player UI state ───────────────────────────────────────────────────── */
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [rate, setRate] = useState(1);
  const [selectedSubtitle, setSelectedSubtitle] = useState("");

  /* HLS quality */
  const [levels, setLevels] = useState<{ index: number; height: number; label: string }[]>([]);
  const [curLevel, setCurLevel] = useState(-1);

  /* Next episode card */
  const [nextCard, setNextCard] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [autoplayNext, setAutoplayNext] = useState(true);

  /* Skip intro/outro */
  const [cue, setCue] = useState<PlaybackCue | null>(null);

  /* Metadata */
  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [similar, setSimilar] = useState<Title[]>([]);
  const [seasons, setSeasons] = useState<{ season_number: number; name?: string }[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  /* Reactions + watchlist */
  const [userReaction, setUserReaction] = useState<"like" | "dislike" | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  /* Comments */
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  /* ── Derived ────────────────────────────────────────────────────────────── */
  const { playing, currentTime, duration } = playerCtx;
  const displayTitle = titleProp || detail?.title || detail?.name || `${mediaType === "tv" ? "TV Show" : "Movie"} ${tmdbId}`;
  const currentEpisodeObj = episodes.find((e) => e.episode_number === episodeNum);

  /* ── Movie Night ────────────────────────────────────────────────────────── */
  const stateRef = useRef({ playing, currentTime, rate, season: seasonNum, episode: episodeNum });
  stateRef.current = { playing, currentTime, rate, season: seasonNum, episode: episodeNum };

  const room = useMovieNight({
    roomCode: roomCode || null,
    sender: user?.name || user?.email || "Guest",
    onRemoteState: (s) => {
      const video = videoRef.current;
      if (!video) return;
      if (typeof s.time === "number" && Math.abs(video.currentTime - s.time) > 2) {
        video.currentTime = s.time;
        playerCtx.setCurrentTime(s.time);
      }
      if (typeof s.rate === "number" && video.playbackRate !== s.rate) {
        video.playbackRate = s.rate;
        setRate(s.rate);
      }
      if (s.playing !== undefined) {
        if (s.playing) video.play().catch(() => {});
        else video.pause();
      }
    },
  });

  const syncState = useCallback(
    (partial: Record<string, unknown>) => {
      room.broadcastState({ ...stateRef.current, ...partial });
    },
    [room.broadcastState]
  );

  /* ── announce ───────────────────────────────────────────────────────────── */
  const announce = useCallback((text: string) => {
    setAnnouncement(text);
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(""), 2500);
  }, []);

  /* ── Controls auto-hide ─────────────────────────────────────────────────── */
  const pokeControls = useCallback(() => {
    setShowControls(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setShowControls(false), IDLE_HIDE_MS);
  }, []);

  const toggleControls = useCallback(() => {
    setShowControls((v) => {
      const next = !v;
      if (next) {
        window.clearTimeout(idleTimer.current);
        if (playing) {
          idleTimer.current = window.setTimeout(() => setShowControls(false), IDLE_HIDE_MS);
        }
      }
      return next;
    });
  }, [playing]);

  /* ── Progress save ──────────────────────────────────────────────────────── */
  const saveProgress = useCallback(
    async (seconds: number, completed = false, force = false) => {
      try {
        const map = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
        map[`${mediaType}:${tmdbId}`] = seconds;
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
      } catch { /* ignore */ }
      const now = Date.now();
      if (force || now - lastReport.current > 15000) {
        lastReport.current = now;
        if (user) {
          put("/api/v1/me/history", {
            tmdb_id: tmdbId,
            media_type: mediaType,
            progress_seconds: seconds,
            completed,
            ...(mediaType === "tv" ? { season_number: seasonNum, episode_number: episodeNum } : {}),
          }).catch(() => {});
        }
      }
    },
    [tmdbId, mediaType, user, seasonNum, episodeNum]
  );

  /* ── Restore saved position ─────────────────────────────────────────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        const pos = Number(map[`${mediaType}:${tmdbId}`] || 0);
        if (pos > 5) setSavedPos(pos);
      }
    } catch { /* ignore */ }
  }, [tmdbId, mediaType]);

  /* ── Sync saveProgress on video events ──────────────────────────────────── */
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
  }, [saveProgress, embed, videoRef]);

  /* ── Embed postMessage listener ──────────────────────────────────────────── */
  useEffect(() => {
    if (!embed) return;
    const onMessage = (event: MessageEvent) => {
      let data = event.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { return; }
      }
      if (data && typeof data === "object") {
        if (data.event === "frameXTV:timeupdate") {
          const cur = Number(data.currentTime);
          const dur = Number(data.duration);
          if (Number.isFinite(cur) && cur > 0) {
            embedGotRealProgress.current = true;
            playerCtx.setCurrentTime(cur);
            if (Number.isFinite(dur) && dur > 0) playerCtx.setDuration(dur);
            saveProgress(Math.floor(cur), dur > 0 && cur / dur >= 0.95);
          }
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed, saveProgress, playerCtx]);

  /* ── HLS.js setup (for non-global video — embed mode) ───────────────────── */
  useEffect(() => {
    if (embed || !isHls) return;
    const video = videoRef.current;
    if (!video) return;
    if (useHlsJs) {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels.map((l, i) => ({ index: i, height: l.height || 0, label: l.height ? `${l.height}p` : `Level ${i + 1}` })));
        setCurLevel(-1);
        video.play().catch(() => {});
        if (savedPos > 5 && video.duration > savedPos) video.currentTime = savedPos;
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurLevel(data.level));
      return () => { hls.destroy(); hlsRef.current = null; setLevels([]); };
    } else {
      video.src = src;
      video.play().catch(() => {});
    }
  }, [src, isHls, embed, useHlsJs, videoRef, savedPos]);

  /* ── Sync src changes for direct video ──────────────────────────────────── */
  useEffect(() => {
    if (embed || isHls) return;
    const video = videoRef.current;
    if (!video || !src) return;
    video.src = src;
    video.play().catch(() => {});
  }, [src, embed, isHls, videoRef]);

  /* ── Load metadata ───────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    get<TitleDetail>(`/api/v1/content/${mediaType}/${tmdbId}`).then(d => { if (!cancelled && d) setDetail(d); }).catch(() => {});
    get<ContentListResponse>(`/api/v1/content/${mediaType}/${tmdbId}/similar`).then(res => {
      if (!cancelled && res?.results?.length) setSimilar(res.results.slice(0, 10).map(t => ({ ...t, media_type: mediaType })));
    }).catch(() => {});
    get<MediaReactionResponse>(`/api/v1/reactions/${mediaType}/${tmdbId}`).then(rx => {
      if (!cancelled && rx) { setLikesCount(rx.likes_count || 0); setDislikesCount(rx.dislikes_count || 0); setUserReaction(rx.user_reaction || null); }
    }).catch(() => {});
    setCommentsLoading(true);
    get<MediaComment[]>(`/api/v1/comments/${mediaType}/${tmdbId}`).then(list => {
      if (!cancelled && Array.isArray(list)) setComments(list);
    }).catch(() => {}).finally(() => { if (!cancelled) setCommentsLoading(false); });
    if (user) {
      get<{ tmdb_id: number; media_type: string }[]>("/api/v1/me/watchlist").then(list => {
        if (!cancelled && Array.isArray(list)) setInWatchlist(list.some(item => item.tmdb_id === tmdbId && item.media_type === mediaType));
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [tmdbId, mediaType, user]);

  /* ── Load addon streams + subtitles ─────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const base = mediaType === "tv"
      ? `/api/v1/media/${tmdbId}/streams?media_type=tv&season=${seasonNum}&episode=${episodeNum}`
      : `/api/v1/media/${tmdbId}/streams?media_type=movie`;
    get<MediaStreamsResponse>(base).then(res => { if (!cancelled) setAddonStreams(res.streams || []); }).catch(() => {});
    const subBase = mediaType === "tv"
      ? `/api/v1/media/${tmdbId}/subtitles?media_type=tv&season=${seasonNum}&episode=${episodeNum}`
      : `/api/v1/media/${tmdbId}/subtitles?media_type=movie`;
    get<MediaSubtitlesResponse>(subBase).then(res => { if (!cancelled) setAddonSubtitles(res.subtitles || []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [tmdbId, mediaType, seasonNum, episodeNum]);

  /* ── Load cues ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (embed || mediaType !== "tv") return;
    let cancelled = false;
    get<PlaybackCue | null>(`/api/v1/playback/cues?tmdb_id=${tmdbId}&media_type=tv&season=${seasonNum}&episode=${episodeNum}`).then(c => { if (!cancelled) setCue(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, [embed, mediaType, tmdbId, seasonNum, episodeNum]);

  /* ── Load seasons ────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (mediaType !== "tv") return;
    let cancelled = false;
    get<TitleDetail>(`/api/v1/content/tv/${tmdbId}`).then(d => {
      if (cancelled) return;
      const list = (d.seasons || []).filter(s => s.season_number > 0).map(s => ({ season_number: s.season_number, name: s.name }));
      if (list.length) setSeasons(list);
      else if (typeof d.number_of_seasons === "number") setSeasons(Array.from({ length: d.number_of_seasons }, (_, i) => ({ season_number: i + 1 })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [mediaType, tmdbId]);

  /* ── Load episodes ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (mediaType !== "tv") return;
    let cancelled = false;
    setEpisodesLoading(true);
    setEpisodes([]);
    get<SeasonEpisodes>(`/api/v1/content/tv/${tmdbId}/season/${seasonNum}`).then(d => {
      if (!cancelled) setEpisodes((d.episodes || []).filter(e => e.episode_number > 0));
    }).catch(() => {}).finally(() => { if (!cancelled) setEpisodesLoading(false); });
    return () => { cancelled = true; };
  }, [mediaType, tmdbId, seasonNum]);

  /* ── Providers ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    get<string[]>("/api/v1/playback/providers").then(list => {
      if (list.length) setProviders(list);
    }).catch(() => {});
  }, []);

  /* ── Next episode card timer ────────────────────────────────────────────── */
  useEffect(() => {
    if (embed) return;
    if (duration > 0 && duration - currentTime <= NEXT_CARD_SECONDS && currentTime > 0) setNextCard(true);
    else if (duration > 0 && duration - currentTime > NEXT_CARD_SECONDS) setNextCard(false);
  }, [embed, duration, currentTime]);

  useEffect(() => {
    if (!nextCard) { setCountdown(10); return; }
    const iv = window.setInterval(() => setCountdown(c => c - 1), 1000);
    return () => window.clearInterval(iv);
  }, [nextCard]);

  useEffect(() => {
    if (nextCard && countdown <= 0 && autoplayNext) { setNextCard(false); playNextItem(); }
  }, [nextCard, countdown, autoplayNext]);

  /* ── Skip intro / outro window ───────────────────────────────────────────── */
  const inWindow = (kind: "intro" | "outro") => {
    if (!cue || mediaType !== "tv" || skippedRef.current === `${episodeNum}:${kind}`) return false;
    const start = kind === "intro" ? cue.intro_start : cue.outro_start;
    const end = kind === "intro" ? cue.intro_end : cue.outro_end;
    if (typeof start !== "number" || typeof end !== "number") return false;
    return currentTime > 0 && currentTime >= start && currentTime <= Math.max(start, end - 1);
  };
  const showSkipIntro = inWindow("intro");
  const showSkipOutro = inWindow("outro");

  const skipCue = (kind: "intro" | "outro") => {
    const video = videoRef.current;
    if (!video || !cue) return;
    const end = kind === "intro" ? cue.intro_end : cue.outro_end;
    if (typeof end !== "number") return;
    video.currentTime = end;
    playerCtx.setCurrentTime(end);
    skippedRef.current = `${episodeNum}:${kind}`;
    pokeControls();
  };

  /* ── Fullscreen ─────────────────────────────────────────────────────────── */
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    const doc = document as Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
    const inFs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
    try {
      if (inFs) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        try { (screen as any)?.orientation?.unlock(); } catch { /* ok */ }
      } else {
        const c = container as HTMLDivElement & { webkitRequestFullscreen?: () => void };
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (c.webkitRequestFullscreen) c.webkitRequestFullscreen();
        try { await (screen as any)?.orientation?.lock("landscape"); } catch { /* not always permitted */ }
      }
    } catch (err) { console.warn("[fullscreen]", err); }
  }, []);

  useEffect(() => {
    const sync = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const fs = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(fs);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  /* ── Minimize → mini player ─────────────────────────────────────────────── */
  const handleMinimize = useCallback(() => {
    playerCtx.setMode("mini");
    router.back();
  }, [playerCtx, router]);

  /* ── Episode switching ───────────────────────────────────────────────────── */
  const switchEpisode = useCallback(
    async (targetSeason: number, targetEpisode: number) => {
      if (mediaType !== "tv" || busyResolve) return;
      setBusyResolve(true);
      setNextCard(false);
      try {
        const res = await post<PlaybackSession>("/api/v1/playback/resolve", {
          tmdb_id: tmdbId, media_type: "tv", season: targetSeason, episode: targetEpisode, provider,
        });
        setSrc(res.stream_url);
        setSeasonNum(targetSeason);
        setEpisodeNum(targetEpisode);
        setSavedPos(0);
        playerCtx.setCurrentTime(0);
        playerCtx.setEpisode(targetEpisode);
        playerCtx.setSeason(targetSeason);
        skippedRef.current = "";
        const video = videoRef.current;
        if (video) { video.currentTime = 0; video.play().catch(() => {}); pokeControls(); }
        syncState({ season: targetSeason, episode: targetEpisode, time: 0, playing: true });
        const url = new URL(window.location.href);
        url.searchParams.set("season", String(targetSeason));
        url.searchParams.set("episode", String(targetEpisode));
        window.history.replaceState({}, "", url.toString());
      } catch { announce("Could not load that episode"); }
      finally { setBusyResolve(false); }
    },
    [mediaType, busyResolve, tmdbId, announce, pokeControls, syncState, provider, playerCtx, videoRef]
  );

  const playNextItem = useCallback(async () => {
    if (busyResolve) return;
    setNextCard(false);
    if (mediaType === "tv") {
      const hasNext = episodes.some(e => e.episode_number === episodeNum + 1);
      if (hasNext || episodes.length === 0) await switchEpisode(seasonNum, episodeNum + 1);
      else {
        const nextSeason = seasons.find(s => s.season_number > seasonNum);
        if (nextSeason) await switchEpisode(nextSeason.season_number, 1);
        else announce("Reached the last episode!");
      }
    } else if (similar.length > 0) {
      const next = similar[0];
      router.push(`/watch/${next.media_type || "movie"}/${next.id}`);
    } else announce("No recommendations available");
  }, [mediaType, busyResolve, seasonNum, episodeNum, switchEpisode, episodes, seasons, similar, router, announce]);

  /* ── Change provider ─────────────────────────────────────────────────────── */
  const changeProvider = useCallback(async (target: string) => {
    if (busyResolve || (target === provider && !selectedAddonStream)) return;
    setBusyResolve(true);
    try {
      const res = await post<PlaybackSession>("/api/v1/playback/resolve", {
        tmdb_id: tmdbId, media_type: mediaType, season: seasonNum, episode: episodeNum, provider: target,
      });
      setSelectedAddonStream(null);
      setActiveContentType(res.content_type || "text/html");
      setSrc(res.stream_url);
      setProvider(target);
      embedGotRealProgress.current = false;
      announce(`Source: ${providerLabel(target, providers)}`);
    } catch { announce("Could not load that source"); }
    finally { setBusyResolve(false); }
  }, [busyResolve, provider, selectedAddonStream, tmdbId, mediaType, seasonNum, episodeNum, announce, providers]);

  /* ── Quality ─────────────────────────────────────────────────────────────── */
  const setQuality = (index: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = index;
    setCurLevel(index);
    announce(index === -1 ? "Quality: Auto" : `Quality: ${levels.find(l => l.index === index)?.label ?? index}p`);
  };

  /* ── Watchlist ───────────────────────────────────────────────────────────── */
  const toggleWatchlist = async () => {
    if (!user) { announce("Please sign in to save to your watchlist"); return; }
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        await del(`/api/v1/me/watchlist/${mediaType}/${tmdbId}`);
        setInWatchlist(false); announce("Removed from Watchlist");
      } else {
        await post("/api/v1/me/watchlist", { tmdb_id: tmdbId, media_type: mediaType });
        setInWatchlist(true); announce("Added to Watchlist");
      }
    } catch { announce("Could not update watchlist"); }
    finally { setWatchlistLoading(false); }
  };

  /* ── Reactions ───────────────────────────────────────────────────────────── */
  const handleMediaReaction = async (target: "like" | "dislike") => {
    if (!user) { announce("Please sign in to like or dislike titles."); return; }
    const nextRx = userReaction === target ? "none" : target;
    try {
      const updated = await post<MediaReactionResponse>("/api/v1/reactions", { tmdb_id: tmdbId, media_type: mediaType, reaction: nextRx });
      setUserReaction(updated.user_reaction || null); setLikesCount(updated.likes_count || 0); setDislikesCount(updated.dislikes_count || 0);
      announce(nextRx === "none" ? "Reaction removed" : `Marked as ${nextRx}`);
    } catch { announce("Could not save reaction"); }
  };

  /* ── Share ───────────────────────────────────────────────────────────────── */
  const copyShareLink = () => {
    try { navigator.clipboard.writeText(window.location.href); setShareCopied(true); announce("Link copied!"); setTimeout(() => setShareCopied(false), 2500); }
    catch { announce("Could not copy link"); }
  };

  /* ── Comments ────────────────────────────────────────────────────────────── */
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { announce("Please sign in to comment."); return; }
    const text = newCommentText.trim();
    if (!text || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const added = await post<MediaComment>("/api/v1/comments", { tmdb_id: tmdbId, media_type: mediaType, text });
      setComments([added, ...comments]); setNewCommentText(""); announce("Comment posted!");
    } catch { announce("Could not post comment"); }
    finally { setCommentSubmitting(false); }
  };

  const toggleCommentLike = async (commentId: number) => {
    if (!user) { announce("Please sign in to like comments."); return; }
    try {
      const res = await post<{ liked: boolean; likes_count: number }>(`/api/v1/comments/${commentId}/like`);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, is_liked: res.liked, likes_count: res.likes_count } : c));
    } catch { announce("Could not update comment like"); }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!user) return;
    try {
      await del(`/api/v1/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId)); announce("Comment deleted!");
    } catch { announce("Could not delete comment"); }
  };

  /* ── Keyboard shortcuts (desktop fallback) ───────────────────────────────── */
  useEffect(() => {
    if (embed) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      const video = videoRef.current;
      if (!video) return;
      if (key === " " || key === "k") { e.preventDefault(); if (video.paused) video.play().catch(() => {}); else video.pause(); }
      else if (key === "f") { e.preventDefault(); toggleFullscreen(); }
      else if (key === "m") { e.preventDefault(); video.muted = !video.muted; }
      else if (key === "j") { video.currentTime = Math.max(0, video.currentTime - 10); }
      else if (key === "l") { video.currentTime = Math.min(video.duration, video.currentTime + 10); }
      else if (e.key === "ArrowLeft") { video.currentTime = Math.max(0, video.currentTime - 5); }
      else if (e.key === "ArrowRight") { video.currentTime = Math.min(video.duration, video.currentTime + 5); }
      pokeControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embed, toggleFullscreen, pokeControls, videoRef]);

  /* ── Embed src ───────────────────────────────────────────────────────────── */
  const embedSrc = (() => {
    if (!embed) return src;
    try {
      const u = new URL(src, typeof window !== "undefined" ? window.location.href : "http://localhost");
      if (!u.searchParams.has("color")) u.searchParams.set("color", "FF0A47");
      if (savedPos > 5) u.searchParams.set("progress", String(Math.floor(savedPos)));
      return u.toString();
    } catch { return src; }
  })();

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-dvh flex-col bg-[#09090b]" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>

      {/* ═══ STICKY VIDEO PLAYER (16:9) ══════════════════════════════════ */}
      <div className="mobile-player-sticky">
        <div
          ref={containerRef}
          className="relative aspect-video w-full bg-black"
          onPointerMove={pokeControls}
        >
          {/* ── Embed (iframe) mode ────────────────────────────────────── */}
          {embed ? (
            <iframe
              ref={iframeRef}
              key={`${tmdbId}-${seasonNum}-${episodeNum}-${embedSrc}`}
              src={embedSrc}
              title={displayTitle}
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              className="h-full w-full border-0"
            />
          ) : (
            /* ── Teleported global <video> slot ──────────────────────── */
            /* The actual <video> element is moved here from GlobalPlayer's portal */
            <div
              ref={videoSlotRef}
              className="h-full w-full"
              style={{ background: "#000" }}
            />
          )}

          {/* ── Gesture layer (tap/double-tap/swipe) ─────────────────── */}
          {!embed && (
            <GestureLayer
              onToggleControls={toggleControls}
              onSwipeDown={handleMinimize}
            />
          )}

          {/* ── Controls overlay ─────────────────────────────────────── */}
          {!embed && (
            <PlayerControls
              visible={showControls}
              isFullscreen={isFullscreen}
              onMinimize={handleMinimize}
              onFullscreen={toggleFullscreen}
              onSettings={() => setSettingsOpen(true)}
              onPrev={mediaType === "tv" && episodeNum > 1 ? () => switchEpisode(seasonNum, episodeNum - 1) : undefined}
              onNext={mediaType === "tv" ? playNextItem : undefined}
              hasPrev={mediaType === "tv" && episodeNum > 1}
              hasNext={mediaType === "tv"}
              showSkipIntro={showSkipIntro}
              showSkipOutro={showSkipOutro}
              onSkipIntro={() => skipCue("intro")}
              onSkipOutro={() => skipCue("outro")}
            />
          )}

          {/* ── Next episode card ─────────────────────────────────────── */}
          {!embed && nextCard && mediaType === "tv" && (
            <NextEpisodeCard
              isVisible={nextCard}
              countdown={countdown}
              seasonNum={seasonNum}
              episodeNum={episodeNum + 1}
              episodeName={episodes.find(e => e.episode_number === episodeNum + 1)?.name}
              thumbnail={
                episodes.find(e => e.episode_number === episodeNum + 1)?.still_path
                  ? `https://image.tmdb.org/t/p/w300${episodes.find(e => e.episode_number === episodeNum + 1)?.still_path}`
                  : detail?.backdrop_path
                  ? `https://image.tmdb.org/t/p/w300${detail.backdrop_path}`
                  : null
              }
              onPlayNow={playNextItem}
              onCancel={() => setNextCard(false)}
            />
          )}

          {/* ── Settings sheet ────────────────────────────────────────── */}
          <SettingsSheet
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            levels={levels}
            curLevel={curLevel}
            onQualityChange={setQuality}
            rate={rate}
            onRateChange={(r) => {
              setRate(r);
              const video = videoRef.current;
              if (video) video.playbackRate = r;
              announce(`Speed: ${r}×`);
            }}
            subtitleLanguage={selectedSubtitle}
            onSubtitleChange={setSelectedSubtitle}
            subtitleOptions={addonSubtitles.map(s => ({ id: s.id, language: s.language, label: s.language.toUpperCase() }))}
          />
        </div>
      </div>

      {/* ═══ SCROLLABLE CONTENT BELOW ════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto overscroll-y-none pb-safe-bottom">
        <div className="px-4 pt-3 space-y-4 pb-8">

          {/* ── Title + episode info ──────────────────────────────────── */}
          <div>
            <h1 className="text-lg font-black leading-snug text-white tracking-tight line-clamp-2">
              {displayTitle}
            </h1>
            {mediaType === "tv" && (
              <p className="font-mono text-xs tracking-widest uppercase text-[var(--brand-accent)] mt-1 font-semibold">
                Season {seasonNum} · Episode {episodeNum}
                {currentEpisodeObj?.name ? ` · ${currentEpisodeObj.name}` : ""}
              </p>
            )}
            {/* Meta row */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-white/50 font-mono">
              {detail?.release_date?.slice(0, 4) && <span>{detail.release_date.slice(0, 4)}</span>}
              {detail?.first_air_date?.slice(0, 4) && <span>{detail.first_air_date.slice(0, 4)}</span>}
              {detail?.runtime && <span>· {Math.floor(detail.runtime / 60)}h {detail.runtime % 60}m</span>}
              {detail?.vote_average ? <span className="text-[var(--brand-accent)] font-bold">★ {detail.vote_average.toFixed(1)}</span> : null}
            </div>
          </div>

          {/* ── Action chips ─────────────────────────────────────────── */}
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {/* Like / dislike */}
            <div className="flex shrink-0 divide-x divide-white/10 overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
              <button
                id="player-like-btn"
                onClick={() => handleMediaReaction("like")}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition hover:bg-white/10 ${userReaction === "like" ? "text-[var(--brand-accent)]" : "text-white/60"}`}
              >
                <span>👍</span><span>{likesCount}</span>
              </button>
              <button
                id="player-dislike-btn"
                onClick={() => handleMediaReaction("dislike")}
                className={`flex items-center gap-1 px-3.5 py-2 text-xs font-semibold transition hover:bg-white/10 ${userReaction === "dislike" ? "text-[var(--brand-accent)]" : "text-white/60"}`}
              >
                <span>👎</span>
              </button>
            </div>

            {/* Share */}
            <button
              id="player-share-btn"
              onClick={copyShareLink}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              🔗 {shareCopied ? "Copied!" : "Share"}
            </button>

            {/* Watchlist */}
            <button
              id="player-watchlist-btn"
              onClick={toggleWatchlist}
              disabled={watchlistLoading}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                inWatchlist
                  ? "border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]"
                  : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {inWatchlist ? "✓ Saved" : "+ Save"}
            </button>

            {/* Back to details */}
            <Link
              href={mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`}
              id="player-details-link"
              className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              ← Details
            </Link>
          </div>

          {/* ── Server selector ─────────────────────────────────────── */}
          {providers.length > 1 && (
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
              <span className="shrink-0 self-center font-mono text-[10px] uppercase tracking-widest text-white/40">Server</span>
              {providers.map((p, idx) => (
                <button
                  key={p}
                  id={`player-provider-${idx}`}
                  onClick={() => changeProvider(p)}
                  disabled={busyResolve || (p === provider && !selectedAddonStream)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    p === provider && !selectedAddonStream
                      ? "bg-[var(--brand-accent)] text-[var(--brand-accent-text)] shadow-brand-glow"
                      : "border border-white/10 bg-white/[0.04] text-white/60 hover:text-white"
                  }`}
                >
                  {providerLabel(p, providers)}
                </button>
              ))}
            </div>
          )}

          {/* ── Description ─────────────────────────────────────────── */}
          <div
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 cursor-pointer"
            onClick={() => setShowFullDescription(v => !v)}
          >
            <p className={`text-sm leading-relaxed text-white/70 ${showFullDescription ? "" : "line-clamp-2"}`}>
              {detail?.overview || currentEpisodeObj?.overview || "No description available."}
            </p>
            {detail?.genres && detail.genres.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.genres.map(g => (
                  <span key={g.id} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50">
                    {g.name}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 font-mono text-xs font-semibold text-[var(--brand-accent)]">
              {showFullDescription ? "Show less" : "...more"}
            </p>
          </div>

          {/* ── TV: Season selector + episode list ──────────────────── */}
          {mediaType === "tv" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h2 className="font-bold text-sm text-white">Episodes</h2>
                {seasons.length > 1 && (
                  <select
                    value={seasonNum}
                    onChange={(e) => setSeasonNum(Number(e.target.value))}
                    className="rounded-full bg-black/60 border border-white/10 px-3 py-1 font-mono text-xs text-white outline-none"
                    id="player-season-select"
                  >
                    {seasons.map(s => (
                      <option key={s.season_number} value={s.season_number} className="bg-[#09090b]">
                        {s.name || `Season ${s.season_number}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto thin-scroll divide-y divide-white/[0.05]">
                {episodesLoading ? (
                  <div className="p-4 text-center font-mono text-xs text-white/40 animate-pulse">Loading episodes…</div>
                ) : episodes.length === 0 ? (
                  <div className="p-4 text-center text-xs text-white/40">No episodes found.</div>
                ) : episodes.map(ep => {
                  const isCurrent = ep.episode_number === episodeNum;
                  return (
                    <button
                      key={ep.episode_number}
                      id={`player-episode-${ep.episode_number}`}
                      onClick={() => switchEpisode(seasonNum, ep.episode_number)}
                      disabled={busyResolve || isCurrent}
                      className={`flex w-full gap-3 px-3 py-2.5 text-left transition ${
                        isCurrent ? "bg-[var(--brand-accent)]/10" : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg bg-black/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : (detail?.backdrop_path ? `https://image.tmdb.org/t/p/w300${detail.backdrop_path}` : "/placeholder-backdrop.svg")}
                          alt={ep.name || `Episode ${ep.episode_number}`}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 font-mono text-[8px] font-bold text-white">
                          E{String(ep.episode_number).padStart(2, "0")}
                        </span>
                        {isCurrent && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[var(--brand-accent)]/40 text-[var(--brand-accent-text)] text-xs font-bold">▶</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className={`truncate text-xs font-semibold ${isCurrent ? "text-[var(--brand-accent)]" : "text-white"}`}>
                          {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-white/50">{ep.overview || "No overview"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Up next / similar ────────────────────────────────────── */}
          {similar.length > 0 && (
            <div>
              <h2 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--brand-accent)]">More like this</h2>
              <div className="space-y-2.5">
                {similar.map(item => {
                  const media = item.media_type || "movie";
                  const itemTitle = item.title || item.name || "Untitled";
                  const thumb = item.backdrop_path
                    ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
                    : item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "/placeholder-backdrop.svg";
                  return (
                    <Link
                      key={item.id}
                      href={`/watch/${media}/${item.id}`}
                      id={`similar-${item.id}`}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2 transition hover:bg-white/[0.06]"
                    >
                      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumb} alt={itemTitle} className="h-full w-full object-cover" />
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 font-mono text-[8px] font-bold text-white">{media === "tv" ? "TV" : "Movie"}</span>
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-white">{itemTitle}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-white/40">
                          {item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || ""}
                          {item.vote_average ? ` · ★ ${item.vote_average.toFixed(1)}` : ""}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Comments ────────────────────────────────────────────── */}
          <div className="space-y-4 pt-2">
            <h2 className="font-bold text-sm text-white">Comments <span className="text-white/40 font-normal">({comments.length})</span></h2>
            {user ? (
              <form onSubmit={handleAddComment} className="flex gap-3 items-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] font-bold text-xs">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    disabled={commentSubmitting}
                    className="w-full border-b border-white/10 bg-transparent py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-[var(--brand-accent)]/60 transition"
                  />
                  {newCommentText.trim() && (
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setNewCommentText("")} className="rounded-full px-4 py-1.5 text-xs font-semibold text-white/50 hover:text-white transition">Cancel</button>
                      <button type="submit" disabled={commentSubmitting} className="cinema-btn-accent px-5 py-1.5 text-xs font-bold disabled:opacity-50">
                        {commentSubmitting ? "Posting…" : "Post"}
                      </button>
                    </div>
                  )}
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
                <p className="text-xs text-white/40 mb-2">Sign in to leave a comment.</p>
                <Link href="/login" className="cinema-btn-accent px-5 py-1.5 text-xs font-bold">Sign In</Link>
              </div>
            )}

            <div className="space-y-4">
              {commentsLoading ? (
                <div className="py-4 text-center text-xs text-white/30 animate-pulse">Loading comments…</div>
              ) : comments.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-xs text-white/30">
                  No comments yet. Be the first!
                </div>
              ) : comments.map(comment => (
                <div key={comment.id} className="flex gap-3 text-sm">
                  {comment.author_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={comment.author_avatar} alt={comment.author_name} className="h-8 w-8 rounded-full object-cover shrink-0 border border-white/10" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] font-bold text-xs">
                      {comment.author_name?.[0]?.toUpperCase() || "A"}
                    </div>
                  )}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{comment.author_name}</span>
                      <span className="font-mono text-[10px] text-white/30">{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-white/60 leading-normal">{comment.text}</p>
                    <div className="flex items-center gap-3 text-xs text-white/40 pt-0.5">
                      <button
                        onClick={() => toggleCommentLike(comment.id)}
                        className={`flex items-center gap-1 transition ${comment.is_liked ? "text-[var(--brand-accent)]" : "hover:text-white"}`}
                      >
                        👍 {comment.likes_count}
                      </button>
                      {user && comment.user_id === user.id && (
                        <button onClick={() => handleDeleteComment(comment.id)} className="text-red-400/60 hover:text-red-400 transition">Delete</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Screen-reader announcements */}
      <div aria-live="polite" className="sr-only">{announcement}</div>
    </div>
  );
}
