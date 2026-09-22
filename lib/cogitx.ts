// ─────────────────────────────────────────────────────────────────────────────
// CogitX client — runs SERVER-SIDE ONLY. Holds the client credentials and talks
// to the CogitX export/jobs REST API. Nothing here ever reaches the browser.
//
// Contract mirrored from the resume-backend client (the confirmed, working one):
//   - Auth:    header-based  x-client-id / x-client-secret   (NO token exchange)
//   - Trigger: POST {BASE_URL}/project/exports/rest-api/{exportId}/jobs?waitSeconds=30
//   - Response: { statusCode, message, data: {...} }. Everything real is under `data`.
//       • Sync  → data.isCompleted === true inline.
//       • Async → data.runId (+ optional data.statusUrl) → poll until isCompleted.
//   - Output content lives at data.output.workflow_response.content
//       (falls back to data.output.variables.text / .message).
// ─────────────────────────────────────────────────────────────────────────────

type Msg = { role: "user" | "assistant"; content: string };

const {
  COGITX_BASE_URL,
  COGITX_EXPORT_ID,
  COGITX_CLIENT_ID,
  COGITX_CLIENT_SECRET,
} = process.env;

const POLL_INTERVAL_MS = Number(process.env.COGITX_POLL_INTERVAL_MS ?? 2000);
const POLL_TIMEOUT_MS = Number(process.env.COGITX_POLL_TIMEOUT_MS ?? 120000);

function requireEnv(name: string, val: string | undefined): string {
  if (!val) throw new Error(`Missing environment variable: ${name}`);
  return val;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-client-id": requireEnv("COGITX_CLIENT_ID", COGITX_CLIENT_ID),
    "x-client-secret": requireEnv("COGITX_CLIENT_SECRET", COGITX_CLIENT_SECRET),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── trigger a job; return the `data` object once it's complete ────────────────
async function trigger(body: Record<string, unknown>): Promise<any> {
  const base = requireEnv("COGITX_BASE_URL", COGITX_BASE_URL).replace(/\/$/, "");
  const eid = requireEnv("COGITX_EXPORT_ID", COGITX_EXPORT_ID);
  const triggerUrl = `${base}/project/exports/rest-api/${eid}/jobs?waitSeconds=30`;

  const res = await fetch(triggerUrl, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Trigger failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json())?.data ?? {};

  // Sync: completed within the wait window.
  if (data.isCompleted) return data;

  // Async: accepted for background processing → poll runId.
  if (data.runId) return poll(base, eid, data.runId, data.statusUrl);

  throw new Error(
    `Unexpected trigger response (no isCompleted/runId): ${Object.keys(data).join(", ")}`
  );
}

// ── poll a running job until it reports isCompleted ───────────────────────────
async function poll(base: string, eid: string, runId: string, statusUrl?: string): Promise<any> {
  // The poll path isn't 100% consistent across responses, so try each candidate
  // URL form: server-provided statusUrl, then /project/, then bare.
  const candidates = [
    statusUrl ? `${base}${statusUrl}` : "",
    `${base}/project/exports/rest-api/${eid}/jobs/${runId}`,
    `${base}/exports/rest-api/${eid}/jobs/${runId}`,
  ].filter(Boolean);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    for (const url of candidates) {
      let res: Response;
      try {
        res = await fetch(url, { headers: headers() });
        if (!res.ok) continue;
      } catch {
        continue; // this URL form / transient hiccup — try the next
      }
      const text = await res.text().catch(() => "");
      if (!text.trim()) continue; // still running, empty body
      let data: any;
      try {
        data = JSON.parse(text)?.data ?? {};
      } catch {
        continue; // non-JSON yet
      }
      if (data.isCompleted) return data;
      break; // valid status but not done — wait for the next tick
    }
  }
  throw new Error(`Job ${runId} did not complete within ${POLL_TIMEOUT_MS}ms`);
}

// ── locate the final output content in the completed `data` object ────────────
function extractContent(data: any): unknown {
  if (data.success === false) {
    throw new Error(`Workflow reported failure: ${data.error ?? "unknown"}`);
  }
  const output = data.output ?? {};
  const wr = output.workflow_response;
  if (wr && typeof wr === "object" && wr.content != null) return wr.content;

  const variables = output.variables ?? {};
  for (const key of ["text", "message"]) {
    if (variables[key] != null) return variables[key];
  }
  throw new Error(`Could not locate output content. output keys=${Object.keys(output).join(",")}`);
}

// Turn the raw content (string, JSON string, or object) into a chat reply string.
function toReplyText(raw: unknown): string {
  if (typeof raw === "string") {
    // The JSON Output node may wrap prose as {"result": "..."} — unwrap if so.
    const s = raw.trim();
    if (s.startsWith("{") && s.endsWith("}")) {
      try {
        const obj = JSON.parse(s);
        const inner = obj?.result ?? obj?.reply ?? obj?.text ?? obj?.message;
        if (typeof inner === "string") return inner;
      } catch {
        /* not JSON — fall through and return the string as-is */
      }
    }
    return raw;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const inner = o.result ?? o.reply ?? o.text ?? o.message;
    if (typeof inner === "string") return inner;
    return JSON.stringify(raw);
  }
  return String(raw);
}

// ── main entry ────────────────────────────────────────────────────────────────
export async function sendChat(message: string, history: Msg[]): Promise<string> {
  // The workflow's input node reads `text` (also mirrored to `message` for
  // robustness). If your GMP workflow expects a different field, change it here.
  const body: Record<string, unknown> = { text: message, message, history };

  const data = await trigger(body);
  return toReplyText(extractContent(data));
}
