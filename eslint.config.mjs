// Decision: Next 15.2.4 + ESLint 9 — use FlatCompat to load legacy eslint-config-next (eslintrc-style).
// create-next-app scaffolded the Next-16 style subpath imports; those don't exist in eslint-config-next@15.x.
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "build/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"],
  },
];

export default eslintConfig;
