"use client";

import { useEffect, useState } from "react";

const AUDIO_KEY = "apollo:audio-pref";
const FILLER_KEY = "apollo:hide-filler";

type AudioPref = "all" | "sub" | "dub";

export function AnimeHubPrefs() {
  const [audio, setAudio] = useState<AudioPref>("all");
  const [hideFiller, setHideFiller] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUDIO_KEY);
      if (saved === "sub" || saved === "dub" || saved === "all") setAudio(saved);
      setHideFiller(localStorage.getItem(FILLER_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const selectAudio = (p: AudioPref) => {
    setAudio(p);
    try {
      localStorage.setItem(AUDIO_KEY, p);
    } catch {
      /* ignore */
    }
  };

  const toggleFiller = () => {
    setHideFiller((v) => {
      const next = !v;
      try {
        localStorage.setItem(FILLER_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex overflow-hidden rounded-full border border-white/10 text-xs">
        {(
          [
            { value: "all", label: "All audio" },
            { value: "sub", label: "Sub" },
            { value: "dub", label: "Dub" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            onClick={() => selectAudio(opt.value)}
            aria-pressed={audio === opt.value}
            className={`px-3 py-1.5 transition ${
              audio === opt.value ? "bg-brand font-bold text-white" : "text-text-muted hover:text-text-vivid"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={toggleFiller}
        aria-pressed={hideFiller}
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          hideFiller ? "border-brand bg-brand/15 text-brand-soft" : "border-white/10 text-text-muted hover:border-brand/50"
        }`}
      >
        {hideFiller ? "Filler hidden" : "Hide Filler"}
      </button>
      <p className="w-full text-[11px] text-text-muted sm:w-auto">
        Applies to all series — Sub/Dub audio and canon/filler episode filters.
      </p>
    </div>
  );
}