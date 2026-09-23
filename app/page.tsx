"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Hi, I'm your Global Media Plan assistant. Ask me to draft a plan, compare channels, or estimate reach and budget.";
const SUGGESTIONS = ["Draft a launch media plan", "Compare channels", "Estimate budget split"];

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string) {
  return s
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>");
}

function renderMarkdown(md: string) {
  const lines = escapeHtml(md).replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      closeList();
      const lvl = m[1].length;
      const tag = lvl <= 2 ? "h3" : lvl === 3 ? "h4" : "h5";
      out.push(`<${tag}>${inline(m[2])}</${tag}>`);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (list !== "ul") { closeList(); list = "ul"; out.push("<ul>"); }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      if (list !== "ol") { closeList(); list = "ol"; out.push("<ol>"); }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("");
}

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [showChips, setShowChips] = useState(true);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  async function submit(textOverride?: string) {
    const text = (textOverride ?? input).trim();
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
        body: JSON.stringify({ message: text, history: nextHistory.slice(0, -1) }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : data.error ?? "Request failed";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Couldn't reach the assistant. ${err?.message ?? ""}` },
      ]);
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }

  function newChat() {
    setMessages([{ role: "assistant", content: GREETING }]);
    setShowChips(true);
    setInput("");
    taRef.current?.focus();
  }

  return (
    <div className={`app${collapsed ? " collapsed" : ""}`}>
      <aside className="side">
        <div className="logo">
          <img src="/cogitx-logo.png" alt="CogitX" />
          <button className="icon-btn side-toggle" type="button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /></svg>
          </button>
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
          <button className="icon-btn expand" type="button" onClick={() => setCollapsed(false)} aria-label="Open sidebar">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" /></svg>
          </button>
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
                {m.role === "assistant" ? (
                  <div className="bubble md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                ) : (
                  <div className="bubble">{m.content}</div>
                )}
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
                  <button key={s} className="chip" type="button" onClick={() => submit(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="composer-wrap">
          <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
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
