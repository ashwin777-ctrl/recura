import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fintech-neutral surface scale (slate-tuned) + brand + semantic states.
        bg: "#0a0e17",
        surface: "#111725",
        "surface-2": "#161d2e",
        border: "#232c40",
        muted: "#8a97b1",
        fg: "#e7ecf5",
        brand: {
          DEFAULT: "#5b8cff",
          fg: "#c9d9ff",
          dim: "#2a3a63",
        },
        good: "#3ecf8e",
        "good-dim": "#123326",
        warn: "#f5b445",
        "warn-dim": "#3a2c0f",
        bad: "#ff6b6b",
        "bad-dim": "#3a1717",
        info: "#59c2e6",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
      borderRadius: {
        xl: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
