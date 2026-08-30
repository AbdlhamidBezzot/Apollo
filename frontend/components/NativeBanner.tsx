"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isAdExcluded } from "@/lib/adsConfig";

/**
 * Adsterra Native Banner – async/defer safe.
 * Place anywhere in the page body.
 */
export function NativeBanner() {
  const pathname = usePathname();
  const injectedRef = useRef(false);

  useEffect(() => {
    if (isAdExcluded(pathname)) return;
    if (injectedRef.current) return;
    injectedRef.current = true;

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src =
      "https://pl31098606.profitableratecpmnetwork.com/57a45f319b0d3f47845ad8b9059b61de/invoke.js";

    document.getElementById(
      "container-57a45f319b0d3f47845ad8b9059b61de"
    )?.after(script);
  }, [pathname]);

  if (isAdExcluded(pathname)) return null;

  return (
    <div className="mx-auto my-6 w-full max-w-7xl px-4">
      <div id="container-57a45f319b0d3f47845ad8b9059b61de" />
    </div>
  );
}
