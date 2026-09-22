import { NextRequest, NextResponse } from "next/server";
import { sendChat } from "@/lib/cogitx";

// This route runs on the server. The browser calls POST /api/chat; this handler
// authenticates to CogitX with the client credentials and forwards the message,
// so the secret never leaves the server and there is no CORS issue.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const reply = await sendChat(message, Array.isArray(history) ? history : []);
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("[/api/chat]", err);
    return NextResponse.json(
      { error: err?.message ?? "Something went wrong" },
      { status: 500 }
    );
  }
}
