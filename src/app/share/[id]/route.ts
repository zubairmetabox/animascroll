import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generateAnimationHtml, type ExportConfig } from "@/lib/generate-animation-html";

// ── Overlay injected into the share page (not the download) ────────────────

const SCROLL_HINT = `
<style>
#sh {
  position: fixed; bottom: 10%; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: rgba(255,255,255,0.6); pointer-events: none; z-index: 100;
  font-family: system-ui, -apple-system, sans-serif;
  animation: sh-in 1.2s ease 0.8s both;
}
@keyframes sh-in {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes sh-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
#sh svg { animation: sh-bob 1.8s ease infinite; }
#sh.out { opacity: 0 !important; transition: opacity 0.7s ease; }
@media (prefers-reduced-motion: reduce) { #sh, #sh svg { animation: none; } }
</style>
<div id="sh">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <polyline points="19 12 12 19 5 12"/>
  </svg>
  <span style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-weight:500">
    Scroll to explore
  </span>
</div>
<script>
window.addEventListener('scroll', function() {
  var h = document.getElementById('sh');
  if (!h) return;
  h.classList.add('out');
  setTimeout(function() { if (h && h.parentNode) h.parentNode.removeChild(h); }, 750);
}, { once: true });
</script>`;

const DOWNLOAD_BTN = `
<a id="dl"
   href="?download=1"
   style="position:fixed;bottom:20px;right:20px;display:flex;align-items:center;gap:6px;
          background:rgba(0,0,0,0.5);color:rgba(255,255,255,0.55);
          border:1px solid rgba(255,255,255,0.12);border-radius:8px;
          padding:7px 13px;font-size:11px;
          font-family:system-ui,-apple-system,sans-serif;
          text-decoration:none;backdrop-filter:blur(12px);
          transition:color 0.2s,border-color 0.2s;z-index:100"
   onmouseover="this.style.color='rgba(255,255,255,0.95)';this.style.borderColor='rgba(255,255,255,0.28)'"
   onmouseout="this.style.color='rgba(255,255,255,0.55)';this.style.borderColor='rgba(255,255,255,0.12)'">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
  Download HTML
</a>`;

// ── Route handler ───────────────────────────────────────────────────────────

type StoredConfig = {
  settings?: {
    backgroundColor?: string;
    useAmbientLight?: boolean;
    ambientIntensity?: number;
  };
  pointLights?: {
    enabled: boolean;
    color: string;
    intensity: number;
    x: number;
    y: number;
    z: number;
  }[];
  pinnedCameraView?: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    zoom: number;
  };
  timelineLengthVh?: number;
  animationTracks?: {
    layerName?: string;
    propertyId: string;
    keyframes: { atVh: number; value: number; easing?: string }[];
  }[];
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await sql`
    SELECT name, model_blob_url, config, is_public
    FROM projects
    WHERE id = ${id}
  `;

  if (!rows[0] || !rows[0].is_public) {
    return new NextResponse("Not found", { status: 404 });
  }

  const project = rows[0];
  const config = (project.config ?? {}) as StoredConfig;

  const cfg: ExportConfig = {
    backgroundColor: config.settings?.backgroundColor ?? "#0b0f13",
    useAmbientLight: config.settings?.useAmbientLight ?? true,
    ambientIntensity: config.settings?.ambientIntensity ?? 2,
    pointLights: (config.pointLights ?? [])
      .filter((l) => l.enabled)
      .map(({ color, intensity, x, y, z }) => ({ color, intensity, x, y, z })),
    pinnedCamera: config.pinnedCameraView ?? null,
    timelineLengthVh: config.timelineLengthVh ?? 200,
    tracks: (config.animationTracks ?? []).map((t) => ({
      layerName: t.layerName ?? "",
      propertyId: t.propertyId,
      keyframes: t.keyframes.map((k) => ({
        atVh: k.atVh,
        value: k.value,
        easing: k.easing ?? "linear",
      })),
    })),
  };

  const modelUrl = project.model_blob_url as string;
  const isDownload = new URL(req.url).searchParams.get("download") === "1";
  const projectTitle = `<title>${String(project.name)} — Animascroll</title>`;

  if (isDownload) {
    // Resolve relative URLs to absolute so the server-side fetch works
    const origin = new URL(req.url).origin;
    const absoluteModelUrl = modelUrl.startsWith("/") ? `${origin}${modelUrl}` : modelUrl;
    const modelRes = await fetch(absoluteModelUrl);
    const buffer = await modelRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:model/gltf-binary;base64,${base64}`;

    // Standalone HTML — model embedded as base64, no overlay, opens from file://
    const standaloneHtml = generateAnimationHtml(dataUrl, cfg)
      .replace("<title>Animation</title>", projectTitle);

    return new NextResponse(standaloneHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="animation.html"`,
      },
    });
  }

  // Share view — pass blob URL directly (browser loads from same origin)
  const baseHtml = generateAnimationHtml(modelUrl, cfg)
    .replace("<title>Animation</title>", projectTitle);

  // Inject scroll hint + download button before </body>
  const shareHtml = baseHtml.replace("</body>", `${SCROLL_HINT}\n${DOWNLOAD_BTN}\n</body>`);

  return new NextResponse(shareHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
