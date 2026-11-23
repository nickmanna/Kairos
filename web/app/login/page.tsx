"use client";
import { useState } from "react";

export default function Login() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ token }) });
    if (!res.ok) return setError("That passcode didn't match.");
    const next = new URLSearchParams(location.search).get("next");
    location.href = next?.startsWith("/") ? next : "/";
  }

  return (
    <form className="login glass" onSubmit={submit}>
      <h1 style={{ margin: 0 }}>Kairos</h1>
      <input type="password" placeholder="Passcode" value={token} onChange={(e) => setToken(e.target.value)} autoFocus />
      <button className="btn">Unlock</button>
      {error && <div className="toast error">{error}</div>}
    </form>
  );
}
