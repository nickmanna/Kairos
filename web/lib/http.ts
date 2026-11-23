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

export const origin = (req: Request) => process.env.PUBLIC_URL?.replace(/\/$/, "") || new URL(req.url).origin;
