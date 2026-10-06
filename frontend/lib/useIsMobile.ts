"use client";

import { useEffect, useState } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const checkIsMobile = () => {
      if (typeof window === "undefined") return;

      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      const isMobilePhoneUA = /iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua);

      // Phone landscape fallback (small height <= 500px on actual mobile phone UAs)
      const isPhoneLandscape = isMobilePhoneUA && window.innerHeight <= 500 && window.innerWidth <= 1024;

      const mobile = window.innerWidth <= 768 || isPhoneLandscape;
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

