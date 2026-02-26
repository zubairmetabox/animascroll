# Scroll Animation Plan (Phased Delivery)

## Project
3D Animation Orchestrator

## Delivery Strategy
Ship in small, safe increments. Each phase must be fully stable before moving to the next.

## Current Status
- Phases 1–10: Completed
- Next: Phase 11 (UX Polish + Hardening)

---

## Product Requirements

- **Preview mode** — real scroll drives the timeline like production; editing locked.
- **Export** — JSON animation bundle for use in a runtime player on a website.
- **Animation completion** — hold final state at end; reverse on scroll back.

---

## Phase 1: Mode System + Camera ✅
- Navigate / Animate toggle.
- Navigate: free orbit/pan/zoom, zero editing UI.
- Animate: default on load; camera resets to pinned view on entry.
- **Pin View** button in Navigate: saves current orbit as the Animate camera. Greyed until user moves; auto-greys after save.

---

## Phase 2: Timeline Shell ✅
- Full-width AE-style timeline panel in Animate mode.
- `timelineLengthVh` input; playhead with vh + normalized progress.
- Layer rows merged with timeline; depth indent + shade.
- Zoom (Ctrl+scroll + buttons), resize handle, collapsible to ruler-only.

---

## Phase 3: Keyframe Data Model ✅
- In-memory `AnimationTrack[]` — `{ layerId, propertyId, keyframes: { atVh, value }[] }`.
- Keyframe icon per modifier row — click writes or overwrites at current playhead.

---

## Phase 4: Timeline Track Rendering ✅
- Keyframe diamond markers in track lanes, positioned precisely at `atVh`.
- Colored gutter between layers panel and track area.
- Amber diamond indicator on layer rows that have any keyframes.

---

## Phase 5: Playback + Scrub Engine ✅
- rAF loop at 50 vh/sec; Play/Pause; Space key. Play resets to 0 if at end.
- Ruler click+drag seeking; any timeline click stops playback.
- Shift+scrub snaps to nearest keyframe (3% threshold).
- Scrub-apply effect: linear interp via `evaluateTrackAtVh`, applied to all tracks.

---

## Phase 6: Keyframe Editing + Layer Management + Modifier UX ✅

### Keyframe Editing
- Click to select; Shift/Ctrl/Meta+click toggles individual keyframes.
- Rubber-band drag on empty track area multi-selects — Y-range filtered so only rows within the drag box are included (layer header rows select all their child tracks).
- Drag selected marker(s) to retime — snapshot-based, drift-free; preserves multi-selection when dragging an already-selected keyframe.
- `Delete` / `Backspace` removes selected keyframes.
- `Ctrl+C` / `Ctrl+V` copies and pastes relative to current playhead.
- Escape deselects.

### Modifier UX
- Modifier label drag: instantly creates/updates keyframe at current seek (live, every frame).
- Number input ▲▼ spinners: instantly create/update keyframe.
- Position modifiers: 0.001 step, 4 decimal precision, continuous drag (`deltaX * 0.001`).
- Modifier input widened to `w-24`.

### Layer Management
- Pointer-event drag-and-drop reorder within the same group.
- Double-click layer name → inline rename.
- Ctrl+click multi-select layers; right-click → **Group selected** / **Ungroup** (world transform preserved via `attach()`).
- Right-click → **Duplicate** / **Delete**.

### History (Undo / Redo) for Keyframe Operations
- `HistoryEntry` extended with `tracks: AnimationTrack[]` snapshot.
- Undo/redo restores both layer transforms AND keyframe data.
- History entries pushed for: delete keyframe(s), paste, retime drag commit, toggle track animation, set keyframe (◆ button), modifier spinner click, modifier label drag commit.

---

## Phase 7: Easing ✅
- `easing` field on keyframes (default `"linear"`).
- Supported curves: `linear`, `easeIn`, `easeOut`, `easeInOut`, `easeInOutCubic`.
- Right-click keyframe marker → easing picker.
- `evaluateTrackAtVh` applies chosen curve between adjacent keyframes.
- Easing survives copy/paste.

---

## Phase 8: Persistence (Save / Load) ✅
### Scope
- Extend the existing config JSON:
  - `pinnedCameraView` (position, target, fov, zoom)
  - `timelineLengthVh`
  - `animationTracks` (full keyframe + easing data, with `layerName` for UUID-stable remapping on re-upload)
- Integrate into existing **Upload / History / Copy config** UI — no new panels needed.
- Backward compat: old configs without animation data load safely (tracks default to `[]`).

### Exit Criteria
- Save + load fully restores the authored animation (camera, timeline length, all keyframes + easings).
- Existing config flows (copy/paste config, upload config file) remain unbroken.

---

## Phase 9: Preview Mode ✅
### Scope
- **Preview** button: locks all editing UI, maps real page scroll to `timelineCurrentVh`.
- Page height temporarily extended so scroll distance = `timelineLengthVh` in vh.
- Lightweight HUD (current vh + progress bar); no timeline panel visible.
- Final state holds at end-of-timeline; values reverse correctly on scroll back (already handled by `evaluateTrackAtVh`).
- **Exit Preview** snaps page back and restores authoring UI without losing edits.

### Exit Criteria
- User can validate the full scroll narrative end-to-end.
- Preview ↔ authoring round-trip is clean (no state loss).

---

## Phase 10: Export v1 (Animation JSON + HTML Page) ✅
### Scope

**A. Download Animation JSON** — File menu button (disabled when no tracks):
```ts
{
  version: 1,
  pinnedCameraView: { position, target, fov, zoom },
  timeline: { lengthVh: number },
  tracks: [{
    layerId: string,
    layerName: string,
    propertyId: string,
    keyframes: [{ atVh: number, value: number, easing: string }]
  }]
}
```

**B. Export HTML Page** — File menu button (disabled when no model or no tracks):
- Fully self-contained `.html` file: embedded base64 GLB, inline animation runtime, Three.js via CDN importmap.
- Reproduces Preview mode exactly — scroll-driven, camera fixed at pinned view, no editing UI.
- `generateAnimationHtml(glbDataUrl, cfg)` pure function; GLB re-serialized via `GLTFExporter`.
- Layer names used (not UUIDs) for stable mapping after fresh GLB load.
- Rotation values converted degrees → radians in the HTML runtime.

### Exit Criteria
- Exported JSON correctly encodes all keyframes + easings.
- Exported HTML opens in any modern browser and reproduces the authored scroll animation without the editor.

---

## Phase 11: UX Polish + Hardening
### Scope
- Keyframe tooltip on hover: `atVh` + value + easing.
- `J` / `L` step playhead ±1 vh; `K` toggles play/pause.
- Snap-to-grid indicator while retiming keyframes.
- Performance pass for large scenes (many tracks / keyframes).
- Full regression pass across all authoring flows.

### Exit Criteria
- Polished, stable experience ready for production usage.

---

## Phase 12: Export v2 Investigation (Optional)
### Scope
- Feasibility study: bake timeline into `.glb` animation clips.
- Go/no-go based on complexity and property coverage.

### Exit Criteria
- Written technical decision and prototype outcome.
