"use client";

import { useEffect, useRef } from "react";

interface Ad300x250Props {
  className?: string;
  label?: string;
}

function SingleAdBox() {
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

  return (
    <div
      ref={containerRef}
      className="w-[300px] h-[250px] min-w-[300px] min-h-[250px] flex items-center justify-center bg-black/40 rounded-xl overflow-hidden shadow-inner border border-white/5"
    />
  );
}

export function Ad300x250({ className = "", label = "Sponsored Advertisement" }: Ad300x250Props) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 my-8 ${className}`}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-surface-dark/70 p-4 sm:p-6 shadow-glass backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">
            {label}
          </span>
          <span className="text-[10px] font-mono text-white/30">300x250 Banner</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <SingleAdBox />
          <div className="hidden md:flex">
            <SingleAdBox />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Ad300x250;
