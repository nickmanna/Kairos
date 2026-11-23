import { randomBytes } from "node:crypto";
import { isAuthorized } from "@/lib/auth";
import { oauthClient, SCOPES } from "@/lib/google";
import { errorResponse, origin } from "@/lib/http";

// Step 1 of one-time setup: send you to Google's consent screen.
export async function GET(req: Request) {
  if (!isAuthorized(req)) return Response.redirect(`${origin(req)}/login?next=/api/google/connect`, 302);
  try {
    const { id } = oauthClient();
    const state = randomBytes(16).toString("hex");
    const params = new URLSearchParams({
      client_id: id,
      redirect_uri: `${origin(req)}/api/google/callback`,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
        "Set-Cookie": `kairos_oauth_state=${state}; Path=/api/google; HttpOnly; SameSite=Lax; Max-Age=600`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
