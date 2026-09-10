"use client";

import { useEffect, useRef, useState } from "react";

interface VastPreRollProps {
  adTagUrl?: string;
  onAdComplete: () => void;
}

const DEFAULT_VAST_URL = "https://s.magsrv.com/v1/vast.php?idz=6025796";

export function VastPreRoll({ adTagUrl, onAdComplete }: VastPreRollProps) {
  const activeUrl = adTagUrl || process.env.NEXT_PUBLIC_VAST_TAG_URL || DEFAULT_VAST_URL;
  const [skipCountdown, setSkipCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const [adProgress, setAdProgress] = useState(0);
  const [adDuration, setAdDuration] = useState(0);
  const [clickThroughUrl, setClickThroughUrl] = useState<string | null>(null);
  const [mediaFileUrl, setMediaFileUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const completedRef = useRef(false);

  const finishAd = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onAdComplete();
  };

  // 1. Fetch & parse VAST Tag URL (supports direct MediaFiles and VAST Wrappers)
  useEffect(() => {
    let active = true;

    const parseVast = async (targetUrl: string, depth = 0): Promise<void> => {
      if (depth > 3 || !active) return;
      try {
        const res = await fetch(targetUrl, { credentials: "omit" });
        const xmlText = await res.text();
        if (!active) return;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        // Extract MediaFile URL
        const mediaFiles = xmlDoc.getElementsByTagName("MediaFile");
        let mediaUrl: string | null = null;
        for (let i = 0; i < mediaFiles.length; i++) {
          const url = mediaFiles[i].textContent?.trim();
          if (url && (url.includes(".mp4") || url.includes(".webm") || url.startsWith("http"))) {
            mediaUrl = url;
            break;
          }
        }

        // Extract ClickThrough URL
        const clickThroughs = xmlDoc.getElementsByTagName("ClickThrough");
        if (clickThroughs.length > 0) {
          const clickUrl = clickThroughs[0].textContent?.trim();
          if (clickUrl && clickUrl.startsWith("http")) {
            setClickThroughUrl(clickUrl);
          }
        }

        if (mediaUrl) {
          setMediaFileUrl(mediaUrl);
          return;
        }

        // Handle VAST Wrapper redirects (<VASTAdTagURI>)
        const wrappers = xmlDoc.getElementsByTagName("VASTAdTagURI");
        if (wrappers.length > 0) {
          const nextUrl = wrappers[0].textContent?.trim();
          if (nextUrl && nextUrl.startsWith("http")) {
            return await parseVast(nextUrl, depth + 1);
          }
        }

        finishAd();
      } catch {
        finishAd();
      }
    };

    void parseVast(activeUrl);

    return () => {
      active = false;
    };
  }, [activeUrl]);

  // 2. Skip Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSkipCountdown((prev) => {
        if (prev <= 1) {
          setCanSkip(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSkip = () => {
    finishAd();
  };

  const handleAdClick = () => {
    const target = clickThroughUrl || activeUrl;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between overflow-hidden bg-black text-white">
      {/* Top Banner Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-b from-black/90 to-transparent p-4">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-brand px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-brand-glow">
            Ad
          </span>
          <span className="text-xs font-medium text-white/80">
            Advertisement • Main video will play shortly
          </span>
        </div>
        <button
          onClick={handleAdClick}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
        >
          Visit Advertiser ↗
        </button>
      </div>

      {/* Video / Ad Container */}
      <div className="relative flex-1 flex items-center justify-center bg-black cursor-pointer" onClick={handleAdClick}>
        {mediaFileUrl ? (
          <video
            ref={videoRef}
            src={mediaFileUrl}
            autoPlay
            playsInline
            className="h-full w-full object-contain"
            onTimeUpdate={(e) => {
              setAdProgress(e.currentTarget.currentTime);
              setAdDuration(e.currentTarget.duration || 0);
            }}
            onEnded={finishAd}
            onError={finishAd}
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-xs font-semibold text-text-muted">Loading advertisement...</p>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar & Skip Button */}
      <div className="flex items-center justify-between border-t border-white/10 bg-gradient-to-t from-black/90 to-transparent p-4">
        <div className="w-1/2">
          {adDuration > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-brand transition-all duration-200"
                style={{ width: `${Math.min(100, (adProgress / adDuration) * 100)}%` }}
              />
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          disabled={!canSkip}
          className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition shadow-lg ${
            canSkip
              ? "bg-brand text-white hover:bg-brand-soft shadow-brand-glow cursor-pointer"
              : "bg-white/10 text-white/60 cursor-not-allowed border border-white/10"
          }`}
        >
          {canSkip ? (
            <>
              <span>Skip Ad</span>
              <span>⏭</span>
            </>
          ) : (
            <span>Skip in {skipCountdown}s</span>
          )}
        </button>
      </div>
    </div>
  );
}
