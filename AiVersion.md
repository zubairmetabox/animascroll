# Animascroll — AI Chat Animator Plan

## What We're Building

A chat panel inside the editor where the user describes what they want the animation to do in plain English. The AI interprets the request, outputs structured keyframe operations, and the timeline updates live. The user can keep chatting to refine the result.

---

## User Flow

1. User uploads a 3D model
2. Opens the AI chat panel (right sidebar)
3. Types: *"Make the Cube spin 360° and fade in over the first half"*
4. AI responds in text: *"I've added a full Y-axis rotation and an opacity fade-in for Cube from 0–100vh"*
5. Timeline updates immediately with new keyframes
6. User continues: *"Now make it bounce up and down too"*
7. AI adds position.y keyframes without touching the rotation/opacity tracks
8. User is happy — closes chat, exports

---

## Architecture

### Provider

**Cerebras** (free tier, OpenAI-compatible API) as the default text provider.

- Base URL: `https://api.cerebras.ai/v1`
- Model: `llama-3.3-70b`
- SDK: `openai` npm package (with custom `baseURL`)
- Vision fallback: **OpenAI GPT-4o** (when user enables screenshot mode)

Both providers are configurable via env vars — swapping the provider requires only changing env values.

### Data Flow

```
User types message
       ↓
[AiChatPanel] builds scene context (layers + current tracks + timeline length)
       ↓
  [optional] captures canvas screenshot (toDataURL)
       ↓
POST /api/animate  { messages[], sceneContext, screenshot? }
       ↓
[API Route] builds system prompt with full animation schema
       ↓
Cerebras / OpenAI API call (streaming optional)
       ↓
AI returns JSON operations + human-readable message
       ↓
[AiChatPanel] parses operations → calls setAnimationTracks()
       ↓
Timeline updates live
```

### AI Response Format

The AI always responds with a JSON block plus a short human message:

```json
{
  "message": "I've added a full Y rotation and an opacity fade for Cube from 0–100vh.",
  "operations": [
    {
      "type": "set_track",
      "layerName": "Cube",
      "propertyId": "rotation.y",
      "keyframes": [
        { "atVh": 0, "value": 0, "easing": "linear" },
        { "atVh": 100, "value": 360, "easing": "easeInOut" }
      ]
    },
    {
      "type": "set_track",
      "layerName": "Cube",
      "propertyId": "opacity",
      "keyframes": [
        { "atVh": 0, "value": 0 },
        { "atVh": 100, "value": 1, "easing": "easeIn" }
      ]
    }
  ]
}
```

**Operation types:**

| type | Effect |
|------|--------|
| `set_track` | Create or fully replace a (layerName, propertyId) track |
| `delete_track` | Remove a specific track |
| `clear_all` | Reset all animation tracks |

**Note:** `layerName` is used (not `layerId`) — the frontend resolves names to IDs before applying.

### What the AI Knows (Scene Context)

Sent with every request:

```json
{
  "timelineLengthVh": 200,
  "layers": [
    { "name": "Cube", "id": "uuid-1" },
    { "name": "Sphere", "id": "uuid-2" }
  ],
  "currentTracks": [
    {
      "layerName": "Cube",
      "propertyId": "rotation.y",
      "keyframes": [{ "atVh": 0, "value": 0 }, { "atVh": 100, "value": 360 }]
    }
  ]
}
```

### Animatable Properties (AI must know these)

| propertyId | Values | Notes |
|------------|--------|-------|
| `position.x/y/z` | any number | world-space units |
| `rotation.x/y/z` | 0–360 | degrees |
| `scale.uniform` | 0.1–10 | uniform scale |
| `opacity` | 0.0–1.0 | |

Easing options: `linear`, `easeIn`, `easeOut`, `easeInOut`, `easeInOutCubic`

---

## Vision Toggle

A small camera icon in the chat input area. When toggled on:
- Captures `canvas.toDataURL("image/jpeg", 0.7)` from the Three.js canvas
- Attaches the image to the API request
- Switches provider to GPT-4o (Cerebras doesn't support vision)
- Shows a small indicator: *"📷 Screenshot included"*

When off (default): text-only, uses Cerebras.

---

## UI — Chat Panel

Located in the right sidebar, alongside the existing Upload/History panel.

```
┌─────────────────────────┐
│  AI Animator        [📷]│  ← header + vision toggle
├─────────────────────────┤
│                         │
│  [user] Make the cube   │
│         spin 360°       │
│                         │
│  [ai] Added rotation.y  │
│       track: 0→360°     │
│       over 0–100vh ✓    │
│                         │
│  [user] Now fade it in  │
│                         │
│  [ai] thinking...       │
│                         │
├─────────────────────────┤
│  [textarea] [Send ↑]    │
└─────────────────────────┘
```

**Features:**
- Conversation history (multi-turn — AI remembers what it did earlier in the session)
- Each AI message shows the response text + a collapsible "Changes" chip listing applied operations
- "Undo last AI change" button after each AI turn (calls the existing undo history)
- Loading state: animated dots while waiting
- Error state: shows error inline, retryable

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/app/api/animate/route.ts` | Create — API route, calls Cerebras/OpenAI |
| `src/components/ai-chat-panel.tsx` | Create — full chat panel component |
| `src/components/glb-viewer.tsx` | Modify — render `<AiChatPanel>` in right sidebar, pass scene context + setAnimationTracks |
| `.env.local` | Add `CEREBRAS_API_KEY`, `OPENAI_API_KEY` (for vision fallback) |

---

## API Route — `src/app/api/animate/route.ts`

```typescript
POST /api/animate
Body: {
  messages: { role: "user"|"assistant", content: string }[]
  sceneContext: { timelineLengthVh, layers, currentTracks }
  screenshot?: string  // base64 data URL (optional)
}
Response: {
  message: string
  operations: Operation[]
}
```

Responsibilities:
- Build system prompt with full animation schema + scene context
- If screenshot provided: use OpenAI GPT-4o with image content part
- If text-only: use Cerebras llama-3.3-70b
- Parse AI response → extract JSON block → validate → return
- Handle errors gracefully (malformed JSON, missing layers, out-of-range values)

---

## System Prompt Strategy

The system prompt must:
1. Explain the data model (properties, value ranges, easing options)
2. Inject the current scene context (layers available + existing tracks)
3. Instruct the AI to always respond in the exact JSON format
4. Tell the AI to ONLY modify tracks it needs to — leave others untouched unless asked
5. Tell the AI to be conservative with values (don't go to extremes unless asked)

---

## Environment Variables

```
# Cerebras (text-only, free)
CEREBRAS_API_KEY=

# OpenAI (vision fallback)
OPENAI_API_KEY=
```

---

## Dependencies

```bash
npm install openai
```

(The `openai` package works for both Cerebras and OpenAI since Cerebras is API-compatible.)

---

## Implementation Order

1. `npm install openai`
2. Add env vars
3. Create `/api/animate/route.ts` — get the AI calling and returning structured JSON
4. Create `ai-chat-panel.tsx` — UI with hardcoded mock first, then wire to API
5. Integrate into `glb-viewer.tsx` — expose scene context, wire setAnimationTracks
6. Add vision toggle — screenshot capture + provider switching
7. Test end-to-end with a model loaded

---

## Validation Checklist

- [ ] AI correctly identifies layer names from context
- [ ] `set_track` creates new keyframes visible in timeline
- [ ] Multi-turn: AI remembers previous changes in same session
- [ ] Vision toggle: screenshot is attached and AI references what it sees
- [ ] Undo after AI change restores previous track state
- [ ] Malformed AI JSON is caught and shown as error in chat
- [ ] Works with models that have multiple layers (AI targets correct one)
- [ ] Out-of-range values are clamped before applying to state
