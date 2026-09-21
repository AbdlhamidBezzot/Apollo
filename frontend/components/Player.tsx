"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  MediaComment,
  MediaReactionResponse,
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

const PROGRESS_KEY = "apollo:progress";
const PROVIDER_KEY = "apollo:provider";
const IDLE_HIDE_MS = 3000;
const NEXT_CARD_SECONDS = 15;

const PROVIDER_LABELS: Record<string, string> = {
  pekka: "P.E.K.K.A IV",
  barbarian: "Barbarian I",
  archer: "Archer II",
  goblin: "Goblin III",
  stellar: "Stellar 4K",
  framextv: "frameXTV",
  cinemaos: "CinemaOS",
  videasy: "Videasy",
  vidsrc: "VidSrc",
};

const providerLabel = (p: string, list: string[] = []) => {
  if (PROVIDER_LABELS[p]) return PROVIDER_LABELS[p];
  const idx = list.indexOf(p);
  return idx >= 0 ? `Server ${idx + 1}` : p;
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
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Add-ons & Subtitles
  const [addonSubtitles, setAddonSubtitles] = useState<ApolloSubtitle[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [addonStreams, setAddonStreams] = useState<ApolloStream[]>([]);
  const [selectedAddonStream, setSelectedAddonStream] = useState<ApolloStream | null>(null);
  const [addonStreamMenuOpen, setAddonStreamMenuOpen] = useState<boolean>(false);

  // Playback States
  const [rate, setRate] = useState(1);
  const [savedPos, setSavedPos] = useState(0);
  const lastReport = useRef(0);
  const [provider, setProvider] = useState<string>(providerProp || "pekka");
  const [activeContentType, setActiveContentType] = useState<string>(contentType);
  const embed = !selectedAddonStream && isEmbed(activeContentType);
  const embedGotRealProgress = useRef(false);

  const [src, setSrc] = useState(streamUrl);
  const [seasonNum, setSeasonNum] = useState(season ?? 1);
  const [episodeNum, setEpisodeNum] = useState(episode ?? 1);
  const [busyResolve, setBusyResolve] = useState(false);
  const [providers, setProviders] = useState<string[]>([
    "pekka",
    "barbarian",
    "archer",
    "goblin",
    "framextv",
    "cinemaos",
    "videasy",
    "vidsrc",
  ]);

  // Details & Recommendations
  const [detail, setDetail] = useState<TitleDetail | null>(null);
  const [similar, setSimilar] = useState<Title[]>([]);
  const [seasons, setSeasons] = useState<{ season_number: number; name?: string }[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);



  // Cues & Skip
  const [cue, setCue] = useState<PlaybackCue | null>(null);
  const [cueMenuOpen, setCueMenuOpen] = useState(false);
  const [marking, setMarking] = useState<"intro" | "outro" | null>(null);
  const [markingStart, setMarkingStart] = useState(0);
  const skippedRef = useRef<string>("");

  const idleTimer = useRef<number>(0);
  const announceTimer = useRef<number>(0);

  // Real Database Reactions & Watchlist
  const [userReaction, setUserReaction] = useState<"like" | "dislike" | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

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

  const isHls = !embed && (activeContentType === "application/x-mpegURL" || /\.m3u8(\?|$)/i.test(src));
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


  // Real Database Comments
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);


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

  // Load Title Details, Similar titles, Reactions, and Comments
  useEffect(() => {
    let cancelled = false;

    // Title Detail
    get<TitleDetail>(`/api/v1/content/${mediaType}/${tmdbId}`)
      .then((d) => {
        if (!cancelled && d) setDetail(d);
      })
      .catch(() => {});

    // Similar
    get<ContentListResponse>(`/api/v1/content/${mediaType}/${tmdbId}/similar`)
      .then((res) => {
        if (!cancelled && res?.results?.length) {
          setSimilar(res.results.slice(0, 10).map((t) => ({ ...t, media_type: mediaType })));
        } else {
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

    // Real DB Reactions
    get<MediaReactionResponse>(`/api/v1/reactions/${mediaType}/${tmdbId}`)
      .then((rx) => {
        if (!cancelled && rx) {
          setLikesCount(rx.likes_count || 0);
          setDislikesCount(rx.dislikes_count || 0);
          setUserReaction(rx.user_reaction || null);
        }
      })
      .catch(() => {});

    // Real DB Comments
    setCommentsLoading(true);
    get<MediaComment[]>(`/api/v1/comments/${mediaType}/${tmdbId}`)
      .then((list) => {
        if (!cancelled && Array.isArray(list)) {
          setComments(list);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    // Watchlist state
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
      let data = event.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          /* ignore non-json payload */
        }
      }
      if (data && typeof data === "object") {
        // frameXTV telemetry event: frameXTV:timeupdate
        if (data.event === "frameXTV:timeupdate") {
          const cur = Number(data.currentTime);
          const dur = Number(data.duration);
          if (Number.isFinite(cur) && cur > 0) {
            embedGotRealProgress.current = true;
            setCurrentTime(cur);
            if (Number.isFinite(dur) && dur > 0) setDuration(dur);
            saveProgress(Math.floor(cur), dur > 0 && cur / dur >= 0.95);
          }
        } else if (data.type === "PLAYER_EVENT" && data.data) {
          // Stellar player event
          const cur = Number(data.data.currentTime);
          const dur = Number(data.data.duration);
          if (Number.isFinite(cur) && cur > 0) {
            embedGotRealProgress.current = true;
            setCurrentTime(cur);
            if (Number.isFinite(dur) && dur > 0) setDuration(dur);
            saveProgress(Math.floor(cur), dur > 0 && cur / dur >= 0.95);
          }
        } else if (data.type === "MEDIA_DATA" && data.data) {
          // Stellar media snapshot
          const cur = Number(data.data.currentTime ?? data.data.progress);
          if (Number.isFinite(cur) && cur > 0) {
            embedGotRealProgress.current = true;
            saveProgress(Math.floor(cur), Boolean(data.data.completed));
          }
        } else {
          const secs = Number(data.timestamp ?? data.progress);
          if (Number.isFinite(secs) && secs > 0) {
            embedGotRealProgress.current = true;
            saveProgress(Math.floor(secs), Number(data.progress) >= 0.95);
          }
        }
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
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("season", String(targetSeason));
          url.searchParams.set("episode", String(targetEpisode));
          window.history.replaceState({}, "", url.toString());
        }
      } catch {
        setBusyResolve(false);
        announce("Could not load that episode");
      }
    },
    [mediaType, busyResolve, tmdbId, announce, pokeControls, syncState, provider]
  );

  const playNextItem = useCallback(async () => {
    if (busyResolve) return;
    setNextCard(false);
    if (mediaType === "tv") {
      const hasNextInSeason = episodes.some((e) => e.episode_number === episodeNum + 1);
      if (hasNextInSeason || episodes.length === 0) {
        await switchEpisode(seasonNum, episodeNum + 1);
      } else {
        const nextSeasonObj = seasons.find((s) => s.season_number > seasonNum);
        if (nextSeasonObj) {
          await switchEpisode(nextSeasonObj.season_number, 1);
        } else {
          announce("Reached the last episode!");
        }
      }
    } else if (similar.length > 0) {
      const nextMovie = similar[0];
      const nextMedia = nextMovie.media_type || "movie";
      router.push(`/watch/${nextMedia}/${nextMovie.id}`);
    } else {
      announce("No up-next recommendations available");
    }
  }, [mediaType, busyResolve, seasonNum, episodeNum, switchEpisode, episodes, seasons, similar, router, announce]);

  const changeProvider = useCallback(
    async (target: string) => {
      if (busyResolve || (target === provider && !selectedAddonStream)) return;
      setBusyResolve(true);
      try {
        const res = await post<PlaybackSession>("/api/v1/playback/resolve", {
          tmdb_id: tmdbId,
          media_type: mediaType,
          season: seasonNum,
          episode: episodeNum,
          provider: target,
        });
        setSelectedAddonStream(null);
        setActiveContentType(res.content_type || "text/html");
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
    [busyResolve, provider, selectedAddonStream, tmdbId, mediaType, seasonNum, episodeNum, announce, providers]
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
        const current = providerProp || "pekka";
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
    if (embed) return;
    if (duration > 0 && duration - currentTime <= NEXT_CARD_SECONDS && currentTime > 0) {
      setNextCard(true);
    } else if (duration > 0 && duration - currentTime > NEXT_CARD_SECONDS) {
      setNextCard(false);
    }
  }, [embed, duration, currentTime]);

  useEffect(() => {
    if (!nextCard) {
      setCountdown(10);
      return;
    }
    const iv = window.setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearInterval(iv);
  }, [nextCard]);

  useEffect(() => {
    if (nextCard && countdown <= 0 && autoplayNext) {
      setNextCard(false);
      playNextItem();
    }
  }, [nextCard, countdown, autoplayNext, playNextItem]);

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
        playNextItem();
      }
      pokeControls();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embed, togglePlay, fullscreen, toggleMute, seek, volume, setVol, playNextItem, pokeControls, skipCue, showSkipIntro, showSkipOutro]);

  // Real DB Title Reaction (Like / Dislike) - Auth Gated
  const handleMediaReaction = async (targetReaction: "like" | "dislike") => {
    if (!user) {
      announce("Please sign in to like or dislike titles.");
      return;
    }
    const nextRx = userReaction === targetReaction ? "none" : targetReaction;
    try {
      const updated = await post<MediaReactionResponse>("/api/v1/reactions", {
        tmdb_id: tmdbId,
        media_type: mediaType,
        reaction: nextRx,
      });
      setUserReaction(updated.user_reaction || null);
      setLikesCount(updated.likes_count || 0);
      setDislikesCount(updated.dislikes_count || 0);
      announce(nextRx === "none" ? "Reaction removed" : `Marked as ${nextRx}`);
    } catch {
      announce("Could not save reaction");
    }
  };

  // Watchlist Toggle
  const toggleWatchlist = async () => {
    if (!user) {
      announce("Please sign in to save to your watchlist");
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

  // Real DB Comment Submission - Auth Gated
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      announce("Please sign in to post a comment.");
      return;
    }
    const text = newCommentText.trim();
    if (!text || commentSubmitting) return;

    setCommentSubmitting(true);
    try {
      const added = await post<MediaComment>("/api/v1/comments", {
        tmdb_id: tmdbId,
        media_type: mediaType,
        text,
      });
      setComments([added, ...comments]);
      setNewCommentText("");
      announce("Comment posted!");
    } catch {
      announce("Could not post comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Real DB Comment Upvoting - Auth Gated
  const toggleCommentLike = async (commentId: number) => {
    if (!user) {
      announce("Please sign in to like comments.");
      return;
    }
    try {
      const res = await post<{ liked: boolean; likes_count: number }>(`/api/v1/comments/${commentId}/like`);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, is_liked: res.liked, likes_count: res.likes_count } : c
        )
      );
    } catch {
      announce("Could not update comment like");
    }
  };

  // Real DB Comment Deletion - Auth Gated (author or admin)
  const handleDeleteComment = async (commentId: number) => {
    if (!user) return;
    try {
      await del(`/api/v1/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      announce("Comment deleted!");
    } catch {
      announce("Could not delete comment");
    }
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
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#09090B]"
              onDoubleClick={fullscreen}
            >
              <iframe
                ref={iframeRef}
                key={`${tmdbId}-${seasonNum}-${episodeNum}-${embedSrc}`}
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
                className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-[var(--brand-accent)] hover:text-[var(--brand-accent-text)]"
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
              className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-[#09090B] ${
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
                  setNextCard(true);
                  setCountdown(10);
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

              {/* Dark Gradient Overlay for video controls */}
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#09090B]/80 to-transparent transition-opacity duration-300 ${
                  showControls ? "opacity-100" : "opacity-0"
                }`}
              />

              {!playing && showControls && (
                <button
                  onClick={togglePlay}
                  aria-label="Play"
                  className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--brand-accent)] text-xl text-[var(--brand-accent-text)] font-bold shadow-brand-glow transition hover:scale-105"
                >
                  ▶
                </button>
              )}

              {showSkipIntro && (
                <button
                  onClick={() => skipCue("intro")}
                  className="absolute bottom-24 right-4 rounded-full bg-[var(--brand-accent)] px-4 py-2 text-xs font-bold text-[var(--brand-accent-text)] shadow-brand-glow transition hover:bg-[var(--brand-accent-hover)]"
                >
                  Skip Intro ⏭
                </button>
              )}
              {showSkipOutro && (
                <button
                  onClick={() => skipCue("outro")}
                  className="absolute bottom-24 right-4 rounded-full bg-[var(--brand-accent)] px-4 py-2 text-xs font-bold text-[var(--brand-accent-text)] shadow-brand-glow transition hover:bg-[var(--brand-accent-hover)]"
                >
                  Skip Outro ⏭
                </button>
              )}

              {nextCard && (mediaType === "tv" || similar.length > 0) && (
                <div className="absolute bottom-24 right-4 z-30 w-72 overflow-hidden rounded-2xl border border-white/15 bg-[#09090B]/90 backdrop-blur-md shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                    <p className="text-xs font-bold text-white">Up next in {countdown}s</p>
                    <button
                      onClick={() => setNextCard(false)}
                      aria-label="Cancel autoplay"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white hover:bg-white/25"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-3.5 space-y-2">
                    {mediaType === "tv" ? (
                      <>
                        <p className="font-mono text-xs text-[var(--brand-accent)] font-semibold tracking-wider">
                          S{String(seasonNum).padStart(2, "0")} E{String(episodeNum + 1).padStart(2, "0")}
                        </p>
                        <p className="text-xs text-white line-clamp-1 font-medium">
                          {episodes.find((e) => e.episode_number === episodeNum + 1)?.name || `Episode ${episodeNum + 1}`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-mono text-xs text-[var(--brand-accent)] font-semibold tracking-wider">Recommended Movie</p>
                        <p className="text-xs text-white line-clamp-1 font-medium">
                          {similar[0]?.title || similar[0]?.name || "Next Movie"}
                        </p>
                      </>
                    )}
                    <button
                      onClick={playNextItem}
                      disabled={busyResolve}
                      className="mt-2 w-full rounded-full bg-[var(--brand-accent)] px-4 py-2 text-xs font-bold text-[var(--brand-accent-text)] shadow-brand-glow transition hover:bg-[var(--brand-accent-hover)] disabled:opacity-50"
                    >
                      {busyResolve ? "Loading..." : mediaType === "tv" ? "▶ Play next episode" : "▶ Play next movie"}
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Video Controls Bar */}
              <div
                className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#09090B]/95 via-[#09090B]/70 to-transparent px-4 pb-3 pt-12 transition-opacity duration-300 ${
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
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--brand-accent)] hover:h-2 transition-all"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-3">
                    <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="text-white hover:text-[var(--brand-accent)] text-lg">
                      {playing ? "❚❚" : "▶"}
                    </button>
                    <button
                      onClick={playNextItem}
                      aria-label="Next"
                      title={mediaType === "tv" ? "Next episode" : "Next movie"}
                      className="text-white hover:text-[var(--brand-accent)] text-sm p-1 disabled:opacity-40"
                      disabled={busyResolve || (mediaType === "movie" && similar.length === 0)}
                    >
                      ⏭
                    </button>
                    <button onClick={toggleMute} aria-label="Mute" className="text-white hover:text-[var(--brand-accent)]">
                      {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                    </button>
                    <span className="font-mono text-xs tabular-nums text-[#A1A1AA]">
                      {fmtTime(currentTime)} / {fmtTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={cycleRate}
                      aria-label="Playback speed"
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[11px] text-[#A1A1AA] hover:border-white/20 hover:text-white"
                    >
                      {rate.toFixed(2)}x
                    </button>

                    {isHls && levels.length > 1 && (
                      <div className="relative">
                        <button
                          onClick={() => setQualityOpen((v) => !v)}
                          aria-label="Quality"
                          aria-expanded={qualityOpen}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[11px] text-[#A1A1AA] hover:border-white/20 hover:text-white"
                        >
                          {curLevel === -1 ? "Auto" : levels.find((l) => l.index === curLevel)?.label ?? "Auto"}
                        </button>
                        {qualityOpen && (
                          <div className="absolute bottom-full right-0 z-20 mb-2 w-32 overflow-hidden rounded-xl border border-white/10 bg-[#09090B]/90 backdrop-blur-xl shadow-2xl">
                            <button
                              onClick={() => setQuality(-1)}
                              className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 ${
                                curLevel === -1 ? "font-semibold text-[var(--brand-accent)]" : "text-white"
                              }`}
                            >
                              Auto
                            </button>
                            {levels.map((l) => (
                              <button
                                key={l.index}
                                onClick={() => setQuality(l.index)}
                                className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 ${
                                  curLevel === l.index ? "font-semibold text-[var(--brand-accent)]" : "text-white"
                                }`}
                              >
                                {l.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={fullscreen} aria-label="Toggle fullscreen" className="text-white hover:text-[var(--brand-accent)]">
                      ⛶
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subtitle Sync Notice Tip */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-3.5 py-2.5 text-xs text-amber-200/90 backdrop-blur-md shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs">
                💬
              </span>
              <p className="leading-snug text-[11px] sm:text-xs">
                <strong className="font-semibold text-amber-300">Subtitle out of sync?</strong> If subtitles aren&apos;t synchronized, try switching to another streaming server (e.g. Barbarian I or Stellar 4K) or adjust subtitle sync in settings.
              </p>
            </div>
          </div>

          {/* Title Heading */}
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{displayTitle}</h1>
            {mediaType === "tv" && (
              <p className="text-xs font-mono tracking-[0.14em] uppercase text-[var(--brand-accent)] mt-1 font-semibold">
                Season {seasonNum} • Episode {episodeNum} {currentEpisodeObj?.name ? `• ${currentEpisodeObj.name}` : ""}
              </p>
            )}
          </div>

          {/* YouTube Channel & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-white/10 pb-4">
            {/* Channel Info */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] font-extrabold text-sm shadow-sm">
                A
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-white">Apollo Cinema</span>
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[8px] font-bold text-[var(--brand-accent-text)]" title="Verified Streamer">
                    ✓
                  </span>
                </div>
                <p className="text-[11px] font-mono text-[#A1A1AA]">1.2M subscribers • Free HD Stream</p>
              </div>
              <button
                onClick={() => announce("Subscribed to Apollo Cinema")}
                className="ml-2 rounded-full bg-[var(--brand-accent)] px-4 py-1.5 text-xs font-extrabold text-[var(--brand-accent-text)] shadow-brand-glow transition hover:bg-[var(--brand-accent-hover)]"
              >
                Subscribe
              </button>
            </div>

            {/* Action Pills Group */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {/* Real DB Like / Dislike Pill (Auth Gated) */}
              <div className="flex items-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md divide-x divide-white/10 overflow-hidden">
                <button
                  onClick={() => handleMediaReaction("like")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition hover:bg-white/10 ${
                    userReaction === "like" ? "text-[var(--brand-accent)] font-bold bg-white/10" : "text-[#A1A1AA] hover:text-white"
                  }`}
                  title={user ? "I like this" : "Sign in to like"}
                >
                  <span className="text-xs">👍</span>
                  <span>{likesCount}</span>
                </button>
                <button
                  onClick={() => handleMediaReaction("dislike")}
                  className={`px-3 py-1.5 flex items-center gap-1 transition hover:bg-white/10 ${
                    userReaction === "dislike" ? "text-[var(--brand-accent)] font-bold bg-white/10" : "text-[#A1A1AA] hover:text-white"
                  }`}
                  title={user ? "I dislike this" : "Sign in to dislike"}
                >
                  <span className="text-xs">👎</span>
                  {dislikesCount > 0 && <span>{dislikesCount}</span>}
                </button>
              </div>

              {/* Share Pill */}
              <button
                onClick={copyShareLink}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[#A1A1AA] backdrop-blur-md transition hover:border-white/20 hover:text-white"
                title="Share link"
              >
                <span>🔗</span>
                <span>{shareCopied ? "Copied!" : "Share"}</span>
              </button>

              {/* Watchlist / Save Pill */}
              <button
                onClick={toggleWatchlist}
                disabled={watchlistLoading}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 border backdrop-blur-md transition ${
                  inWatchlist
                    ? "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] border-[var(--brand-accent)]/40 font-bold"
                    : "border-white/10 bg-white/[0.04] text-[#A1A1AA] hover:border-white/20 hover:text-white"
                }`}
                title="Save to watchlist"
              >
                <span>{inWatchlist ? "✓" : "+"}</span>
                <span>{inWatchlist ? "Saved" : "Save"}</span>
              </button>

              {/* Server / Source Selector Pill */}
              {providers.length > 1 && (
                <div className="relative flex items-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md p-0.5">
                  {providers.map((p, idx) => (
                    <button
                      key={p}
                      onClick={() => changeProvider(p)}
                      disabled={busyResolve || (p === provider && !selectedAddonStream)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-default ${
                        p === provider && !selectedAddonStream
                          ? "bg-[var(--brand-accent)] text-[var(--brand-accent-text)] font-bold shadow-brand-glow"
                          : "text-[#A1A1AA] hover:text-white"
                      }`}
                    >
                      {providerLabel(p, providers)}
                    </button>
                  ))}
                </div>
              )}

              {/* Addon / Torrent Streams Dropdown Selector */}
              {addonStreams.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setAddonStreamMenuOpen((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border backdrop-blur-md transition ${
                      selectedAddonStream
                        ? "bg-[var(--brand-accent)] text-[var(--brand-accent-text)] border-[var(--brand-accent)] shadow-brand-glow font-bold"
                        : "border-white/10 bg-white/[0.04] text-[#A1A1AA] hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <span className="max-w-[140px] truncate">
                      {selectedAddonStream
                        ? selectedAddonStream.title || selectedAddonStream.addon_name
                        : `Addon Streams (${addonStreams.length})`}
                    </span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {addonStreamMenuOpen && (
                    <div className="absolute bottom-full right-0 z-40 mb-2 w-80 max-h-72 overflow-y-auto rounded-2xl border border-white/15 bg-[#09090B]/95 p-2 shadow-2xl backdrop-blur-xl">
                      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 mb-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                          Direct Addon Streams
                        </p>
                        <span className="text-[10px] text-[var(--brand-accent)] font-mono font-semibold">
                          {addonStreams.length} found
                        </span>
                      </div>
                      <div className="space-y-1">
                        {addonStreams.map((st) => (
                          <button
                            key={st.id}
                            onClick={() => {
                              setSelectedAddonStream(st);
                              setSrc(st.url || "");
                              setActiveContentType(
                                st.is_direct || st.url?.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4"
                              );
                              setProvider(st.addon_name);
                              setAddonStreamMenuOpen(false);
                              announce(`Playing ${st.title || st.addon_name}`);
                            }}
                            className={`block w-full rounded-xl px-3 py-2 text-left text-xs transition hover:bg-white/10 ${
                              selectedAddonStream?.id === st.id ? "bg-[var(--brand-accent)]/20 font-bold text-[var(--brand-accent)] border border-[var(--brand-accent)]/30" : "text-white"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-semibold">{st.title || st.addon_name}</span>
                              {st.quality && (
                                <span className="shrink-0 rounded bg-[var(--brand-accent)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-accent)]">
                                  {st.quality}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#A1A1AA]">
                              <span>{st.addon_name}</span>
                              {st.is_torrent && <span className="text-amber-400 font-medium">• Torrent</span>}
                              {st.is_direct && <span className="text-emerald-400 font-medium">• Direct</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Watch Party Room */}
              {roomCode && (
                <button
                  onClick={() => setChatOpen((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 border backdrop-blur-md transition ${
                    chatOpen ? "bg-[var(--brand-accent)]/15 border-[var(--brand-accent)]/40 text-[var(--brand-accent)] font-bold" : "border-white/10 bg-white/[0.04] text-[#A1A1AA] hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span>Room ({room.members})</span>
                </button>
              )}

              {/* Back to details */}
              <Link
                href={mediaType === "tv" ? `/tv/${tmdbId}` : `/movie/${tmdbId}`}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[#A1A1AA] backdrop-blur-md transition hover:border-white/20 hover:text-white"
              >
                <span>←</span>
                <span>Details</span>
              </Link>
            </div>
          </div>

          {/* Expandable Description Card */}
          <div
            onClick={() => setShowFullDescription((v) => !v)}
            className="rounded-2xl border border-white/10 bg-[#121215]/60 p-5 backdrop-blur-xl transition hover:bg-[#121215]/80 cursor-pointer text-sm"
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-mono text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-[0.14em] rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5">
                {detail?.release_date?.slice(0, 4) || detail?.first_air_date?.slice(0, 4) || "2024"}
              </span>
              {detail?.vote_average ? (
                <span className="flex items-center gap-1 rounded-full border border-[var(--brand-accent)]/30 bg-black/60 px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--brand-accent)] backdrop-blur-md">
                  <svg className="h-3 w-3 fill-[var(--brand-accent)] text-[var(--brand-accent)]" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  {detail.vote_average.toFixed(1)}
                </span>
              ) : null}
              {detail?.genres && detail.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.genres.map((g) => (
                    <span key={g.id} className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A1A1AA] rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5">
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className={showFullDescription ? "leading-relaxed text-[#A1A1AA]" : "line-clamp-2 leading-relaxed text-[#A1A1AA]"}>
              {detail?.overview || currentEpisodeObj?.overview || "No detailed description available for this title."}
            </p>

            {showFullDescription && detail?.credits?.cast && detail.credits.cast.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#A1A1AA] mb-2">Cast & Crew</p>
                <div className="flex flex-wrap gap-2">
                  {detail.credits.cast.slice(0, 6).map((actor) => (
                    <div key={actor.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs">
                      <span className="font-semibold text-white">{actor.name}</span>
                      <span className="text-[11px] text-[#A1A1AA]">as {actor.character}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="mt-3 font-mono text-xs font-semibold text-[var(--brand-accent)] hover:underline block">
              {showFullDescription ? "Show less" : "...Show more"}
            </button>
          </div>

          {/* Real Database Comments Section */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Comments</span>
                <span className="font-mono text-xs font-semibold text-[#A1A1AA]">({comments.length})</span>
              </h2>
            </div>

            {/* Comment Submission Form (Auth Gated) */}
            {user ? (
              <form onSubmit={handleAddComment} className="flex gap-3 items-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] font-bold text-xs shadow-sm overflow-hidden">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Add a public comment..."
                    disabled={commentSubmitting}
                    className="w-full border-b border-white/10 bg-transparent px-1 py-1.5 text-sm text-white placeholder-[#A1A1AA] outline-none focus:border-[var(--brand-accent)]/60 transition disabled:opacity-50"
                  />
                  {newCommentText.trim() && (
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setNewCommentText("")}
                        className="rounded-full px-4 py-1.5 text-xs font-semibold text-[#A1A1AA] hover:text-white transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={commentSubmitting}
                        className="cinema-btn-accent px-5 py-1.5 text-xs font-bold shadow-brand-glow disabled:opacity-50"
                      >
                        {commentSubmitting ? "Posting..." : "Comment"}
                      </button>
                    </div>
                  )}
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#121215]/60 p-4 text-center backdrop-blur-xl">
                <p className="text-xs text-[#A1A1AA] mb-2">Sign in to leave a comment and share your thoughts.</p>
                <Link
                  href="/login"
                  className="inline-block cinema-btn-accent px-5 py-1.5 text-xs font-bold shadow-brand-glow"
                >
                  Sign In to Comment
                </Link>
              </div>
            )}

            {/* Real Comments Feed */}
            <div className="space-y-4 pt-2">
              {commentsLoading ? (
                <div className="py-6 text-center text-xs font-mono text-[#A1A1AA] animate-pulse">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#121215]/40 p-8 text-center text-xs text-[#A1A1AA] backdrop-blur-xl">
                  No comments yet. Be the first to share your thoughts on this title!
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 text-sm">
                    {comment.author_avatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={comment.author_avatar}
                        alt={comment.author_name}
                        className="h-8 w-8 rounded-full object-cover shrink-0 border border-white/10"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--brand-accent-text)] font-bold text-xs shadow-sm">
                        {comment.author_name?.[0]?.toUpperCase() || "A"}
                      </div>
                    )}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white truncate">{comment.author_name}</span>
                        <span className="font-mono text-[11px] text-[#A1A1AA]">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-[#A1A1AA] leading-normal break-words">{comment.text}</p>
                      <div className="flex items-center gap-3 text-xs text-[#A1A1AA] pt-1">
                        <button
                          onClick={() => toggleCommentLike(comment.id)}
                          className={`flex items-center gap-1 transition ${
                            comment.is_liked ? "text-[var(--brand-accent)] font-bold" : "hover:text-white"
                          }`}
                          title={user ? "Like comment" : "Sign in to like"}
                        >
                          👍 <span>{comment.likes_count}</span>
                        </button>
                        {user && comment.user_id === user.id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="flex items-center gap-1 text-red-400/80 hover:text-red-400 text-xs transition ml-2"
                            title="Delete your comment"
                          >
                            <span className="hover:underline">Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Ad300x250 />
        </div>

        {/* RIGHT COLUMN: Up Next Sidebar & TV Episode Playlist */}
        <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 space-y-6">
          {/* TV Episodes Playlist Box */}
          {mediaType === "tv" && (
            <div className="rounded-2xl border border-white/10 bg-[#121215]/60 backdrop-blur-xl overflow-hidden">
              <div className="p-3.5 border-b border-white/10 bg-white/[0.03] flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-white">Episodes Playlist</h3>
                  <p className="font-mono text-[11px] text-[#A1A1AA]">Season {seasonNum} • {episodes.length} episodes</p>
                </div>
                {seasons.length > 1 && (
                  <select
                    value={seasonNum}
                    onChange={(e) => setSeasonNum(Number(e.target.value))}
                    className="rounded-full bg-black/60 border border-white/10 px-3 py-1 font-mono text-xs text-white outline-none backdrop-blur-md"
                  >
                    {seasons.map((s) => (
                      <option key={s.season_number} value={s.season_number} className="bg-[#09090B] text-white">
                        {s.name || `Season ${s.season_number}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Scrollable Episodes List */}
              <div className="thin-scroll max-h-[420px] overflow-y-auto divide-y divide-white/[0.05] p-2 space-y-1">
                {episodesLoading ? (
                  <div className="p-4 text-center font-mono text-xs text-[#A1A1AA]">Loading episodes...</div>
                ) : episodes.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#A1A1AA]">No episodes found for this season.</div>
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
                            ? "bg-[var(--brand-accent)]/15 border border-[var(--brand-accent)]/40 font-semibold"
                            : "hover:bg-white/[0.04] border border-transparent"
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
                          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[9px] font-bold text-white">
                            E{String(ep.episode_number).padStart(2, "0")}
                          </span>
                          {isCurrent && (
                            <div className="absolute inset-0 bg-[var(--brand-accent)]/40 flex items-center justify-center text-[var(--brand-accent-text)] text-xs font-bold">
                              ▶
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs truncate font-semibold ${isCurrent ? "text-[var(--brand-accent)]" : "text-white group-hover:text-[var(--brand-accent)]"}`}>
                            {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                          </p>
                          <p className="text-[11px] text-[#A1A1AA] line-clamp-1 mt-0.5">{ep.overview || "No overview"}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Up Next / Recommended Sidebar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-white/10">
              <h3 className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent)]">Up next</h3>
            </div>

            {/* Recommended Video Cards */}
            <div className="space-y-2.5">
              {/* For TV Shows: Show upcoming episodes of current show FIRST */}
              {mediaType === "tv" && episodes.length > 0 && (
                <>
                  {episodes
                    .filter((ep) => ep.episode_number > episodeNum)
                    .slice(0, 4)
                    .map((ep) => {
                      const isNextEp = ep.episode_number === episodeNum + 1;
                      const thumb = ep.still_path
                        ? `https://image.tmdb.org/t/p/w500${ep.still_path}`
                        : detail?.backdrop_path
                        ? `https://image.tmdb.org/t/p/w500${detail.backdrop_path}`
                        : "/placeholder-backdrop.svg";

                      return (
                        <button
                          key={`next-ep-${ep.episode_number}`}
                          onClick={() => switchEpisode(seasonNum, ep.episode_number)}
                          disabled={busyResolve}
                          className="group w-full flex gap-3 text-left rounded-2xl p-2 hover:bg-white/[0.06] transition border border-white/10 bg-[#121215]/40 backdrop-blur-md disabled:opacity-50"
                        >
                          <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-black/60 border border-white/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumb}
                              alt={ep.name || `Episode ${ep.episode_number}`}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[var(--brand-accent)] uppercase tracking-wider">
                              S{seasonNum} E{ep.episode_number}
                            </span>
                            {isNextEp && (
                              <span className="absolute top-1 left-1 rounded bg-[var(--brand-accent)] px-1.5 py-0.5 font-mono text-[9px] font-extrabold text-[var(--brand-accent-text)] shadow uppercase tracking-wider">
                                UP NEXT
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 py-0.5">
                            <h4 className="font-semibold text-xs text-white line-clamp-2 leading-snug group-hover:text-[var(--brand-accent)] transition">
                              {ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}
                            </h4>
                            <p className="text-[11px] text-[#A1A1AA] mt-1 line-clamp-1">
                              {ep.overview || `${displayTitle} - Season ${seasonNum}`}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                </>
              )}

              {/* Similar / Recommended Video Cards */}
              {similar.length === 0 ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse rounded-2xl border border-white/10 bg-[#121215]/40 p-2">
                      <div className="w-32 aspect-video rounded-xl bg-white/10 shrink-0" />
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
                      className="group flex gap-3 rounded-2xl p-2 hover:bg-white/[0.06] transition border border-white/10 bg-[#121215]/40 backdrop-blur-md"
                    >
                      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-black/60 border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumb}
                          alt={itemTitle}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white uppercase tracking-wider">
                          {media === "tv" ? "TV" : "Movie"}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <h4 className="font-semibold text-xs text-white line-clamp-2 leading-snug group-hover:text-[var(--brand-accent)] transition">
                          {itemTitle}
                        </h4>
                        <p className="text-[11px] text-[#A1A1AA] mt-0.5 font-mono">Apollo Streams</p>
                        <div className="flex items-center gap-2 text-[10px] text-[#A1A1AA] mt-1">
                          <span className="font-mono">{item.release_date?.slice(0, 4) || item.first_air_date?.slice(0, 4) || "2024"}</span>
                          {item.vote_average ? (
                            <span className="text-[var(--brand-accent)] font-mono font-bold flex items-center gap-0.5">
                              ★ {item.vote_average.toFixed(1)}
                            </span>
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

      {/* Floating Movie Night Chat Drawer */}
      {roomCode && chatOpen && (
        <div className="fixed bottom-4 right-4 z-40 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#09090B]/90 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 bg-white/[0.03]">
            <p className="text-xs font-extrabold text-white">Movie Night Chat · <span className="font-mono text-[var(--brand-accent)]">{room.code}</span></p>
            <button onClick={() => setChatOpen(false)} className="text-[#A1A1AA] hover:text-white" aria-label="Close chat">
              ✕
            </button>
          </div>
          <div className="thin-scroll flex-1 space-y-2 overflow-y-auto px-3 py-2">
            {room.messages.map((msg, i) => (
              <div key={i} className="text-xs">
                <span className="font-bold text-[var(--brand-accent)]">{msg.sender}: </span>
                <span className="text-white">{msg.text}</span>
              </div>
            ))}
            {room.messages.length === 0 && <p className="text-xs text-[#A1A1AA]">Say hi to the room 👋</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendChat();
            }}
            className="flex gap-2 border-t border-white/10 p-2.5 bg-white/[0.03]"
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Message..."
              aria-label="Chat message"
              className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white outline-none focus:border-[var(--brand-accent)]/60"
            />
            <button type="submit" className="cinema-btn-accent px-4 py-1.5 text-xs font-bold shadow-brand-glow disabled:opacity-50" disabled={!chatInput.trim()}>
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
