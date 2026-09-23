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

  if (data.isCompleted) return data;
  if (data.runId) return poll(base, eid, data.runId, data.statusUrl);

  throw new Error(
    `Unexpected trigger response (no isCompleted/runId): ${Object.keys(data).join(", ")}`
  );
}

async function poll(base: string, eid: string, runId: string, statusUrl?: string): Promise<any> {
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
        continue;
      }
      const text = await res.text().catch(() => "");
      if (!text.trim()) continue;
      let data: any;
      try {
        data = JSON.parse(text)?.data ?? {};
      } catch {
        continue;
      }
      if (data.isCompleted) return data;
      break;
    }
  }
  throw new Error(`Job ${runId} did not complete within ${POLL_TIMEOUT_MS}ms`);
}

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

function toReplyText(raw: unknown): string {
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s.startsWith("{") && s.endsWith("}")) {
      try {
        const obj = JSON.parse(s);
        const inner = obj?.result ?? obj?.reply ?? obj?.text ?? obj?.message;
        if (typeof inner === "string") return inner;
      } catch {}
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

export async function sendChat(message: string, history: Msg[]): Promise<string> {
  const body: Record<string, unknown> = { text: message, message, history };
  const data = await trigger(body);
  return toReplyText(extractContent(data));
}
