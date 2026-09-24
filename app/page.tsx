"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const PanelIcon = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="9" y1="4" x2="9" y2="20" />
  </svg>
);

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
    <div className="flex h-full overflow-hidden bg-app-surface text-fg-primary">
      <aside className={cn("w-56 shrink-0 flex-col bg-sidebar-surface border-r border-edge-3 px-3.5 py-[18px]", collapsed ? "hidden" : "flex")}>
        <div className="flex items-center justify-between gap-2 px-1.5 pb-[18px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cogitx-logo.png" alt="CogitX" className="h-[26px] w-auto" />
          <Button variant="ghost" size="icon" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar">
            <PanelIcon />
          </Button>
        </div>

        <Button variant="default" onClick={newChat} className="w-full gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </Button>

        <div className="mt-auto flex items-center gap-2.5 pt-3 px-2 border-t border-edge-2">
          <div className="w-[30px] h-[30px] rounded-full bg-btn-black text-white grid place-items-center text-[13px] font-semibold shrink-0">T</div>
          <div>
            <div className="text-[12.5px] font-semibold leading-tight">Test User</div>
            <div className="text-[11px] text-fg-muted leading-tight">test@cogitx.ai</div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="shrink-0 bg-header-surface border-b border-edge-2 px-6 py-[15px] flex items-center gap-3">
          {collapsed && (
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} aria-label="Open sidebar">
              <PanelIcon />
            </Button>
          )}
          <div>
            <h1 className="text-base font-semibold">Global Media Plan</h1>
            <div className="text-xs text-fg-muted mt-0.5">AI assistant</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          <div className="max-w-[760px] mx-auto px-5 pt-6 pb-2 flex flex-col gap-[18px]">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2.5 max-w-[88%]", m.role === "user" && "self-end flex-row-reverse")}>
                <div
                  className={cn(
                    "w-[30px] h-[30px] rounded-lg shrink-0 grid place-items-center font-bold text-xs",
                    m.role === "assistant" ? "bg-btn-black text-white" : "bg-edge-2 text-fg-muted"
                  )}
                  aria-hidden="true"
                >
                  {m.role === "assistant" ? "C" : "T"}
                </div>
                {m.role === "assistant" ? (
                  <div
                    className="md px-[15px] py-3 rounded-2xl rounded-tl-[5px] bg-white border border-edge-3 text-[14.5px] leading-[1.55]"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                  />
                ) : (
                  <div className="px-[15px] py-3 rounded-2xl rounded-tr-[5px] bg-btn-black text-white text-[14.5px] leading-[1.55] whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="flex gap-2.5 max-w-[88%]">
                <div className="w-[30px] h-[30px] rounded-lg shrink-0 grid place-items-center font-bold text-xs bg-btn-black text-white" aria-hidden="true">C</div>
                <div className="px-[15px] py-3 rounded-2xl rounded-tl-[5px] bg-white border border-edge-3">
                  <span className="typing"><i /><i /><i /></span>
                </div>
              </div>
            )}

            {showChips && !busy && (
              <div className="flex flex-wrap gap-2.5 pl-[41px]">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => submit(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-5 pt-3.5 pb-[18px]">
          <form
            className="max-w-[760px] mx-auto flex items-end gap-2.5 bg-input-surface border border-input-border rounded-[15px] pl-4 pr-2 py-2 focus-within:border-input-border-focus transition-colors"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              placeholder="Ask about your media plan…"
              className="flex-1 resize-none border-0 outline-none bg-transparent text-fg-primary text-[14.5px] leading-normal max-h-[140px] py-[7px] placeholder:text-fg-muted"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
            />
            <Button type="submit" size="icon" aria-label="Send" disabled={busy || !input.trim()}>
              <svg viewBox="0 0 24 24" className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4 20-7z" />
              </svg>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
