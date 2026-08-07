"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import { Player } from "@/components/Player";
import { PreWatchAd } from "@/components/PreWatchAd";
import { classifyError, logTechnicalDetail } from "@/lib/errors";
import { post } from "@/lib/http";
import type { PlaybackSession } from "@/lib/types";

interface PlayTarget {
  tmdb_id: number;
  media_type: "movie" | "tv";
  stream_url: string;
  content_type: string;
  expires_at: string;
  poster: string | null;
  title: string | null;
  session_token?: string | null;
}

export function WatchClient({ mediaType, id }: { mediaType: "movie" | "tv"; id: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<PlaybackSession | null>(null);
  const [title, setTitle] = useState("");
  const [poster, setPoster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adCompleted, setAdCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      let target: PlayTarget | null = null;
      try {
        const raw = sessionStorage.getItem("apollo:play");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.tmdb_id === id && parsed.media_type === mediaType) {
            target = parsed;
          }
        }
      } catch {
        /* ignore */
      }

      const season = mediaType === "tv" ? Number(searchParams.get("season") || 1) : undefined;
      const episode = mediaType === "tv" ? Number(searchParams.get("episode") || 1) : undefined;
      const hasExplicitEpisode = searchParams.get("season") !== null || searchParams.get("episode") !== null;

      try {
        if (target && !hasExplicitEpisode) {
          setSession({
            provider: "chat",
            stream_url: target.stream_url,
            content_type: target.content_type,
            expires_at: target.expires_at,
            poster: target.poster,
            title: target.title,
            session_token: target.session_token,
          });
          setTitle(target.title || "");
          setPoster(target.poster);
        } else {
          const res = await post<PlaybackSession>("/api/v1/playback/resolve", {
            tmdb_id: id,
            media_type: mediaType,
            season,
            episode,
          });
          setSession(res);
        }
      } catch (err: unknown) {
        const issue = classifyError(err);
        logTechnicalDetail(issue, { mediaType, id });
        setError(issue.message);
      }
    })();
  }, [mediaType, id, searchParams]);

  if (error) {
    return (
      <ErrorScreen
        message={error}
        onRetry={() => router.refresh()}
      />
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="skeleton mb-3 h-8 w-64 rounded" />
        <div className="skeleton aspect-video w-full rounded-xl" />
      </div>
    );
  }

  if (!adCompleted) {
    return (
      <PreWatchAd
        title={title || session.title || `${mediaType === "tv" ? "TV" : "Movie"} ${id}`}
        poster={poster || session.poster}
        onComplete={() => setAdCompleted(true)}
      />
    );
  }

  return (
    <Player
      streamUrl={session.stream_url}
      contentType={session.content_type}
      tmdbId={id}
      mediaType={mediaType}
      title={title || `${mediaType === "tv" ? "TV" : "Movie"} ${id}`}
      poster={poster}
      season={mediaType === "tv" ? Number(searchParams.get("season") || 1) : undefined}
      episode={mediaType === "tv" ? Number(searchParams.get("episode") || 1) : undefined}
      roomCode={searchParams.get("room")}
    />
  );
}
