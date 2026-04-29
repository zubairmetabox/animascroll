import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

type SectionId = "history" | "environment" | "navigation" | "lighting" | "pointLights" | "variables" | "aiAnimator";

type UiPrefs = {
  workspace: "full" | "framed";
  leftPanelWidth: number;
  rightPanelWidth: number;
  panelLayout: { left: SectionId[]; right: SectionId[] };
  sectionsOpen: Record<string, boolean>;
};

const DEFAULTS: UiPrefs = {
  workspace: "framed",
  leftPanelWidth: 280,
  rightPanelWidth: 280,
  panelLayout: {
    left: ["history"],
    right: ["environment", "navigation", "lighting", "pointLights", "variables", "aiAnimator"],
  },
  sectionsOpen: { environment: true, lighting: true },
};

let tableReady = false;

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS user_ui_settings (
      user_id TEXT PRIMARY KEY,
      prefs JSONB NOT NULL DEFAULT '{}'
    )
  `.catch(() => {});
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!tableReady) { await ensureTable(); tableReady = true; }

  const rows = await sql`SELECT prefs FROM user_ui_settings WHERE user_id = ${userId}`;
  if (rows.length === 0) return NextResponse.json(DEFAULTS);

  const saved = rows[0].prefs as Partial<UiPrefs>;
  return NextResponse.json({ ...DEFAULTS, ...saved });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!tableReady) { await ensureTable(); tableReady = true; }

  const body = await req.json() as Partial<UiPrefs>;

  await sql`
    INSERT INTO user_ui_settings (user_id, prefs)
    VALUES (${userId}, ${JSON.stringify(body)}::jsonb)
    ON CONFLICT (user_id) DO UPDATE SET prefs = ${JSON.stringify(body)}::jsonb
  `;

  return NextResponse.json({ ok: true });
}
