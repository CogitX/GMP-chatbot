"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi \u{1F44B} I'm your Global Media Plan assistant. Ask me to draft a plan, compare channels, or estimate reach and budget.";
const SUGGESTIONS = ["Draft a launch media plan", "Compare channels", "Estimate budget split"];

// very small, safe markdown: **bold**
function fmt(s: string) {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [showChips, setShowChips] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  // auto-grow textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  async function submit() {
    const text = input.trim();
    if (!text || busy) return;

    const nextHistory: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setShowChips(false);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextHistory.slice(0, -1), // history before this message
        }),
      });
      const data = await res.json();
      const reply = res.ok
        ? data.reply
        : `⚠️ ${data.error ?? "Request failed"}`;
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ Couldn't reach the assistant. ${err?.message ?? ""}` },
      ]);
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }

  function onChip(s: string) {
    setInput(s);
    // submit on next tick so state is set
    setTimeout(() => submit(), 0);
  }

  function newChat() {
    setMessages([{ role: "assistant", content: GREETING }]);
    setShowChips(true);
    setInput("");
    taRef.current?.focus();
  }

  return (
    <div className="app">
      <aside className="side">
        <div className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cogitx-logo.png" alt="CogitX" />
        </div>
        <button className="newchat" type="button" onClick={newChat}>
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg> New chat
        </button>
        <div className="me">
          <div className="ava">T</div>
          <div>
            <div className="nm">Test User</div>
            <div className="em">test@cogitx.ai</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div>
            <h1>Global Media Plan</h1>
            <div className="sub">AI assistant</div>
          </div>
        </div>

        <div className="scroll" ref={scrollRef}>
          <div className="thread">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === "assistant" ? "bot" : "user"}`}>
                <div className="av" aria-hidden="true">{m.role === "assistant" ? "C" : "T"}</div>
                <div className="bubble" dangerouslySetInnerHTML={{ __html: fmt(m.content) }} />
              </div>
            ))}

            {busy && (
              <div className="msg bot">
                <div className="av" aria-hidden="true">C</div>
                <div className="bubble">
                  <span className="typing"><i /><i /><i /></span>
                </div>
              </div>
            )}

            {showChips && !busy && (
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" type="button" onClick={() => onChip(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="composer-wrap">
          <form
            className="composer"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              placeholder="Ask about your media plan…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
            />
            <button className="send" type="submit" aria-label="Send" disabled={busy || !input.trim()}>
              <svg viewBox="0 0 24 24"><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
