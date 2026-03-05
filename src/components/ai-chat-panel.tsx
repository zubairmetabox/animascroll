"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronRight, Info, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

type Keyframe = { atVh: number; value: number; easing?: string };

type Operation =
  | { type: "set_track"; layerName: string; propertyId: string; keyframes: Keyframe[] }
  | { type: "delete_track"; layerName: string; propertyId: string }
  | { type: "clear_all" }
  | { type: "set_timeline_length"; vh: number }
  | { type: "set_scene"; settings: Record<string, unknown> }
  | { type: "set_point_light"; index: number; patch: Record<string, unknown> }
  | { type: "exploded_view"; vh: number; multiplier?: number };

type AnimationTrack = {
  layerId: string;
  layerName?: string;
  propertyId: string;
  keyframes: Keyframe[];
};

type LayerItem = {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  depth: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  worldPosition: { x: number; y: number; z: number };
};

type ViewerSettings = {
  backgroundColor: string;
  showGrid: boolean;
  useAmbientLight: boolean;
  ambientIntensity: number;
  useDirectionalLight: boolean;
  directionalIntensity: number;
  directionalX: number;
  directionalY: number;
  directionalZ: number;
};

type PointLightConfig = {
  id: string;
  enabled: boolean;
  color: string;
  intensity: number;
  x: number;
  y: number;
  z: number;
  distance: number;
  decay: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  operations?: Operation[];
  error?: boolean;
};

// ── Props ─────────────────────────────────────────────────────────────────

type Props = {
  layerItems: LayerItem[];
  animationTracks: AnimationTrack[];
  setAnimationTracks: (tracks: AnimationTrack[]) => void;
  timelineLengthVh: number;
  setTimelineLengthVh: (vh: number) => void;
  settings: ViewerSettings;
  patchSettings: (patch: Partial<ViewerSettings>) => void;
  pointLights: PointLightConfig[];
  setPointLights: (lights: PointLightConfig[]) => void;
  projectId: string | null;
  addLog?: (msg: string) => void;
  onExplodedView?: (centroid: { x: number; y: number; z: number }, maxOffset: number) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function applyOperations(
  ops: Operation[],
  currentTracks: AnimationTrack[],
  layerItems: LayerItem[],
  callbacks: {
    setTimelineLengthVh: (vh: number) => void;
    patchSettings: (patch: Partial<ViewerSettings>) => void;
    setPointLights: (lights: PointLightConfig[]) => void;
    pointLights: PointLightConfig[];
    addLog?: (msg: string) => void;
    onExplodedView?: (centroid: { x: number; y: number; z: number }, maxOffset: number) => void;
  }
): AnimationTrack[] {
  let tracks = [...currentTracks];
  const log = callbacks.addLog ?? (() => {});

  for (const op of ops) {
    if (op.type === "set_timeline_length") {
      if (typeof op.vh === "number" && op.vh > 0) {
        const clamped = Math.min(Math.max(op.vh, 50), 2000);
        callbacks.setTimelineLengthVh(clamped);
        log(`[AI] set_timeline_length → ${clamped}vh`);
      }
      continue;
    }

    if (op.type === "set_scene") {
      callbacks.patchSettings(op.settings as Partial<ViewerSettings>);
      log(`[AI] set_scene → ${JSON.stringify(op.settings)}`);
      continue;
    }

    if (op.type === "set_point_light") {
      const lights = [...callbacks.pointLights];
      const idx = op.index;
      if (idx >= 0 && idx < lights.length) {
        lights[idx] = { ...lights[idx], ...op.patch } as PointLightConfig;
        callbacks.setPointLights(lights);
        log(`[AI] set_point_light[${idx}] → ${JSON.stringify(op.patch)}`);
      }
      continue;
    }

    if (op.type === "exploded_view") {
      const vh = Math.min(Math.max(op.vh ?? 400, 50), 2000);
      const multiplier = op.multiplier ?? 1.0;
      callbacks.setTimelineLengthVh(vh);

      // Only animate leaf Mesh nodes — animating Groups AND their children causes double-movement
      const meshLayers = layerItems.filter(
        (l) => l.type === "Mesh" || l.type === "SkinnedMesh"
      );

      // Compute centroid from mesh bbox centers
      let cx = 0, cy = 0, cz = 0;
      for (const l of meshLayers) { cx += l.worldPosition.x; cy += l.worldPosition.y; cz += l.worldPosition.z; }
      if (meshLayers.length > 0) { cx /= meshLayers.length; cy /= meshLayers.length; cz /= meshLayers.length; }

      // Model diagonal (from bbox centers spread)
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const l of meshLayers) {
        minX = Math.min(minX, l.worldPosition.x); maxX = Math.max(maxX, l.worldPosition.x);
        minY = Math.min(minY, l.worldPosition.y); maxY = Math.max(maxY, l.worldPosition.y);
        minZ = Math.min(minZ, l.worldPosition.z); maxZ = Math.max(maxZ, l.worldPosition.z);
      }
      const diagonal = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2 + (maxZ - minZ) ** 2);
      // Minimum offset = 1.5× model diagonal, fully model-relative (no hardcoded floor)
      const minOffset = diagonal * 1.5;

      // 4-phase keyframe vh positions: closed → still closed → fully exploded → hold → closed
      const t0 = 0, t1 = vh * 0.25, t2 = vh * 0.5, t3 = vh * 0.75, t4 = vh;

      // Remove existing position tracks for mesh layers only, then rebuild
      tracks = tracks.filter((t) => !meshLayers.some((l) => l.id === t.layerId && t.propertyId.startsWith("position.")));

      let tracksCreated = 0;
      let maxAbsPeak = 0;
      for (const layer of meshLayers) {
        const dx = layer.worldPosition.x - cx;
        const dy = layer.worldPosition.y - cy;
        const dz = layer.worldPosition.z - cz;
        const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);

        let nx: number, ny: number, nz: number, offset: number;
        if (mag < diagonal * 0.01) {
          // Part is at centroid — push along the axis with least spread (inward parts)
          nx = 0; ny = 1; nz = 0;
          offset = minOffset * multiplier;
        } else {
          nx = dx / mag; ny = dy / mag; nz = dz / mag;
          offset = Math.max(mag * 2, minOffset) * multiplier;
        }

        // position.x/y/z are ABSOLUTE local positions (not offsets).
        // "Closed" = layer's current local position. "Exploded" = closed + direction * offset.
        const baseX = layer.position.x;
        const baseY = layer.position.y;
        const baseZ = layer.position.z;

        const axes: [string, number, number][] = [
          ["position.x", baseX, nx * offset],
          ["position.y", baseY, ny * offset],
          ["position.z", baseZ, nz * offset],
        ];

        for (const [propId, base, delta] of axes) {
          if (Math.abs(delta) < diagonal * 0.05) continue; // skip negligible axes
          const peakVal = base + delta;
          maxAbsPeak = Math.max(maxAbsPeak, Math.abs(delta));
          tracks = [...tracks, {
            layerId: layer.id,
            layerName: layer.name,
            propertyId: propId,
            keyframes: [
              { atVh: t0, value: base, easing: "easeInOut" },
              { atVh: t1, value: base, easing: "easeInOut" },
              { atVh: t2, value: peakVal, easing: "easeInOut" },
              { atVh: t3, value: peakVal, easing: "easeInOut" },
              { atVh: t4, value: base, easing: "easeInOut" },
            ],
          }];
          tracksCreated++;
          log(`[explode] "${layer.name}" ${propId} base=${base.toFixed(4)} peak=${peakVal.toFixed(4)} delta=${delta.toFixed(4)}`);
        }
      }

      // Notify glb-viewer to auto-fit camera to exploded extents
      callbacks.onExplodedView?.({ x: cx, y: cy, z: cz }, maxAbsPeak);

      log(`[AI] exploded_view → ${vh}vh ×${multiplier} | ${meshLayers.length} meshes | ${tracksCreated} tracks | centroid(${cx.toFixed(4)},${cy.toFixed(4)},${cz.toFixed(4)}) diagonal:${diagonal.toFixed(4)} minOffset:${minOffset.toFixed(4)}`);
      continue;
    }

    if (op.type === "clear_all") {
      tracks = [];
      log("[AI] clear_all → all tracks removed");
      continue;
    }

    const layer = layerItems.find(
      (l) => l.name.toLowerCase() === op.layerName.toLowerCase()
    );
    if (!layer) {
      log(`[AI] WARN: layer not found: "${(op as { layerName: string }).layerName}"`);
      continue;
    }

    if (op.type === "delete_track") {
      tracks = tracks.filter(
        (t) => !(t.layerId === layer.id && t.propertyId === op.propertyId)
      );
      log(`[AI] delete_track "${layer.name}" / ${op.propertyId}`);
      continue;
    }

    if (op.type === "set_track") {
      const sorted = [...op.keyframes].sort((a, b) => a.atVh - b.atVh);
      const idx = tracks.findIndex(
        (t) => t.layerId === layer.id && t.propertyId === op.propertyId
      );
      const newTrack: AnimationTrack = {
        layerId: layer.id,
        layerName: layer.name,
        propertyId: op.propertyId,
        keyframes: sorted,
      };
      if (idx >= 0) {
        tracks = tracks.map((t, i) => (i === idx ? newTrack : t));
      } else {
        tracks = [...tracks, newTrack];
      }
      const kfSummary = sorted.map((k) => `${k.atVh}vh=${k.value}`).join(", ");
      log(`[AI] set_track "${layer.name}" / ${op.propertyId} → [${kfSummary}]`);
    }
  }

  return tracks;
}

function captureScreenshot(): string | null {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  try {
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

function opsToSummary(ops: Operation[]): string {
  return ops
    .map((op) => {
      if (op.type === "clear_all") return "Cleared all tracks";
      if (op.type === "delete_track") return `Removed ${op.layerName} / ${op.propertyId}`;
      if (op.type === "set_track")
        return `Set ${op.layerName} / ${op.propertyId} (${op.keyframes.length} keyframes)`;
      if (op.type === "set_timeline_length") return `Timeline length → ${op.vh}vh`;
      if (op.type === "set_scene")
        return `Scene: ${Object.keys(op.settings).join(", ")}`;
      if (op.type === "set_point_light")
        return `Light [${op.index}]: ${Object.keys(op.patch).join(", ")}`;
      if (op.type === "exploded_view")
        return `Exploded view (${op.vh}vh, ×${op.multiplier ?? 1})`;
      return "";
    })
    .filter(Boolean)
    .join(" · ");
}

async function saveMessage(projectId: string, role: "user" | "assistant", content: string, operations?: Operation[]) {
  await fetch(`/api/projects/${projectId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content, operations }),
  }).catch(() => {});
}

// ── Component ─────────────────────────────────────────────────────────────

export function AiChatPanel({
  layerItems,
  animationTracks,
  setAnimationTracks,
  timelineLengthVh,
  setTimelineLengthVh,
  settings,
  patchSettings,
  pointLights,
  setPointLights,
  projectId,
  addLog,
  onExplodedView,
}: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [visionOn, setVisionOn] = useState(false);
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Always-fresh refs for callbacks used inside async sendMessage
  const callbacksRef = useRef({ setTimelineLengthVh, patchSettings, setPointLights, pointLights, addLog, onExplodedView });
  callbacksRef.current = { setTimelineLengthVh, patchSettings, setPointLights, pointLights, addLog, onExplodedView };

  useEffect(() => {
    if (!projectId) {
      setMessages([]);
      return;
    }
    fetch(`/api/projects/${projectId}/messages`)
      .then((r) => r.json())
      .then((d) => {
        const rows = d.messages ?? [];
        setMessages(
          rows.map((m: { id: string; role: "user" | "assistant"; content: string; operations?: Operation[] }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            operations: m.operations ?? undefined,
          }))
        );
      })
      .catch(() => {});
  }, [projectId]);

  const scrollToBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    scrollToBottom();

    if (projectId) saveMessage(projectId, "user", text);

    // Build rich scene context
    const layerNameMap = new Map(layerItems.map((l) => [l.id, l.name]));
    const sceneContext = {
      timelineLengthVh,
      layers: layerItems.map((l) => ({
        name: l.name,
        id: l.id,
        type: l.type,
        depth: l.depth,
        parentName: l.parentId ? (layerNameMap.get(l.parentId) ?? null) : null,
        position: l.position,
        rotation: l.rotation,
        scale: l.scale,
        worldPosition: l.worldPosition,
      })),
      currentTracks: animationTracks.map((t) => ({
        layerName: t.layerName ?? t.layerId,
        propertyId: t.propertyId,
        keyframes: t.keyframes,
      })),
      settings: {
        backgroundColor: settings.backgroundColor,
        showGrid: settings.showGrid,
        useAmbientLight: settings.useAmbientLight,
        ambientIntensity: settings.ambientIntensity,
        useDirectionalLight: settings.useDirectionalLight,
        directionalIntensity: settings.directionalIntensity,
        directionalX: settings.directionalX,
        directionalY: settings.directionalY,
        directionalZ: settings.directionalZ,
      },
      pointLights: pointLights.map((l, i) => ({
        index: i,
        enabled: l.enabled,
        color: l.color,
        intensity: l.intensity,
        x: l.x,
        y: l.y,
        z: l.z,
        distance: l.distance,
      })),
    };

    let screenshot: string | undefined;
    if (visionOn) screenshot = captureScreenshot() ?? undefined;

    try {
      const res = await fetch("/api/animate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          sceneContext,
          screenshot,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data.error ?? "Something went wrong. Please try again.", error: true },
        ]);
      } else {
        const ops: Operation[] = data.operations ?? [];

        if (ops.length > 0) {
          const cb = callbacksRef.current;
          addLog?.(`[AI] prompt: "${text}"`);
          const updated = applyOperations(ops, animationTracks, layerItems, {
            setTimelineLengthVh: cb.setTimelineLengthVh,
            patchSettings: cb.patchSettings,
            setPointLights: cb.setPointLights,
            pointLights: cb.pointLights,
            addLog: cb.addLog,
            onExplodedView: cb.onExplodedView,
          });
          setAnimationTracks(updated);
        }

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          operations: ops.length > 0 ? ops : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (projectId) saveMessage(projectId, "assistant", data.message, ops.length > 0 ? ops : undefined);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: "Network error. Please try again.", error: true },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleOps = (id: string) =>
    setExpandedOps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <Card className="bg-card/95 backdrop-blur">
      <CardHeader className="py-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full min-w-[160px] justify-between"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Animator
          </span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-2 pt-0" style={{ width: 280 }}>

          {/* Message list */}
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-0.5">
            {messages.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Describe what you want to animate.<br />
                e.g. &quot;Exploded view on scroll — open, hold, close back&quot;
              </p>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : msg.error
                      ? "border border-destructive/40 bg-destructive/10 text-destructive"
                      : "bg-muted text-foreground"
                  )}
                >
                  {msg.content}
                </div>

                {msg.operations && msg.operations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleOps(msg.id)}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expandedOps.has(msg.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {msg.operations.length} change{msg.operations.length > 1 ? "s" : ""}
                  </button>
                )}
                {msg.operations && expandedOps.has(msg.id) && (
                  <div className="w-full rounded bg-muted/60 px-2 py-1.5 text-[10px] text-muted-foreground leading-relaxed">
                    {opsToSummary(msg.operations)}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <span className="animate-pulse">Thinking…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Vision toggle + clear */}
          <div className="flex items-center justify-between border-t border-border/40 pt-2">
            <div className="flex items-center gap-2">
              <Camera className={cn("h-3.5 w-3.5", visionOn ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-[10px]", visionOn ? "text-primary" : "text-muted-foreground")}>
                AI Vision
              </span>
              <Switch checked={visionOn} onCheckedChange={setVisionOn} className="scale-75" />
              <div className="group relative flex items-center">
                <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-md border border-border/60 bg-card px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                  Captures the current 3D view and sends it to the AI alongside your message.
                </div>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
                Clear chat
              </button>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-1.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe an animation…"
              rows={2}
              disabled={loading || layerItems.length === 0}
              className={cn(
                "flex-1 resize-none rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs leading-relaxed",
                "placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none",
                "disabled:opacity-50"
              )}
            />
            <Button
              size="sm"
              className="h-auto self-end px-2.5 py-2"
              disabled={!input.trim() || loading || layerItems.length === 0}
              onClick={sendMessage}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>

          {layerItems.length === 0 && (
            <p className="text-center text-[10px] text-muted-foreground">
              Upload a model to start animating
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
