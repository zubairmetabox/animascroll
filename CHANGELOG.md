# Changelog

All notable changes to Animascroll are documented here.

---

## [Unreleased]

### Added
- **View menu** in left sidebar header — toggle any panel (History, Environment, Variables, AI Animator, Navigation, Lighting, Additional Light Sources) on/off; state persisted to user prefs
- **File / Edit / View menus** moved from top bar into a sticky strip at the top of the left sidebar
- **Camera controls** (Fit, Set Preview Camera, Reset Angle) moved from top bar into a sticky strip at the top of the right sidebar
- **Full-width timeline** — timeline now spans the full viewport width; sidebars sit above it and stop at the timeline's top edge
- **Edge-drag timeline resize** — replaced pill handle with a top-edge drag strip matching the sidebar resize handle style (hover highlight, `cursor-ns-resize`)
- **ResizeObserver on timeline** — sidebar and canvas bottom positions are derived from the timeline's actual rendered height, eliminating header overlap

### Changed
- **Always-framed layout** — removed Framed/Full workspace switcher; the app is always in framed mode
- **Sidebar minimum width** set to 240px (was 160px)
- Removed "Timeline" label from timeline header (redundant)
- Top bar simplified — now contains only logo, project name, mode toggles (Animate/Preview), and Share/user controls

### Fixed
- Horizontal scrollbar appearing in preview/scroll mode (`overflow-x: hidden` on `<html>`)
- Right sidebar resize handle extending into the timeline area (was using `timelinePanelHeight` instead of `timelineActualHeight`)

### Removed
- Workspace selector (Framed / Full toggle)
- Unused lucide imports: `Box`, `Settings2`, `LayoutPanelLeft`
- 162-line dead `{false && ...}` JSX block in right sidebar

---

## 2025-04-22

### Added
- **Sleek 4px dark scrollbars** across all panels and timeline
- **Workspace layout persistence** — panel widths, layout, and section open states saved per user account

## 2025-04-20

### Added
- **Framed/Full workspace switcher** with draggable panel sections (drag-and-drop reorder between left and right panels)
- **AI Settings** — user-configurable OpenRouter API key and model selection
- **Camera zoom/dolly animation** on timeline tracks; fixed scale drift and number input edge cases

## Earlier

### Added
- Animation Skills system with AI prompt injection and skills manager UI
- Public share URL with scroll-driven animation viewer (model embedded as base64)
- Projects system with DB persistence, autosave, and storage quota management
- AI chat panel with exploded view algorithm, fit-to-model camera, and activity log
- Help modal (`File > Help`) with full in-app documentation
- Sample project for new users on first sign-in
- Draco GLB support, PBR rendering fixes (env map, exposure, transmission)
- STL upload fix (empty browser MIME type)
- Auth guard, rate limiting, XSS escaping, and input validation
