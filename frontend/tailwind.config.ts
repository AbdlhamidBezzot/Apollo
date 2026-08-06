import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // OLED-dark Apollo palette
        "bg-void": "#08090C",
        "bg-surface": "#11131A",
        "bg-card": "#1B1E27",
        glass: "rgba(18, 20, 28, 0.65)",
        brand: {
          DEFAULT: "#FF0A47",
          crimson: "#FF0A47",
          soft: "#FF5C7A",
          glow: "rgba(255, 10, 71, 0.35)",
        },
        "text-vivid": "#FFFFFF",
        "text-muted": "#94A3B8",
        "accent-emerald": "#10B981",
        "accent-amber": "#F59E0B",

        // Backwards-compatible aliases (existing components keep working)
        base: {
          DEFAULT: "#08090C",
          soft: "#11131A",
          card: "#1B1E27",
          line: "#262A37",
        },
        accent: {
          DEFAULT: "#FF0A47",
          soft: "#FF5C7A",
          glow: "rgba(255, 10, 71, 0.35)",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#B3B9C5",
          muted: "#62706F",
        },
        badge: {
          rating: "#FFD166",
          filler: "#F59E0B",
          canon: "#10B981",
        },
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Roboto Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: {
        tightest: "-0.03em",
        tight: "-0.02em",
        wide: "0.02em",
      },
      boxShadow: {
        "card-hover": "0px 12px 32px rgba(0,0,0,0.8)",
        "brand-glow": "0 0 24px rgba(255, 10, 71, 0.35)",
        "brand-glow-lg": "0 20px 50px -10px rgba(255, 10, 71, 0.25)",
        "glass": "0 8px 32px rgba(0,0,0,0.35)",
      },
      backdropBlur: {
        "glass": "20px",
      },
      borderRadius: {
        "glass": "20px",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "rise": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "drawer-in": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "radial-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(255, 10, 71, 0.4)" },
          "70%": { boxShadow: "0 0 0 12px rgba(255, 10, 71, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255, 10, 71, 0)" },
        },
      },
      animation: {
        pulse: "pulse 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "rise": "rise 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "draw-in": "draw-in 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "radial-pulse": "radial-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;