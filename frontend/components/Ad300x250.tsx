"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
  className?: string;
  label?: string;
  format?: "300x250" | "728x90" | "auto";
}

function MultiTagBox({ width = 300, height = 250 }: { width?: number; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (containerRef.current.querySelector("script")) return;

    const script = document.createElement("script");
    script.src =
      "//unfoldedtrade.com/bNXEVPsFd.G/lq0_Y/WAcy/-eEmQ9/ujZ/Ucl/kjPCT/cx0PMhDUITw/N/TAc/tBNazqQ-w/MejfAQ2IMbQZ";
    script.async = true;
    script.referrerPolicy = "no-referrer-when-downgrade";
    (script as any).settings = {};

    containerRef.current.appendChild(script);
  }, []);

  const is728 = width === 728;

  return (
    <div
      ref={containerRef}
      style={{
        maxWidth: "100%",
        width: is728 ? "728px" : "300px",
        height: is728 ? "90px" : "250px",
        minHeight: is728 ? "90px" : "250px",
      }}
      className="flex items-center justify-center bg-black/40 rounded-xl overflow-hidden shadow-inner border border-white/5 mx-auto"
    />
  );
}

export function Ad300x250({
  className = "",
  label = "Sponsored Advertisement",
  format = "auto",
}: AdBannerProps) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 my-8 ${className}`}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface-dark/70 p-4 sm:p-6 shadow-glass backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">
            {label}
          </span>
          <span className="text-[10px] font-mono text-white/30">
            {format === "728x90" ? "728x90 Leaderboard" : "MultiTag Responsive Banner"}
          </span>
        </div>

        {format === "728x90" ? (
          <div className="flex justify-center items-center overflow-x-auto py-2">
            <MultiTagBox width={728} height={90} />
          </div>
        ) : format === "300x250" ? (
          <div className="flex flex-wrap items-center justify-center gap-6">
            <MultiTagBox width={300} height={250} />
            <div className="hidden md:flex">
              <MultiTagBox width={300} height={250} />
            </div>
          </div>
        ) : (
          /* Auto / Responsive: 728x90 on Desktop, 300x250 on Mobile */
          <div className="flex justify-center items-center">
            <div className="hidden md:block w-full text-center">
              <MultiTagBox width={728} height={90} />
            </div>
            <div className="block md:hidden w-full text-center">
              <MultiTagBox width={300} height={250} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Alias for general ad banner usage
export const AdBanner = Ad300x250;

export default Ad300x250;
