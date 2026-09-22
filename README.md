# Global Media Plan — CogitX chatbot

A single-screen chatbot UI (CogitX look & feel) with a Next.js API route that
proxies to your CogitX export/chat workflow. The client ID/secret stay
server-side, so the browser never sees them and there's no CORS problem.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create your env file from the example and fill it in:
   ```bash
   cp .env.local.example .env.local
   ```
   Set `COGITX_BASE_URL`, `COGITX_EXPORT_ID`, `COGITX_CLIENT_ID`,
   `COGITX_CLIENT_SECRET`. Auth is header-based (`x-client-id` /
   `x-client-secret`) — same as your resume-backend, no token exchange.

3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000

## How it flows

```
browser  ──POST /api/chat──▶  Next.js route  ──auth + POST──▶  CogitX export /chat
   ▲                              (secrets here)                      │
   └──────────────  { reply }  ◀───────────────────────────────────┘
```

- Frontend: `app/page.tsx` + `app/globals.css`
- Server proxy: `app/api/chat/route.ts`
- Auth + CogitX call: `lib/cogitx.ts`  ← the only file to touch if the request/
  response shape differs from the defaults (look for the `TODO` markers)

## Deploy to Vercel

Push to a Git repo, import it in Vercel, then add the four `COGITX_*` env vars
in **Project → Settings → Environment Variables**. Do **not** commit `.env.local`.

## The CogitX contract (matches resume-backend)

- **Auth:** headers `x-client-id` / `x-client-secret` (no OAuth token step).
- **Trigger:** `POST {BASE_URL}/project/exports/rest-api/{EXPORT_ID}/jobs?waitSeconds=30`
- **Response:** `{ statusCode, message, data }`. Sync jobs come back with
  `data.isCompleted=true` inline; async ones return `data.runId` and are polled
  until complete.
- **Reply text:** read from `data.output.workflow_response.content`
  (falls back to `data.output.variables.text|message`).

The request body sends `{ text, message, history }`. If your GMP workflow's
input node reads a different field, change it in `sendChat()` in `lib/cogitx.ts`.
