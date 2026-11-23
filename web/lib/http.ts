export const errorResponse = (err: unknown, status = 500) =>
  Response.json({ error: err instanceof Error ? err.message : String(err) }, { status });

export function validTimeZone(tz: unknown): string {
  if (typeof tz === "string") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    } catch {}
  }
  return process.env.KAIROS_TIMEZONE || "America/Chicago";
}

/** Public origin of this app. Cloud Run / App Hosting sit behind a proxy, so prefer the forwarded headers. */
export function origin(req: Request): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0];
  return host ? `${proto || "https"}://${host}` : new URL(req.url).origin;
}

export const isHttps = (req: Request) => origin(req).startsWith("https:");
