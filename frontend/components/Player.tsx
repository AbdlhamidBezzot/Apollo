"use client";

import Link from "next/link";
import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { del, get, post, put } from "@/lib/http";
import { Ad300x250 } from "@/components/Ad300x250";
import { useAuth } from "@/components/AuthContext";
import { useMovieNight } from "@/lib/useMovieNight";

import type {
  ApolloStream,
  ApolloSubtitle,
  ContentListResponse,
  Episode,
  MediaStreamsResponse,
  MediaSubtitlesResponse,
  PlaybackCue,
  SeasonEpisodes,
  Title,
  TitleDetail,
} from "@/lib/types";

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

interface CommentItem {
  id: string;
  author: string;
  avatar: string;
  text: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
}

const PROGRESS_KEY = "apollo:progress";
const PROVIDER_KEY = "apollo:provider";
const IDLE_HIDE_MS = 3000;
const NEXT_CARD_SECONDS = 15;

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

export function Player({
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
}: PlayerProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Playback States
  const [rate, setRate] = useState(1);
  const [savedPos, setSavedPos] = useState(0);
  const lastReport = useRef(0);
  const [provider, setProvider] = useState<string>(providerProp || "cinemaos");
  const embed = isEmbed(contentType);
  const embedGotRealProgress = useRef(false);

  const [src, setSrc] = useState(streamUrl);
  const [seasonNum, setSeasonNum] = useState(season ?? 1);
  const [episodeNum, setEpisodeNum] = useState(episode ?? 1);
  const [busyResolve, setBusyResolve] = useState(false);
  const [providers, setProviders] = useState<string[]>(["cinemaos", "videasy", "vidsrc"]);

  // Details & Recommendations
  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [similar, setSimilar] = useState<Title[]>([]);
  const [seasons, setSeasons] = useState<{ season_number: number; name?: string }[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // Player controls
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
  const [autoplayNext, setAutoplayNext] = useState(true);

  const isHls = !embed && (contentType === "application/x-mpegURL" || /\.m3u8(\?|$)/i.test(src));
  const useHlsJs = !embed && isHls && typeof window !== "undefined" && Hls.isSupported();

  // Embed provider URL
  const embedSrc = useMemo(() => {
    if (!embed) return src;
    try {
      const u = new URL(src, window.location.href);
      if (!u.searchParams.has("color")) u.searchParams.set("color", "FF0A47");
      if (savedPos > 5) u.searchParams.set("progress", String(Math.floor(savedPos)));
      return u.toString();
    } catch {
      return src;
    }
  }, [embed, src, savedPos]);

  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<{ index: number; height: number; label: string }[]>([]);
  const [curLevel, setCurLevel] = useState(-1);
  const [qualityOpen, setQualityOpen] = useState(false);

  // Add-ons & Subtitles
  const [addonSubtitles, setAddonSubtitles] = useState<ApolloSubtitle[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [addonStreams, setAddonStreams] = useState<ApolloStream[]>([]);
  const [selectedAddonStream, setSelectedAddonStream] = useState<ApolloStream | null>(null);
  const [addonStreamMenuOpen, setAddonStreamMenuOpen] = useState<boolean>(false);

  // Cues & Skip
  const [cue, setCue] = useState<PlaybackCue | null>(null);
  const [cueMenuOpen, setCueMenuOpen] = useState(false);
  const [marking, setMarking] = useState<"intro" | "outro" | null>(null);
  const [markingStart, setMarkingStart] = useState(0);
  const skippedRef = useRef<string>("");

  const idleTimer = useRef<number>(0);
  const announceTimer = useRef<number>(0);

  // YouTube Action States
  const [userVote, setUserVote] = useState<"like" | "dislike" | null>(null);
  const [likeCount, setLikeCount] = useState(1420);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // YouTube Comments
  const [comments, setComments] = useState<CommentItem[]>([
    {
      id: "c1",
      author: "Alex Rivers",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      text: "The cinematography and sound design in this release are absolutely phenomenal! 10/10 streaming experience.",
      timestamp: "2 hours ago",
      likes: 42,
    },
    {
      id: "c2",
      author: "Marcus Chen",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
      text: "Awesome server speed and HD quality. Apollo never disappoints 🔥",
      timestamp: "5 hours ago",
      likes: 19,
    },
    {
      id: "c3",
      author: "Elena Rostova",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      text: "Can't wait to watch the next episode! Movie Night feature made watching with friends super smooth.",
      timestamp: "1 day ago",
      likes: 8,
    },
  ]);
  const [newComment, setNewComment] = useState("");

  // Movie Night sync room
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
        if (s.playing) video.play().catch(() => {});
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

  // Restore last position from localStorage
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
      /* ignore */
    }
  }, [tmdbId, mediaType]);

  // Load Title Details, Similar titles, and Watchlist status
  useEffect(() => {
    let cancelled = false;
    get<TitleDetail>(`/api/v1/content/${mediaType}/${tmdbId}`)
      .then((d) => {
        if (!cancelled && d) {
          setDetail(d);
          if (d.vote_count) setLikeCount(Math.floor(d.vote_count / 8) + 120);
        }
      })
      .catch(() => {});

    get<ContentListResponse>(`/api/v1/content/${mediaType}/${tmdbId}/similar`)
      .then((res) => {
        if (!cancelled && res?.results?.length) {
          setSimilar(res.results.slice(0, 10).map((t) => ({ ...t, media_type: mediaType })));
        } else {
          // Fallback to popular content if similar returns empty
          get<ContentListResponse>(`/api/v1/content/popular?media_type=${mediaType}`)
            .then((pop) => {
              if (!cancelled && pop?.results) {
                setSimilar(pop.results.filter((t) => t.id !== tmdbId).slice(0, 10));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    if (user) {
      get<{ tmdb_id: number; media_type: string }[]>("/api/v1/me/watchlist")
        .then((list) => {
          if (!cancelled && Array.isArray(list)) {
            setInWatchlist(list.some((item) => item.tmdb_id === tmdbId && item.media_type === mediaType));
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType, user]);

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
  }, [saveProgress, embed]);

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
        /* ignore */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed, saveProgress]);

  // Load add-on streams & subtitles
  useEffect(() => {
    let cancelled = false;
    const base =
      mediaType === "tv"
        ? `/api/v1/media/${tmdbId}/streams?media_type=tv&season=${seasonNum}&episode=${episodeNum}`
        : `/api/v1/media/${tmdbId}/streams?media_type=movie`;
    get<MediaStreamsResponse>(base)
      .then((res) => {
        if (!cancelled) setAddonStreams(res.streams || []);
      })
      .catch(() => {});
    const subBase =
      mediaType === "tv"
        ? `/api/v1/media/${tmdbId}/subtitles?media_type=tv&season=${seasonNum}&episode=${episodeNum}`
        : `/api/v1/media/${tmdbId}/subtitles?media_type=movie`;
    get<MediaSubtitlesResponse>(subBase)
      .then((res) => {
        if (!cancelled) setAddonSubtitles(res.subtitles || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType, seasonNum, episodeNum]);

  // Load cues
  useEffect(() => {
    if (embed || mediaType !== "tv") return;
    let cancelled = false;
    get<PlaybackCue | null>(
      `/api/v1/playback/cues?tmdb_id=${tmdbId}&media_type=tv&season=${seasonNum}&episode=${episodeNum}`
    )
      .then((c) => {
        if (!cancelled) setCue(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [embed, mediaType, tmdbId, seasonNum, episodeNum]);

  // Load season list
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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mediaType, tmdbId]);

  // Load episodes for season
  useEffect(() => {
    if (mediaType !== "tv") return;
    let cancelled = false;
    setEpisodesLoading(true);
    setEpisodes([]);
    get<SeasonEpisodes>(`/api/v1/content/tv/${tmdbId}/season/${seasonNum}`)
      .then((d) => {
        if (!cancelled) setEpisodes((d.episodes || []).filter((e) => e.episode_number > 0));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEpisodesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType, tmdbId, seasonNum]);

  // HLS logic
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
          data.levels.map((l, i) => ({
            index: i,
            height: l.height || 0,
            label: l.height ? `${l.height}p` : `Level ${i + 1}`,
          }))
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
      video.play().catch(() => {});
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
        /* ignore */
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
          video.play().catch(() => {});
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
    [busyResolve, provider, tmdbId, mediaType, seasonNum, episodeNum, announce, providers]
  );

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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
    if (nextCard && countdown <= 0 && autoplayNext) playNextEpisode();
  }, [nextCard, countdown, autoplayNext, playNextEpisode]);

  // Keyboard controls
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

  // YouTube Actions Handlers
  const handleLike = (isLike: boolean) => {
    if (userVote === (isLike ? "like" : "dislike")) {
      setUserVote(null);
      if (isLike) setLikeCount((c) => c - 1);
    } else {
      if (userVote === "like") setLikeCount((c) => c - 1);
      if (isLike) setLikeCount((c) => c + 1);
      setUserVote(isLike ? "like" : "dislike");
    }
  };

  const toggleWatchlist = async () => {
    if (!user) {
      announce("Please log in to save to your watchlist");
      return;
    }
    setWatchlistLoading(true);
    try {
      if (inWatchlist) {
        await del(`/api/v1/me/watchlist/${mediaType}/${tmdbId}`);
        setInWatchlist(false);
        announce("Removed from Watchlist");
      } else {
        await post("/api/v1/me/watchlist", { tmdb_id: tmdbId, media_type: mediaType });
        setInWatchlist(true);
        announce("Added to Watchlist");
      }
    } catch {
      announce("Could not update watchlist");
    } finally {
      setWatchlistLoading(false);
    }
  };

  const copyShareLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      announce("Link copied to clipboard!");
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      announce("Could not copy link");
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const added: CommentItem = {
      id: `c-${Date.now()}`,
      author: user?.name || user?.email || "Guest Viewer",
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
      text: newComment.trim(),
      timestamp: "Just now",
      likes: 0,
    };
    setComments([added, ...comments]);
    setNewComment("");
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    room.sendChat(text);
    setChatInput("");
  };

  const currentEpisodeObj = useMemo(() => {
    return episodes.find((e) => e.episode_number === episodeNum);
  }, [episodes, episodeNum]);

  const displayTitle = titleProp || detail?.title || detail?.name || `${mediaType === "tv" ? "TV Show" : "Movie"} ${tmdbId}`;

  return (
    <div className="mx-auto max-w-[1750px] px-3 sm:px-6 py-4">
      {/* 2-Column YouTube Watch Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Video Player & Video Details & Comments */}
        <div className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 space-y-4">
          {/* Main Video Frame */}
          {embed ? (
            <div
              ref={containerRef}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl"
              onDoubleClick={fullscreen}
            >
              <iframe
                src={embedSrc}
                title={displayTitle}
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                className="aspect-video w-full"
              />
              <button
                onClick={fullscreen}
                aria-label="Toggle fullscreen"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur transition hover:bg-brand"
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
              className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl ${
                showControls ? "" : "player-idle"
              }`}
              onPointerMove={pokeControls}
              onPointerLeave={() => setShowControls(false)}
              onDoubleClick={fullscreen}
            >
              <video
                ref={videoRef}
                src={useHlsJs ? undefined : src}
                poster={posterProp || detail?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail?.backdrop_path}` : undefined}
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
                {addonSubtitles.map((sub) => (
                  <track
                    key={sub.id}
                    kind="subtitles"
                    src={sub.url}
                    srcLang={sub.language}
                    label={sub.language.toUpperCase()}
                    default={selectedSubtitle === sub.id}
                  />
                ))}
              </video>

              {/* Gradient overlays */}
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
                  showControls ? "opacity-100" : "opacity-0"
                }`}
              />

              {!playing && showControls && (
                <button
                  onClick={togglePlay}
                  aria-label="Play"
                  className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand/90 text-2xl text-white shadow-brand-glow transition hover:scale-110"
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

              {/* Bottom Video Controls Bar */}
              <div
                className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-3 pt-12 transition-opacity duration-300 ${
                  showControls ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <div className="relative mb-2">
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
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-brand hover:h-2 transition-all"
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
                              className={`absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 ${
                                m.kind === "intro" ? "bg-amber-400" : "bg-emerald-400"
                              }`}
                              style={{ left: `${Math.min(100, Math.max(0, (m.t / duration) * 100))}%` }}
                            />
                          ))}
                        </div>
                      );
                    })()}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-3">
                    <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="text-white hover:text-brand-soft text-lg">
                      {playing ? "❚❚" : "▶"}
                    </button>
                    {mediaType === "tv" && (
                      <button onClick={playNextEpisode} aria-label="Next episode" className="text-white hover:text-brand-soft" disabled={busyResolve}>
                        ⏭
                      </button>
                    )}
                    <button onClick={toggleMute} aria-label="Mute" className="text-white hover:text-brand-soft">
                      {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                    </button>
                    <span className="font-mono text-xs tabular-nums text-text-muted">
                      {fmtTime(currentTime)} / {fmtTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
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
                              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/5 ${
                                curLevel === -1 ? "font-semibold text-brand-soft" : "text-text-vivid"
                              }`}
                            >
                              Auto
                            </button>
                            {levels.map((l) => (
                              <button
                                key={l.index}
                                onClick={() => setQuality(l.index)}
                                className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/5 ${
                                  curLevel === l.index ? "font-semibold text-brand-soft" : "text-text-vivid"
                                }`}
                              >
                                {l.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Addon Stream Picker */}
                    {addonStreams.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => {
                            setAddonStreamMenuOpen((v) => !v);
                            setSubtitleMenuOpen(false);
                          }}
                          aria-label="Add-on sources"
                          aria-expanded={addonStreamMenuOpen}
                          className="rounded border border-white/10 px-2 py-0.5 font-mono text-[11px] text-text-muted hover:border-brand/50 hover:text-white"
                        >
                          Sources ({addonStreams.length})
                        </button>
                        {addonStreamMenuOpen && (
                          <div className="absolute bottom-full right-0 z-20 mb-2 w-64 overflow-hidden rounded-lg border border-white/10 glass shadow-glass">
                            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted border-b border-white/10">
                              Add-on Sources
                            </p>
                            {addonStreams.map((stream) => (
                              <button
                                key={stream.id}
                                onClick={() => {
                                  if (stream.url) {
                                    if (stream.url.startsWith("magnet:")) {
                                      window.open(stream.url, "_blank");
                                    } else {
                                      setSrc(stream.url);
                                      setSelectedAddonStream(stream);
                                    }
                                  }
                                  setAddonStreamMenuOpen(false);
                                }}
                                className={`block w-full px-3 py-2 text-left text-xs hover:bg-white/5 ${
                                  selectedAddonStream?.id === stream.id ? "text-brand-soft font-semibold" : "text-text-vivid"
                                }`}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span className="truncate">{stream.title || stream.addon_name}</span>
                                  <span className="flex shrink-0 gap-1">
                                    {stream.quality && (
                                      <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-bold">{stream.quality}</span>
                                    )}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Subtitles */}
                    {addonSubtitles.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => {
                            setSubtitleMenuOpen((v) => !v);
                            setAddonStreamMenuOpen(false);
                          }}
                          aria-label="Subtitles"
                          aria-expanded={subtitleMenuOpen}
                          className={`rounded border px-2 py-0.5 font-mono text-[11px] transition hover:text-white ${
                            selectedSubtitle ? "border-brand/50 text-brand-soft" : "border-white/10 text-text-muted hover:border-brand/50"
                          }`}
                        >
                          CC
                        </button>
                        {subtitleMenuOpen && (
                          <div className="absolute bottom-full right-0 z-20 mb-2 w-48 overflow-hidden rounded-lg border border-white/10 glass shadow-glass">
                            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted border-b border-white/10">
                              Subtitles
                            </p>
                            <button
                              onClick={() => {
                                setSelectedSubtitle(null);
                                setSubtitleMenuOpen(false);
                              }}
                              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/5 ${
                                !selectedSubtitle ? "font-semibold text-brand-soft" : "text-text-vivid"
                              }`}
                            >
                              Off
                            </button>
                            {addonSubtitles.map((sub) => (
                              <button
                                key={sub.id}
                                onClick={() => {
                                  setSelectedSubtitle(sub.id);
                                  setSubtitleMenuOpen(false);
                                }}
                                className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/5 ${
                                  selectedSubtitle === sub.id ? "font-semibold text-brand-soft" : "text-text-vivid"
                                }`}
                              >
                                {sub.language.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={fullscreen}
                      aria-label="Toggle fullscreen"
                      className="text-white hover:text-brand-soft"
                    >
                      ⛶
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Title Heading */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{displayTitle}</h1>
            {mediaType === "tv" && (
              <p className="text-sm text-text-muted font-medium mt-1">
                Season {seasonNum} Episode {episodeNum} {currentEpisodeObj?.name ? `• ${currentEpisodeObj.name}` : ""}
              </p>
            )}
          </div>

          {/* YouTube Channel & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-1 border-b border-white/10 pb-4">
            {/* Channel Info */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand to-purple-600 text-white font-bold text-lg shadow-md">
                A
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm text-white">Apollo Cinema</span>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-white" title="Verified Streamer">
                    ✓
                  </span>
                </div>
                <p className="text-xs text-text-muted">1.2M subscribers • Free HD Stream</p>
              </div>
              <button
                onClick={() => announce("Subscribed to Apollo Cinema")}
                className="ml-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-gray-200"
              >
                Subscribe
              </button>
            </div>

            {/* Action Pills Group */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {/* Like / Dislike Pill */}
              <div className="flex items-center rounded-full bg-white/10 border border-white/5 divide-x divide-white/10 overflow-hidden">
                <button
                  onClick={() => handleLike(true)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 transition hover:bg-white/15 ${
                    userVote === "like" ? "text-brand-soft font-bold" : "text-white"
                  }`}
                  title="I like this"
                >
                  <span className="text-sm">👍</span>
                  <span>{likeCount.toLocaleString()}</span>
                </button>
                <button
                  onClick={() => handleLike(false)}
                  className={`px-3 py-2 transition hover:bg-white/15 ${
                    userVote === "dislike" ? "text-brand-soft font-bold" : "text-white"
                  }`}
                  title="I dislike this"
                >
                  <span className="text-sm">👎</span>
                </button>
              </div>

              {/* Share Pill */}
              <button
                onClick={copyShareLink}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-white border border-white/5 transition hover:bg-white/15"
                title="Share link"
              >
                <span>🔗</span>
                <span>{shareCopied ? "Copied!" : "Share"}</span>
              </button>

              {/* Watchlist / Save Pill */}
              <button
                onClick={toggleWatchlist}
                disabled={watchlistLoading}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 border border-white/5 transition ${
                  inWatchlist
                    ? "bg-brand/20 text-brand-soft border-brand/40 font-bold"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
                title="Save to watchlist"
              >
                <span>{inWatchlist ? "✓" : "+"}</span>
                <span>{inWatchlist ? "Saved" : "Save"}</span>
              </button>

              {/* Server / Source Selector Pill */}
              {providers.length > 1 && (
                <div className="relative flex items-center rounded-full bg-white/10 border border-white/5 p-0.5">
                  {providers.map((p, idx) => (
                    <button
                      key={p}
                      onClick={() => changeProvider(p)}
                      disabled={busyResolve || p === provider}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${
                        p === provider ? "bg-brand text-white shadow-sm" : "text-text-muted hover:text-white"
                      }`}
                    >
                      Server {idx + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Watch Party Room */}
              {roomCode && (
                <button
                  onClick={() => setChatOpen((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 border transition ${
                    chatOpen ? "bg-accent/20 border-accent text-brand-soft" : "bg-white/10 border-white/5 text-white hover:bg-white/15"
                  }`}
                >
                  <span>👥</span>
                  <span>Room ({room.members})</span>
                </button>
              )}

              {/* Back to details */}
              <Link
                href={mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3.5 py-2 text-white border border-white/5 transition hover:bg-white/15"
              >
                <span>←</span>
                <span>Details</span>
              </Link>
            </div>
          </div>

          {/* YouTube Expandable Description Card */}
          <div
            onClick={() => setShowFullDescription((v) => !v)}
            className="rounded-2xl bg-[#272727]/60 hover:bg-[#272727]/90 border border-white/5 p-4 transition cursor-pointer text-sm text-text-vivid"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold text-xs text-white mb-2">
              <span>{(detail?.vote_count ? detail.vote_count * 38 : 124500).toLocaleString()} views</span>
              <span>{detail?.release_date || detail?.first_air_date || "2024"}</span>
              {detail?.vote_average ? (
                <span className="flex items-center gap-1 text-amber-400">★ {detail.vote_average.toFixed(1)}/10</span>
              ) : null}
              {detail?.genres && detail.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {detail.genres.map((g) => (
                    <span key={g.id} className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-text-muted">
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className={showFullDescription ? "leading-relaxed" : "line-clamp-2 leading-relaxed text-text-muted"}>
              {detail?.overview || currentEpisodeObj?.overview || "No detailed description available for this title."}
            </p>

            {showFullDescription && detail?.credits?.cast && detail.credits.cast.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Cast & Crew</p>
                <div className="flex flex-wrap gap-2">
                  {detail.credits.cast.slice(0, 6).map((actor) => (
                    <div key={actor.id} className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs">
                      <span className="font-semibold text-white">{actor.name}</span>
                      <span className="text-[11px] text-text-muted">as {actor.character}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="mt-2 font-bold text-xs text-white hover:underline block">
              {showFullDescription ? "Show less" : "...Show more"}
            </button>
          </div>

          {/* YouTube Comments Section */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Comments</span>
                <span className="text-sm font-normal text-text-muted">({comments.length})</span>
              </h2>
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-3 items-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white font-bold text-sm">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full border-b border-white/20 bg-transparent px-1 py-1.5 text-sm text-white placeholder-text-muted outline-none focus:border-brand transition"
                />
                {newComment.trim() && (
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setNewComment("")}
                      className="rounded-full px-4 py-1.5 text-xs font-medium text-text-muted hover:text-white transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-brand-glow transition hover:bg-brand-soft"
                    >
                      Comment
                    </button>
                  </div>
                )}
              </div>
            </form>

            {/* Comments List */}
            <div className="space-y-4 pt-2">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={comment.avatar}
                    alt={comment.author}
                    className="h-9 w-9 rounded-full object-cover shrink-0"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{comment.author}</span>
                      <span className="text-[11px] text-text-muted">{comment.timestamp}</span>
                    </div>
                    <p className="text-sm text-text-vivid leading-normal">{comment.text}</p>
                    <div className="flex items-center gap-3 text-xs text-text-muted pt-1">
                      <button
                        onClick={() => {
                          setComments((prev) =>
                            prev.map((c) =>
                              c.id === comment.id
                                ? { ...c, likes: c.isLiked ? c.likes - 1 : c.likes + 1, isLiked: !c.isLiked }
                                : c
                            )
                          );
                        }}
                        className={`flex items-center gap-1 hover:text-white transition ${
                          comment.isLiked ? "text-brand-soft font-bold" : ""
                        }`}
                      >
                        👍 <span>{comment.likes}</span>
                      </button>
                      <button className="hover:text-white transition">Reply</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Ad300x250 />
        </div>

        {/* RIGHT COLUMN: Up Next Sidebar & TV Episode Playlist */}
        <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-6">
          {/* TV Episodes Playlist Box (YouTube Playlist format) */}
          {mediaType === "tv" && (
            <div className="rounded-2xl border border-white/10 bg-[#1f1f1f]/80 overflow-hidden shadow-lg">
              <div className="p-3.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">Episodes Playlist</h3>
                  <p className="text-[11px] text-text-muted">Season {seasonNum} • {episodes.length} episodes</p>
                </div>
                {seasons.length > 1 && (
                  <select
                    value={seasonNum}
                    onChange={(e) => setSeasonNum(Number(e.target.value))}
                    className="rounded-lg bg-black/50 border border-white/10 px-2.5 py-1 text-xs text-white outline-none"
                  >
                    {seasons.map((s) => (
                      <option key={s.season_number} value={s.season_number} className="bg-neutral-900 text-white">
                        {s.name || `Season ${s.season_number}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Scrollable Episodes List */}
              <div className="thin-scroll max-h-[420px] overflow-y-auto divide-y divide-white/5 p-2 space-y-1">
                {episodesLoading ? (
                  <div className="p-4 text-center text-xs text-text-muted">Loading episodes...</div>
                ) : episodes.length === 0 ? (
                  <div className="p-4 text-center text-xs text-text-muted">No episodes found for this season.</div>
                ) : (
                  episodes.map((ep) => {
                    const isCurrent = ep.episode_number === episodeNum;
                    return (
                      <button
                        key={ep.episode_number}
                        onClick={() => switchEpisode(seasonNum, ep.episode_number)}
                        disabled={busyResolve || isCurrent}
                        className={`w-full group flex gap-3 p-2 rounded-xl text-left transition ${
                          isCurrent
                            ? "bg-brand/20 border border-brand/40 font-semibold"
                            : "hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-black/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              ep.still_path
                                ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
                                : detail?.backdrop_path
                                ? `https://image.tmdb.org/t/p/w300${detail.backdrop_path}`
                                : "/placeholder-backdrop.svg"
                            }
                            alt={ep.name || `Episode ${ep.episode_number}`}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[9px] font-mono font-bold text-white">
                            E{String(ep.episode_number).padStart(2, "0")}
                          </span>
                          {isCurrent && (
                            <div className="absolute inset-0 bg-brand/40 flex items-center justify-center text-white text-xs font-bold">
                              ▶
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs truncate font-medium ${isCurrent ? "text-brand-soft" : "text-white group-hover:text-brand-soft"}`}>
                            {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                          </p>
                          <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">{ep.overview || "No overview"}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* YouTube "Up Next" / Recommended Sidebar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Up next</h3>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>Autoplay</span>
                <button
                  onClick={() => setAutoplayNext((v) => !v)}
                  className={`h-5 w-9 rounded-full p-0.5 transition ${autoplayNext ? "bg-brand" : "bg-white/20"}`}
                >
                  <div className={`h-4 w-4 rounded-full bg-white transition ${autoplayNext ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            {/* Recommended Video Cards */}
            <div className="space-y-2">
              {similar.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-36 aspect-video rounded-xl bg-white/10 shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-white/10 rounded w-3/4" />
                        <div className="h-2.5 bg-white/10 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                similar.map((item) => {
                  const media = item.media_type || "movie";
                  const itemTitle = item.title || item.name || "Untitled";
                  const thumb = item.backdrop_path
                    ? `https://image.tmdb.org/t/p/w500${item.backdrop_path}`
                    : item.poster_path
                    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                    : "/placeholder-backdrop.svg";

                  return (
                    <Link
                      key={item.id}
                      href={`/watch/${media}/${item.id}`}
                      className="group flex gap-3 rounded-xl p-1.5 hover:bg-white/10 transition"
                    >
                      <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-xl bg-black/60 border border-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumb}
                          alt={itemTitle}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                          {media === "tv" ? "TV" : "Movie"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <h4 className="font-semibold text-xs text-white line-clamp-2 leading-snug group-hover:text-brand-soft transition">
                          {itemTitle}
                        </h4>
                        <p className="text-[11px] text-text-muted mt-1">Apollo Streams</p>
                        <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5">
                          <span>{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || "2024"}</span>
                          {item.vote_average ? (
                            <span className="text-amber-400 font-bold">★ {item.vote_average.toFixed(1)}</span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Movie Night Chat Drawer (when connected in room) */}
      {roomCode && chatOpen && (
        <div className="fixed bottom-4 right-4 z-40 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border border-white/10 glass shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 bg-black/40">
            <p className="text-xs font-semibold text-white">Movie Night Chat · {room.code}</p>
            <button onClick={() => setChatOpen(false)} className="text-text-muted hover:text-white" aria-label="Close chat">
              ✕
            </button>
          </div>
          <div className="thin-scroll flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {room.messages.map((msg, i) => (
              <div key={i} className="text-xs">
                <span className="font-semibold text-brand-soft">{msg.sender}: </span>
                <span className="text-white">{msg.text}</span>
              </div>
            ))}
            {room.messages.length === 0 && <p className="text-xs text-text-muted">Say hi to the room 👋</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
            className="flex gap-2 border-t border-white/10 p-2 bg-black/40"
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message..."
              aria-label="Chat message"
              className="flex-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-brand"
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
