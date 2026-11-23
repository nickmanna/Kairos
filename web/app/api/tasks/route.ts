import { isAuthorized, unauthorized } from "@/lib/auth";
import { createTask, listTasks } from "@/lib/google";
import { errorResponse, validTimeZone } from "@/lib/http";
import { parseTask } from "@/lib/parse";
import { eventTimes } from "@/lib/time";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export async function GET(req: Request) {
  if (!isAuthorized(req)) return unauthorized();
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? new Date(Date.now() - DAY / 2).toISOString();
  const to = url.searchParams.get("to") ?? new Date(Date.now() + 7 * DAY).toISOString();
  try {
    return Response.json({ tasks: await listTasks(from, to) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { text?: unknown; timeZone?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return errorResponse("Say or type a task first.", 400);
  if (text.length > 1000) return errorResponse("That note is too long for one task.", 400);
  const timeZone = validTimeZone(body.timeZone);
  try {
    const parsed = await parseTask(text, timeZone);
    await createTask(parsed.title, parsed.description, eventTimes(parsed, timeZone));
    return Response.json({ task: parsed }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
