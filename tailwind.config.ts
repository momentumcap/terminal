import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#080b10",
          panel: "#101722",
          border: "#243044",
          text: "#e5ebf5",
          muted: "#91a0b6",
          green: "#43d17a",
          amber: "#f3b449",
          red: "#ff5d5d",
          cyan: "#4cc9f0"
        }
      },
      boxShadow: {
        glow: "0 0 28px rgba(67, 209, 122, 0.16)",
        panel: "0 18px 50px rgba(0, 0, 0, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
