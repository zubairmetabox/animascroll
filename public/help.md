# Animascroll — Help

---

## Getting Started

### Creating a Project
Go to the **Projects** page (`/app`). Click **New Project**, then upload a 3D model (GLB, GLTF, FBX, OBJ, or STL). Your project is created automatically and saved to the cloud.

New accounts start with a **Racket — Sample Project** so you can explore the editor before uploading your own model.

### Opening the Editor
Click any project card on the Projects page to open it in the editor. The editor loads your last-saved animation state automatically.

---

## Editor Interface

The editor has three areas:
- **Top bar** — menus, mode switcher, share button
- **Viewport** — 3D canvas
- **Timeline** — keyframe editor at the bottom (Animate mode only)

A **left sidebar** (History) and **right sidebar** (Customize, AI Animator) are available in Animate mode.

---

## Modes

### Animate Mode
The default editing mode. The camera is locked to your saved preview angle. The timeline is visible. Use this mode to place keyframes and build your animation.

### Navigate Mode
Orbit freely around your model using **left-click drag** to rotate, **right-click drag** to pan, and **scroll** to zoom. Use this mode to find the right camera angle, then click **Set Preview Camera** to save it.

### Preview Mode
Hides all editing UI. Scroll the page to drive the animation — this is exactly what visitors will see on your share page. Press **Escape** to exit Preview mode.

---

## Top Bar

### File Menu

| Item | Description |
|---|---|
| **Export Model** | Downloads the loaded 3D model as a GLB file |
| **Export HTML Page** | Downloads a fully self-contained HTML file with the animation baked in |
| **Save** `Ctrl S` | Saves the current animation state to the cloud |
| **Download Config…** | Downloads a JSON file with your full animation configuration |
| **Load Config…** | Loads a previously downloaded JSON config |
| **Animation Skills…** | Opens the Animation Skills manager |
| **Logs** | Shows the AI activity log |
| **Help** | Opens this help page |
| **Close Project** | Returns to the Projects dashboard |

### Edit Menu

| Item | Shortcut | Description |
|---|---|---|
| **Undo** | `Ctrl Z` | Undoes the last action |
| **Redo** | `Ctrl Y` | Redoes the last undone action |

---

## Viewport

### Orbit Controls (Navigate mode only)
- **Left-click drag** — rotate
- **Right-click drag** — pan
- **Scroll wheel** — zoom

### Selecting Layers
Click any part of the model in the viewport to select that mesh layer. The selected layer is highlighted with an outline and the corresponding row is focused in the timeline.

### Isolation Mode
**Double-click** a layer in the viewport to isolate it — all other layers are hidden. Double-click empty space or click **Exit Isolation** to leave isolation mode.

### Move Tool
When a layer is selected in Animate mode, a translate gizmo appears. Drag the **X** (red), **Y** (green), or **Z** (blue) axis arrow to move the object along that axis. Each drag automatically creates a keyframe at the current playhead position.

---

## Layer Panel (left side of timeline)

Each row in the left column represents a 3D object (mesh or group) in your model.

| Control | Description |
|---|---|
| **Eye icon** | Toggle layer visibility |
| **Layer name** | Click to select the layer |
| **Right-click** | Context menu: Rename, Group, Ungroup, Isolate, Focus, Delete |
| **Chevron** | Expand/collapse child layers |

### Grouping
Select multiple layers (hold `Shift` or `Ctrl` and click), then right-click → **Group Selected**. The objects are parented to a new group while preserving their world positions. Right-click a group → **Ungroup** to dissolve it.

### Focus
Right-click a layer → **Focus** to fly the camera to that object.

---

## Timeline

The timeline shows animation tracks for each layer property. The playhead (white vertical line) marks the current time in **vh** (viewport height units).

### Scrolling & Zooming
- **Scroll** the track area to scrub through time
- **Shift + scroll** to zoom the timeline in or out
- **Drag the resize handle** at the top of the timeline panel to make it taller or shorter

### Playhead
- **Click** anywhere in the track area to move the playhead
- **Drag** the playhead line to scrub
- **Shift + drag** snaps to the nearest existing keyframe (within 3% threshold)
- Press **Space** to play/pause the animation in Animate mode

### Adding Keyframes
1. Move the playhead to the desired time
2. In the layer panel, right-click a property row (e.g., **Rotation Y**) → **Add Keyframe**
3. Or use the **modifier label drag** (see below) — a keyframe is created automatically

### Keyframe Selection
- **Click** a keyframe diamond to select it
- **Ctrl + click** to add/remove from selection
- **Click and drag** on empty track space to rubber-band select multiple keyframes

### Moving Keyframes (Retime)
- **Drag** a selected keyframe left or right to move it in time
- When multiple keyframes are selected, all move together proportionally

### Easing
Right-click a keyframe → choose an easing type:
- **Linear** — constant speed
- **Ease In** — starts slow, accelerates
- **Ease Out** — starts fast, decelerates
- **Ease In-Out** — slow at both ends
- **Ease In-Out Cubic** — stronger slow at both ends

### Deleting Keyframes
Select keyframe(s) and press **Delete** or **Backspace**.

---

## Animatable Properties

Each layer can have tracks for the following properties:

| Property | Description |
|---|---|
| **Position X / Y / Z** | Move the object along each world axis (in scene units) |
| **Rotation X / Y / Z** | Rotate around each axis in degrees, pivoting from the object's bounding-box centre |
| **Scale** | Uniform scale (1 = original size) |
| **Opacity** | 0 = fully transparent, 1 = fully opaque |

### Modifier Label Drag
In the layer panel, the current value of each property is shown as a number next to the property name. **Click and drag horizontally** on that number to scrub the value live. A keyframe is automatically created at the current playhead position on every drag.

- Position: drag sensitivity `0.001` per pixel
- Rotation: drag sensitivity `1°` per 8 pixels

---

## Set Preview Camera

In **Animate mode**, click **Set Preview Camera** to save the current viewport angle as the camera for Preview mode and the Share page. The camera locks to this view when you enter Animate mode.

Click **↩ (reset)** to return to the saved preview angle at any time.

---

## AI Animator

Click the **AI Animator** button in the right sidebar to open the chat panel.

### How It Works
Describe the animation you want in plain language. The AI reads your model's layer names and generates keyframes on the timeline accordingly.

**Example prompts:**
- *"Rotate the body 360 degrees over the full timeline"*
- *"Fade in the logo between 0 and 50vh, then slide it up"*
- *"Make the wheel spin continuously"*

### Tips
- Refer to layers by their exact name as shown in the layer panel
- Mention timing (e.g., "between 50vh and 150vh") for precise placement
- If the result isn't right, describe the adjustment: *"Move the rotation to start later, at 80vh"*

### Activity Log
Open **File → Logs** to see a record of all AI actions taken — which keyframes were added, modified, or removed, and on which layers.

---

## Animation Skills

Animation Skills are reusable instruction snippets that teach the AI how to perform specific techniques. The AI automatically uses relevant skills when it detects matching keywords in your prompt.

### Creating a Skill
Open **File → Animation Skills…** (or the **Animation Skills** tab on the Projects page). Click **New Skill** and write your instructions in markdown. Add a `keywords:` line in the frontmatter so the AI knows when to apply it.

**Frontmatter format:**
```
---
name: Smooth Entrance
keywords: fade in, entrance, appear
description: Fades and slides an object into view
---

Animate opacity from 0 to 1 and position.y from -0.5 to 0 over 50vh using easeOut easing.
```

### How Skills Are Injected
When you send a prompt to the AI, Animascroll scans your message for keywords. Any matching skills are automatically appended to the AI's system context — you don't need to do anything special.

---

## Share

Enable public sharing to get a URL anyone can open — no account required.

### Enabling Sharing
Click **Share** in the top bar → **Enable sharing & copy link**. The link is copied to your clipboard automatically.

### The Share Page
The share URL serves your animation as a standalone HTML page. Visitors scroll the page to play the animation. A **"Scroll to explore"** hint fades in on load and disappears on first scroll.

### Downloading HTML
On the share page, click **Download HTML** (bottom-right corner) to get a fully self-contained HTML file with the 3D model embedded. This file works offline, opened directly from the filesystem.

You can also download the HTML from inside the editor via **File → Export HTML Page**.

### Stopping Sharing
Click **Share** → **Stop sharing**. The share URL immediately returns a 404.

---

## Customize Panel

Click **Customize** in the right sidebar to open the scene settings.

| Setting | Description |
|---|---|
| **Background color** | Sets the scene background color (also applied to the export) |
| **Ambient light** | Toggle and set the intensity of the global fill light |
| **Point lights** | Add up to 4 point lights — set color, intensity, and X/Y/Z position |
| **Timeline length** | Total animation duration in vh units (default: 200vh) |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl Z` | Undo |
| `Ctrl Y` | Redo |
| `Ctrl S` | Save |
| `Space` | Play / Pause (Animate mode) |
| `Escape` | Exit Preview mode |
| `Delete` / `Backspace` | Delete selected keyframes |
| `Shift + drag` | Snap playhead to nearest keyframe |

---

## Storage & Limits

- Each account has a **100 MB** model storage limit
- Thumbnails and project configs do not count toward the limit
- The Racket sample project does not count toward your limit
- To free up space, delete projects you no longer need from the Projects page
