"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ADSTERRA_UNITS, isAdExcluded } from "@/lib/adsConfig";

type AdsterraUnit = keyof typeof ADSTERRA_UNITS;

interface AdBannerProps {
  /** Which Adsterra unit to render */
  unit?: AdsterraUnit;
  className?: string;
  label?: string;
}

export function AdBanner({
  unit = "leaderboard728x90",
  className = "",
  label = "ADVERTISEMENT",
}: AdBannerProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);

  const config = ADSTERRA_UNITS[unit];

  useEffect(() => {
    if (isAdExcluded(pathname)) return;
    if (injectedRef.current) return;
    injectedRef.current = true;

    const container = containerRef.current;
    if (!container) return;

    // Build the Adsterra IFRAME SYNC snippet dynamically
    const optionsScript = document.createElement("script");
    optionsScript.text = `
      atOptions = {
        'key' : '${config.key}',
        'format' : 'iframe',
        'height' : ${config.height},
        'width' : ${config.width},
        'params' : {}
      };
    `;

    const invokeScript = document.createElement("script");
    invokeScript.src = `https://www.highrevenueformat.com/${config.key}/invoke.js`;
    invokeScript.async = false;

    container.appendChild(optionsScript);
    container.appendChild(invokeScript);
  }, [pathname, config]);

  if (isAdExcluded(pathname)) {
    return null;
  }

  return (
    <div
      className={`group relative mx-auto my-6 w-full max-w-7xl overflow-hidden rounded-2xl border border-white/10 bg-bg-card/40 backdrop-blur-md transition hover:border-white/20 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-1.5 text-[10px] uppercase tracking-widest text-text-muted">
        <span>{label}</span>
        <span className="opacity-40">Apollo Ads</span>
      </div>

      <div
        className="flex w-full items-center justify-center p-3"
        style={{ minHeight: config.height + 24 }}
      >
        <div ref={containerRef} />
      </div>
    </div>
  );
}
