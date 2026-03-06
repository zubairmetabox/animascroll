# Animascroll

AI-assisted scroll-driven 3D animation tool. Upload a 3D model, animate it by describing what you want or placing keyframes manually, preview with real scroll, and share a public link or export a standalone HTML file.

## Features

- **AI Animator** — describe motion in plain language and let AI generate keyframes
- **Animation Skills** — save and reuse custom animation techniques; AI auto-injects relevant ones
- **Timeline editor** — animate position, rotation, scale, opacity per layer with multiple easing types
- **Scroll-driven preview** — real scroll position drives animation playback
- **Share** — enable a public URL; anyone can view the animation in their browser
- **Export to HTML** — self-contained file with Three.js and model embedded (works offline)
- **Upload any 3D model** — GLB, GLTF, FBX, OBJ, STL
- **Layer management** — group, isolate, hide/show individual mesh layers
- **Move tool** — drag to reposition objects in the viewport
- **Projects** — cloud-persisted projects with autosave

## Tech Stack

- [Next.js 16](https://nextjs.org/) · [React 19](https://react.dev/) · TypeScript
- [Three.js](https://threejs.org/) · [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) · [@react-three/drei](https://github.com/pmndrs/drei)
- [Tailwind CSS v3](https://tailwindcss.com/) · shadcn-style UI primitives
- [Clerk](https://clerk.com/) auth · [Neon](https://neon.tech/) PostgreSQL · [Vercel Blob](https://vercel.com/storage/blob) storage
- [Claude](https://anthropic.com/) (claude-sonnet-4-6) for AI animation generation

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=
BLOB_READ_WRITE_TOKEN=
ANTHROPIC_API_KEY=
```

## Build

```bash
npm run build   # uses --webpack flag (Turbopack is not supported in this environment)
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── animate/        # Claude-powered keyframe generation
│   │   ├── projects/       # CRUD for persisted projects
│   │   ├── skills/         # Animation Skills CRUD
│   │   └── upload/         # Vercel Blob client upload handler
│   ├── app/                # /app — projects dashboard
│   ├── share/[id]/         # Public share route (serves raw animation HTML)
│   ├── layout.tsx
│   └── page.tsx            # Landing page
├── components/
│   ├── glb-viewer.tsx      # Main editor (scene, timeline, AI chat, all UI)
│   ├── skills-manager.tsx  # Animation Skills UI
│   └── ui/                 # Shared UI primitives
└── lib/
    ├── db.ts                       # Neon SQL client
    ├── generate-animation-html.ts  # Pure function — generates standalone HTML export
    ├── skills.ts                   # Skills types, helpers, starter skills
    └── utils.ts                    # cn() utility
```
