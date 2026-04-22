import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: "#0a0a0f", card: "#13131f", border: "#1f1f2e" },
        brand: { indigo: "#6366f1", amber: "#f59e0b" },
        muted: "#6b7280",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;
