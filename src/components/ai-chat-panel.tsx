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
  | { type: "clear_all" };

type AnimationTrack = {
  layerId: string;
  layerName?: string;
  propertyId: string;
  keyframes: Keyframe[];
};

type LayerItem = { id: string; name: string };

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
  projectId: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function applyOperations(
  ops: Operation[],
  currentTracks: AnimationTrack[],
  layerItems: LayerItem[]
): AnimationTrack[] {
  let tracks = [...currentTracks];

  for (const op of ops) {
    if (op.type === "clear_all") {
      tracks = [];
      continue;
    }

    const layer = layerItems.find(
      (l) => l.name.toLowerCase() === op.layerName.toLowerCase()
    );
    if (!layer) continue;

    if (op.type === "delete_track") {
      tracks = tracks.filter(
        (t) => !(t.layerId === layer.id && t.propertyId === op.propertyId)
      );
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
  }).catch(() => {}); // fire-and-forget, don't block UI
}

// ── Component ─────────────────────────────────────────────────────────────

export function AiChatPanel({
  layerItems,
  animationTracks,
  setAnimationTracks,
  timelineLengthVh,
  projectId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [visionOn, setVisionOn] = useState(false);
  const [expandedOps, setExpandedOps] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load persisted messages when projectId changes
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

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    scrollToBottom();

    if (projectId) saveMessage(projectId, "user", text);

    const sceneContext = {
      timelineLengthVh,
      layers: layerItems.map((l) => ({ name: l.name, id: l.id })),
      currentTracks: animationTracks.map((t) => ({
        layerName: t.layerName ?? t.layerId,
        propertyId: t.propertyId,
        keyframes: t.keyframes,
      })),
    };

    let screenshot: string | undefined;
    if (visionOn) {
      screenshot = captureScreenshot() ?? undefined;
    }

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
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.error ?? "Something went wrong. Please try again.",
            error: true,
          },
        ]);
      } else {
        const ops: Operation[] = data.operations ?? [];

        if (ops.length > 0) {
          const updated = applyOperations(ops, animationTracks, layerItems);
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
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Network error. Please try again.",
          error: true,
        },
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
                e.g. &quot;Spin the Cube 360° over the full timeline&quot;
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
                    {expandedOps.has(msg.id) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
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
              <Switch
                checked={visionOn}
                onCheckedChange={setVisionOn}
                className="scale-75"
              />
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
