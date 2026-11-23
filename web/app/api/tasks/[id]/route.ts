import { isAuthorized, unauthorized } from "@/lib/auth";
import { deleteTask, setDone } from "@/lib/google";
import { errorResponse } from "@/lib/http";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { done?: unknown };
  if (typeof body.done !== "boolean") return errorResponse("Send { done: true | false }.", 400);
  try {
    await setDone(id, body.done);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return unauthorized();
  const { id } = await ctx.params;
  try {
    await deleteTask(id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
