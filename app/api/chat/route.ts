import { NextRequest, NextResponse } from "next/server";
import { sendChat } from "@/lib/cogitx";

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
    return NextResponse.json(
      { error: err?.message ?? "Something went wrong" },
      { status: 500 }
    );
  }
}
