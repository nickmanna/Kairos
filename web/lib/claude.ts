import Anthropic from "@anthropic-ai/sdk";
import { oidcFederationProvider } from "@anthropic-ai/sdk/lib/credentials/oidc-federation";

// Google's metadata server hands the server's service account a short-lived ID token.
// format=full adds the email claim the federation rule matches on.
const METADATA_IDENTITY_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity" +
  "?audience=https://api.anthropic.com&format=full";

async function googleIdentityToken(): Promise<string> {
  const res = await fetch(METADATA_IDENTITY_URL, { headers: { "Metadata-Flavor": "Google" } });
  if (!res.ok) throw new Error(`Could not get a Google identity token (${res.status}).`);
  return (await res.text()).trim();
}

/**
 * On Firebase App Hosting, authenticate with Workload Identity Federation: no API key exists,
 * the SDK trades the service account's Google token for a short-lived Anthropic token and
 * refreshes it before it expires. Locally, fall back to the SDK's normal credential lookup
 * (ANTHROPIC_API_KEY in .env.local, or an `ant auth login` profile).
 */
export function createClaudeClient(): Anthropic {
  const federationRuleId = process.env.ANTHROPIC_FEDERATION_RULE_ID;
  const organizationId = process.env.ANTHROPIC_ORGANIZATION_ID;
  if (!federationRuleId || !organizationId) return new Anthropic();

  const baseURL = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  return new Anthropic({
    baseURL,
    apiKey: null,
    authToken: null,
    credentials: oidcFederationProvider({
      identityTokenProvider: googleIdentityToken,
      federationRuleId,
      organizationId,
      serviceAccountId: process.env.ANTHROPIC_SERVICE_ACCOUNT_ID || undefined,
      workspaceId: process.env.ANTHROPIC_WORKSPACE_ID || undefined,
      baseURL,
      fetch,
    }),
  });
}
