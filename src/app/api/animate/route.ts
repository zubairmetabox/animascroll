import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ── Types ─────────────────────────────────────────────────────────────────

type Keyframe = { atVh: number; value: number; easing?: string };

type Operation =
  | { type: "set_track"; layerName: string; propertyId: string; keyframes: Keyframe[] }
  | { type: "delete_track"; layerName: string; propertyId: string }
  | { type: "clear_all" };

type SceneContext = {
  timelineLengthVh: number;
  layers: { name: string; id: string }[];
  currentTracks: { layerName: string; propertyId: string; keyframes: Keyframe[] }[];
};

type Message = { role: "user" | "assistant"; content: string };

// ── System prompt ─────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: SceneContext): string {
  return `You are an AI animator inside a 3D animation editor called Animascroll.
Your job is to interpret the user's animation requests and output structured keyframe operations.

## Scene State
Timeline length: ${ctx.timelineLengthVh}vh (0 = start, ${ctx.timelineLengthVh} = end)
Layers available: ${ctx.layers.map((l) => `"${l.name}"`).join(", ") || "none"}
Current tracks:
${
  ctx.currentTracks.length === 0
    ? "  (none)"
    : ctx.currentTracks
        .map(
          (t) =>
            `  - ${t.layerName} / ${t.propertyId}: ${t.keyframes.map((k) => `${k.atVh}vh=${k.value}`).join(", ")}`
        )
        .join("\n")
}

## Animatable Properties
- position.x, position.y, position.z  (world-space units, any number)
- rotation.x, rotation.y, rotation.z  (degrees, e.g. 0–360)
- scale.uniform  (e.g. 0.1–5.0, where 1.0 = original size)
- opacity  (0.0 = invisible, 1.0 = fully visible)

## Easing Options
linear, easeIn, easeOut, easeInOut, easeInOutCubic

## Rules
- Only modify tracks the user asked about. Leave others untouched.
- Use the layer names exactly as listed above.
- Keep values sensible — don't go to extremes unless the user asks.
- atVh values must be between 0 and ${ctx.timelineLengthVh}.
- For rotation, 360 = one full spin. Values can exceed 360 for multiple spins.
- At minimum provide a keyframe at atVh 0 and one at a meaningful end point.

## Response Format
Always respond with ONLY valid JSON in this exact shape — no markdown, no extra text:
{
  "message": "Brief explanation of what you did (1–2 sentences, friendly tone)",
  "operations": [
    {
      "type": "set_track",
      "layerName": "<exact layer name>",
      "propertyId": "<property>",
      "keyframes": [
        { "atVh": 0, "value": 0, "easing": "linear" },
        { "atVh": 100, "value": 360, "easing": "easeInOut" }
      ]
    }
  ]
}
Operation types: "set_track" | "delete_track" | "clear_all"
For "delete_track": { "type": "delete_track", "layerName": "...", "propertyId": "..." }
For "clear_all":   { "type": "clear_all" }`;
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      messages: Message[];
      sceneContext: SceneContext;
      screenshot?: string;
    };

    const { messages, sceneContext, screenshot } = body;
    const useVision = Boolean(screenshot);

    // Pick provider
    const client = useVision
      ? new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        })
      : new OpenAI({
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1",
        });

    const model = useVision ? "gpt-4o" : "llama-3.3-70b-versatile";

    // Build messages for the API call
    const systemPrompt = buildSystemPrompt(sceneContext);

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
      max_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    // Extract JSON — strip any accidental markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

    let parsed: { message: string; operations: Operation[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "AI returned malformed JSON", raw },
        { status: 422 }
      );
    }

    // Basic validation
    if (typeof parsed.message !== "string" || !Array.isArray(parsed.operations)) {
      return NextResponse.json(
        { error: "AI response missing required fields", raw },
        { status: 422 }
      );
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
