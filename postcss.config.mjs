// Decision: Tailwind v3 used to match prompt 1A config (tailwind.config.ts + @tailwind directives).
// create-next-app scaffolded v4 by default; downgraded during Prompt 1A setup.
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
