"use client";

import { useEffect } from "react";

const POPUNDER_URL =
  "https://fluffy-machine.com/bs3/Vr0sP.3YpavKb-myVUJpZqD/0T3DNpD_AQyoMmTiIdx/L/Tmcp0pMzDLI/xvMjj/UG";

// Cooldown between popunders (e.g. 10 minutes)
const COOLDOWN_MS = 10 * 60 * 1000;

export function PopunderScript() {
  useEffect(() => {
    const handleGlobalClick = () => {
      try {
        const lastFired = localStorage.getItem("apollo_popunder_last");
        const now = Date.now();

        if (lastFired && now - Number(lastFired) < COOLDOWN_MS) {
          return;
        }

        localStorage.setItem("apollo_popunder_last", now.toString());

        const popunderWin = window.open(POPUNDER_URL, "_blank");
        if (popunderWin) {
          popunderWin.blur();
          window.focus();
        }
      } catch {
        /* ignore popup blocker */
      }
    };

    window.addEventListener("click", handleGlobalClick, { capture: true, once: false });
    return () => {
      window.removeEventListener("click", handleGlobalClick, { capture: true });
    };
  }, []);

  return null;
}

export default PopunderScript;
