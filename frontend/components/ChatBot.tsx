"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { API_URL, posterUrl } from "@/lib/api";
import { getAccessToken, get, post } from "@/lib/http";
import type { ChatResponse, SuggestedTitle } from "@/lib/types";

interface EnrichedSuggestion extends SuggestedTitle {
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
}

interface Message {
  role: "user" | "bot";
  content: string;
  suggestions?: EnrichedSuggestion[];
}

const CHAT_SESSION_KEY = "apollo:cinebot-session";

async function enrich(suggestions: SuggestedTitle[]): Promise<EnrichedSuggestion[]> {
  return Promise.all(
    suggestions.map(async (s) => {
      try {
        const detail = await get<{ poster_path: string | null; vote_average: number; release_date?: string }>(
          `/api/v1/content/${s.media_type}/${s.tmdb_id}`
        );
        return { ...s, ...detail };
      } catch {
        return s;
      }
    })
  );
}

export function ChatBot() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content: "Hello. I am CineBot. What is on your mind? I can chat, or help you find something when you ask.",
    },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_SESSION_KEY);
      const parsed = saved ? Number(saved) : NaN;
      if (Number.isSafeInteger(parsed) && parsed > 0) setSessionId(parsed);
    } catch {
      // Private browsing can block storage; chat still works for this view.
    }
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("apollo:cinebot", handler);
    return () => window.removeEventListener("apollo:cinebot", handler);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);

    // Append streaming placeholder for bot message
    setMessages((m) => [...m, { role: "bot", content: "" }]);

    try {
      const token = getAccessToken();
      const response = await fetch(`${API_URL}/api/v1/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError("You need to sign in to chat.");
        } else {
          setError("Something went wrong. Please try again in a moment.");
        }
        setMessages((m) => m.slice(0, -1));
        setBusy(false);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let streamText = "";
      let rawBuffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          rawBuffer += decoder.decode(value, { stream: true });
          const lines = rawBuffer.split("\n\n");
          rawBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const payload = JSON.parse(trimmed.slice(6));
                if (payload.type === "session") {
                  setSessionId(payload.session_id);
                  try { sessionStorage.setItem(CHAT_SESSION_KEY, String(payload.session_id)); } catch {}
                } else if (payload.type === "token") {
                  streamText += payload.token;
                  const currentText = streamText;
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last && last.role === "bot") {
                      next[next.length - 1] = { ...last, content: currentText };
                    }
                    return next;
                  });
                } else if (payload.type === "suggestions") {
                  const enriched = await enrich(payload.suggested_titles || []);
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last && last.role === "bot") {
                      next[next.length - 1] = { ...last, suggestions: enriched };
                    }
                    return next;
                  });
                }
              } catch {}
            }
          }
        }
      }
    } catch {
      setError("Could not reach CineBot. Please try again.");
      setMessages((m) => m.filter((msg) => msg.content !== "" || (msg.suggestions && msg.suggestions.length > 0)));
    } finally {
      setBusy(false);
    }
  };

  const playSuggestion = async (s: EnrichedSuggestion) => {
    setBusy(true);
    setError(null);
    try {
      const res = await post<ChatResponse>("/api/v1/chat/accept", { tmdb_id: s.tmdb_id, media_type: s.media_type });
      if (res.action === "play" && res.play_target) {
        sessionStorage.setItem("apollo:play", JSON.stringify(res.play_target));
        router.push(`/watch/${res.play_target.media_type}/${res.play_target.tmdb_id}`);
      }
    } catch (err: any) {
      if (err.status === 401) { router.push("/login"); } else { setError("Could not start playback. Please try again."); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="glass animate-draw-in fixed bottom-24 right-4 z-[9900] flex h-[600px] w-[380px] max-w-[calc(100vw-2rem)] max-h-[80vh] flex-col overflow-hidden rounded-3xl shadow-glass">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand text-sm font-bold text-white">
                <span className="absolute -inset-1 animate-radial-pulse" aria-hidden="true" />
                AI
              </span>
              <div>
                <p className="text-sm font-bold tracking-tight text-text-vivid">CineBot</p>
                <p className="text-[11px] text-text-muted">AI companion</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-text-muted hover:text-text-vivid" aria-label="Close chat">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="thin-scroll flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                {m.role === "bot" && (
                  <span className="relative mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-[10px] font-bold text-white">
                    AI
                  </span>
                )}
                <div
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user" ? "bg-brand text-white shadow-brand-glow" : "glass text-text-vivid"
                  }`}
                >
                  {m.content}
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {m.suggestions.map((s) => (
                        <div
                          key={s.tmdb_id}
                          className="overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-brand/50"
                        >
                          <div className="flex gap-2.5 p-2">
                            <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-bg-card">
                              <Image
                                src={posterUrl(s.poster_path ?? null, "w185")}
                                alt={s.title}
                                fill
                                sizes="56px"
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-text-vivid">{s.title}</p>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                                {typeof s.vote_average === "number" && s.vote_average > 0 ? (
                                  <span className="rounded bg-badge-rating/15 px-1.5 font-bold text-badge-rating">
                                    â˜… {s.vote_average.toFixed(1)}
                                  </span>
                                ) : null}
                                <span className="uppercase">{s.media_type}</span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-muted">{s.pitch}</p>
                            </div>
                          </div>
                          <button
                            disabled={busy}
                            onClick={() => playSuggestion(s)}
                            className="block w-full border-t border-white/10 px-3 py-2 text-left text-xs font-bold text-brand-soft transition hover:bg-white/5 disabled:opacity-40"
                          >
                            â–¶ Stream now
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="skeleton h-8 w-24 rounded-2xl" />
              </div>
            )}
            {error && (
              <div className="flex justify-start">
                <p className="text-xs text-brand-soft">{error}</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What should I watch?"
              aria-label="Message CineBot"
              className="flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-text-vivid outline-none placeholder:text-text-muted focus:border-brand/50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-brand-glow transition hover:bg-brand-soft disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close CineBot" : "Open CineBot"}
        className="fixed bottom-5 right-5 z-[9900] flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white shadow-brand-glow transition hover:scale-105"
      >
        <span className="absolute -inset-1 animate-radial-pulse rounded-full" aria-hidden="true" />
        {open ? (
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3c3 0 4.5 1 5.5 2.5S20 8.5 20 11c0 2.6-1 5-3 6.8V21l-2.8-1.6c-.7.1-1.4.1-2.2.1-3 0-4.5-1-5.5-2.5S4 15.5 4 13c0-2.6 1-5 3-6.8S9 3 12 3z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </>
  );
}
