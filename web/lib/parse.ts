import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { localNow, type ParsedTask } from "./time";

const TaskSchema = z.object({
  title: z.string().describe("Short task title, a few words, no time or date in it"),
  description: z.string().describe("One short sentence of extra detail, or empty string"),
  date: z.string().describe("YYYY-MM-DD in the user's time zone"),
  startTime: z.string().nullable().describe("HH:MM 24-hour start time, or null if no time was given"),
  durationMinutes: z.number().int().describe("Length in minutes; 30 if a time was given but no length; 0 if no time"),
});

const SYSTEM = `You turn a short, possibly dictated note into one calendar task.
Resolve relative dates ("tomorrow", "Friday", "next week") against the current local time you are given.
If no date is mentioned, use today, unless the time has already passed today, then use tomorrow.
"Morning" means 09:00, "afternoon" 14:00, "evening" 18:00, "tonight" 20:00.
Strip filler words from dictation. Keep the title short; put any remaining detail in description.`;

let client: Anthropic | null = null;

export async function parseTask(text: string, timeZone: string, now = new Date()): Promise<ParsedTask> {
  client ??= new Anthropic();
  const model = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
  // Server-side refusal fallback exists for Opus/Sonnet/Fable, not Haiku.
  const fallback = model.startsWith("claude-haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 4000,
    ...fallback,
    system: SYSTEM,
    output_config: { effort: "low", format: betaZodOutputFormat(TaskSchema) },
    messages: [
      {
        role: "user",
        content: `Current local time: ${localNow(now, timeZone)} (${timeZone})\nNote: ${text}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined to parse this task.");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Claude did not return a task.");
  return parsed;
}
