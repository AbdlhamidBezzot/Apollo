"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { backdropUrl, titleName } from "@/lib/api";
import { del, get } from "@/lib/http";
import type { Title } from "@/lib/types";

interface HistoryEntry {
  id: number;
  tmdb_id: number;
  media_type: string;
  watched_at: string;
  progress_seconds: number;
  completed: boolean;
  season_number?: number | null;
  episode_number?: number | null;
}

interface Resolved extends HistoryEntry {
  detail: Title | null;
}

function watchQuery(entry: HistoryEntry): string {
  if (entry.media_type !== "tv") {
    return "";
  }
  const s = typeof entry.season_number === "number" && entry.season_number > 0 ? entry.season_number : 1;
  const e = typeof entry.episode_number === "number" && entry.episode_number > 0 ? entry.episode_number : 1;
  return `?season=${s}&episode=${e}`;
}

export function HistoryClient() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Resolved[]>([]);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setStatus("error");
      return;
    }
    (async () => {
      try {
        const list = await get<HistoryEntry[]>("/api/v1/me/history");
        const resolved = await Promise.all(
          list.map(async (entry) => {
            try {
              const detail = await get<Title>(`/api/v1/content/${entry.media_type}/${entry.tmdb_id}`);
              return { ...entry, detail };
            } catch {
              return { ...entry, detail: null };
            }
          })
        );
        setItems(resolved);
        setStatus("loaded");
      } catch {
        setStatus("error");
      }
    })();
  }, [user, loading]);

  if (status === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="mb-4 text-[#A1A1AA]">Sign in to see your viewing history.</p>
        <Link href="/login" className="rounded-full bg-[#FACC15] px-6 py-2 text-sm font-extrabold text-black shadow-brand-glow transition hover:bg-[#FDE68B]">
          Sign in
        </Link>
      </div>
    );
  }

  const removeItem = async (entry: Resolved) => {
    try {
      await del(`/api/v1/me/history/${entry.media_type}/${entry.tmdb_id}`);
    } catch {
      /* ignore */
    }
    setItems((list) => list.filter((e) => !(e.media_type === entry.media_type && e.tmdb_id === entry.tmdb_id)));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-black tracking-tight text-white">Viewing History</h1>
      {status === "loading" ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl border border-white/10 bg-[#121215]/60 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-[#A1A1AA]">Nothing watched yet. Your playback history will appear here.</p>
      ) : (
        <div className="space-y-3">
          {items.map((entry) => {
            const pct = entry.completed
              ? 100
              : entry.detail?.runtime
                ? Math.min(100, Math.round((entry.progress_seconds / (entry.detail.runtime * 60)) * 100))
                : 0;
            const href = `/watch/${entry.media_type}/${entry.tmdb_id}${watchQuery(entry)}`;
            return (
              <Link
                key={entry.id}
                href={href}
                className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-[#121215]/60 p-3 transition duration-300 hover:border-[#FACC15]/30 backdrop-blur-xl"
              >
                <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg bg-black">
                  <Image
                    src={backdropUrl(entry.detail?.backdrop_path ?? null, "w780")}
                    alt={entry.detail ? titleName(entry.detail) : `Title ${entry.tmdb_id}`}
                    fill
                    sizes="144px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">
                    {entry.detail ? titleName(entry.detail) : `${entry.media_type} #${entry.tmdb_id}`}
                  </p>
                  <div className="mt-1.5 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#FACC15]" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[#A1A1AA]">
                    {entry.completed ? "Completed" : `${Math.round(entry.progress_seconds / 60)} min watched`}
                  </p>
                </div>
                <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[#A1A1AA] transition group-hover:border-[#FACC15]/40 group-hover:text-[#FACC15] sm:block">
                  {entry.completed ? "Watch again" : "Resume"}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${entry.detail ? titleName(entry.detail) : "title"} from history`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeItem(entry);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-sm text-[#A1A1AA] transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                >
                  ✕
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
