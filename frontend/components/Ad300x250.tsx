"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
  className?: string;
  label?: string;
  format?: "300x250" | "728x90" | "auto";
}

const AD_SRC =
  "//unfoldedtrade.com/bNXEVPsFd.G/lq0_Y/WAcy/-eEmQ9/ujZ/Ucl/kjPCT/cx0PMhDUITw/N/TAc/tBNazqQ-w/MejfAQ2IMbQZ";

// Inline script string — must be injected as real HTML so d.currentScript works
const INLINE_SCRIPT = `
(function(vrq){
  var d=document,s=d.createElement('script'),l=d.currentScript||d.scripts[d.scripts.length-1];
  s.settings=vrq||{};
  s.src="${AD_SRC}";
  s.async=true;
  s.referrerPolicy='no-referrer-when-downgrade';
  l.parentNode.insertBefore(s,l);
})({});
`;

function AdSlot({ width, height }: { width: number; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current || !ref.current) return;
    injected.current = true;

    // Create a real <script> tag as raw HTML so d.currentScript resolves
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<script>${INLINE_SCRIPT}<\/script>`;
    const scriptEl = wrapper.querySelector("script");
    if (scriptEl) {
      ref.current.appendChild(scriptEl);
    }
  }, []);

  return (
    <div
      ref={ref}
      style={{ width, height, maxWidth: "100%" }}
      className="overflow-visible mx-auto"
    />
  );
}

export function Ad300x250({
  className = "",
  format = "auto",
}: AdBannerProps) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 my-8 ${className}`}>
      <div className="relative overflow-visible rounded-2xl border border-white/10 bg-surface-dark/50 py-4 shadow-glass backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between px-4 border-b border-white/5 pb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">
            Sponsored Advertisement
          </span>
          <span className="text-[10px] font-mono text-white/20">
            {format === "728x90" ? "728×90" : format === "300x250" ? "300×250" : "Responsive"}
          </span>
        </div>

        <div className="flex justify-center items-start px-4 pt-2 overflow-visible">
          {format === "728x90" ? (
            <AdSlot width={728} height={90} />
          ) : format === "300x250" ? (
            <div className="flex flex-wrap gap-6 justify-center">
              <AdSlot width={300} height={250} />
              <div className="hidden md:block">
                <AdSlot width={300} height={250} />
              </div>
            </div>
          ) : (
            /* Auto: 728x90 on desktop, 300x250 on mobile */
            <>
              <div className="hidden md:block w-full">
                <AdSlot width={728} height={90} />
              </div>
              <div className="block md:hidden">
                <AdSlot width={300} height={250} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const AdBanner = Ad300x250;
export default Ad300x250;
