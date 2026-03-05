// ── Types ──────────────────────────────────────────────────────────────────

export type SkillIndexEntry = {
  slug: string;
  name: string;
  keywords: string[];
  description: string;
  enabled: boolean;
  updatedAt: string;
  blobUrl: string; // stable Vercel Blob URL for the .md file
};

export type SkillIndex = {
  version: 1;
  skills: SkillIndexEntry[];
};

export type ParsedSkill = {
  slug: string;
  name: string;
  keywords: string[];
  description: string;
  enabled: boolean;
  body: string;
  raw: string;
};

// ── Blob path helpers ──────────────────────────────────────────────────────

export const skillBlobPath = (userId: string, slug: string) =>
  `skills/${userId}/${slug}.md`;

export const skillIndexPath = (userId: string) =>
  `skills/${userId}/_index.json`;

// ── Frontmatter parser ─────────────────────────────────────────────────────

export function parseSkillFile(raw: string): Omit<ParsedSkill, "slug"> | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const yamlBlock = match[1];
  const body = match[2].trim();

  const get = (key: string): string | null => {
    const m = yamlBlock.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : null;
  };

  const name = get("name");
  if (!name) return null;

  const description = get("description") ?? "";
  const enabledRaw = get("enabled");
  const keywordsRaw = get("keywords");

  let keywords: string[] = [];
  if (keywordsRaw) {
    const bracketMatch = keywordsRaw.match(/^\[(.+)\]$/);
    if (bracketMatch) {
      keywords = bracketMatch[1].split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    } else {
      keywords = [keywordsRaw.toLowerCase().trim()].filter(Boolean);
    }
  }

  return {
    name,
    keywords,
    description,
    enabled: enabledRaw !== "false",
    body,
    raw,
  };
}

// ── Frontmatter serializer ─────────────────────────────────────────────────

export function serializeSkillFile(
  fm: { name: string; keywords: string[]; description: string; enabled: boolean },
  body: string
): string {
  return [
    "---",
    `name: ${fm.name}`,
    `keywords: [${fm.keywords.join(", ")}]`,
    `description: ${fm.description}`,
    `enabled: ${fm.enabled}`,
    "---",
    "",
    body.trim(),
  ].join("\n");
}

// ── Slug utilities ─────────────────────────────────────────────────────────

export function toSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "skill"
  );
}

export function uniqueSlug(name: string, existingSlugs: Set<string>): string {
  const base = toSlug(name);
  if (!existingSlugs.has(base)) return base;
  let i = 2;
  while (existingSlugs.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// ── Starter skills ─────────────────────────────────────────────────────────

export type StarterSkill = {
  slug: string;
  frontmatter: { name: string; keywords: string[]; description: string; enabled: boolean };
  body: string;
};

export const STARTER_SKILLS: StarterSkill[] = [
  {
    slug: "stagger",
    frontmatter: {
      name: "Stagger Entrance",
      keywords: ["stagger", "cascade", "sequence", "one by one", "staggered", "sequential", "wave"],
      description: "Parts animate in one after another with a time offset, creating a cascade effect",
      enabled: true,
    },
    body: `## What it does
Instead of all parts moving simultaneously, each layer starts its animation slightly later than the previous one. The result is a satisfying wave or cascade effect.

## When to use
When the user says: "stagger", "cascade", "one by one", "sequential", "wave", or describes parts appearing in sequence.

## Keyframe recipe
- Decide a stagger offset: \`staggerOffset = timelineLengthVh * 0.08\` (8% of timeline per layer)
- For each layer at index i (0-based):
  - entryStart = i * staggerOffset
  - entryEnd = entryStart + (timelineLengthVh * 0.3)
- Animate position.y from -2 → 0 (or opacity 0 → 1) within that window
- Use \`easeOut\` easing for a natural deceleration on entry

## Example (4 layers, 200vh timeline)
\`\`\`json
[
  { "type": "set_track", "layerName": "part_1", "propertyId": "position.y",
    "keyframes": [{"atVh":0,"value":-2,"easing":"easeOut"},{"atVh":60,"value":0,"easing":"easeOut"},{"atVh":200,"value":0}] },
  { "type": "set_track", "layerName": "part_2", "propertyId": "position.y",
    "keyframes": [{"atVh":16,"value":-2,"easing":"easeOut"},{"atVh":76,"value":0,"easing":"easeOut"},{"atVh":200,"value":0}] },
  { "type": "set_track", "layerName": "part_3", "propertyId": "position.y",
    "keyframes": [{"atVh":32,"value":-2,"easing":"easeOut"},{"atVh":92,"value":0,"easing":"easeOut"},{"atVh":200,"value":0}] }
]
\`\`\`

## Tips
- For a reverse cascade (last part first), iterate layers in reverse order
- Combine with opacity: fade each part in as it rises
- Limit to ~0.05× timeline per layer to avoid entries going off-screen`,
  },

  {
    slug: "overshoot-spring",
    frontmatter: {
      name: "Overshoot Spring",
      keywords: ["overshoot", "spring", "bounce", "elastic", "springy", "bouncy", "snap", "pop"],
      description: "Element shoots past its target then springs back — simulates physical inertia",
      enabled: true,
    },
    body: `## What it does
The animated value goes 15–20% beyond its final target, then settles back. This mimics how real physical objects overshoot due to momentum before coming to rest.

## When to use
When the user says: "bouncy", "springy", "elastic", "snap into place", "pop", or "overshoot".

## Keyframe recipe
For any property animating from A to B:
- Add a third keyframe at ~70% of the animation window at value \`B + (B - A) * 0.18\` (overshoot)
- Then a fourth keyframe at 100% of the window back at \`B\` (settle)
- Use \`easeOut\` on the overshoot keyframe, \`easeInOut\` on the settle

## Example: scale from 0 to 1 with overshoot
\`\`\`json
{ "type": "set_track", "layerName": "logo", "propertyId": "scale.uniform",
  "keyframes": [
    {"atVh": 0,   "value": 0,    "easing": "easeOut"},
    {"atVh": 100, "value": 1.18, "easing": "easeOut"},
    {"atVh": 140, "value": 0.95, "easing": "easeInOut"},
    {"atVh": 180, "value": 1.0,  "easing": "easeInOut"}
  ]
}
\`\`\`

## Example: position.y drop with overshoot
\`\`\`json
{ "type": "set_track", "layerName": "object", "propertyId": "position.y",
  "keyframes": [
    {"atVh": 0,   "value": 3,    "easing": "easeIn"},
    {"atVh": 80,  "value": -0.3, "easing": "easeOut"},
    {"atVh": 120, "value": 0.1,  "easing": "easeInOut"},
    {"atVh": 160, "value": 0,    "easing": "easeInOut"}
  ]
}
\`\`\`

## Tips
- Overshoot magnitude: 15–20% for subtle, 30–40% for dramatic
- Works on position, scale, and rotation
- Stack with stagger for a playful multi-part entrance`,
  },

  {
    slug: "cinematic-reveal",
    frontmatter: {
      name: "Cinematic Reveal",
      keywords: ["cinematic", "dramatic", "reveal", "film", "hero", "product shot", "showcase", "dramatic reveal", "emergence"],
      description: "Model emerges from darkness with dramatic lighting — a film-style product reveal",
      enabled: true,
    },
    body: `## What it does
Creates a film-grade reveal: the scene starts in near-darkness with a single dramatic light source, the model rises or scales in, then the scene blooms to full illumination. Like a product launch reveal.

## When to use
When the user says: "cinematic", "dramatic", "reveal", "film", "hero shot", "product showcase", or "make it dramatic".

## Recipe

### 1. Scene setup (include these set_scene and set_point_light ops first)
\`\`\`json
{ "type": "set_scene", "settings": {
    "backgroundColor": "#000000",
    "useAmbientLight": true, "ambientIntensity": 0.1,
    "useDirectionalLight": false
}},
{ "type": "set_point_light", "index": 0, "patch": {
    "enabled": true, "color": "#ffffff",
    "intensity": 0, "x": 2, "y": 4, "z": 3, "distance": 20
}}
\`\`\`

### 2. Animate the light intensity (0 → 8 as model rises)
\`\`\`json
{ "type": "set_point_light", "index": 0, "patch": { "intensity": 0 }}
\`\`\`
Then use a set_track on point light intensity — note: point lights are not animatable via set_track directly. Instead: set the light to its final value and let the scene's ambient light animate via the scene settings approach, OR set intensity to 0 at start and to 8 midway through via two set_point_light ops in sequence (the client applies ops in order).

### 3. Model entrance — choose one style
**Rise from below:**
\`\`\`json
{ "type": "set_track", "layerName": "MODEL_ROOT", "propertyId": "position.y",
  "keyframes": [
    {"atVh": 0,   "value": -2,  "easing": "easeOut"},
    {"atVh": 120, "value": 0,   "easing": "easeOut"},
    {"atVh": 300, "value": 0}
  ]
}
\`\`\`

**Scale in from zero:**
\`\`\`json
{ "type": "set_track", "layerName": "MODEL_ROOT", "propertyId": "scale.uniform",
  "keyframes": [
    {"atVh": 0,   "value": 0.01, "easing": "easeOut"},
    {"atVh": 100, "value": 1.0,  "easing": "easeOut"},
    {"atVh": 300, "value": 1.0}
  ]
}
\`\`\`

### 4. Slow rotation for presence
\`\`\`json
{ "type": "set_track", "layerName": "MODEL_ROOT", "propertyId": "rotation.y",
  "keyframes": [
    {"atVh": 0,   "value": -15, "easing": "linear"},
    {"atVh": 300, "value": 15,  "easing": "linear"}
  ]
}
\`\`\`

## Tips
- Use 300vh+ timeline for a cinematic pace (slow is more dramatic)
- Replace MODEL_ROOT with the actual root layer name from the scene
- A warm key light (color: #ffcc88) and cool fill light (color: #88aaff) create depth`,
  },

  {
    slug: "orbit",
    frontmatter: {
      name: "Continuous Orbit",
      keywords: ["orbit", "rotate", "spin", "turntable", "loop", "full rotation", "360", "spinning", "product rotation"],
      description: "Object rotates continuously on its Y axis — perfect for product turntables",
      enabled: true,
    },
    body: `## What it does
The model spins smoothly on its Y axis across the full timeline. As the user scrolls, the model rotates. Use linear easing for a consistent turntable feel.

## When to use
When the user says: "rotate", "spin", "orbit", "turntable", "360", "product rotation", or "loop".

## Basic recipe (one full rotation)
\`\`\`json
{ "type": "set_track", "layerName": "MODEL_ROOT", "propertyId": "rotation.y",
  "keyframes": [
    {"atVh": 0,                  "value": 0,   "easing": "linear"},
    {"atVh": TIMELINE_LENGTH_VH, "value": 360, "easing": "linear"}
  ]
}
\`\`\`

## Multiple rotations
Use values beyond 360 for multiple spins:
- 1 rotation = 360
- 2 rotations = 720
- 3 rotations = 1080

## Dramatic tilt variation (Y spin + slight X tilt)
\`\`\`json
[
  { "type": "set_track", "layerName": "MODEL_ROOT", "propertyId": "rotation.y",
    "keyframes": [
      {"atVh": 0,   "value": 0,   "easing": "linear"},
      {"atVh": 400, "value": 360, "easing": "linear"}
    ]
  },
  { "type": "set_track", "layerName": "MODEL_ROOT", "propertyId": "rotation.x",
    "keyframes": [
      {"atVh": 0,   "value": 0,  "easing": "easeInOut"},
      {"atVh": 200, "value": 15, "easing": "easeInOut"},
      {"atVh": 400, "value": 0,  "easing": "easeInOut"}
    ]
  }
]
\`\`\`

## Float effect (slow vertical bob during orbit)
\`\`\`json
{ "type": "set_track", "layerName": "MODEL_ROOT", "propertyId": "position.y",
  "keyframes": [
    {"atVh": 0,   "value": 0,    "easing": "easeInOut"},
    {"atVh": 100, "value": 0.05, "easing": "easeInOut"},
    {"atVh": 200, "value": 0,    "easing": "easeInOut"},
    {"atVh": 300, "value": 0.05, "easing": "easeInOut"},
    {"atVh": 400, "value": 0,    "easing": "easeInOut"}
  ]
}
\`\`\`

## Tips
- Always use \`linear\` easing on rotation.y for a consistent turntable speed
- Replace MODEL_ROOT with the actual root layer name from the scene
- Set timeline to 300–400vh for a comfortable scroll-through-rotation experience`,
  },

  {
    slug: "heartbeat-pulse",
    frontmatter: {
      name: "Heartbeat Pulse",
      keywords: ["heartbeat", "pulse", "beat", "pulsate", "ping", "throb", "breathe", "breathing", "rhythm", "rhythmic"],
      description: "Object scales in a rhythmic double-bump heartbeat or slow breathing pattern",
      enabled: true,
    },
    body: `## What it does
Creates a rhythmic pulsing animation on scale.uniform. Two patterns available: a sharp heartbeat double-bump (tick-TICK) or a slow breathing swell.

## When to use
When the user says: "heartbeat", "pulse", "beat", "breathe", "pulsate", "ping", "throb", or "rhythmic".

## Heartbeat pattern (double-bump, sharp)
The first bump is smaller (the pre-beat), the second is larger (the main beat):
\`\`\`json
{ "type": "set_track", "layerName": "MODEL_ROOT", "propertyId": "scale.uniform",
  "keyframes": [
    {"atVh": 0,   "value": 1.0,  "easing": "easeOut"},
    {"atVh": 20,  "value": 1.06, "easing": "easeOut"},
    {"atVh": 40,  "value": 1.0,  "easing": "easeIn"},
    {"atVh": 60,  "value": 1.12, "easing": "easeOut"},
    {"atVh": 90,  "value": 1.0,  "easing": "easeIn"},
    {"atVh": 200, "value": 1.0,  "easing": "easeOut"}
  ]
}
\`\`\`

## Breathing pattern (slow swell, gentle)
\`\`\`json
{ "type": "set_track", "layerName": "MODEL_ROOT", "propertyId": "scale.uniform",
  "keyframes": [
    {"atVh": 0,   "value": 1.0,  "easing": "easeInOut"},
    {"atVh": 100, "value": 1.04, "easing": "easeInOut"},
    {"atVh": 200, "value": 1.0,  "easing": "easeInOut"}
  ]
}
\`\`\`

## Attention ping (single sharp pop then settle)
Great for drawing attention to a specific part:
\`\`\`json
{ "type": "set_track", "layerName": "TARGET_PART", "propertyId": "scale.uniform",
  "keyframes": [
    {"atVh": 0,  "value": 1.0,  "easing": "easeOut"},
    {"atVh": 30, "value": 1.25, "easing": "easeOut"},
    {"atVh": 60, "value": 0.95, "easing": "easeInOut"},
    {"atVh": 90, "value": 1.0,  "easing": "easeInOut"}
  ]
}
\`\`\`

## Tips
- Scale magnitude: 1.04–1.06 for subtle, 1.10–1.15 for visible, 1.20+ for dramatic
- Replace MODEL_ROOT or TARGET_PART with the actual layer name from the scene
- Combine heartbeat on the whole model with a glow effect via point light intensity pulse`,
  },
];
