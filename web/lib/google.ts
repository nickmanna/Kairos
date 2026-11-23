// Minimal Google Calendar REST client for a single user (refresh token in env).
import type { EventTimes } from "./time";

const API = "https://www.googleapis.com/calendar/v3";
export const SCOPES = "https://www.googleapis.com/auth/calendar";

let cached: { token: string; expires: number } | null = null;
let tasksCalendarId: string | null = process.env.GOOGLE_TASKS_CALENDAR_ID || null;

export function oauthClient() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.");
  return { id, secret };
}

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refresh) throw new Error("Google is not connected yet. Visit /api/google/connect.");
  const { id, secret } = oauthClient();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expires: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

async function gcal<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

type GCalendar = { id: string; summary: string; backgroundColor?: string; selected?: boolean; primary?: boolean; accessRole: string };
type GEvent = {
  id: string;
  status: string;
  summary?: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
};

export type Task = {
  id: string;
  title: string;
  description: string;
  start: string; // ISO dateTime or YYYY-MM-DD for all-day
  end: string;
  allDay: boolean;
  done: boolean;
  isTask: boolean; // lives in the Kairos tasks calendar
  calendar: string;
  color: string;
};

const encodeId = (calendarId: string, eventId: string) => Buffer.from(`${calendarId}\n${eventId}`).toString("base64url");
export function decodeId(id: string): { calendarId: string; eventId: string } {
  const [calendarId, eventId] = Buffer.from(id, "base64url").toString().split("\n");
  if (!calendarId || !eventId) throw new Error("Bad task id");
  return { calendarId, eventId };
}

export async function tasksCalendar(): Promise<string> {
  if (tasksCalendarId) return tasksCalendarId;
  const name = process.env.KAIROS_CALENDAR_NAME || "Kairos Tasks";
  const list = await gcal<{ items: GCalendar[] }>("/users/me/calendarList?minAccessRole=owner");
  const found = list.items.find((c) => c.summary === name);
  if (found) return (tasksCalendarId = found.id);
  const created = await gcal<{ id: string }>("/calendars", {
    method: "POST",
    body: JSON.stringify({ summary: name, description: "Tasks added from Kairos" }),
  });
  return (tasksCalendarId = created.id);
}

export async function listTasks(timeMin: string, timeMax: string): Promise<Task[]> {
  const tasksId = await tasksCalendar();
  const { items } = await gcal<{ items: GCalendar[] }>("/users/me/calendarList");
  const calendars = items.filter((c) => c.selected || c.primary || c.id === tasksId);
  const qs = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const perCalendar = await Promise.all(
    calendars.map(async (cal) => {
      try {
        const res = await gcal<{ items: GEvent[] }>(`/calendars/${encodeURIComponent(cal.id)}/events?${qs}`);
        return res.items
          .filter((e) => e.status !== "cancelled")
          .map<Task>((e) => ({
            id: encodeId(cal.id, e.id),
            title: e.summary ?? "(untitled)",
            description: e.description ?? "",
            start: e.start.dateTime ?? e.start.date ?? "",
            end: e.end.dateTime ?? e.end.date ?? "",
            allDay: !e.start.dateTime,
            done: e.extendedProperties?.private?.kairosDone === "1",
            isTask: cal.id === tasksId,
            calendar: cal.summary,
            color: cal.backgroundColor ?? "#7aa2f7",
          }));
      } catch {
        return []; // e.g. a holiday calendar we can't read; skip it
      }
    }),
  );
  return perCalendar.flat().sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

// All-day items sort to the top of their day.
const sortKey = (t: Task) => (t.allDay ? `${t.start}T00:00:00-99` : new Date(t.start).toISOString());

export async function createTask(title: string, description: string, times: EventTimes): Promise<void> {
  const calendarId = await tasksCalendar();
  await gcal(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: title,
      description: description || undefined,
      ...times,
      extendedProperties: { private: { kairos: "1", kairosDone: "0" } },
    }),
  });
}

export async function setDone(id: string, done: boolean): Promise<void> {
  const { calendarId, eventId } = decodeId(id);
  await gcal(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify({ extendedProperties: { private: { kairosDone: done ? "1" : "0" } } }),
  });
}

export async function deleteTask(id: string): Promise<void> {
  const { calendarId, eventId } = decodeId(id);
  await gcal(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
}
