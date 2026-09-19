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
        // Cinemaos Dark Canvas Palette
        canvas: "#09090B",
        "bg-void": "#09090B",
        "bg-surface": "#09090B",
        "bg-card": "rgba(9, 9, 11, 0.6)",
        glass: "rgba(9, 9, 11, 0.75)",
        
        // Cinemaos Gold & Monochromatic Primary Tokens
        primary: "#FAFAFA",
        "on-primary": "#222222",
        body: "#A1A1AA",
        "accent-1": "#FACC15",
        "accent-2": "#FDE68B",
        gold: {
          DEFAULT: "#FACC15",
          soft: "#FDE68B",
          glow: "rgba(250, 204, 21, 0.3)",
        },
        brand: {
          DEFAULT: "#FACC15",
          crimson: "#FACC15",
          soft: "#FDE68B",
          glow: "rgba(250, 204, 21, 0.3)",
        },
        "text-vivid": "#FAFAFA",
        "text-muted": "#A1A1AA",
        "accent-emerald": "#10B981",
        "accent-amber": "#F59E0B",

        // Backwards-compatible aliases
        base: {
          DEFAULT: "#09090B",
          soft: "rgba(9, 9, 11, 0.8)",
          card: "rgba(9, 9, 11, 0.6)",
          line: "rgba(39, 39, 42, 0.5)",
        },
        accent: {
          DEFAULT: "#FACC15",
          soft: "#FDE68B",
          glow: "rgba(250, 204, 21, 0.3)",
        },
        text: {
          primary: "#FAFAFA",
          secondary: "#A1A1AA",
          muted: "#71717A",
        },
        badge: {
          rating: "#FACC15",
          filler: "#F59E0B",
          canon: "#10B981",
        },
      },
      fontFamily: {
        sans: [
          "Space Grotesk",
          "Plus Jakarta Sans",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
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
        tracked: "1.96px",
      },
      boxShadow: {
        "card-hover": "rgba(0, 0, 0, 0.4) 0px 10px 30px -5px",
        "brand-glow": "0 0 20px rgba(250, 204, 21, 0.35)",
        "brand-glow-lg": "0 20px 40px -10px rgba(250, 204, 21, 0.3)",
        "glass": "rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.1) 0px 4px 6px -4px",
        "cinema-micro": "rgba(255, 255, 255, 0.45) 0px 0px 10px 0px",
      },
      backdropBlur: {
        "glass": "20px",
      },
      borderRadius: {
        "glass": "20px",
        full: "9999px",
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
          "0%": { boxShadow: "0 0 0 0 rgba(250, 204, 21, 0.4)" },
          "70%": { boxShadow: "0 0 0 12px rgba(250, 204, 21, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(250, 204, 21, 0)" },
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