import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { head } from "@vercel/blob";
import type { SkillIndex } from "@/lib/skills";
import { sql } from "@/lib/db";

// ── User AI settings ───────────────────────────────────────────────────────

async function getUserAiSettings(userId: string): Promise<{ key: string | null; model: string }> {
  try {
    const rows = await sql`SELECT openrouter_key, model_id FROM user_ai_settings WHERE user_id = ${userId}`;
    if (rows.length === 0) return { key: null, model: "anthropic/claude-sonnet-4-5" };
    return {
      key: (rows[0].openrouter_key as string | null) || null,
      model: (rows[0].model_id as string) || "anthropic/claude-sonnet-4-5",
    };
  } catch {
    return { key: null, model: "anthropic/claude-sonnet-4-5" };
  }
}

// ── Types ─────────────────────────────────────────────────────────────────

type Keyframe = { atVh: number; value: number; easing?: string };

type Operation =
  | { type: "set_track"; layerName: string; propertyId: string; keyframes: Keyframe[] }
  | { type: "delete_track"; layerName: string; propertyId: string }
  | { type: "clear_all" }
  | { type: "set_timeline_length"; vh: number }
  | { type: "set_scene"; settings: Record<string, unknown> }
  | { type: "set_point_light"; index: number; patch: Record<string, unknown> }
  | { type: "exploded_view"; vh: number; multiplier?: number };

type LayerInfo = {
  name: string;
  id: string;
  type: string;
  depth: number;
  parentName: string | null;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  worldPosition: { x: number; y: number; z: number };
};

type PointLightInfo = {
  index: number;
  enabled: boolean;
  color: string;
  intensity: number;
  x: number;
  y: number;
  z: number;
  distance: number;
};

type SceneSettings = {
  backgroundColor: string;
  showGrid: boolean;
  useAmbientLight: boolean;
  ambientIntensity: number;
  useDirectionalLight: boolean;
  directionalIntensity: number;
  directionalX: number;
  directionalY: number;
  directionalZ: number;
};

type SceneContext = {
  timelineLengthVh: number;
  layers: LayerInfo[];
  currentTracks: { layerName: string; propertyId: string; keyframes: Keyframe[] }[];
  settings: SceneSettings;
  pointLights: PointLightInfo[];
};

type Message = { role: "user" | "assistant"; content: string };

// ── Skill fetching ─────────────────────────────────────────────────────────

async function fetchMatchedSkills(userId: string, userPrompt: string): Promise<string[]> {
  try {
    const indexPath = `skills/${userId}/_index.json`;
    const meta = await head(indexPath).catch(() => null);
    if (!meta) return [];

    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return [];
    const index = await res.json() as SkillIndex;

    const promptLower = userPrompt.toLowerCase();
    const matched = index.skills.filter(
      (s) => s.enabled && s.keywords.some((kw) => promptLower.includes(kw.toLowerCase()))
    );

    if (matched.length === 0) return [];

    // Fetch body content for matched skills (parallel)
    const bodies = await Promise.all(
      matched.map(async (entry) => {
        try {
          const r = await fetch(entry.blobUrl, { cache: "no-store" });
          if (!r.ok) return null;
          const raw = await r.text();
          // Strip frontmatter, keep body
          const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
          const body = m ? m[1].trim() : raw;
          return `### Skill: ${entry.name}\n${body}`;
        } catch {
          return null;
        }
      })
    );

    return bodies.filter((b): b is string => b !== null);
  } catch {
    return [];
  }
}

// ── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: SceneContext, skillBodies?: string[]): string {
  const layerList = ctx.layers.map((l) => {
    const indent = "  ".repeat(l.depth);
    const parent = l.parentName ? ` [child of "${l.parentName}"]` : "";
    const pos = `pos(${l.position.x.toFixed(2)},${l.position.y.toFixed(2)},${l.position.z.toFixed(2)})`;
    const wpos = `worldPos(${l.worldPosition.x.toFixed(2)},${l.worldPosition.y.toFixed(2)},${l.worldPosition.z.toFixed(2)})`;
    return `${indent}"${l.name}" [${l.type}]${parent} ${pos} ${wpos}`;
  }).join("\n") || "  (none)";

  const trackList = ctx.currentTracks.length === 0
    ? "  (none)"
    : ctx.currentTracks.map(
        (t) => `  - ${t.layerName} / ${t.propertyId}: ${t.keyframes.map((k) => `${k.atVh}vh=${k.value}`).join(", ")}`
      ).join("\n");

  const lightList = ctx.pointLights.map((l, i) =>
    `  [${i}] ${l.enabled ? "on" : "off"} color=${l.color} intensity=${l.intensity} pos(${l.x},${l.y},${l.z}) distance=${l.distance}`
  ).join("\n") || "  (none)";

  return `You are an expert AI animator inside Animascroll, a scroll-driven 3D animation editor.
The user scrolls a webpage and the 3D model animates. You control keyframes, timeline length, scene lighting, and environment.

## Current Scene State
Timeline length: ${ctx.timelineLengthVh}vh
Layers (with hierarchy, local position, world position):
${layerList}

Current tracks:
${trackList}

Scene settings:
  backgroundColor: "${ctx.settings.backgroundColor}"
  ambientLight: ${ctx.settings.useAmbientLight ? `on, intensity=${ctx.settings.ambientIntensity}` : "off"}
  directionalLight: ${ctx.settings.useDirectionalLight ? `on, intensity=${ctx.settings.directionalIntensity}, dir=(${ctx.settings.directionalX},${ctx.settings.directionalY},${ctx.settings.directionalZ})` : "off"}
  showGrid: ${ctx.settings.showGrid}

Point lights:
${lightList}

## Animatable Layer Properties
- position.x / position.y / position.z  — local position offset in world units
- rotation.x / rotation.y / rotation.z  — degrees (360 = full spin, values can exceed 360)
- scale.uniform                          — uniform scale multiplier (1.0 = original)
- opacity                                — 0.0 (invisible) to 1.0 (fully visible)

## Timeline Length Control
Use "set_timeline_length" to change how many vh the animation runs.
Example: { "type": "set_timeline_length", "vh": 400 }
Always set this BEFORE writing keyframes so atVh values are valid.

## Scene / Environment Control
Use "set_scene" to patch scene settings. Only include keys you want to change.
Settable keys: backgroundColor (hex), showGrid (bool),
  useAmbientLight (bool), ambientIntensity (number, 0–10),
  useDirectionalLight (bool), directionalIntensity (number, 0–10),
  directionalX/Y/Z (number, position of directional light source)
Example: { "type": "set_scene", "settings": { "backgroundColor": "#000000", "ambientIntensity": 1.5 } }

## Point Light Control
Use "set_point_light" with the light index (0-based) and a patch.
Settable patch keys: enabled (bool), color (hex), intensity (number), x/y/z (position), distance (number, 0=infinite)
Example: { "type": "set_point_light", "index": 0, "patch": { "intensity": 8, "color": "#ff6600" } }

## Easing Options
linear, easeIn, easeOut, easeInOut, easeInOutCubic

## Technique: Exploded View
Use the dedicated "exploded_view" operation — the client computes exact directions from real
3D world positions. Do NOT use set_track for exploded views.

{ "type": "exploded_view", "vh": 400, "multiplier": 1.0 }

- vh: total timeline length (400 is good for a 4-phase animation)
- multiplier: explosion strength — 1.0 = default, 1.5 = more dramatic, 0.5 = subtle
- The client will handle set_timeline_length automatically; do NOT emit a separate set_timeline_length when using exploded_view.

## Phase-based Animation Pattern
For multi-phase animations (e.g. closed → explode → hold → close):
  vh 0–25%: phase 1 (e.g. closed, all offsets at 0)
  vh 25–50%: phase 2 (e.g. exploding outward)
  vh 50–75%: phase 3 (e.g. fully exploded, hold)
  vh 75–100%: phase 4 (e.g. close back)

## Rules
- Use layer names EXACTLY as listed above (case-sensitive).
- atVh must be between 0 and the NEW timelineLengthVh (after any set_timeline_length op).
- set_timeline_length must come FIRST in the operations array if used.
- Only modify what the user asked about. Leave untouched tracks alone.
- For position offsets, use sensible values proportional to the model's world size.
- For rotation, values can go beyond 360 for multiple spins.

## Response Format
ONLY output valid JSON — no markdown, no explanation outside the JSON:
{
  "message": "Brief friendly explanation of what you did (1–3 sentences)",
  "operations": [
    { "type": "set_timeline_length", "vh": 400 },
    { "type": "set_scene", "settings": { "backgroundColor": "#000011" } },
    { "type": "set_point_light", "index": 0, "patch": { "intensity": 10 } },
    {
      "type": "set_track",
      "layerName": "<exact layer name>",
      "propertyId": "position.y",
      "keyframes": [
        { "atVh": 0, "value": 0, "easing": "easeInOut" },
        { "atVh": 200, "value": 3, "easing": "easeInOut" },
        { "atVh": 300, "value": 3, "easing": "easeInOut" },
        { "atVh": 400, "value": 0, "easing": "easeInOut" }
      ]
    }
  ]
}
Operation types: "set_track" | "delete_track" | "clear_all" | "set_timeline_length" | "set_scene" | "set_point_light" | "exploded_view"
For "delete_track":  { "type": "delete_track", "layerName": "...", "propertyId": "..." }
For "clear_all":     { "type": "clear_all" }
For "exploded_view": { "type": "exploded_view", "vh": 400, "multiplier": 1.0 }${
    skillBodies && skillBodies.length > 0
      ? `\n\n## Animation Skills (apply these techniques when relevant)\n${skillBodies.join("\n\n---\n\n")}`
      : ""
  }`;
}

// ── JSON repair ───────────────────────────────────────────────────────────

/**
 * When the LLM response is truncated mid-JSON, attempt to salvage the
 * complete operations that were emitted before the cut-off.
 */
function repairTruncatedJson(s: string): { message: string; operations: Operation[] } | null {
  // Extract the message field if present
  const msgMatch = s.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const message = msgMatch ? msgMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, "\"") : "(truncated)";

  // Find the operations array start
  const opsStart = s.indexOf('"operations"');
  if (opsStart === -1) return null;
  const arrStart = s.indexOf("[", opsStart);
  if (arrStart === -1) return null;

  // Walk forward collecting balanced objects
  const operations: Operation[] = [];
  let i = arrStart + 1;
  while (i < s.length) {
    // Skip whitespace / commas between elements
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length || s[i] === "]") break;
    if (s[i] !== "{") break;

    // Find the matching closing brace
    let depth = 0;
    let inStr = false;
    let escape = false;
    let j = i;
    for (; j < s.length; j++) {
      const ch = s[j];
      if (escape) { escape = false; continue; }
      if (ch === "\\" && inStr) { escape = true; continue; }
      if (ch === "\"") { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) break; }
    }
    if (depth !== 0) break; // incomplete object — stop here

    const objStr = s.slice(i, j + 1);
    try {
      operations.push(JSON.parse(objStr) as Operation);
    } catch {
      break; // malformed object — stop
    }
    i = j + 1;
  }

  if (operations.length === 0) return null;
  return { message: message + " (response was truncated; some operations may be missing)", operations };
}

// ── Rate limiting ─────────────────────────────────────────────────────────

const RATE_WINDOW_SEC = 60;
const RATE_LIMIT = 20; // requests per user per minute

async function ensureRateLimitsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT NOT NULL,
      window_start BIGINT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, window_start)
    )
  `.catch(() => {});
}

let rateLimitsTableReady = false;

async function checkRateLimit(userId: string): Promise<boolean> {
  if (!rateLimitsTableReady) {
    await ensureRateLimitsTable();
    rateLimitsTableReady = true;
  }
  const window = Math.floor(Date.now() / 1000 / RATE_WINDOW_SEC);
  const key = `animate:${userId}`;
  const rows = await sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${window}, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `;
  return (rows[0].count as number) <= RATE_LIMIT;
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      messages: Message[];
      sceneContext: SceneContext;
      screenshot?: string;
    };

    const { messages, sceneContext, screenshot } = body;

    // Validate screenshot must be a data URI (prevents SSRF via external URLs)
    if (screenshot && !screenshot.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid screenshot format" }, { status: 400 });
    }

    const useVision = Boolean(screenshot);

    const { key: userKey, model } = await getUserAiSettings(userId);

    if (!userKey) {
      return NextResponse.json(
        { error: "No API key configured. Add your OpenRouter key in File → AI Settings." },
        { status: 402 }
      );
    }

    const client = new OpenAI({
      apiKey: userKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "https://animascroll.com", "X-Title": "Animascroll" },
    });

    // Rate limit: 20 requests per user per minute
    const allowed = await checkRateLimit(userId);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
    }

    // Fetch matched skills (non-blocking — if it fails, proceed without)
    const userPrompt = messages.findLast((m) => m.role === "user")?.content ?? "";
    const skillBodies = await fetchMatchedSkills(userId, userPrompt).catch(() => []);

    const systemPrompt = buildSystemPrompt(sceneContext, skillBodies);

    const apiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
        if (m.role === "user" && useVision && screenshot && m === messages[messages.length - 1]) {
          return {
            role: "user",
            content: [
              { type: "text", text: m.content },
              { type: "image_url", image_url: { url: screenshot, detail: "low" } },
            ],
          };
        }
        return { role: m.role, content: m.content };
      }),
    ];

    const completion = await client.chat.completions.create({
      model,
      messages: apiMessages,
      temperature: 0.3,
      max_tokens: 32768,
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    // Strip accidental markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

    let parsed: { message: string; operations: Operation[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Response was truncated mid-JSON — salvage all complete operations
      const repaired = repairTruncatedJson(jsonStr);
      if (!repaired) {
        return NextResponse.json({ error: "AI returned malformed JSON", raw }, { status: 422 });
      }
      parsed = repaired;
    }

    if (typeof parsed.message !== "string" || !Array.isArray(parsed.operations)) {
      return NextResponse.json({ error: "AI response missing required fields", raw }, { status: 422 });
    }

    return NextResponse.json({ message: parsed.message, operations: parsed.operations });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/animate]", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Internal server error" },
      { status: 500 }
    );
  }
}
