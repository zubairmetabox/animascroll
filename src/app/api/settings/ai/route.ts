import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_ai_settings (
      user_id TEXT PRIMARY KEY,
      openrouter_key TEXT,
      model_id TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4-5'
    )
  `.catch(() => {});
}

let tableReady = false;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!tableReady) { await ensureTable(); tableReady = true; }

  const rows = await sql`SELECT openrouter_key, model_id FROM user_ai_settings WHERE user_id = ${userId}`;
  if (rows.length === 0) return NextResponse.json({ hasKey: false, model: "anthropic/claude-sonnet-4-5" });

  const row = rows[0];
  const key = row.openrouter_key as string | null;
  return NextResponse.json({
    hasKey: Boolean(key),
    keyPreview: key ? `${key.slice(0, 8)}…` : null,
    model: (row.model_id as string) || "anthropic/claude-sonnet-4-5",
  });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!tableReady) { await ensureTable(); tableReady = true; }

  const body = await req.json() as { key?: string; model?: string };
  const { key, model } = body;

  if (model !== undefined && typeof model !== "string") {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  await sql`
    INSERT INTO user_ai_settings (user_id, openrouter_key, model_id)
    VALUES (${userId}, ${key ?? null}, ${model ?? "anthropic/claude-sonnet-4-5"})
    ON CONFLICT (user_id) DO UPDATE SET
      openrouter_key = COALESCE(EXCLUDED.openrouter_key, user_ai_settings.openrouter_key),
      model_id = COALESCE(EXCLUDED.model_id, user_ai_settings.model_id)
  `;

  return NextResponse.json({ ok: true });
}
