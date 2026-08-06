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
}

interface Resolved extends HistoryEntry {
  detail: Title | null;
}

export function ContinueWatchingRow() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Resolved[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await get<HistoryEntry[]>("/api/v1/me/history", 0);
        const inProgress = list.filter((e) => !e.completed && e.progress_seconds > 0);
        const resolved = await Promise.all(
          inProgress.map(async (entry) => {
            try {
              const detail = await get<Title>(`/api/v1/content/${entry.media_type}/${entry.tmdb_id}`, 0);
              return { ...entry, detail };
            } catch {
              return { ...entry, detail: null };
            }
          })
        );
        if (!cancelled) setItems(resolved);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  if (loading || items === null || items.length === 0) return null;

  const removeItem = async (entry: Resolved) => {
    try {
      await del(`/api/v1/me/history/${entry.media_type}/${entry.tmdb_id}`);
    } catch {
      /* ignore */
    }
    setItems((list) => (list ?? []).filter((e) => !(e.media_type === entry.media_type && e.tmdb_id === entry.tmdb_id)));
  };

  return (
    <section className="mx-auto max-w-7xl px-4">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-text-vivid">Continue Watching</h2>
        <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      </div>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {items.map((entry) => {
          const runtime = entry.detail?.runtime;
          const pct = entry.completed
            ? 100
            : runtime
              ? Math.min(99, Math.round((entry.progress_seconds / (runtime * 60)) * 100))
              : 0;
          const remainingMin = entry.completed ? 0 : runtime ? Math.max(1, Math.round(runtime - entry.progress_seconds / 60)) : 0;
          const href = `/watch/${entry.media_type}/${entry.tmdb_id}`;
          return (
            <Link
              key={`${entry.media_type}-${entry.tmdb_id}`}
              href={href}
              className="group relative w-64 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-bg-card transition duration-300 hover:border-brand/40"
            >
              <div className="relative aspect-video overflow-hidden bg-black">
                <Image
                  src={backdropUrl(entry.detail?.backdrop_path ?? null, "w780")}
                  alt={entry.detail ? titleName(entry.detail) : `Title ${entry.tmdb_id}`}
                  fill
                  sizes="256px"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-void via-bg-void/20 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-12 w-12 text-white drop-shadow" aria-hidden="true">
                    <path d="M7 5l12 7-12 7V5z" />
                  </svg>
                </div>
                <span className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-brand-soft backdrop-blur">
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
                  className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-xs text-white backdrop-blur transition hover:bg-brand hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-text-vivid">
                  {entry.detail ? titleName(entry.detail) : `${entry.media_type} #${entry.tmdb_id}`}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(3, pct)}%` }} />
                </div>
                <p className="mt-1.5 font-mono text-[11px] text-text-muted">
                  {entry.completed ? "Completed" : `${remainingMin}m left${runtime ? ` · ${pct}%` : ""}`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}