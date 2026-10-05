"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

export type PlayerMode = "hidden" | "portrait" | "fullscreen" | "mini";

export interface OpenPlayerParams {
  src: string;
  contentType: string;
  provider: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster: string | null;
  season?: number;
  episode?: number;
}

export interface PlayerContextValue {
  /* State */
  mode: PlayerMode;
  src: string;
  contentType: string;
  provider: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster: string | null;
  season: number;
  episode: number;
  playing: boolean;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
  /* The single <video> ref — GlobalPlayer owns this element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /* Actions */
  open: (params: OpenPlayerParams) => void;
  setMode: (mode: PlayerMode) => void;
  dismiss: () => void;
  setPlaying: (v: boolean) => void;
  setCurrentTime: (v: number) => void;
  setDuration: (v: number) => void;
  setMuted: (v: boolean) => void;
  setVolume: (v: number) => void;
  setSeason: (v: number) => void;
  setEpisode: (v: number) => void;
  setSrc: (src: string, contentType?: string) => void;
  setProvider: (p: string) => void;
  setTitle: (t: string) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [mode, setModeState] = useState<PlayerMode>("hidden");
  const [src, setSrcState] = useState("");
  const [contentType, setContentType] = useState("text/html");
  const [provider, setProviderState] = useState("cinemaos");
  const [tmdbId, setTmdbId] = useState(0);
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [title, setTitleState] = useState("");
  const [poster, setPoster] = useState<string | null>(null);
  const [season, setSeasonState] = useState(1);
  const [episode, setEpisodeState] = useState(1);
  const [playing, setPlayingState] = useState(false);
  const [currentTime, setCurrentTimeState] = useState(0);
  const [duration, setDurationState] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(1);

  const open = useCallback((params: OpenPlayerParams) => {
    setSrcState(params.src);
    setContentType(params.contentType);
    setProviderState(params.provider);
    setTmdbId(params.tmdbId);
    setMediaType(params.mediaType);
    setTitleState(params.title);
    setPoster(params.poster);
    setSeasonState(params.season ?? 1);
    setEpisodeState(params.episode ?? 1);
    setCurrentTimeState(0);
    setDurationState(0);
    setModeState("portrait");
  }, []);

  const setMode = useCallback((m: PlayerMode) => setModeState(m), []);

  const dismiss = useCallback(() => {
    setModeState("hidden");
    setPlayingState(false);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.src = "";
    }
  }, []);

  const setSrc = useCallback((newSrc: string, newContentType?: string) => {
    setSrcState(newSrc);
    if (newContentType) setContentType(newContentType);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        mode,
        src,
        contentType,
        provider,
        tmdbId,
        mediaType,
        title,
        poster,
        season,
        episode,
        playing,
        currentTime,
        duration,
        muted,
        volume,
        videoRef,
        open,
        setMode,
        dismiss,
        setPlaying: setPlayingState,
        setCurrentTime: setCurrentTimeState,
        setDuration: setDurationState,
        setMuted: setMutedState,
        setVolume: setVolumeState,
        setSeason: setSeasonState,
        setEpisode: setEpisodeState,
        setSrc,
        setProvider: setProviderState,
        setTitle: setTitleState,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
