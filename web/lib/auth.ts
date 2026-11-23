import { timingSafeEqual } from "node:crypto";

export const COOKIE = "kairos_token";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkToken(candidate: string | undefined | null): boolean {
  const expected = process.env.KAIROS_TOKEN;
  if (!expected || !candidate) return false;
  return same(candidate, expected);
}

/** Accepts the login cookie (web app) or a Bearer token (Mac widget). */
export function isAuthorized(req: Request): boolean {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return checkToken(header.slice(7));
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  return checkToken(match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : null);
}

export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 });
