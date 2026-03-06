# Animascroll — Help

---

## Modes

Animascroll has two editor modes, toggled with the buttons in the top-right bar.

### Animate Mode
The default editing mode. **OrbitControls are active** — you can freely orbit, pan, and zoom the viewport with your mouse. The timeline, layer panel, and all editing controls are visible. Use this mode to build your animation and explore the scene.

> To lock in a camera angle for Preview, click **Set Preview Camera** after positioning the viewport.

### Preview Mode
Hides all editing UI. The canvas fills the screen and **scrolling the page drives the animation** — exactly what visitors see on your share page. Press **Escape** or click **Exit Preview** to return.

---

## Top Bar

### Project Name
Click the project name to rename it inline. Press **Enter** or click away to save.

### File Menu

| Item | Notes |
|---|---|
| **Export Model** | Downloads the current scene as a GLB file |
| **Export HTML Page** | Downloads a self-contained HTML animation file (requires at least one animation track) |
| **Save** `Ctrl S` | Saves your animation config to the cloud |
| **Download Config…** | Downloads a JSON snapshot of all settings, lights, camera, and tracks |
| **Load Config…** | Loads a previously downloaded JSON config file |
| **Animation Skills…** | Opens the Animation Skills manager |
| **Logs** | Shows the AI activity log |
| **Help** | Opens this page |
| **Close Project** | Returns to the Projects dashboard |

### Edit Menu

| Item | Shortcut |
|---|---|
| **Undo** | `Ctrl Z` |
| **Redo** | `Ctrl Shift Z` or `Ctrl Y` |
| **Reset All** | Jumps back to the initial state (full undo history) |

### Move Tool Button
Appears in the top bar when a layer is selected in Animate mode. Click it (or press **G**) to toggle the Move gizmo — a wireframe box around the selected object. Drag the gizmo to reposition the object; a keyframe is automatically created.

### Share Button
Visible when a project is open. Opens a popover:

- **When sharing is off**: Click **Enable sharing & copy link** — the project becomes public and the link is copied to your clipboard.
- **When sharing is on**: Shows the public link with a copy button, and a **Stop sharing** option. The indicator dot turns green when public.

### Set Preview Camera & Reset
- **Set Preview Camera**: Saves the current viewport angle as the locked camera for Preview mode and the share page. Updates to **"Update saved preview camera"** once set.
- **↩ Reset button**: Returns the viewport to the saved preview angle.
- **Fit Camera** (animate mode): Fits the entire model in view and saves that angle as the preview camera.

### Animate / Preview Toggle
Switches between Animate and Preview modes.

---

## Viewport

### Mouse Controls (Animate Mode)
- **Left-click drag** — orbit/rotate camera
- **Right-click drag or middle-click drag** — pan camera
- **Scroll wheel** — zoom (can be disabled in Customize)

### Selecting Layers
Click any mesh in the viewport to select that layer. It gets a blue outline and the corresponding timeline row is highlighted.

### Isolation Mode
Double-click a group mesh to enter isolation mode — all other layers are hidden. A breadcrumb bar appears at the top (`Scene › Group1 › …`). Click any breadcrumb level to navigate up, or press **Escape** / click **×** to exit fully.

### Move Gizmo
When the Move tool is active (press **G** or click the Move button), an orange wireframe box appears around the selected object. Drag it to move the object in world space. The gizmo correctly accounts for parent transforms.

### Grid
Visible in Animate mode when **Show grid** is enabled in Customize. Toggle it off for a cleaner preview.

---

## Layer Panel (Left Side of Timeline)

Lists all meshes and groups in your model as a tree.

### Per-Layer Controls

| Control | Action |
|---|---|
| **▶ / ▼ chevron** | Expand or collapse child layers (groups only) |
| **Layer name** | Click to select; double-click to rename |
| **Eye / Switch** | Toggle visibility |
| **▶ / ▼ details chevron** | Expand the property detail panel below |
| **🗑 Trash button** | Soft-delete the layer (hidden, can be undone) |

### Layer Detail Panel (When Expanded)
Shows four collapsible sections. Each value field can be **dragged horizontally** to scrub the value live — a keyframe is created at the current playhead position automatically.

- **Position** — Local X, Y, Z coordinates (0.001 per pixel of drag)
- **Rotation** — X, Y, Z in degrees. Rotates around the object's visual bounding-box centre to prevent circular drift (1° per 8 pixels of drag)
- **Scale** — Uniform scale (0.01 per 8 pixels of drag)
- **Opacity** — Slider 0 (transparent) to 1 (opaque)

### Right-Click Context Menu
- **Focus** — Flies the viewport camera to that layer
- **Group selected** — Groups all Ctrl-selected sibling layers (preserves world transforms)
- **Ungroup** — Dissolves the group, moves children to scene root
- **Duplicate layer** — Clones the layer with a slight X offset
- **Delete layer** — Soft-delete

### Multi-Select
Hold **Ctrl** and click multiple layer rows to select them. Then right-click → **Group selected**.

---

## Timeline

The timeline runs along the bottom of the screen. Drag the **pill handle** at the top edge to resize it (minimum 28px, maximum 560px).

### Layout
```
[ Layer list (320px) ][ gutter ][ Track area (scrollable) ]
```

### Ruler & Playhead
- The ruler at the top shows time in **vh** (viewport height) units
- The white vertical line is the **playhead** — drag it or click the ruler to seek
- **Shift + click or drag** snaps the playhead to the nearest keyframe (within 3% threshold)

### Playback
- Press **Space** or click ▶/⏸ to play/pause
- Playback speed is **50 vh/second**
- **J** — step back 1 vh
- **K** — play/pause
- **L** — step forward 1 vh
- Playback stops automatically at the end of the timeline

### Zoom
- **Ctrl + Scroll** inside the track area to zoom in/out
- Use the **−** / **+** buttons in the toolbar
- Zoom range: 0.5× to 4× (step 0.25)

### Timeline Length
Set the total duration of your animation with the **length field** in the toolbar (default 200 vh, min 50, max 5000).

---

## Animation Tracks

### Enabling a Property
In the layer panel, each layer has 8 animatable properties: **Position X/Y/Z**, **Rotation X/Y/Z**, **Scale**, **Opacity**. Click the **clock icon** next to a property name to enable animation for it. A track row appears in the timeline.

### Adding Keyframes
1. Move the playhead to the desired time
2. Click the **◇ diamond button** in the property row to create a keyframe at the current value
3. Or scrub a property value with modifier drag — a keyframe is created automatically

### Keyframe Appearance
- **Grey diamond** — unselected keyframe
- **Blue diamond** — selected or at current playhead position
- **Amber dot below** — non-linear easing applied
- **Hover** a keyframe to see its time (vh), value, and easing

### Selecting Keyframes
- **Click** a keyframe to select it
- **Ctrl + Click** to add/remove from selection
- **Drag** on empty track space to rubber-band select multiple keyframes

### Moving Keyframes (Retime)
Drag any selected keyframe horizontally. All selected keyframes move together. An amber indicator line shows the target position. Cannot move outside 0 – timeline length bounds.

### Copy & Paste Keyframes
- **Ctrl + C** — copy selected keyframes (relative timing preserved)
- **Ctrl + V** — paste at current playhead position

### Deleting Keyframes
Select keyframe(s) and press **Delete** or **Backspace**.

### Easing
Right-click any keyframe to change its easing (applies between that keyframe and the next):

| Easing | Behaviour |
|---|---|
| **Linear** | Constant speed |
| **Ease In** | Starts slow, accelerates |
| **Ease Out** | Starts fast, decelerates |
| **Ease In/Out** | Slow at both ends (quadratic) |
| **Ease In/Out Cubic** | Stronger slow at both ends |

---

## Animatable Properties

| Property | Description |
|---|---|
| **Position X / Y / Z** | World-space translation in scene units |
| **Rotation X / Y / Z** | Degrees — pivots around the object's visual bounding-box centre |
| **Scale** | Uniform scale (1 = original size) |
| **Opacity** | 0 = invisible, 1 = fully opaque |

---

## Customize Panel

Open by clicking **Customize** in the right sidebar.

### Environment
- **Background color** — hex color picker (also applied to exports and share page)
- **Show grid** — toggle the viewport grid

### Navigation
- **Enable zoom** — allows scroll-wheel zoom in the viewport
- **Auto rotate** — continuously rotates the camera around the model

### Lighting

#### Ambient Light
- **Enabled** toggle
- **Intensity** slider (0–3)

#### Directional Light
- **Enabled** toggle
- **Intensity** slider (0–5)
- **X / Y / Z** position sliders (–30 to +30)

#### Point Lights (up to 4)
Click **Add light** to add a point light. Per light:
- **Enabled** toggle
- **Color** — hex color picker
- **Intensity** — 0 to 20
- **Distance** — 0 to 500 (0 = no falloff cutoff)
- **Decay** — 0 to 4
- **X / Y / Z** position — ±100
- **Delete** button

### Variables Panel
Shows and edits the full JSON config (settings, lights, camera, timeline, tracks).

| Button | Action |
|---|---|
| **Format JSON** | Prettify the JSON |
| **Copy** | Copy to clipboard |
| **Save Local** | Save to browser localStorage |
| **Load Local** | Load from browser localStorage |
| **Apply** | Parse and apply to the editor (layers matched by name if UUIDs differ) |

---

## AI Animator

Click **AI Animator** in the right sidebar to open the chat panel.

Describe the animation you want in plain language. The AI knows your model's layer names and generates keyframes directly on the timeline.

**Example prompts:**
- *"Rotate the body 360 degrees over the full timeline"*
- *"Fade in the logo between 0 and 50vh, then slide it up"*
- *"Make the lid bounce open at 100vh"*

### Tips
- Refer to layers by their exact name as shown in the layer panel
- Mention timing explicitly ("between 50 and 150vh") for precise placement
- To adjust the result: *"Move the rotation to start later, at 80vh"*

### Activity Log
**File → Logs** shows a timestamped record of all AI operations — which keyframes were added, removed, or modified, and on which layers.

---

## Animation Skills

Skills are reusable instruction snippets that teach the AI specific animation techniques. The AI automatically uses matching skills when it detects their keywords in your prompt.

### Opening Skills Manager
**File → Animation Skills…** — opens the Skills manager as a modal.

From the **Projects page**, click the **Animation Skills** tab to manage skills in a full-page view.

### Creating a Skill
Click **New Skill**. Write your instructions in the editor. Use the YAML frontmatter block at the top:

```
---
name: Smooth Entrance
keywords: fade in, entrance, appear, reveal
description: Fades and slides an object into view
---

Animate opacity from 0 to 1 and position.y from -0.5 to 0
over 50vh using easeOut easing on both properties.
```

### How Skills Are Injected
When you send a prompt to the AI, Animascroll scans your message for the skill's keywords. Any matching skills are appended automatically to the AI's system context — you don't need to mention them.

---

## Share

### Enabling Sharing
Click **Share** in the top bar → **Enable sharing & copy link**. The project is made public and the link is copied to your clipboard. A green dot appears on the Share button.

### The Share Page
Opening the link serves a self-contained animation page:
- No account required to view
- Visitors scroll the page to play the animation
- A **"Scroll to explore"** hint fades in and disappears on first scroll
- **Download HTML** button in the bottom-right corner lets visitors download the animation

### Downloading HTML
The downloaded HTML file has the 3D model **embedded as base64** — it works completely offline, opened from anywhere including `file://` on a local machine.

You can also export HTML from inside the editor via **File → Export HTML Page**.

### Stopping Sharing
Click **Share** → **Stop sharing**. The share URL immediately returns a 404.

---

## History & Undo

- **Ctrl Z** — undo
- **Ctrl Shift Z** / **Ctrl Y** — redo
- **Edit → Reset All** — jump back to the initial state

Up to **40 history entries** are kept. Operations tracked include: layer transforms, visibility, rename, group/ungroup, duplicate, delete, keyframe changes, easing changes, and AI operations.

---

## Autosave & Manual Save

### Autosave
Changes are automatically saved **10 seconds** after the last edit. A 2-minute fallback ensures saves aren't missed. Autosave is silent (no interruption).

### Manual Save
**Ctrl S** or **File → Save** — saves immediately and captures a thumbnail.

### Unsaved Changes Warning
If you try to close the project while there are unsaved changes, a dialog asks: **Cancel**, **Discard**, or **Save**.

### Config File
- **File → Download Config…** — saves a JSON file with all your animation data
- **File → Load Config…** — loads it back (layers matched by name, so it works even after re-uploading the model)

---

## Upload

### Supported Formats
GLB, GLTF, FBX, OBJ, STL

### Storage Quota
Each account has a **100 MB** model storage limit. The quota is checked before upload starts. If you're over the limit, delete a project first to free space.

> The **Racket sample project** does not count toward your quota.

### What Happens on Upload
1. File is parsed in the browser
2. Scene loads in the viewport, layers rebuild
3. Animation tracks reset, history resets
4. Model is uploaded to cloud storage in the background (non-blocking)

---

## Preview Mode (Scroll Animation)

### Entering Preview
Click **Preview** in the top-right bar. The editing UI disappears and the canvas fills the screen.

### How Scroll Works
Page height is set to `timelineLengthVh + 100` vh. As you scroll, the scroll position is mapped linearly to 0–timelineLengthVh, which drives the animation. This is identical to what visitors see on the share page.

### HUD
A small bar at the bottom center shows:
- **Progress bar** — visual position in the animation
- **Current vh / total vh** readout
- **Exit Preview** button

### Exiting Preview
Press **Escape** or click **Exit Preview**.

---

## Keyboard Shortcuts Reference

| Shortcut | Action |
|---|---|
| `Ctrl S` | Save |
| `Ctrl Z` | Undo |
| `Ctrl Shift Z` / `Ctrl Y` | Redo |
| `Space` | Play / Pause |
| `J` | Step back 1 vh |
| `K` | Play / Pause |
| `L` | Step forward 1 vh |
| `G` | Toggle Move tool |
| `Escape` | Exit isolation / exit preview / deselect keyframes |
| `Delete` / `Backspace` | Delete selected keyframes |
| `Ctrl C` | Copy selected keyframes |
| `Ctrl V` | Paste keyframes at playhead |
