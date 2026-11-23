import { isAuthorized } from "@/lib/auth";
import { oauthClient } from "@/lib/google";
import { origin } from "@/lib/http";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const page = (body: string, status = 200) =>
  new Response(
    `<!doctype html><meta name="viewport" content="width=device-width"><title>Kairos setup</title>
<body style="font:16px system-ui;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5">${body}</body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

// Step 2 of one-time setup: trade the code for a refresh token and show it once.
export async function GET(req: Request) {
  if (!isAuthorized(req)) return page("<p>Log in to Kairos first.</p>", 401);
  const url = new URL(req.url);
  const cookie = req.headers.get("cookie") ?? "";
  const state = cookie.match(/kairos_oauth_state=([a-f0-9]+)/)?.[1];
  if (!state || state !== url.searchParams.get("state")) return page("<p>Setup link expired. Start again at /api/google/connect.</p>", 400);
  const code = url.searchParams.get("code");
  if (!code) return page(`<p>Google said: ${esc(url.searchParams.get("error") ?? "no code")}</p>`, 400);

  const { id, secret } = oauthClient();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: `${origin(req)}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as { refresh_token?: string; error_description?: string };
  if (!json.refresh_token) return page(`<p>No refresh token returned: ${esc(json.error_description ?? "unknown error")}</p>`, 400);

  return page(`<h2>Google Calendar connected</h2>
<p>Copy this value into the <code>GOOGLE_REFRESH_TOKEN</code> environment variable (Vercel → Project → Settings → Environment Variables, or <code>web/.env.local</code> locally), then redeploy or restart.</p>
<textarea readonly rows="4" style="width:100%;font:13px ui-monospace" onclick="this.select()">${esc(json.refresh_token)}</textarea>
<p>It is shown only once. Keep it private: it lets Kairos read and write your calendar.</p>`);
}
