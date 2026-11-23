"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/google";

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function dayKey(t: Task) {
  if (t.allDay) return t.start;
  const d = new Date(t.start);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

const timeLabel = (t: Task) =>
  t.allDay
    ? "All day"
    : `${new Date(t.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${new Date(t.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

export default function Home() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 8 * 86_400_000);
    const res = await fetch(`/api/tasks?from=${from.toISOString()}&to=${to.toISOString()}`, { cache: "no-store" });
    if (res.status === 401) return void (location.href = "/login");
    const json = await res.json();
    if (!res.ok) return setToast({ msg: json.error, error: true });
    setTasks(json.tasks);
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(load, 120_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [load]);

  async function add(e?: React.FormEvent) {
    e?.preventDefault();
    const note = text.trim();
    if (!note || busy) return;
    setBusy(true);
    setToast({ msg: "Adding…" });
    try {
      const res = await fetch("/api/tasks", { method: "POST", body: JSON.stringify({ text: note, timeZone: tz() }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const p = json.task;
      setText("");
      setToast({ msg: `Added “${p.title}” · ${dayLabel(p.date)}${p.startTime ? ` at ${p.startTime}` : ""}` });
      await load();
    } catch (err) {
      setToast({ msg: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(t: Task) {
    setTasks((ts) => ts?.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) ?? ts);
    const res = await fetch(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ done: !t.done }) });
    if (!res.ok) {
      setToast({ msg: "Couldn't update that one.", error: true });
      load();
    }
  }

  async function remove(t: Task) {
    setTasks((ts) => ts?.filter((x) => x.id !== t.id) ?? ts);
    const res = await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      setToast({ msg: "Couldn't delete that one.", error: true });
      load();
    }
  }

  const groups = new Map<string, Task[]>();
  for (const t of tasks ?? []) groups.set(dayKey(t), [...(groups.get(dayKey(t)) ?? []), t]);

  return (
    <>
      <main className="shell">
        <header>
          <h1>Kairos</h1>
          <p>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        </header>

        {tasks === null && <div className="glass empty">Loading your calendar…</div>}
        {tasks?.length === 0 && <div className="glass empty">Nothing scheduled this week. Add something below.</div>}

        {[...groups].map(([key, items]) => (
          <section key={key} className="glass day">
            <h2>{dayLabel(key)}</h2>
            {items.map((t) => (
              <div key={t.id} className={`row${t.done ? " done" : ""}`}>
                {t.isTask ? (
                  <button className={`check${t.done ? " on" : ""}`} onClick={() => toggle(t)} aria-label={t.done ? "Mark not done" : "Mark done"}>
                    {t.done ? "✓" : ""}
                  </button>
                ) : (
                  <span className="dot" style={{ background: t.color }} title={t.calendar} />
                )}
                <div className="body">
                  <div className="title">{t.title}</div>
                  <div className="meta">
                    {timeLabel(t)}
                    {!t.isTask && ` · ${t.calendar}`}
                  </div>
                  {t.description && <div className="desc">{t.description.replace(/<[^>]+>/g, " ")}</div>}
                </div>
                {t.isTask && (
                  <button className="del" onClick={() => remove(t)} aria-label="Delete task">
                    ×
                  </button>
                )}
              </div>
            ))}
          </section>
        ))}
      </main>

      <div className="composer">
        <div className={`toast${toast?.error ? " error" : ""}`}>{toast?.msg}</div>
        <form className="glass" onSubmit={add}>
          <textarea
            ref={input}
            rows={1}
            value={text}
            placeholder="Add a task, e.g. “gym tomorrow at 6”"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add();
              }
            }}
            enterKeyHint="send"
          />
          <button className="btn" disabled={busy || !text.trim()}>
            Add
          </button>
        </form>
      </div>
    </>
  );
}
