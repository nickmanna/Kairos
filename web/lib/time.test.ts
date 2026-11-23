import { test } from "node:test";
import assert from "node:assert/strict";
import { addMinutesLocal, eventTimes, localNow, nextDay } from "./time.ts";

test("addMinutesLocal rolls over midnight and month end", () => {
  assert.equal(addMinutesLocal("2026-11-30", "23:30", 45), "2026-12-01T00:15");
});

test("nextDay handles year end", () => {
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
});

test("timed task gets start and end in the zone", () => {
  const t = eventTimes(
    { title: "Lab", description: "", date: "2026-11-23", startTime: "16:00", durationMinutes: 90 },
    "America/Chicago",
  );
  assert.deepEqual(t, {
    start: { dateTime: "2026-11-23T16:00:00", timeZone: "America/Chicago" },
    end: { dateTime: "2026-11-23T17:30:00", timeZone: "America/Chicago" },
  });
});

test("no start time means all-day", () => {
  const t = eventTimes(
    { title: "Groceries", description: "", date: "2026-11-24", startTime: null, durationMinutes: 0 },
    "America/Chicago",
  );
  assert.deepEqual(t, { start: { date: "2026-11-24" }, end: { date: "2026-11-25" } });
});

test("zero duration defaults to 30 minutes", () => {
  const t = eventTimes(
    { title: "Call", description: "", date: "2026-11-23", startTime: "09:00", durationMinutes: 0 },
    "UTC",
  );
  assert.equal((t.end as { dateTime: string }).dateTime, "2026-11-23T09:30:00");
});

test("localNow formats in the given zone", () => {
  assert.equal(localNow(new Date("2026-11-23T18:59:00Z"), "America/Chicago"), "2026-11-23 12:59 (Monday)");
});
