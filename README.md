# Animascroll

Browser-based 3D model animation authoring and export tool. Upload a 3D model, animate it with a keyframe timeline, preview with scroll-driven playback, and export as a standalone HTML file.

## Features

- **Upload any 3D model** — GLB, GLTF, FBX, OBJ, STL
- **Timeline keyframe editor** — animate position, rotation, scale, opacity per layer
- **Multiple easing types** — linear, ease-in, ease-out, ease-in-out, bounce
- **Scroll-driven preview** — real scroll position drives animation playback
- **Export to HTML** — self-contained file with Three.js animation baked in
- **Save / load** — JSON config for re-importing animations
- **Layer management** — group, isolate, hide/show individual mesh layers
- **Move tool** — drag to reposition objects in viewport

## Tech Stack

- [Next.js 16](https://nextjs.org/) · [React 19](https://react.dev/) · TypeScript
- [Three.js](https://threejs.org/) · [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) · [@react-three/drei](https://github.com/pmndrs/drei)
- [Tailwind CSS v3](https://tailwindcss.com/) · shadcn-style UI primitives

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build   # uses --webpack flag (Turbopack is not supported in this environment)
npm start
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Entry point
│   └── globals.css         # Tailwind + CSS variables
├── components/
│   ├── glb-viewer.tsx      # Main editor (scene, timeline, UI)
│   └── ui/                 # Shared UI primitives
└── lib/
    └── utils.ts            # cn() utility
```

See `plan.md` for the full development phase history and `Shipping-Plan.md` for the upcoming product roadmap.
