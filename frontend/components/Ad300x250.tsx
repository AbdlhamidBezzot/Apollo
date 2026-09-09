"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
  className?: string;
  label?: string;
  format?: string;
}

export function Ad300x250({ className = "" }: AdBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!containerRef.current || renderedRef.current) return;
    renderedRef.current = true;

    const wrapper = containerRef.current;
    wrapper.innerHTML = "";

    const executeBanner = () => {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.text = `
        if (window.aclib && typeof window.aclib.runBanner === 'function') {
          aclib.runBanner({
            zoneId: '12133798',
          });
        }
      `;
      wrapper.appendChild(script);
    };

    if (typeof window !== "undefined" && (window as any).aclib && typeof (window as any).aclib.runBanner === "function") {
      executeBanner();
    } else {
      const interval = setInterval(() => {
        if ((window as any).aclib && typeof (window as any).aclib.runBanner === "function") {
          clearInterval(interval);
          executeBanner();
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div className={`w-full flex justify-center items-center my-6 ${className}`}>
      <div
        ref={containerRef}
        className="w-full max-w-[728px] min-h-[90px] flex justify-center items-center overflow-hidden"
      />
    </div>
  );
}

export const AdBanner = Ad300x250;
export default Ad300x250;
