# Global Media Plan

A single-screen chat interface for the Global Media Plan workflow.

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
COGITX_BASE_URL=https://cpab.cogitx.ai
COGITX_EXPORT_ID=<export id>
COGITX_CLIENT_ID=<client id>
COGITX_CLIENT_SECRET=<client secret>
```

## Run

```bash
npm run dev
```

Open http://localhost:3000

## Deploy

Push to a Git repo and import it on Vercel, then add the four `COGITX_*`
variables in Project → Settings → Environment Variables.
