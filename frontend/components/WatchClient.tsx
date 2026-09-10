"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";
import { Player } from "@/components/Player";

import { classifyError, logTechnicalDetail } from "@/lib/errors";
import { get, post } from "@/lib/http";
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

      const hasExplicitEpisode = searchParams.get("season") !== null || searchParams.get("episode") !== null;
      let season = mediaType === "tv" && hasExplicitEpisode ? Number(searchParams.get("season")) : undefined;
      let episode = mediaType === "tv" && hasExplicitEpisode ? Number(searchParams.get("episode")) : undefined;

      if (mediaType === "tv" && !hasExplicitEpisode) {
        try {
          const list = await get<
            { tmdb_id: number; media_type: string; season_number?: number | null; episode_number?: number | null }[]
          >("/api/v1/me/history");
          const match = list.find((e) => e.media_type === "tv" && e.tmdb_id === id);
          if (match && typeof match.season_number === "number" && typeof match.episode_number === "number") {
            season = match.season_number;
            episode = match.episode_number;
          }
        } catch {
          /* ignore guest/unauthenticated */
        }
        if (!season) season = 1;
        if (!episode) episode = 1;
      }

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
      <div className="mx-auto max-w-[1750px] px-3 sm:px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="skeleton aspect-video w-full rounded-2xl" />
            <div className="skeleton h-8 w-3/4 rounded-lg" />
            <div className="skeleton h-12 w-full rounded-full" />
            <div className="skeleton h-28 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-4 space-y-3">
            <div className="skeleton h-6 w-28 rounded" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="skeleton aspect-video w-36 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="skeleton h-3.5 w-full rounded" />
                  <div className="skeleton h-3 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }



  return (
    <Player
      streamUrl={session.stream_url}
      contentType={session.content_type}
      provider={session.provider}
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
