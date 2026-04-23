type EnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "ENCRYPTION_KEY"
  | "GOOGLE_OAUTH_CLIENT_ID"
  | "GOOGLE_OAUTH_CLIENT_SECRET"
  | "GOOGLE_MAPS_API_KEY";

const REQUIRED_ENV_VARS: EnvKey[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_KEY",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_MAPS_API_KEY",
];

export function assertEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}. Set these in .env.local (dev) or Vercel project settings (prod).`);
  }
}

export function getEnv(key: EnvKey): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} is not set`);
  return v;
}
