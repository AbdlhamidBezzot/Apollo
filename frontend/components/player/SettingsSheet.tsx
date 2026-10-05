"use client";

import { useCallback, useRef, useState } from "react";
import { usePlayer } from "@/lib/playerContext";

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  levels: { index: number; height: number; label: string }[];
  curLevel: number;
  onQualityChange: (index: number) => void;
  rate: number;
  onRateChange: (rate: number) => void;
  subtitleLanguage: string;
  onSubtitleChange: (lang: string) => void;
  subtitleOptions: { id: string; language: string; label: string }[];
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
type SubPage = null | "quality" | "speed" | "subtitles";

const DRAG_DISMISS_THRESHOLD = 80;

/**
 * SettingsSheet — YouTube-style bottom sheet.
 * Slides up from the bottom with a drag handle + dimmed backdrop.
 * Sub-sheets for quality, speed, and subtitles.
 */
export function SettingsSheet({
  isOpen,
  onClose,
  levels,
  curLevel,
  onQualityChange,
  rate,
  onRateChange,
  subtitleLanguage,
  onSubtitleChange,
  subtitleOptions,
}: SettingsSheetProps) {
  const [subPage, setSubPage] = useState<SubPage>(null);
  const touchStartYRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleDragEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartYRef.current = null;
    if (dy > DRAG_DISMISS_THRESHOLD) {
      setSubPage(null);
      onClose();
    }
  };

  const close = useCallback(() => {
    setSubPage(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const qualityLabel = curLevel === -1 ? "Auto" : levels.find(l => l.index === curLevel)?.label ?? "Auto";
  const speedLabel = `${rate}×`;
  const subLabel = subtitleLanguage || "Off";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        id="settings-sheet"
        className="sheet-enter fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-[#141416] shadow-2xl"
        style={{ maxHeight: "70dvh", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
        role="dialog"
        aria-modal="true"
        aria-label="Player settings"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Back button (sub-pages) */}
        {subPage && (
          <div className="flex items-center gap-2 border-b border-white/10 px-4 pb-3">
            <button
              onClick={() => setSubPage(null)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white"
              id="settings-sheet-back"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>
          </div>
        )}

        {/* ── Main menu ──────────────────────────────────────────────── */}
        {!subPage && (
          <ul className="py-2">
            {/* Quality */}
            {levels.length > 0 && (
              <li>
                <button
                  id="settings-quality-btn"
                  onClick={() => setSubPage("quality")}
                  className="settings-row"
                >
                  <span className="settings-row-icon">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left text-sm font-medium text-white">Quality</span>
                  <span className="text-sm text-white/50">{qualityLabel}</span>
                  <span className="settings-row-chevron">›</span>
                </button>
              </li>
            )}

            {/* Playback speed */}
            <li>
              <button
                id="settings-speed-btn"
                onClick={() => setSubPage("speed")}
                className="settings-row"
              >
                <span className="settings-row-icon">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </span>
                <span className="flex-1 text-left text-sm font-medium text-white">Playback speed</span>
                <span className="text-sm text-white/50">{speedLabel}</span>
                <span className="settings-row-chevron">›</span>
              </button>
            </li>

            {/* Subtitles */}
            {subtitleOptions.length > 0 && (
              <li>
                <button
                  id="settings-subtitles-btn"
                  onClick={() => setSubPage("subtitles")}
                  className="settings-row"
                >
                  <span className="settings-row-icon">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="15" rx="2" />
                      <path d="M17 12H7M13 16H7" />
                    </svg>
                  </span>
                  <span className="flex-1 text-left text-sm font-medium text-white">Subtitles</span>
                  <span className="text-sm text-white/50">{subLabel}</span>
                  <span className="settings-row-chevron">›</span>
                </button>
              </li>
            )}
          </ul>
        )}

        {/* ── Quality sub-page ───────────────────────────────────────── */}
        {subPage === "quality" && (
          <ul className="py-2">
            <li>
              <button
                id="settings-quality-auto"
                onClick={() => { onQualityChange(-1); close(); }}
                className={`settings-row ${curLevel === -1 ? "text-[var(--brand-accent)]" : ""}`}
              >
                <span className="flex-1 text-sm font-medium">Auto</span>
                {curLevel === -1 && <CheckIcon />}
              </button>
            </li>
            {levels.map((l) => (
              <li key={l.index}>
                <button
                  id={`settings-quality-${l.label}`}
                  onClick={() => { onQualityChange(l.index); close(); }}
                  className={`settings-row ${curLevel === l.index ? "text-[var(--brand-accent)]" : ""}`}
                >
                  <span className="flex-1 text-sm font-medium">{l.label}</span>
                  {curLevel === l.index && <CheckIcon />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ── Speed sub-page ─────────────────────────────────────────── */}
        {subPage === "speed" && (
          <ul className="py-2">
            {SPEEDS.map((s) => (
              <li key={s}>
                <button
                  id={`settings-speed-${s}`}
                  onClick={() => { onRateChange(s); close(); }}
                  className={`settings-row ${rate === s ? "text-[var(--brand-accent)]" : ""}`}
                >
                  <span className="flex-1 text-sm font-medium">{s === 1 ? "Normal" : `${s}×`}</span>
                  {rate === s && <CheckIcon />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* ── Subtitles sub-page ─────────────────────────────────────── */}
        {subPage === "subtitles" && (
          <ul className="py-2">
            <li>
              <button
                id="settings-subtitle-off"
                onClick={() => { onSubtitleChange(""); close(); }}
                className={`settings-row ${!subtitleLanguage ? "text-[var(--brand-accent)]" : ""}`}
              >
                <span className="flex-1 text-sm font-medium">Off</span>
                {!subtitleLanguage && <CheckIcon />}
              </button>
            </li>
            {subtitleOptions.map((sub) => (
              <li key={sub.id}>
                <button
                  id={`settings-subtitle-${sub.id}`}
                  onClick={() => { onSubtitleChange(sub.language); close(); }}
                  className={`settings-row ${subtitleLanguage === sub.language ? "text-[var(--brand-accent)]" : ""}`}
                >
                  <span className="flex-1 text-sm font-medium">{sub.label}</span>
                  {subtitleLanguage === sub.language && <CheckIcon />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--brand-accent)]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
