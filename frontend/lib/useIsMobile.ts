"use client";

import { useEffect, useState } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const checkIsMobile = () => {
      if (typeof window === "undefined") return;

      // Use minimum dimension (width vs height) so rotating phone into landscape doesn't flip layout to desktop mode
      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = minDimension <= 768;
      const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent || ""
      );

      setIsMobile(isSmallScreen || (isTouch && userAgentMobile));
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    window.addEventListener("orientationchange", checkIsMobile);
    return () => {
      window.removeEventListener("resize", checkIsMobile);
      window.removeEventListener("orientationchange", checkIsMobile);
    };
  }, []);

  return { isMobile, isNative: false, mounted };
}

