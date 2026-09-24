"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isNative, setIsNative] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const checkIsMobile = () => {
      const native = typeof window !== "undefined" && Capacitor.isNativePlatform();
      const isCapacitorProtocol =
        typeof window !== "undefined" &&
        (window.location.protocol === "capacitor:" || window.location.protocol === "file:");
      const isMobileWidth = typeof window !== "undefined" && window.innerWidth <= 768;

      setIsNative(native || isCapacitorProtocol);
      setIsMobile(native || isCapacitorProtocol || isMobileWidth);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  return { isMobile, isNative, mounted };
}
