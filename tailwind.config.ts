import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F8FAFC",
        surface: "#FFFFFF",
        primaryText: "#0F172A",
        primaryAction: {
          DEFAULT: "#0284C7",
          hover: "#0369A1",
          light: "#E0F2FE",
        },
        positive: {
          DEFAULT: "#10B981",
          light: "#D1FAE5",
          dark: "#047857",
        },
        warm: {
          DEFAULT: "#F59E0B",
          light: "#FEF3C7",
          dark: "#B45309",
        },
        subtleHover: "#E0F2FE",
        borderMuted: "#E2E8F0",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)",
        cardHover: "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
        glass: "0 8px 32px 0 rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
