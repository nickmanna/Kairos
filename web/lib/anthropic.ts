import Anthropic from "@anthropic-ai/sdk";
import { oidcFederationProvider } from "@anthropic-ai/sdk/lib/credentials/oidc-federation";

// On Cloud Run (Firebase App Hosting) the metadata server mints a Google ID token for the
// backend's service account. `format=full` includes the `email` claim the federation rule checks.
const METADATA_ID_TOKEN =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity" +
  "?audience=https://api.anthropic.com&format=full";

async function googleIdentityToken(): Promise<string> {
  const res = await fetch(METADATA_ID_TOKEN, { headers: { "Metadata-Flavor": "Google" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't get a Google identity token (${res.status}). Is this running on Google Cloud?`);
  return (await res.text()).trim();
}

/**
 * Credentials, in order:
 * 1. ANTHROPIC_API_KEY if set (simplest for local dev).
 * 2. Workload Identity Federation when ANTHROPIC_FEDERATION_RULE_ID and ANTHROPIC_ORGANIZATION_ID
 *    are set: no stored key; the server proves it is your Cloud Run service account.
 * 3. Otherwise the SDK default chain (e.g. your `ant auth login` profile on your Mac).
 */
export function makeClient(): Anthropic {
  const env = process.env;
  if (!env.ANTHROPIC_API_KEY && env.ANTHROPIC_FEDERATION_RULE_ID && env.ANTHROPIC_ORGANIZATION_ID) {
    return new Anthropic({
      credentials: oidcFederationProvider({
        identityTokenProvider: googleIdentityToken,
        federationRuleId: env.ANTHROPIC_FEDERATION_RULE_ID,
        organizationId: env.ANTHROPIC_ORGANIZATION_ID,
        serviceAccountId: env.ANTHROPIC_SERVICE_ACCOUNT_ID || undefined,
        workspaceId: env.ANTHROPIC_WORKSPACE_ID || undefined,
        baseURL: env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
        fetch: globalThis.fetch,
      }),
    });
  }
  return new Anthropic();
}
