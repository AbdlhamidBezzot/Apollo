"use client";

import { useEffect, useState } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const checkIsMobile = () => {
      if (typeof window === "undefined") return;

      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(
          navigator.userAgent
        ) || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);

      // Use the minimum dimension (portrait width) so landscape rotation does NOT change mobile status
      const minDimension = Math.min(window.innerWidth, window.innerHeight);

      const mobile = minDimension <= 768 || (isMobileDevice && Math.min(window.innerWidth, window.innerHeight) <= 1024);
      setIsMobile(mobile);
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
