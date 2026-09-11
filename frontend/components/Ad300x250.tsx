"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
  className?: string;
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

    // Set atOptions first, then load the invoke script — order matters
    const optionsScript = document.createElement("script");
    optionsScript.type = "text/javascript";
    optionsScript.text = `
      atOptions = {
        'key' : 'fed15ec2b808ad78b95f3757737d2162',
        'format' : 'iframe',
        'height' : 90,
        'width' : 728,
        'params' : {}
      };
    `;
    wrapper.appendChild(optionsScript);

    const invokeScript = document.createElement("script");
    invokeScript.type = "text/javascript";
    invokeScript.src =
      "https://heavenlysuspicious.com/fed15ec2b808ad78b95f3757737d2162/invoke.js";
    invokeScript.async = true;
    wrapper.appendChild(invokeScript);
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
