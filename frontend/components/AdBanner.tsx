"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ADSENSE_PUB_ID, AD_SLOTS, isAdExcluded, pushAdSense } from "@/lib/adsConfig";

interface AdBannerProps {
  slotId?: string;
  format?: "auto" | "fluid" | "rectangle" | "horizontal";
  responsive?: boolean;
  className?: string;
  label?: string;
}

export function AdBanner({
  slotId = AD_SLOTS.homeRow1,
  format = "auto",
  responsive = true,
  className = "",
  label = "ADVERTISEMENT",
}: AdBannerProps) {
  const pathname = usePathname();

  // Trigger AdSense script initialization on component mount
  useEffect(() => {
    if (!isAdExcluded(pathname)) {
      pushAdSense();
    }
  }, [pathname]);

  // Exclude ads entirely on specified restricted routes
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

      <div className="flex min-h-[90px] w-full items-center justify-center p-3 text-center">
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%", overflow: "hidden" }}
          data-ad-client={ADSENSE_PUB_ID}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-full-width-responsive={responsive ? "true" : "false"}
        />
      </div>
    </div>
  );
}
