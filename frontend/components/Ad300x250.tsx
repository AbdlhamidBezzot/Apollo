"use client";

import { useEffect, useRef } from "react";

interface Ad300x250Props {
  className?: string;
}

export function Ad300x250({ className = "" }: Ad300x250Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (containerRef.current.querySelector("script")) return;

    const script = document.createElement("script");
    script.src = "//unfoldedtrade.com/bNXEVPsFd.G/lq0_Y/WAcy/-eEmQ9/ujZ/Ucl/kjPCT/cx0PMhDUITw/N/TAc/tBNazqQ-w/MejfAQ2IMbQZ";
    script.async = true;
    script.referrerPolicy = "no-referrer-when-downgrade";
    (script as any).settings = {};

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div className={`flex justify-center items-center my-6 overflow-hidden min-h-[250px] ${className}`}>
      <div
        ref={containerRef}
        className="w-[300px] h-[250px] flex items-center justify-center bg-zinc-900/50 border border-zinc-800/80 rounded-xl shadow-lg overflow-hidden"
      />
    </div>
  );
}

export default Ad300x250;
