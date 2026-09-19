"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreset = {
  id: string;
  name: string;
  primary: string;
  hover: string;
  text: string;
  glow: string;
  border: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "gold",
    name: "Cinema Gold",
    primary: "#FACC15",
    hover: "#EAB308",
    text: "#000000",
    glow: "rgba(250, 204, 21, 0.35)",
    border: "rgba(250, 204, 21, 0.4)",
  },
  {
    id: "cyan",
    name: "Cyber Cyan",
    primary: "#06B6D4",
    hover: "#0891B2",
    text: "#000000",
    glow: "rgba(6, 182, 212, 0.35)",
    border: "rgba(6, 182, 212, 0.4)",
  },
  {
    id: "crimson",
    name: "Neon Crimson",
    primary: "#EF4444",
    hover: "#DC2626",
    text: "#FFFFFF",
    glow: "rgba(239, 68, 68, 0.35)",
    border: "rgba(239, 68, 68, 0.4)",
  },
  {
    id: "emerald",
    name: "Emerald Mint",
    primary: "#10B981",
    hover: "#059669",
    text: "#000000",
    glow: "rgba(16, 185, 129, 0.35)",
    border: "rgba(16, 185, 129, 0.4)",
  },
  {
    id: "violet",
    name: "Electric Violet",
    primary: "#8B5CF6",
    hover: "#7C3AED",
    text: "#FFFFFF",
    glow: "rgba(139, 92, 246, 0.35)",
    border: "rgba(139, 92, 246, 0.4)",
  },
  {
    id: "blue",
    name: "Royal Blue",
    primary: "#3B82F6",
    hover: "#2563EB",
    text: "#FFFFFF",
    glow: "rgba(59, 130, 246, 0.35)",
    border: "rgba(59, 130, 246, 0.4)",
  },
];

type ThemeContextType = {
  theme: ThemePreset;
  setThemeId: (id: string) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: THEME_PRESETS[0],
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreset>(THEME_PRESETS[0]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("apollo_theme_color");
      if (saved) {
        const found = THEME_PRESETS.find((p) => p.id === saved);
        if (found) setTheme(found);
      }
    } catch {
      // localStorage unavailable or restricted
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--brand-accent", theme.primary);
    root.style.setProperty("--brand-accent-hover", theme.hover);
    root.style.setProperty("--brand-accent-text", theme.text);
    root.style.setProperty("--brand-accent-glow", theme.glow);
    root.style.setProperty("--brand-accent-border", theme.border);
  }, [theme]);

  const setThemeId = (id: string) => {
    const found = THEME_PRESETS.find((p) => p.id === id);
    if (found) {
      setTheme(found);
      try {
        localStorage.setItem("apollo_theme_color", id);
      } catch {
        // ignore
      }
    }
  };

  return <ThemeContext.Provider value={{ theme, setThemeId }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
