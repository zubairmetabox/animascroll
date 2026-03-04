# Animascroll — Shipping Plan

## Overview

Turning the completed editor (Phases 1–15) into a shippable product with branding, a landing page, auth, and observability.

---

## What's Done

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Mode System + Camera | ✅ |
| 2 | Timeline Shell | ✅ |
| 3 | Keyframe Data Model | ✅ |
| 4 | Timeline Track Rendering | ✅ |
| 5 | Playback + Scrub Engine | ✅ |
| 6 | Keyframe Editing + Layer Management + Modifier UX | ✅ |
| 7 | Easing | ✅ |
| 8 | Persistence (Save / Load) | ✅ |
| 9 | Preview Mode | ✅ |
| 10 | Export v1 (Animation JSON + HTML Page) | ✅ |
| 11 | Camera + Export UX | ✅ |
| 12 | Move Tool | ✅ |
| 13 | Snap (reverted — UX issues) | — |
| 14 | Viewport Click-to-Select + Isolation Mode | ✅ |
| 15 | Multi-Format File Upload (GLB, GLTF, FBX, OBJ, STL) | ✅ |

---

## Repo Cleanup (do first)

Moving to a fresh repo (`animascroll`). These are the items to address on the first clean commit.

### Fix `.gitignore`

Add these missing entries:

```
tsconfig.tsbuildinfo
.claude/
.env.local
.env*.local
```

### Fix `package.json`

```json
{
  "name": "animascroll",
  "version": "0.1.0",
  "description": "Browser-based 3D model animation authoring and export tool",
  "author": "Metabox",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/zubairmetabox/animascroll.git"
  }
}
```

### Fix `src/app/layout.tsx` metadata

```typescript
export const metadata: Metadata = {
  title: "Animascroll",
  description: "Create scroll-driven 3D animations. Upload any 3D model, animate with keyframes, export as interactive HTML.",
};
```

### Create `README.md`

Minimum: name + tagline, feature list, tech stack, quick start (`npm install` → `npm run dev`), note on `--webpack` build flag.

### Minor

- Remove `./src/pages/**` from `tailwind.config.ts` content paths (unused, harmless)
- `glb-viewer.tsx` (~5,100 lines) is documented tech debt — split into modules in Phase C

---

## What's Next

### A · Branding + Product Layer

**Goal:** Animascroll is a real product, not a dev tool.

#### A1 — Routing Restructure

Current: `/` → editor directly
New:

```
/                         → Landing page (public)
/sign-in/[[...sign-in]]   → Clerk sign-in
/sign-up/[[...sign-up]]   → Clerk sign-up
/app                      → Editor (protected)
```

Files:
- `src/app/app/page.tsx` — create, move `<GlbViewer />` here
- `src/app/page.tsx` — rewrite as landing page

#### A2 — Auth (Clerk)

- **Package:** `@clerk/nextjs`
- **Free tier:** 10,000 MAU — more than enough
- **Model:** Open signups (anyone can register)

Files to create/modify:
- `src/middleware.ts` — `clerkMiddleware()`, protect `/app/*`, leave `/`, `/sign-in`, `/sign-up` public
- `src/app/sign-in/[[...sign-in]]/page.tsx` — Clerk `<SignIn />`, dark-themed card
- `src/app/sign-up/[[...sign-up]]/page.tsx` — Clerk `<SignUp />`, same styling
- `src/app/layout.tsx` — wrap with `<ClerkProvider>`
- `.env.local` — Clerk keys + redirect URLs

Env vars needed:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/app
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/app
```

Editor changes:
- Add Clerk `<UserButton />` in editor top-right (avatar + logout dropdown)
- Add `posthog.identify(userId)` using `useUser()` hook

#### A3 — Landing Page

`src/app/page.tsx` — dark, single-scroll, matches editor aesthetic (`bg-zinc-950`, zinc/slate palette)

Sections:
1. **Navbar** — "Animascroll" wordmark left + "Sign in" / "Get started" right
2. **Hero** — headline, subheading, two CTAs (Get started free → `/sign-up`, View demo)
3. **Features** — 4 cards: Upload any 3D model · Timeline keyframe editor · Scroll-driven preview · Export to HTML
4. **Footer** — wordmark + "Powered by Three.js"

#### A4 — Light Editor Branding

- "Animascroll" wordmark (small, top-left) in the editor mode-switcher bar
- Update `src/app/layout.tsx` `<title>` to "Animascroll"
- Update favicon (`public/favicon.ico`)

---

### B · Observability

#### B1 — Sentry (Error Tracking)

- **Package:** `@sentry/nextjs`
- **Free tier:** 5,000 errors/month, 1 user — sufficient for early stage
- **Setup:** `npx @sentry/wizard@latest -i nextjs` — auto-generates config files and patches `next.config.ts`
- Add `SENTRY_DSN` to `.env.local`

#### B2 — PostHog (Analytics)

- **Package:** `posthog-js`
- **Free tier:** 1,000,000 events/month — very generous
- **Setup:** `src/components/posthog-provider.tsx` — client component, `posthog.init()` in `useEffect`
- Wrap `src/app/layout.tsx` with `<PHProvider>`

Key events to track in `glb-viewer.tsx`:
| Event | Where |
|-------|-------|
| `editor_opened` | on mount |
| `model_uploaded` | after file load succeeds |
| `animation_exported` | inside `exportHtmlAnimation()` |
| `preview_entered` | inside `enterPreviewMode()` |

Env vars:
```
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

---

### C · UX Polish (Phase 16)

From `plan.md` — do after A + B are live:

- **J/L/K shortcuts** — step playhead forward/back one keyframe
- **Keyframe tooltip** — hover a keyframe diamond → show `vh` value + easing name
- **Performance pass** — profile large model render, memoize heavy computations
- **Regression pass** — full manual walkthrough of all modes and features
- **`glb-viewer.tsx` split** — break monolith into `scene/`, `timeline/`, `panels/`, `export/` modules

---

### D · Export v2 (Phase 17 — Optional Investigation)

Feasibility study: bake timeline keyframes into `.glb` animation clips using Three.js `AnimationClip` + GLTFExporter.
Decision gate: only implement if the GLTFExporter supports writing custom animation tracks cleanly.

---

## Install Commands

```bash
npm install @clerk/nextjs posthog-js
npx @sentry/wizard@latest -i nextjs
```

---

## Critical Files

| File | Action |
|------|--------|
| `src/app/page.tsx` | Rewrite → landing page |
| `src/app/app/page.tsx` | Create → editor |
| `src/app/layout.tsx` | Add ClerkProvider, PHProvider, title |
| `src/middleware.ts` | Create → Clerk auth middleware |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | Create |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | Create |
| `src/components/posthog-provider.tsx` | Create |
| `src/components/glb-viewer.tsx` | Add UserButton + posthog events |
| `next.config.ts` | Patched by Sentry wizard |
| `.env.local` | Create → all service keys |

---

## Verification Checklist

- [ ] `/` loads landing page without auth
- [ ] "Get started" → `/sign-up` → Clerk form → redirects to `/app`
- [ ] `/app` while logged out → redirected to `/sign-in`
- [ ] Editor works identically at `/app`
- [ ] Sentry dashboard receives a test error
- [ ] PostHog dashboard shows `editor_opened` after sign-in
- [ ] Animascroll wordmark visible in editor top-left
- [ ] `<title>` = "Animascroll" in browser tab
