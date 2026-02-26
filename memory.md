# 3D Animation Orchestrator - Memory / Handoff

## Project Identity
- Final project name: **3D Animation Orchestrator**
- Stack: Next.js (App Router, TypeScript), Tailwind, react-three-fiber, drei, three.js, shadcn-style UI primitives.

## High-Level Outcome
- Built a browser-based `.glb` viewer/editor foundation.
- Core working features:
  - Drag/drop + file-picker GLB upload.
  - Orbit camera navigation.
  - Full-viewport 3D canvas.
  - Left collapsible upload sidebar (auto-minimized after model load).
  - Right customizable controls sidebar.
  - Editable JSON config with apply/copy/save/load.

## Major Hiccups And Fixes

### 1) Next bootstrap issues
- **Issue:** `create-next-app` stalled in this environment.
- **Fix:** Manually scaffolded Next project and config files.
- **Issue:** Tailwind v4 CLI mismatch (`tailwindcss init -p` failure).
- **Fix:** Standardized on Tailwind v3 config flow for stable setup.

### 2) Turbopack build panic in sandbox
- **Issue:** `next build` (Turbopack) failed with process/port permission error.
- **Fix:** Switched build script to webpack mode (`next build --webpack`) for reproducible builds in this environment.

### 3) GLB blob URL loading failures
- **Issue:** `Failed to fetch blob:...` when loading dropped files.
- **Fix:** Replaced blob URL fetch path with direct `ArrayBuffer` parsing via `GLTFLoader.parse`.

### 4) Intermittent "Failed to read file" on drag-drop
- **Issue:** OS/cloud-provider race caused `NotFoundError` style file read failures.
- **Fixes:**
  - Simplified drop handling to one authoritative handler.
  - Added stable file snapshot (`new File([file], ...)`) before reads.
  - Added resilient read fallbacks (`arrayBuffer` -> `Response(file)` -> `FileReader`).
  - Improved user-facing error message to suggest local download / file picker fallback.

### 5) Viewer controls looked like they "did nothing"
- **Issue:** Multiple controls had weak or non-obvious visual impact.
- **Fixes:**
  - Reworked grid behavior with explicit `gridHelper` and camera-distance fade.
  - Reworked fog controls and explanatory helper text.
  - Improved orbit damping mapping (`0..100` UI -> practical damping range).
  - Added camera FOV control with persistent camera (no destructive remount).

### 6) Black model regressions
- **Issue:** Models sometimes rendered black due to lighting/placement mismatch.
- **Fixes:**
  - Centered loaded model with `<Center>`.
  - Ensured point light defaults are strong and on by default.
  - Clarified and exposed ambient/directional as explicit toggles (no hidden assumptions).

### 7) Need multiple lights
- **Issue:** Requirement expanded to support up to 4 point lights.
- **Fix:** Added dynamic point light system (max 4) with per-light controls:
  - enable/disable, color, intensity, distance, decay, X/Y/Z.

### 8) Customize UI needed premium dashboard polish
- **Issue:** Requested clearer visual hierarchy and stronger shadcn styling.
- **Fixes:**
  - Reworked sidebar into card-based dashboard sections.
  - Added section icons and bold headers.
  - Standardized spacing rhythm.
  - Added slider value badges and refined toggle alignment.
  - Added compact color input + swatch pairing.

### 9) JSON config workflow usability
- **Issue:** Needed reusable presets and easier config workflows.
- **Fixes:**
  - Editable JSON panel.
  - `Format JSON` action.
  - `Apply` action with validation and feedback.
  - `Copy`, `Save Local`, `Load Local` actions.
  - Footer status indicator with success/error tone.

## Current Architecture Notes
- `src/components/glb-viewer.tsx`
  - Main scene and UI orchestration.
  - Handles drag/drop upload and GLTF parsing.
  - Hosts lights, fog, grid, orbit controls.
  - Renders left upload sidebar + right customize sidebar.
  - Owns JSON config serialization/deserialization and local persistence.
- `src/components/ui/*`
  - Local shadcn-style primitives: button, card, input, label, slider, switch, textarea.

## Important Decisions
- Build command uses webpack for environment stability.
- Point Light 1 is the default active lighting path.
- Config payload schema:
  - `{ settings: ViewerSettings, pointLights: PointLightConfig[] }`
- Local config storage key:
  - `glb_tool_viewer_config_v1`

## Known Risks / Follow-Ups
- Drag/drop reliability can still vary by browser + cloud file provider; file picker remains the safest fallback.
- Future editing features (animation tracks, material editor, timeline, keyframes) should likely split `glb-viewer.tsx` into smaller modules.
- Consider adding scene gizmos for light positions and camera target as next UX improvement.

## Verification State (latest)
- `npm run lint` passes.
- `npm run build` passes.

## Suggested Next Work For Another Agent
1. Split `glb-viewer.tsx` into feature modules (`scene`, `panels`, `config`, `lights`) for maintainability.
2. Add import/export to JSON file (not just clipboard/localStorage).
3. Add light gizmos and optional HDRI environment presets.
4. Add unit tests for config parser and clamp/sanitize logic.

---

## 2026-02 Latest State (Animate Branch Handoff)

### Branch / Scope
- Active branch: `codex/animate`
- Product direction shifted from pure viewer editor to scroll-driven animation authoring.

### Completed Since Initial Build
- Left sidebar reorganized with persistent undo/redo/reset and accordion sections.
- Layer workflows expanded:
  - visibility toggle
  - rename on double click
  - delete layer
  - duplicate layer (offset for visibility)
  - collapse/expand groups
  - per-layer transform controls (position, rotation, uniform scale, opacity)
- History workflow added:
  - Photoshop-style timeline of edits
  - jump to specific state
  - forward states grayed out until new edit truncates branch
  - keyboard shortcuts: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`
  - delete layer is undoable
- Unsaved changes flow improved:
  - prompt on tab close when dirty
  - export marks state as saved

### Controls/UX Refinements
- Removed unused controls per product decisions:
  - fog controls
  - grid size/distance/fade controls
  - camera FOV
  - orbit smoothing
  - pan toggle
- Customize pane converted to accordion on right side.
- Layer tree hierarchy improved with:
  - depth-based background tinting
  - visible indent guide lines
  - lighter modifier-pane styling to differentiate from actual layers.

### Scroll Animation Progress (Plan Alignment)
- Phase 1 complete:
  - mode toggle `Orbit` / `Animate`
  - orbit editing in Orbit mode
  - fixed camera contract in Animate mode
- Phase 2 complete:
  - full-width, AE-inspired timeline
  - layer rows merged with timeline lanes
  - vh ruler markers
  - timeline zoom + vertical resize
- Phase 3 complete:
  - keyframe track data model
  - clock toggle enables/disables animation per modifier
  - add/overwrite keyframe at current seek
  - previous/next keyframe navigation
  - seek line + draggable seek handle

### Latest Bug + Fix
- Issue: property row UI broke when clock-enabled controls (prev/diamond/next) appeared.
- Fix:
  - refactored modifier row layout with fixed-width control cluster
  - ensured label area truncates safely with `min-w-0`
  - tightened icon/button sizing and numeric input width
  - prevented overlap/collision in compact rows.

### Known Next Target
- Phase 4: tighten track rendering/interaction polish from real keyframe data and continue toward preview/runtime playback.
