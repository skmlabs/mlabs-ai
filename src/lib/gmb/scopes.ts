// Scopes needed to list a user's accounts/locations AND fetch performance metrics later.
// We request "business.manage" because Google does not grant read-only on GBP.
export const GMB_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
  "profile",
] as const;

export const GMB_SCOPE_STRING = GMB_OAUTH_SCOPES.join(" ");
