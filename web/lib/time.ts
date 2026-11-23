// Pure helpers for turning parsed tasks into Google Calendar event times.
// Times are "wall clock" values in the user's time zone; Google applies the zone.

export type ParsedTask = {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM (24h), null = all-day
  durationMinutes: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Add minutes to a local "YYYY-MM-DDTHH:MM" wall time, returning the same format. */
export function addMinutesLocal(date: string, time: string, minutes: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm) + minutes * 60_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** Next calendar day for an all-day event's exclusive end date. */
export function nextDay(date: string): string {
  return addMinutesLocal(date, "00:00", 24 * 60).slice(0, 10);
}

export type EventTimes = {
  start: { date: string } | { dateTime: string; timeZone: string };
  end: { date: string } | { dateTime: string; timeZone: string };
};

export function eventTimes(task: ParsedTask, timeZone: string): EventTimes {
  if (!task.startTime) {
    return { start: { date: task.date }, end: { date: nextDay(task.date) } };
  }
  const duration = task.durationMinutes > 0 ? task.durationMinutes : 30;
  return {
    start: { dateTime: `${task.date}T${task.startTime}:00`, timeZone },
    end: { dateTime: `${addMinutesLocal(task.date, task.startTime, duration)}:00`, timeZone },
  };
}

/** "YYYY-MM-DD HH:MM (Weekday)" for the current moment in a time zone, for the parser prompt. */
export function localNow(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} (${get("weekday")})`;
}
