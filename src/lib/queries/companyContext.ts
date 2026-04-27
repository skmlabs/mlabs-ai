import { createClient } from "@/lib/supabase/server";

// Schema lives in migration 0008 — interim JSONB on users; migrates to a
// proper companies table in Phase 5B's multi-tenant work.
//
// Note: server.ts exports `createClient` (not `createServerClient`).
export interface CompanyContext {
  // Identity
  brandName?: string;
  legalName?: string;
  logoUrl?: string;

  // Classification
  primaryCategory?: string;
  subCategory?: string;

  // Reach
  hqCity?: string;
  hqCountry?: string;
  yearFounded?: number;
  employeeCountRange?: string;

  // Public-facing
  website?: string;
  supportPhone?: string;
  supportEmail?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;

  // AI fuel — the rich context
  businessDescription?: string;
  uniqueSellingProposition?: string;
  keyServices?: string;
  targetCustomer?: string;
  customerJourneyStages?: string[];
  primaryGoals?: string[];

  // Strategic context
  competitiveContext?: string;
  keyDifferentiators?: string;
  growthPriorities?: string;
  operationalChallenges?: string;

  // Metadata
  lastEditedAt?: string;
}

export async function getCompanyContext(userId: string): Promise<CompanyContext> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("company_context")
    .eq("id", userId)
    .single();

  if (error) throw new Error(`Failed to fetch company context: ${error.message}`);
  return (data?.company_context as CompanyContext) || {};
}

export async function updateCompanyContext(
  userId: string,
  updates: Partial<CompanyContext>,
): Promise<CompanyContext> {
  const supabase = await createClient();

  const current = await getCompanyContext(userId);
  const merged: CompanyContext = {
    ...current,
    ...updates,
    lastEditedAt: new Date().toISOString(),
  };

  // Strip empty strings — clearing a field in the UI removes it entirely from
  // the stored JSONB so prompt builders don't see "" and treat it as a value.
  for (const key of Object.keys(merged) as Array<keyof CompanyContext>) {
    if (merged[key] === "") {
      delete merged[key];
    }
  }

  const { data, error } = await supabase
    .from("users")
    .update({ company_context: merged })
    .eq("id", userId)
    .select("company_context")
    .single();

  if (error) throw new Error(`Failed to update company context: ${error.message}`);
  return data.company_context as CompanyContext;
}
