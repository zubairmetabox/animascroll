"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, Center, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  Box,
  Camera,
  Check,
  Clock3,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Circle,
  Clipboard,
  Code2,
  Download,
  Diamond,
  Globe2,
  History,
  Lightbulb,
  Layers3,
  PanelLeft,
  Plus,
  RotateCcw,
  Redo2,
  Save,
  Settings2,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import * as THREE from "three";
import type {
  OrbitControls as OrbitControlsImpl,
} from "three-stdlib";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  orbitEnableZoom: boolean;
  orbitAutoRotate: boolean;
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

type ConfigPayload = {
  settings: ViewerSettings;
  pointLights: PointLightConfig[];
};

type LayerItem = {
  id: string;
  parentId: string | null;
  name: string;
  type: string;
  depth: number;
  hasChildren: boolean;
  visible: boolean;
  opacity: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  worldPosition: { x: number; y: number; z: number };
};

type LayerSnapshot = Record<
  string,
  {
    name: string;
    visible: boolean;
    deleted: boolean;
    opacity: number;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  }
>;

type HistoryEntry = {
  id: string;
  label: string;
  snapshot: LayerSnapshot;
};

type AnimationKeyframe = {
  atVh: number;
  value: number;
};

type AnimationTrack = {
  layerId: string;
  propertyId: string;
  keyframes: AnimationKeyframe[];
};

type ViewMode = "edit" | "animate";

type CameraView = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom: number;
};

const MAX_POINT_LIGHTS = 4;
const CONFIG_STORAGE_KEY = "glb_tool_viewer_config_v1";
const DEFAULT_CAMERA_VIEW: CameraView = {
  position: [2, 2, 2],
  target: [0, 0, 0],
  fov: 45,
  zoom: 1,
};
const TIMELINE_PROPERTIES = [
  { id: "position.x", label: "Position X" },
  { id: "position.y", label: "Position Y" },
  { id: "position.z", label: "Position Z" },
  { id: "rotation.x", label: "Rotation X" },
  { id: "rotation.y", label: "Rotation Y" },
  { id: "rotation.z", label: "Rotation Z" },
  { id: "scale.uniform", label: "Scale" },
  { id: "opacity", label: "Opacity" },
] as const;

const DEFAULT_SETTINGS: ViewerSettings = {
  backgroundColor: "#0b0f13",
  showGrid: true,
  useAmbientLight: true,
  ambientIntensity: 2,
  useDirectionalLight: false,
  directionalIntensity: 1,
  directionalX: 5,
  directionalY: 6,
  directionalZ: 4,
  orbitEnableZoom: true,
  orbitAutoRotate: false,
};

function createDefaultPointLight(index: number): PointLightConfig {
  return {
    id: `${Date.now()}-${index}`,
    enabled: true,
    color: "#ffffff",
    intensity: 5,
    x: index % 2 === 0 ? 4 : -4,
    y: 5,
    z: index < 2 ? 4 : -4,
    distance: 100,
    decay: 2,
  };
}

function readFileBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const readWithFileReader = () => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("FileReader failed."));
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
          return;
        }
        reject(new Error("Unexpected file read result type."));
      };
      reader.readAsArrayBuffer(file);
    };

    if (typeof file.arrayBuffer === "function") {
      file
        .arrayBuffer()
        .then(resolve)
        .catch(() => {
          new Response(file)
            .arrayBuffer()
            .then(resolve)
            .catch(() => readWithFileReader());
        });
      return;
    }

    readWithFileReader();
  });
}

function disposeScene(scene: THREE.Object3D) {
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (!mesh.material) return;
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose());
      return;
    }
    mesh.material.dispose();
  });
}

function SceneGrid({
  show,
  size,
  divisions,
  fadeDistance,
}: {
  show: boolean;
  size: number;
  divisions: number;
  fadeDistance: number;
}) {
  const gridRef = useRef<THREE.GridHelper>(null);

  useFrame(({ camera }) => {
    if (!gridRef.current) return;
    const material = Array.isArray(gridRef.current.material)
      ? gridRef.current.material
      : [gridRef.current.material];
    const d = camera.position.length();
    const opacity = THREE.MathUtils.clamp(1 - d / Math.max(0.5, fadeDistance), 0.05, 1);
    material.forEach((m) => {
      m.transparent = true;
      m.opacity = opacity;
      m.needsUpdate = true;
    });
  });

  if (!show) return null;

  return <gridHelper ref={gridRef} args={[size, divisions, "#748197", "#2d3642"]} position={[0, -1.2, 0]} />;
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
          {Number(value.toFixed(3))}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(arr) => onChange(arr[0] ?? value)}
        onValueCommit={(arr) => onCommit?.(arr[0] ?? value)}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
        <Input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer p-1"
        />
      </div>
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ScrubbableNumberField({
  label,
  value,
  onBeginChange,
  onValueChange,
  onEndChange,
  inputStep = "0.01",
  dragStep = 0.005,
  dragPixelsPerStep,
  dragDecimals = 3,
}: {
  label: string;
  value: number;
  onBeginChange?: () => void;
  onValueChange: (value: number) => void;
  onEndChange?: () => void;
  inputStep?: string;
  dragStep?: number;
  dragPixelsPerStep?: number;
  dragDecimals?: number;
}) {
  const dragRef = useRef<{ startX: number; startValue: number; active: boolean } | null>(null);
  const typingRef = useRef(false);

  const startDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    onBeginChange?.();
    dragRef.current = {
      startX: event.clientX,
      startValue: value,
      active: true,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = moveEvent.clientX - drag.startX;
      const nextRaw =
        typeof dragPixelsPerStep === "number" && dragPixelsPerStep > 0
          ? drag.startValue + Math.round(delta / dragPixelsPerStep) * dragStep
          : drag.startValue + delta * dragStep;
      const next = Number(nextRaw.toFixed(dragDecimals));
      onValueChange(next);
    };

    const handleUp = () => {
      if (dragRef.current) dragRef.current.active = false;
      dragRef.current = null;
      onEndChange?.();
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div className="space-y-1">
      <span
        className="inline-block cursor-ew-resize select-none text-[11px] text-muted-foreground"
        title="Drag left/right to change value"
        onPointerDown={startDrag}
      >
        {label}
      </span>
      <Input
        type="number"
        step={inputStep}
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isNaN(parsed)) return;
          if (!typingRef.current) {
            onBeginChange?.();
            typingRef.current = true;
          }
          onValueChange(parsed);
        }}
        onBlur={() => {
          if (typingRef.current) {
            onEndChange?.();
          }
          typingRef.current = false;
        }}
      />
    </div>
  );
}

function clampSettings(raw: ViewerSettings): ViewerSettings {
  return {
    ...raw,
    ambientIntensity: THREE.MathUtils.clamp(raw.ambientIntensity, 0, 3),
    directionalIntensity: THREE.MathUtils.clamp(raw.directionalIntensity, 0, 5),
  };
}

function sanitizePointLight(input: PointLightConfig, i: number): PointLightConfig {
  return {
    id: input.id || `${Date.now()}-${i}`,
    enabled: Boolean(input.enabled),
    color: input.color || "#ffffff",
    intensity: THREE.MathUtils.clamp(Number(input.intensity ?? 1), 0, 20),
    x: THREE.MathUtils.clamp(Number(input.x ?? 0), -200, 200),
    y: THREE.MathUtils.clamp(Number(input.y ?? 0), -200, 200),
    z: THREE.MathUtils.clamp(Number(input.z ?? 0), -200, 200),
    distance: THREE.MathUtils.clamp(Number(input.distance ?? 100), 0, 500),
    decay: THREE.MathUtils.clamp(Number(input.decay ?? 2), 0, 4),
  };
}

function getObjectPositionInfo(object: THREE.Object3D) {
  const world = new THREE.Vector3();
  object.getWorldPosition(world);
  return {
    position: {
      x: Number(object.position.x.toFixed(3)),
      y: Number(object.position.y.toFixed(3)),
      z: Number(object.position.z.toFixed(3)),
    },
    worldPosition: {
      x: Number(world.x.toFixed(3)),
      y: Number(world.y.toFixed(3)),
      z: Number(world.z.toFixed(3)),
    },
  };
}

function getObjectScaleInfo(object: THREE.Object3D) {
  return {
    scale: {
      x: Number(object.scale.x.toFixed(3)),
      y: Number(object.scale.y.toFixed(3)),
      z: Number(object.scale.z.toFixed(3)),
    },
  };
}

function getObjectRotationInfo(object: THREE.Object3D) {
  return {
    rotation: {
      x: Number(THREE.MathUtils.radToDeg(object.rotation.x).toFixed(2)),
      y: Number(THREE.MathUtils.radToDeg(object.rotation.y).toFixed(2)),
      z: Number(THREE.MathUtils.radToDeg(object.rotation.z).toFixed(2)),
    },
  };
}

function getObjectOpacity(object: THREE.Object3D) {
  let opacity = 1;
  let found = false;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.material || found) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!material) return;
    opacity = Number((material.opacity ?? 1).toFixed(3));
    found = true;
  });
  return opacity;
}

function setObjectOpacity(object: THREE.Object3D, value: number) {
  const opacity = THREE.MathUtils.clamp(value, 0, 1);
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    });
  });
}

function setObjectUniformScaleFromCenter(object: THREE.Object3D, rawValue: number) {
  const uniformScale = THREE.MathUtils.clamp(rawValue, 0.001, 100);
  const beforeBox = new THREE.Box3().setFromObject(object);
  const beforeCenter = new THREE.Vector3();
  const hasBeforeCenter = !beforeBox.isEmpty();
  if (hasBeforeCenter) beforeBox.getCenter(beforeCenter);

  object.scale.set(uniformScale, uniformScale, uniformScale);
  object.updateMatrixWorld(true);

  if (!hasBeforeCenter) return;
  const afterBox = new THREE.Box3().setFromObject(object);
  if (afterBox.isEmpty()) return;
  const afterCenter = new THREE.Vector3();
  afterBox.getCenter(afterCenter);
  const worldDelta = beforeCenter.sub(afterCenter);
  if (worldDelta.lengthSq() < 1e-12) return;

  const originWorld = new THREE.Vector3();
  object.getWorldPosition(originWorld);
  const targetOriginWorld = originWorld.add(worldDelta);
  if (object.parent) {
    const targetLocal = object.parent.worldToLocal(targetOriginWorld.clone());
    object.position.copy(targetLocal);
  } else {
    object.position.copy(targetOriginWorld);
  }
  object.updateMatrixWorld(true);
}

function setObjectRotationFromCenter(
  object: THREE.Object3D,
  degrees: { x: number; y: number; z: number }
) {
  const beforeBox = new THREE.Box3().setFromObject(object);
  const beforeCenter = new THREE.Vector3();
  const hasBeforeCenter = !beforeBox.isEmpty();
  if (hasBeforeCenter) beforeBox.getCenter(beforeCenter);

  object.rotation.set(
    THREE.MathUtils.degToRad(degrees.x),
    THREE.MathUtils.degToRad(degrees.y),
    THREE.MathUtils.degToRad(degrees.z),
    object.rotation.order
  );
  object.updateMatrixWorld(true);

  if (!hasBeforeCenter) return;
  const afterBox = new THREE.Box3().setFromObject(object);
  if (afterBox.isEmpty()) return;
  const afterCenter = new THREE.Vector3();
  afterBox.getCenter(afterCenter);
  const worldDelta = beforeCenter.sub(afterCenter);
  if (worldDelta.lengthSq() < 1e-12) return;

  const originWorld = new THREE.Vector3();
  object.getWorldPosition(originWorld);
  const targetOriginWorld = originWorld.add(worldDelta);
  if (object.parent) {
    const targetLocal = object.parent.worldToLocal(targetOriginWorld.clone());
    object.position.copy(targetLocal);
  } else {
    object.position.copy(targetOriginWorld);
  }
  object.updateMatrixWorld(true);
}

function isTransformableLayer(object: THREE.Object3D): boolean {
  if (object.type === "Bone") return false;
  if (object.type === "SkeletonHelper") return false;
  if (object.type === "Camera") return false;
  return true;
}

function getLayerItems(scene: THREE.Object3D): {
  items: LayerItem[];
  objectMap: Map<string, THREE.Object3D>;
} {
  const items: LayerItem[] = [];
  const objectMap = new Map<string, THREE.Object3D>();
  let unnamedCounter = 1;

  scene.traverse((object) => {
    if (object === scene) return;
    if (!isTransformableLayer(object)) return;

    const parentId = (() => {
      let current: THREE.Object3D | null = object.parent;
      while (current && current !== scene) {
        if (isTransformableLayer(current)) return current.uuid;
        current = current.parent;
      }
      return null;
    })();

    const depth = (() => {
      let d = 0;
      let current: THREE.Object3D | null = object.parent;
      while (current && current !== scene) {
        d += 1;
        current = current.parent;
      }
      return d;
    })();

    const name =
      object.name.trim().length > 0 ? object.name : `${object.type} ${unnamedCounter++}`;
    const item: LayerItem = {
      id: object.uuid,
      parentId,
      name,
      type: object.type,
      depth,
      hasChildren: object.children.some((child) => isTransformableLayer(child)),
      visible: object.visible,
      opacity: getObjectOpacity(object),
      ...getObjectPositionInfo(object),
      ...getObjectRotationInfo(object),
      ...getObjectScaleInfo(object),
    };
    items.push(item);
    objectMap.set(item.id, object);
  });

  return { items, objectMap };
}

export function GlbViewer() {
  const [modelScene, setModelScene] = useState<THREE.Object3D | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [layerMessage, setLayerMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [cameraView, setCameraView] = useState<CameraView>(DEFAULT_CAMERA_VIEW);
  const [timelineLengthVh, setTimelineLengthVh] = useState(200);
  const [timelineCurrentVh, setTimelineCurrentVh] = useState(0);
  const [timelineProgress, setTimelineProgress] = useState(0);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineExpandedLayerIds, setTimelineExpandedLayerIds] = useState<Set<string>>(new Set());
  const [timelinePanelHeight, setTimelinePanelHeight] = useState(260);
  const [animationTracks, setAnimationTracks] = useState<AnimationTrack[]>([]);
  const [showCustomize, setShowCustomize] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS);
  const [pointLights, setPointLights] = useState<PointLightConfig[]>([createDefaultPointLight(0)]);
  const [layerItems, setLayerItems] = useState<LayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerContextMenu, setLayerContextMenu] = useState<{
    layerId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [layerDetailsOpen, setLayerDetailsOpen] = useState<Record<string, boolean>>({});
  const [layerSectionOpen, setLayerSectionOpen] = useState<Record<string, boolean>>({});
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [deletedLayerIds, setDeletedLayerIds] = useState<Set<string>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [configText, setConfigText] = useState("");
  const [configDirty, setConfigDirty] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const loadIdRef = useRef(0);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const layerObjectMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const deletedLayerIdsRef = useRef<Set<string>>(new Set());
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
  const historyEntriesRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(0);
  const pendingTransformLayerIdsRef = useRef<Set<string>>(new Set());
  const pendingScaleLayerIdsRef = useRef<Set<string>>(new Set());
  const pendingRotationLayerIdsRef = useRef<Set<string>>(new Set());
  const undoActionRef = useRef<() => void>(() => {});
  const redoActionRef = useRef<() => void>(() => {});
  const timelineResizeRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const timelineSeekDragRef = useRef(false);
  const timelineRulerRef = useRef<HTMLDivElement | null>(null);
  const applyTimelinePropertyValueRef = useRef<
    (layer: LayerItem, propertyId: string, rawValue: string) => void
  >(() => {});
  const commitTimelinePropertyEditRef = useRef<
    (layer: LayerItem, propertyId: string) => void
  >(() => {});
  const timelineModifierDragRef = useRef<{
    layerId: string;
    propertyId: string;
    startX: number;
    startValue: number;
  } | null>(null);

  const hasModel = modelScene !== null;
  const undoCount = historyIndex;
  const redoCount = Math.max(0, historyEntries.length - 1 - historyIndex);

  useEffect(() => {
    if (configDirty) return;
    const text = JSON.stringify({ settings, pointLights }, null, 2);
    setConfigText(text);
  }, [settings, pointLights, configDirty]);

  useEffect(() => {
    deletedLayerIdsRef.current = deletedLayerIds;
  }, [deletedLayerIds]);

  useEffect(() => {
    if (!hasModel) return;
    if (viewMode !== "animate") return;
    applyCameraView(cameraView);
  }, [hasModel, viewMode, cameraView]);

  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;

    const updateTimelineFromScroll = () => {
      if (viewMode !== "animate") {
        setTimelineCurrentVh(0);
        setTimelineProgress(0);
        return;
      }
      const viewportHeight = Math.max(container.clientHeight, 1);
      const lengthPx = Math.max((timelineLengthVh / 100) * viewportHeight, 1);
      const scrollTop = container.scrollTop;
      const currentVh = THREE.MathUtils.clamp((scrollTop / viewportHeight) * 100, 0, timelineLengthVh);
      const progress = THREE.MathUtils.clamp(scrollTop / lengthPx, 0, 1);
      setTimelineCurrentVh(Number(currentVh.toFixed(2)));
      setTimelineProgress(progress);
    };

    updateTimelineFromScroll();
    container.addEventListener("scroll", updateTimelineFromScroll, { passive: true });
    window.addEventListener("resize", updateTimelineFromScroll);
    return () => {
      container.removeEventListener("scroll", updateTimelineFromScroll);
      window.removeEventListener("resize", updateTimelineFromScroll);
    };
  }, [timelineLengthVh, viewMode]);

  const commitHistoryState = (entries: HistoryEntry[], index: number) => {
    historyEntriesRef.current = entries;
    historyIndexRef.current = index;
    setHistoryEntries(entries);
    setHistoryIndex(index);
  };

  const getLayerName = (layerId: string) => {
    const fromList = layerItems.find((layer) => layer.id === layerId)?.name;
    if (fromList) return fromList;
    const object = layerObjectMapRef.current.get(layerId);
    return object?.name?.trim() || "Layer";
  };

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!layerContextMenu) return;
    const closeMenu = () => setLayerContextMenu(null);
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [layerContextMenu]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = timelineResizeRef.current;
      if (drag) {
        const delta = drag.startY - event.clientY;
        const next = THREE.MathUtils.clamp(Math.round(drag.startHeight + delta), 160, 560);
        setTimelinePanelHeight(next);
      }

      const modifierDrag = timelineModifierDragRef.current;
      if (modifierDrag) {
        const layer = layerItems.find((item) => item.id === modifierDrag.layerId);
        if (!layer) return;
        const deltaX = event.clientX - modifierDrag.startX;
        const step = modifierDrag.propertyId.startsWith("rotation.") ? 1 : 0.01;
        const nextRaw = modifierDrag.startValue + Math.round(deltaX / 8) * step;
        const decimals = modifierDrag.propertyId.startsWith("rotation.") ? 2 : 3;
        applyTimelinePropertyValueRef.current(layer, modifierDrag.propertyId, nextRaw.toFixed(decimals));
      }

      if (timelineSeekDragRef.current && timelineRulerRef.current) {
        const rect = timelineRulerRef.current.getBoundingClientRect();
        const ratio = THREE.MathUtils.clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        const next = THREE.MathUtils.clamp(ratio * timelineLengthVh, 0, timelineLengthVh);
        setTimelineCurrentVh(Number(next.toFixed(2)));
        setTimelineProgress(THREE.MathUtils.clamp(next / Math.max(1, timelineLengthVh), 0, 1));
      }
    };
    const onPointerUp = () => {
      timelineResizeRef.current = null;
      timelineSeekDragRef.current = false;
      const modifierDrag = timelineModifierDragRef.current;
      if (modifierDrag) {
        const layer = layerItems.find((item) => item.id === modifierDrag.layerId);
        if (layer) {
          commitTimelinePropertyEditRef.current(layer, modifierDrag.propertyId);
        }
      }
      timelineModifierDragRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [layerItems, timelineLengthVh]);

  const patchSettings = (patch: Partial<ViewerSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
  };

  const updateTimelineLengthVh = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    const next = THREE.MathUtils.clamp(Math.round(parsed), 50, 5000);
    setTimelineLengthVh(next);
    setHasUnsavedChanges(true);
  };

  const adjustTimelineZoom = (direction: "in" | "out") => {
    setTimelineZoom((prev) => {
      const delta = direction === "in" ? 0.25 : -0.25;
      return THREE.MathUtils.clamp(Number((prev + delta).toFixed(2)), 0.5, 4);
    });
  };

  const getVisibleLayerItems = () => {
    const byId = new Map(layerItems.map((layer) => [layer.id, layer]));
    return layerItems.filter((layer) => {
      if (deletedLayerIds.has(layer.id)) return false;
      let currentParentId = layer.parentId;
      while (currentParentId) {
        if (collapsedGroupIds.has(currentParentId)) return false;
        const parent = byId.get(currentParentId);
        currentParentId = parent?.parentId ?? null;
      }
      return true;
    });
  };

  const getTimelineRows = () => {
    const visibleLayers = getVisibleLayerItems();
    const rows: Array<
      | { key: string; kind: "layer"; layer: LayerItem }
      | { key: string; kind: "property"; layer: LayerItem; propertyId: string; label: string }
    > = [];
    visibleLayers.forEach((layer) => {
      rows.push({ key: `layer-${layer.id}`, kind: "layer", layer });
      if (timelineExpandedLayerIds.has(layer.id)) {
        TIMELINE_PROPERTIES.forEach((property) => {
          rows.push({
            key: `prop-${layer.id}-${property.id}`,
            kind: "property",
            layer,
            propertyId: property.id,
            label: property.label,
          });
        });
      }
    });
    return rows;
  };

  const getTrackIndex = (layerId: string, propertyId: string) =>
    animationTracks.findIndex(
      (track) => track.layerId === layerId && track.propertyId === propertyId
    );

  const getTrack = (layerId: string, propertyId: string) => {
    const index = getTrackIndex(layerId, propertyId);
    if (index < 0) return null;
    return animationTracks[index];
  };

  const setTimelineSeekVh = useCallback((value: number) => {
    const next = THREE.MathUtils.clamp(value, 0, timelineLengthVh);
    setTimelineCurrentVh(Number(next.toFixed(2)));
    setTimelineProgress(THREE.MathUtils.clamp(next / Math.max(1, timelineLengthVh), 0, 1));
  }, [timelineLengthVh]);

  const hasTrackKeyframes = (layerId: string, propertyId: string) => {
    const track = getTrack(layerId, propertyId);
    if (!track) return false;
    return track.keyframes.length > 0;
  };

  const hasKeyframeAtCurrentTime = (layerId: string, propertyId: string) => {
    const track = getTrack(layerId, propertyId);
    if (!track) return false;
    const atVh = Number(timelineCurrentVh.toFixed(2));
    return track.keyframes.some((kf) => Number(kf.atVh.toFixed(2)) === atVh);
  };

  const toggleTrackAnimation = (layer: LayerItem, propertyId: string, enabled: boolean) => {
    setAnimationTracks((prev) => {
      const index = prev.findIndex(
        (track) => track.layerId === layer.id && track.propertyId === propertyId
      );
      if (!enabled) {
        if (index < 0) return prev;
        return prev.filter((_, i) => i !== index);
      }

      const atVh = Number(timelineCurrentVh.toFixed(2));
      const value = Number(getTimelinePropertyValue(layer, propertyId).toFixed(4));
      if (index < 0) {
        return [...prev, { layerId: layer.id, propertyId, keyframes: [{ atVh, value }] }];
      }
      const next = [...prev];
      const keyframes = [...next[index].keyframes];
      const existing = keyframes.findIndex((kf) => Number(kf.atVh.toFixed(2)) === atVh);
      if (existing >= 0) keyframes[existing] = { atVh, value };
      else keyframes.push({ atVh, value });
      keyframes.sort((a, b) => a.atVh - b.atVh);
      next[index] = { ...next[index], keyframes };
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const navigateTrackKeyframe = (
    layerId: string,
    propertyId: string,
    direction: "prev" | "next"
  ) => {
    const track = getTrack(layerId, propertyId);
    if (!track || track.keyframes.length === 0) return;
    const current = Number(timelineCurrentVh.toFixed(2));
    if (direction === "prev") {
      const candidates = track.keyframes.filter((kf) => kf.atVh < current - 1e-6);
      const target = candidates.at(-1) ?? track.keyframes[0];
      setTimelineSeekVh(target.atVh);
      return;
    }
    const candidates = track.keyframes.filter((kf) => kf.atVh > current + 1e-6);
    const target = candidates[0] ?? track.keyframes[track.keyframes.length - 1];
    setTimelineSeekVh(target.atVh);
  };

  const upsertKeyframeAtCurrentTime = (layer: LayerItem, propertyId: string) => {
    const atVh = Number(timelineCurrentVh.toFixed(2));
    const value = Number(getTimelinePropertyValue(layer, propertyId).toFixed(4));
    setAnimationTracks((prev) => {
      const next = [...prev];
      const index = next.findIndex(
        (track) => track.layerId === layer.id && track.propertyId === propertyId
      );
      if (index < 0) {
        next.push({
          layerId: layer.id,
          propertyId,
          keyframes: [{ atVh, value }],
        });
        return next;
      }

      const keyframes = [...next[index].keyframes];
      const existing = keyframes.findIndex((kf) => Number(kf.atVh.toFixed(2)) === atVh);
      if (existing >= 0) {
        keyframes[existing] = { atVh, value };
      } else {
        keyframes.push({ atVh, value });
      }
      keyframes.sort((a, b) => a.atVh - b.atVh);
      next[index] = { ...next[index], keyframes };
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const getDepthShade = (depth: number) => {
    const clamped = THREE.MathUtils.clamp(depth, 0, 8);
    return Number((0.06 + clamped * 0.055).toFixed(3));
  };

  const getTimelinePropertyValue = (layer: LayerItem, propertyId: string) => {
    switch (propertyId) {
      case "position.x":
        return layer.position.x;
      case "position.y":
        return layer.position.y;
      case "position.z":
        return layer.position.z;
      case "rotation.x":
        return layer.rotation.x;
      case "rotation.y":
        return layer.rotation.y;
      case "rotation.z":
        return layer.rotation.z;
      case "scale.uniform":
        return layer.scale.x;
      case "opacity":
        return layer.opacity;
      default:
        return 0;
    }
  };

  const getTimelinePropertyStep = (propertyId: string) => {
    if (propertyId.startsWith("rotation.")) return "1";
    if (propertyId === "opacity") return "0.01";
    return "0.01";
  };

  const applyTimelinePropertyValue = (layer: LayerItem, propertyId: string, rawValue: string) => {
    switch (propertyId) {
      case "position.x":
        updateLayerCoordinate(layer.id, "x", rawValue);
        return;
      case "position.y":
        updateLayerCoordinate(layer.id, "y", rawValue);
        return;
      case "position.z":
        updateLayerCoordinate(layer.id, "z", rawValue);
        return;
      case "rotation.x":
        updateLayerRotationCoordinate(layer.id, "x", rawValue);
        return;
      case "rotation.y":
        updateLayerRotationCoordinate(layer.id, "y", rawValue);
        return;
      case "rotation.z":
        updateLayerRotationCoordinate(layer.id, "z", rawValue);
        return;
      case "scale.uniform":
        updateLayerUniformScale(layer.id, rawValue);
        return;
      case "opacity":
        updateLayerOpacity(layer.id, rawValue);
        return;
      default:
        return;
    }
  };

  const beginTimelinePropertyEdit = (layer: LayerItem, propertyId: string) => {
    if (propertyId.startsWith("position.")) beginLayerTransform(layer.id);
    else if (propertyId.startsWith("rotation.")) beginLayerRotation(layer.id);
    else if (propertyId === "scale.uniform") beginLayerScale(layer.id);
  };

  const commitTimelinePropertyEdit = (layer: LayerItem, propertyId: string) => {
    if (propertyId.startsWith("position.")) commitLayerTransform(layer.id);
    else if (propertyId.startsWith("rotation.")) commitLayerRotation(layer.id);
    else if (propertyId === "scale.uniform") commitLayerScale(layer.id);
    else if (propertyId === "opacity") commitLayerOpacity(layer.id);
  };

  useEffect(() => {
    applyTimelinePropertyValueRef.current = applyTimelinePropertyValue;
    commitTimelinePropertyEditRef.current = commitTimelinePropertyEdit;
  });

  const startTimelineModifierDrag = (
    event: React.PointerEvent<HTMLSpanElement>,
    layer: LayerItem,
    propertyId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    beginTimelinePropertyEdit(layer, propertyId);
    timelineModifierDragRef.current = {
      layerId: layer.id,
      propertyId,
      startX: event.clientX,
      startValue: getTimelinePropertyValue(layer, propertyId),
    };
  };

  const readCurrentCameraView = (): CameraView | null => {
    const controls = orbitControlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return null;
    return {
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      fov: camera.fov,
      zoom: camera.zoom,
    };
  };

  const applyCameraView = (view: CameraView) => {
    const controls = orbitControlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    camera.position.set(view.position[0], view.position[1], view.position[2]);
    camera.fov = view.fov;
    camera.zoom = view.zoom;
    camera.updateProjectionMatrix();
    controls.target.set(view.target[0], view.target[1], view.target[2]);
    controls.update();
  };

  const selectLayer = (layerId: string) => {
    if (!layerObjectMapRef.current.get(layerId)) {
      setSelectedLayerId(null);
      return;
    }
    setSelectedLayerId(layerId);
  };

  const loadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setErrorMessage("Please choose a valid .glb file.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const loadId = ++loadIdRef.current;

    const previousScene = modelScene;
    setFileName(file.name);

    try {
      const stableFile = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });
      const buffer = await readFileBuffer(stableFile);
      const loader = new GLTFLoader();

      loader.parse(
        buffer,
        "",
        (gltf) => {
          if (loadId !== loadIdRef.current) return;
          setModelScene(gltf.scene);
          const { items, objectMap } = getLayerItems(gltf.scene);
          setLayerItems(items);
          layerObjectMapRef.current = objectMap;
          setSelectedLayerId(null);
          setRenamingLayerId(null);
          setRenameValue("");
          setLayerDetailsOpen({});
          setLayerSectionOpen({});
          setCollapsedGroupIds(new Set());
          setTimelineExpandedLayerIds(new Set());
          setAnimationTracks([]);
          setViewMode("edit");
          setCameraView(DEFAULT_CAMERA_VIEW);
          const emptyDeleted = new Set<string>();
          setDeletedLayerIds(emptyDeleted);
          deletedLayerIdsRef.current = emptyDeleted;
          setHasUnsavedChanges(false);
          const initialSnapshot: LayerSnapshot = {};
          objectMap.forEach((object, id) => {
            initialSnapshot[id] = {
              name: object.name,
              visible: object.visible,
              deleted: false,
              opacity: getObjectOpacity(object),
              position: {
                x: object.position.x,
                y: object.position.y,
                z: object.position.z,
              },
              rotation: {
                x: object.rotation.x,
                y: object.rotation.y,
                z: object.rotation.z,
              },
              scale: {
                x: object.scale.x,
                y: object.scale.y,
                z: object.scale.z,
              },
            };
          });
          commitHistoryState(
            [
              {
                id: `${Date.now()}-init`,
                label: "Initial state",
                snapshot: initialSnapshot,
              },
            ],
            0
          );
          pendingTransformLayerIdsRef.current.clear();
          pendingScaleLayerIdsRef.current.clear();
          pendingRotationLayerIdsRef.current.clear();
          if (previousScene) disposeScene(previousScene);
          setUploadOpen(false);
          setLayersOpen(true);
          setIsLoading(false);
        },
        (error) => {
          if (loadId !== loadIdRef.current) return;
          setErrorMessage(error instanceof Error ? error.message : "Could not parse this .glb file.");
          setIsLoading(false);
        }
      );
    } catch (error) {
      if (loadId !== loadIdRef.current) return;
      const reason = error instanceof Error ? error.message : "Unknown read error";
      const notFound = error instanceof DOMException && error.name === "NotFoundError";
      setErrorMessage(
        notFound
          ? "Failed to read file: File became unavailable during drop. Try the Select button or download locally first."
          : `Failed to read file: ${reason}`
      );
      setIsLoading(false);
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0] ?? event.dataTransfer.items?.[0]?.getAsFile();
    if (file) void loadFile(file);
  };

  const onFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void loadFile(file);
    event.target.value = "";
  };

  const updatePointLight = (id: string, patch: Partial<PointLightConfig>) => {
    setHasUnsavedChanges(true);
    setPointLights((prev) => prev.map((l) => (l.id === id ? sanitizePointLight({ ...l, ...patch }, 0) : l)));
  };

  const addPointLight = () => {
    setHasUnsavedChanges(true);
    setPointLights((prev) => {
      if (prev.length >= MAX_POINT_LIGHTS) return prev;
      return [...prev, createDefaultPointLight(prev.length)];
    });
  };

  const removePointLight = (id: string) => {
    setHasUnsavedChanges(true);
    setPointLights((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((l) => l.id !== id);
    });
  };

  const applyConfigFromText = () => {
    try {
      const parsed = JSON.parse(configText) as ConfigPayload;
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON root.");
      if (!parsed.settings || !parsed.pointLights) throw new Error("JSON requires settings and pointLights.");

      const mergedSettings = clampSettings({ ...DEFAULT_SETTINGS, ...parsed.settings });
      const mergedLights = (Array.isArray(parsed.pointLights) ? parsed.pointLights : [])
        .slice(0, MAX_POINT_LIGHTS)
        .map((light, i) => sanitizePointLight(light, i));

      setSettings(mergedSettings);
      setPointLights(mergedLights.length > 0 ? mergedLights : [createDefaultPointLight(0)]);
      setConfigDirty(false);
      setHasUnsavedChanges(true);
      setConfigMessage("Config applied.");
    } catch (error) {
      setConfigMessage(`Invalid config: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(configText);
      setConfigMessage("Config copied to clipboard.");
    } catch {
      setConfigMessage("Copy failed. Browser denied clipboard access.");
    }
  };

  const saveConfigLocal = () => {
    localStorage.setItem(CONFIG_STORAGE_KEY, configText);
    setConfigMessage("Config saved locally.");
  };

  const loadConfigLocal = () => {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!saved) {
      setConfigMessage("No saved config found.");
      return;
    }
    setConfigText(saved);
    setConfigDirty(true);
    setHasUnsavedChanges(true);
    setConfigMessage("Saved config loaded into editor. Click Apply.");
  };

  const formatConfig = () => {
    try {
      const parsed = JSON.parse(configText);
      setConfigText(JSON.stringify(parsed, null, 2));
      setConfigDirty(true);
      setConfigMessage("JSON formatted.");
    } catch (error) {
      setConfigMessage(`Invalid config: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const configStatusTone =
    configMessage && !configMessage.toLowerCase().startsWith("invalid") && !configMessage.toLowerCase().startsWith("copy failed")
      ? "success"
      : configMessage
        ? "error"
        : null;

  const captureLayerSnapshot = (): LayerSnapshot => {
    const snapshot: LayerSnapshot = {};
    layerObjectMapRef.current.forEach((object, id) => {
      snapshot[id] = {
        name: object.name,
        visible: object.visible,
        deleted: deletedLayerIdsRef.current.has(id),
        opacity: getObjectOpacity(object),
        position: {
          x: object.position.x,
          y: object.position.y,
          z: object.position.z,
        },
        rotation: {
          x: object.rotation.x,
          y: object.rotation.y,
          z: object.rotation.z,
        },
        scale: {
          x: object.scale.x,
          y: object.scale.y,
          z: object.scale.z,
        },
      };
    });
    return snapshot;
  };

  const refreshLayerItemsFromScene = () => {
    setLayerItems((prev) =>
      prev.map((layer) => {
        const object = layerObjectMapRef.current.get(layer.id);
        if (!object) return layer;
        return {
          ...layer,
          name: object.name.trim() || layer.name,
          visible: object.visible,
          opacity: getObjectOpacity(object),
          ...getObjectPositionInfo(object),
          ...getObjectRotationInfo(object),
          ...getObjectScaleInfo(object),
        };
      })
    );
  };

  const pushHistory = (label: string) => {
    const snapshot = captureLayerSnapshot();
    const base = historyEntriesRef.current.slice(0, historyIndexRef.current + 1);
    let next = [
      ...base,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        snapshot,
      },
    ];
    const maxEntries = 40;
    if (next.length > maxEntries) {
      next = next.slice(next.length - maxEntries);
    }
    commitHistoryState(next, next.length - 1);
    setHasUnsavedChanges(true);
  };

  const applyLayerSnapshot = (snapshot: LayerSnapshot) => {
    const deleted = new Set<string>();
    Object.entries(snapshot).forEach(([id, value]) => {
      const object = layerObjectMapRef.current.get(id);
      if (!object) return;
      object.name = value.name || object.name;
      object.visible = value.visible;
      setObjectOpacity(object, value.opacity ?? 1);
      object.position.set(value.position.x, value.position.y, value.position.z);
      object.rotation.set(
        value.rotation?.x ?? object.rotation.x,
        value.rotation?.y ?? object.rotation.y,
        value.rotation?.z ?? object.rotation.z,
        object.rotation.order
      );
      object.scale.set(value.scale?.x ?? 1, value.scale?.y ?? 1, value.scale?.z ?? 1);
      object.updateMatrixWorld();
      if (value.deleted) {
        deleted.add(id);
      }
    });
    deletedLayerIdsRef.current = deleted;
    setDeletedLayerIds(deleted);
    if (selectedLayerId && deleted.has(selectedLayerId)) {
      setSelectedLayerId(null);
    }
    refreshLayerItemsFromScene();
    setHasUnsavedChanges(true);
  };

  const jumpToHistoryIndex = (index: number) => {
    const entry = historyEntriesRef.current[index];
    if (!entry) return;
    historyIndexRef.current = index;
    setHistoryIndex(index);
    applyLayerSnapshot(entry.snapshot);
  };

  const undoLayerChange = () => {
    if (historyIndexRef.current <= 0) return;
    jumpToHistoryIndex(historyIndexRef.current - 1);
  };

  const redoLayerChange = () => {
    if (historyIndexRef.current >= historyEntriesRef.current.length - 1) return;
    jumpToHistoryIndex(historyIndexRef.current + 1);
  };

  const resetLayerChanges = () => {
    jumpToHistoryIndex(0);
  };

  const enterAnimateMode = () => {
    const view = readCurrentCameraView();
    if (view) {
      setCameraView(view);
    }
    setViewMode("animate");
    const container = viewerRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  const enterEditMode = () => {
    setViewMode("edit");
    const container = viewerRef.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: "auto" });
    }
  };

  useEffect(() => {
    undoActionRef.current = undoLayerChange;
    redoActionRef.current = redoLayerChange;
  });

  useEffect(() => {
    const isTypingElement = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        el.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!hasModel) return;
      if (isTypingElement(event.target)) return;
      const key = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;

      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoActionRef.current();
          return;
        }
        undoActionRef.current();
        return;
      }

      if (key === "y") {
        event.preventDefault();
        redoActionRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasModel]);

  const deleteLayer = (layerId: string) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    const layerName = getLayerName(layerId);

    const idsToDelete: string[] = [];
    object.traverse((child) => {
      idsToDelete.push(child.uuid);
      child.visible = false;
      child.updateMatrixWorld();
    });
    const nextDeleted = new Set(deletedLayerIdsRef.current);
    idsToDelete.forEach((id) => nextDeleted.add(id));
    deletedLayerIdsRef.current = nextDeleted;
    setDeletedLayerIds(nextDeleted);
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      idsToDelete.forEach((id) => next.delete(id));
      return next;
    });
    setTimelineExpandedLayerIds((prev) => {
      const next = new Set(prev);
      idsToDelete.forEach((id) => next.delete(id));
      return next;
    });

    if (selectedLayerId && idsToDelete.includes(selectedLayerId)) {
      setSelectedLayerId(null);
    }
    if (renamingLayerId && idsToDelete.includes(renamingLayerId)) {
      setRenamingLayerId(null);
      setRenameValue("");
    }
    refreshLayerItemsFromScene();
    pushHistory(`Delete: ${layerName}`);
  };

  const duplicateLayer = (layerId: string) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object || !object.parent || !modelScene) return;
    const layerName = getLayerName(layerId);
    const originalBounds = new THREE.Box3().setFromObject(object);
    const originalSize = new THREE.Vector3();
    originalBounds.getSize(originalSize);
    const offset = Math.max(Math.max(originalSize.x, originalSize.y, originalSize.z) * 0.15, 0.05);

    const clone = object.clone(true);
    clone.name = `${layerName} Copy`;
    clone.position.x += offset;
    object.parent.add(clone);
    clone.updateMatrixWorld(true);

    const { items, objectMap } = getLayerItems(modelScene);
    setLayerItems(items);
    layerObjectMapRef.current = objectMap;
    setLayerMessage("Layer duplicated.");
    pushHistory(`Duplicate: ${layerName}`);
  };

  const setLayerVisibility = (layerId: string, visible: boolean) => {
    const layerName = getLayerName(layerId);
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    object.visible = visible;
    const opacity = getObjectOpacity(object);
    if (!visible && selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
    setLayerItems((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible, opacity: Number(opacity.toFixed(3)) } : layer
      )
    );
    pushHistory(`Visibility: ${layerName} ${visible ? "On" : "Off"}`);
  };

  const syncLayerTransform = (layerId: string) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    const info = {
      ...getObjectPositionInfo(object),
      ...getObjectRotationInfo(object),
      ...getObjectScaleInfo(object),
    };
    setLayerItems((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, ...info } : layer))
    );
  };

  const updateLayerCoordinate = (layerId: string, axis: "x" | "y" | "z", rawValue: string) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    const value = Number(rawValue);
    if (Number.isNaN(value)) return;
    object.position[axis] = value;
    object.updateMatrixWorld();
    syncLayerTransform(layerId);
    setHasUnsavedChanges(true);
  };

  const updateLayerUniformScale = (layerId: string, rawValue: string) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    const value = Number(rawValue);
    if (Number.isNaN(value)) return;
    setObjectUniformScaleFromCenter(object, value);
    syncLayerTransform(layerId);
    setHasUnsavedChanges(true);
  };

  const updateLayerRotationCoordinate = (
    layerId: string,
    axis: "x" | "y" | "z",
    rawValue: string
  ) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    const value = Number(rawValue);
    if (Number.isNaN(value)) return;
    const rounded = Number(value.toFixed(2));
    const current = getObjectRotationInfo(object).rotation;
    const nextRotation = {
      x: axis === "x" ? rounded : current.x,
      y: axis === "y" ? rounded : current.y,
      z: axis === "z" ? rounded : current.z,
    };
    setObjectRotationFromCenter(object, nextRotation);
    syncLayerTransform(layerId);
    setHasUnsavedChanges(true);
  };

  const updateLayerOpacity = (layerId: string, rawValue: string) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    const value = Number(rawValue);
    if (Number.isNaN(value)) return;
    const opacity = THREE.MathUtils.clamp(value, 0, 1);
    setObjectOpacity(object, opacity);
    object.updateMatrixWorld();
    setLayerItems((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, opacity: Number(opacity.toFixed(3)) } : layer
      )
    );
  };

  const commitLayerOpacity = (layerId: string) => {
    pushHistory(`Opacity: ${getLayerName(layerId)}`);
  };

  const beginLayerTransform = (layerId: string) => {
    pendingTransformLayerIdsRef.current.add(layerId);
  };

  const commitLayerTransform = (layerId: string) => {
    if (!pendingTransformLayerIdsRef.current.has(layerId)) return;
    pendingTransformLayerIdsRef.current.delete(layerId);
    pushHistory(`Move: ${getLayerName(layerId)}`);
  };

  const beginLayerScale = (layerId: string) => {
    pendingScaleLayerIdsRef.current.add(layerId);
  };

  const commitLayerScale = (layerId: string) => {
    if (!pendingScaleLayerIdsRef.current.has(layerId)) return;
    pendingScaleLayerIdsRef.current.delete(layerId);
    pushHistory(`Scale: ${getLayerName(layerId)}`);
  };

  const beginLayerRotation = (layerId: string) => {
    pendingRotationLayerIdsRef.current.add(layerId);
  };

  const commitLayerRotation = (layerId: string) => {
    if (!pendingRotationLayerIdsRef.current.has(layerId)) return;
    pendingRotationLayerIdsRef.current.delete(layerId);
    pushHistory(`Rotate: ${getLayerName(layerId)}`);
  };

  const startRenameLayer = (layerId: string) => {
    const layer = layerItems.find((item) => item.id === layerId);
    if (!layer) return;
    setRenamingLayerId(layerId);
    setRenameValue(layer.name);
  };

  const cancelRenameLayer = () => {
    setRenamingLayerId(null);
    setRenameValue("");
  };

  const commitRenameLayer = (layerId: string) => {
    const nextName = renameValue.trim();
    if (!nextName) {
      cancelRenameLayer();
      return;
    }
    const currentName = getLayerName(layerId);
    if (nextName === currentName) {
      cancelRenameLayer();
      return;
    }
    setLayerItems((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, name: nextName } : layer))
    );
    const object = layerObjectMapRef.current.get(layerId);
    if (object) object.name = nextName;
    cancelRenameLayer();
    pushHistory(`Rename: ${nextName}`);
    setLayerMessage("Layer renamed.");
  };

  const exportCurrentModel = () => {
    if (!modelScene) return;
    const exporter = new GLTFExporter();
    const clone = modelScene.clone(true);

    exporter.parse(
      clone,
      (result) => {
        let blob: Blob;
        let fileName = "model-export.glb";

        if (result instanceof ArrayBuffer) {
          blob = new Blob([result], { type: "model/gltf-binary" });
        } else {
          blob = new Blob([JSON.stringify(result, null, 2)], {
            type: "application/json",
          });
          fileName = "model-export.gltf";
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setHasUnsavedChanges(false);
        setLayerMessage("Model exported.");
      },
      () => {
        setLayerMessage("Failed to export model.");
      },
      { binary: true, onlyVisible: true, includeCustomExtensions: true }
    );
  };

  const uploadPanel = (
    <div
      className={cn(
        "space-y-3 rounded-md border border-dashed p-3 transition",
        isDragging ? "border-primary" : "border-border"
      )}
    >
      <p className="text-xs text-muted-foreground">Drag/drop a file or pick one from disk.</p>
      <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
        Select .glb file
      </Button>
      <input ref={inputRef} type="file" accept=".glb" onChange={onFilePick} className="hidden" />
      {fileName ? (
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Loading" : "Loaded"}: {fileName}
        </p>
      ) : null}
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
    </div>
  );

  const historyPanel = (
    <div className="space-y-2">
      {historyEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground">No history yet.</p>
      ) : (
        <div className="max-h-[28vh] space-y-1 overflow-y-auto pr-1">
          {historyEntries.map((entry, index) => {
            const isCurrent = index === historyIndex;
            const isFuture = index > historyIndex;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => jumpToHistoryIndex(index)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs transition",
                  isCurrent ? "border-primary bg-primary/10" : "border-border bg-background/60",
                  isFuture ? "opacity-45" : ""
                )}
              >
                <span className="truncate">{entry.label}</span>
                <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">#{index}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const layersPanel = (
    <div className="space-y-3">
      {(() => {
        const byId = new Map(layerItems.map((layer) => [layer.id, layer]));
        const visibleLayerItems = layerItems.filter((layer) => {
          if (deletedLayerIds.has(layer.id)) return false;
          let currentParentId = layer.parentId;
          while (currentParentId) {
            if (collapsedGroupIds.has(currentParentId)) return false;
            const parent = byId.get(currentParentId);
            currentParentId = parent?.parentId ?? null;
          }
          return true;
        });

        if (visibleLayerItems.length === 0) {
          return <p className="text-xs text-muted-foreground">No layers found for this model.</p>;
        }

        return (
          <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {visibleLayerItems.map((layer) => (
              <div key={layer.id} className="space-y-1">
                <div
                  className={cn(
                    "flex items-center justify-between rounded-md border px-2 py-1.5",
                    selectedLayerId === layer.id ? "border-primary bg-primary/5" : ""
                  )}
                  style={{ marginLeft: `${Math.min(layer.depth, 6) * 10}px` }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setLayerContextMenu({
                      layerId: layer.id,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                >
                  {layer.hasChildren ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mr-1 h-6 w-6 p-0"
                      onClick={(event) => {
                        event.stopPropagation();
                        setCollapsedGroupIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(layer.id)) {
                            next.delete(layer.id);
                          } else {
                            next.add(layer.id);
                          }
                          return next;
                        });
                      }}
                      title={collapsedGroupIds.has(layer.id) ? "Expand group" : "Collapse group"}
                    >
                      {collapsedGroupIds.has(layer.id) ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  ) : (
                    <span className="mr-1 inline-block h-6 w-6" />
                  )}

                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col pr-2 text-left"
                    onClick={() => {
                      selectLayer(layer.id);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      startRenameLayer(layer.id);
                    }}
                  >
                    {renamingLayerId === layer.id ? (
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={() => commitRenameLayer(layer.id)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRenameLayer(layer.id);
                          } else if (event.key === "Escape") {
                            event.preventDefault();
                            cancelRenameLayer();
                          }
                        }}
                        className="h-7 w-full text-xs"
                      />
                    ) : (
                      <p className="truncate text-xs font-medium" title={layer.name}>
                        {layer.name}
                      </p>
                    )}
                    {renamingLayerId === layer.id ? null : (
                      <p className="truncate text-[11px] text-muted-foreground" title={layer.type}>
                        {layer.type}
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        const nextOpen = !layerDetailsOpen[layer.id];
                        setLayerDetailsOpen((prev) => ({
                          ...prev,
                          [layer.id]: nextOpen,
                        }));
                        if (nextOpen) {
                          setLayerSectionOpen((prev) => ({
                            ...prev,
                            [`${layer.id}:position`]:
                              prev[`${layer.id}:position`] ?? false,
                            [`${layer.id}:rotation`]:
                              prev[`${layer.id}:rotation`] ?? false,
                            [`${layer.id}:scale`]:
                              prev[`${layer.id}:scale`] ?? false,
                            [`${layer.id}:opacity`]:
                              prev[`${layer.id}:opacity`] ?? false,
                          }));
                        }
                      }}
                    >
                      {layerDetailsOpen[layer.id] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Switch
                      checked={layer.visible}
                      onCheckedChange={(checked) => setLayerVisibility(layer.id, checked)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteLayer(layer.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {layerDetailsOpen[layer.id] ? (
                  <div
                    className="space-y-1 rounded-md border bg-background/70 p-2"
                    style={{ marginLeft: `${Math.min(layer.depth, 6) * 10}px` }}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full justify-between"
                      onClick={() =>
                        setLayerSectionOpen((prev) => ({
                          ...prev,
                          [`${layer.id}:position`]: !prev[`${layer.id}:position`],
                        }))
                      }
                    >
                      <span className="text-xs">Position</span>
                      {layerSectionOpen[`${layer.id}:position`] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {layerSectionOpen[`${layer.id}:position`] ? (
                      <div className="space-y-1 pt-1">
                        <p className="text-[11px] text-muted-foreground">
                          Local: X {layer.position.x}, Y {layer.position.y}, Z {layer.position.z}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          World: X {layer.worldPosition.x}, Y {layer.worldPosition.y}, Z {layer.worldPosition.z}
                        </p>
                        <div className="grid grid-cols-3 gap-1 pt-1">
                          <ScrubbableNumberField
                            label="X"
                            value={layer.position.x}
                            onBeginChange={() => beginLayerTransform(layer.id)}
                            onEndChange={() => commitLayerTransform(layer.id)}
                            onValueChange={(next) => updateLayerCoordinate(layer.id, "x", next.toString())}
                          />
                          <ScrubbableNumberField
                            label="Y"
                            value={layer.position.y}
                            onBeginChange={() => beginLayerTransform(layer.id)}
                            onEndChange={() => commitLayerTransform(layer.id)}
                            onValueChange={(next) => updateLayerCoordinate(layer.id, "y", next.toString())}
                          />
                          <ScrubbableNumberField
                            label="Z"
                            value={layer.position.z}
                            onBeginChange={() => beginLayerTransform(layer.id)}
                            onEndChange={() => commitLayerTransform(layer.id)}
                            onValueChange={(next) => updateLayerCoordinate(layer.id, "z", next.toString())}
                          />
                        </div>
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-1 w-full justify-between"
                      onClick={() =>
                        setLayerSectionOpen((prev) => ({
                          ...prev,
                          [`${layer.id}:rotation`]: !prev[`${layer.id}:rotation`],
                        }))
                      }
                    >
                      <span className="text-xs">Rotation (deg)</span>
                      {layerSectionOpen[`${layer.id}:rotation`] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {layerSectionOpen[`${layer.id}:rotation`] ? (
                      <div className="space-y-1 pt-1">
                        <div className="grid grid-cols-3 gap-1 pt-1">
                          <ScrubbableNumberField
                            label="X"
                            value={layer.rotation.x}
                            onBeginChange={() => beginLayerRotation(layer.id)}
                            onEndChange={() => commitLayerRotation(layer.id)}
                            inputStep="1"
                            dragStep={1}
                            dragPixelsPerStep={8}
                            dragDecimals={2}
                            onValueChange={(next) =>
                              updateLayerRotationCoordinate(layer.id, "x", next.toString())
                            }
                          />
                          <ScrubbableNumberField
                            label="Y"
                            value={layer.rotation.y}
                            onBeginChange={() => beginLayerRotation(layer.id)}
                            onEndChange={() => commitLayerRotation(layer.id)}
                            inputStep="1"
                            dragStep={1}
                            dragPixelsPerStep={8}
                            dragDecimals={2}
                            onValueChange={(next) =>
                              updateLayerRotationCoordinate(layer.id, "y", next.toString())
                            }
                          />
                          <ScrubbableNumberField
                            label="Z"
                            value={layer.rotation.z}
                            onBeginChange={() => beginLayerRotation(layer.id)}
                            onEndChange={() => commitLayerRotation(layer.id)}
                            inputStep="1"
                            dragStep={1}
                            dragPixelsPerStep={8}
                            dragDecimals={2}
                            onValueChange={(next) =>
                              updateLayerRotationCoordinate(layer.id, "z", next.toString())
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-1 w-full justify-between"
                      onClick={() =>
                        setLayerSectionOpen((prev) => ({
                          ...prev,
                          [`${layer.id}:scale`]: !prev[`${layer.id}:scale`],
                        }))
                      }
                    >
                      <span className="text-xs">Scale</span>
                      {layerSectionOpen[`${layer.id}:scale`] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {layerSectionOpen[`${layer.id}:scale`] ? (
                      <div className="space-y-2 pt-1">
                        <ScrubbableNumberField
                          label="Uniform"
                          value={layer.scale.x}
                          onBeginChange={() => beginLayerScale(layer.id)}
                          onEndChange={() => commitLayerScale(layer.id)}
                          onValueChange={(next) =>
                            updateLayerUniformScale(layer.id, next.toString())
                          }
                        />
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="mt-1 w-full justify-between"
                      onClick={() =>
                        setLayerSectionOpen((prev) => ({
                          ...prev,
                          [`${layer.id}:opacity`]: !prev[`${layer.id}:opacity`],
                        }))
                      }
                    >
                      <span className="text-xs">Opacity</span>
                      {layerSectionOpen[`${layer.id}:opacity`] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {layerSectionOpen[`${layer.id}:opacity`] ? (
                      <div className="space-y-2 pt-1">
                        <SliderField
                          label="Opacity"
                          value={layer.opacity}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(next) => updateLayerOpacity(layer.id, next.toString())}
                          onCommit={() => commitLayerOpacity(layer.id)}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );

  return (
    <div
      ref={viewerRef}
      className="relative h-screen w-screen overflow-hidden"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      <div className="absolute inset-0">
        {hasModel ? (
          <Canvas>
            <PerspectiveCamera
              ref={cameraRef}
              makeDefault
              position={cameraView.position}
              fov={cameraView.fov}
              near={0.001}
              far={100000}
            />
            <color attach="background" args={[settings.backgroundColor]} />

            {settings.useAmbientLight ? <ambientLight intensity={settings.ambientIntensity} /> : null}
            {settings.useDirectionalLight ? (
              <directionalLight
                position={[settings.directionalX, settings.directionalY, settings.directionalZ]}
                intensity={settings.directionalIntensity}
              />
            ) : null}
            {pointLights.map((light) =>
              light.enabled ? (
                <pointLight
                  key={light.id}
                  position={[light.x, light.y, light.z]}
                  intensity={light.intensity}
                  distance={light.distance}
                  decay={light.decay}
                  color={light.color}
                />
              ) : null
            )}

            <SceneGrid
              show={settings.showGrid && viewMode === "edit"}
              size={20}
              divisions={20}
              fadeDistance={30}
            />

            <Bounds fit clip={false} observe={false} margin={1.1}>
              <Center>
                <primitive object={modelScene} dispose={null} />
              </Center>
            </Bounds>
            <OrbitControls
              ref={orbitControlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.1}
              minDistance={0.02}
              maxDistance={100000}
              enabled={viewMode === "edit"}
              enableRotate={viewMode === "edit"}
              enablePan={viewMode === "edit"}
              enableZoom={viewMode === "edit" && settings.orbitEnableZoom}
              autoRotate={viewMode === "edit" && settings.orbitAutoRotate}
            />
          </Canvas>
        ) : (
          <div className="h-full bg-[#0b0f13]" />
        )}
      </div>

      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-30 border-2 border-dashed border-primary/70 bg-primary/10" />
      ) : null}

      {!hasModel ? <div className="absolute inset-0 z-40 flex items-center justify-center p-4">{uploadPanel}</div> : null}

      {hasModel ? (
        <aside className="absolute left-4 top-4 z-40 w-[340px] space-y-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={undoLayerChange}
              disabled={undoCount === 0}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Undo
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={resetLayerChanges}
              disabled={undoCount === 0}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={redoLayerChange}
              disabled={redoCount === 0}
            >
              <Redo2 className="mr-2 h-4 w-4" />
              Redo
            </Button>
            <Button size="sm" variant="secondary" onClick={exportCurrentModel}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
          {layerMessage ? <p className="text-xs text-muted-foreground">{layerMessage}</p> : null}

          {viewMode === "edit" ? (
            <>
              <Card className="bg-card/95 backdrop-blur">
                <CardHeader className="py-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={() => setUploadOpen((prev) => !prev)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <PanelLeft className="h-4 w-4" />
                      Upload
                    </span>
                    {uploadOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                {uploadOpen ? <CardContent className="pt-0">{uploadPanel}</CardContent> : null}
              </Card>

              <Card className="bg-card/95 backdrop-blur">
                <CardHeader className="py-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={() => setHistoryOpen((prev) => !prev)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <History className="h-4 w-4" />
                      History
                    </span>
                    {historyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                {historyOpen ? <CardContent className="pt-0">{historyPanel}</CardContent> : null}
              </Card>

              <Card className="bg-card/95 backdrop-blur">
                <CardHeader className="py-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={() => setLayersOpen((prev) => !prev)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Layers3 className="h-4 w-4" />
                      Layers
                    </span>
                    {layersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                {layersOpen ? <CardContent className="pt-0">{layersPanel}</CardContent> : null}
              </Card>
            </>
          ) : null}
        </aside>
      ) : null}

      {hasModel ? (
        <aside className="absolute right-4 top-4 z-40 w-full max-w-md space-y-2">
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant={viewMode === "edit" ? "default" : "secondary"}
              onClick={enterEditMode}
            >
              Orbit
            </Button>
            <Button
              size="sm"
              variant={viewMode === "animate" ? "default" : "secondary"}
              onClick={enterAnimateMode}
            >
              Animate
            </Button>
          </div>

          <Card className="bg-card/95 backdrop-blur">
            <CardHeader className="py-3">
              <Button
                type="button"
                variant="secondary"
                className="w-full justify-between"
                onClick={() => setShowCustomize((prev) => !prev)}
              >
                <span className="inline-flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Customize
                </span>
                {showCustomize ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </CardHeader>
            {showCustomize ? (
              <CardContent className="max-h-[calc(100vh-7rem)] space-y-6 overflow-y-auto pt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Globe2 className="h-5 w-5" />
                  Environment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ColorField
                  label="Background color"
                  value={settings.backgroundColor}
                  onChange={(value) => patchSettings({ backgroundColor: value })}
                />
                <ToggleField
                  label="Show grid"
                  checked={settings.showGrid}
                  onChange={(v) => patchSettings({ showGrid: v })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Camera className="h-5 w-5" />
                  Navigation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ToggleField
                  label="Enable zoom"
                  checked={settings.orbitEnableZoom}
                  onChange={(v) => patchSettings({ orbitEnableZoom: v })}
                />
                <ToggleField
                  label="Auto rotate"
                  checked={settings.orbitAutoRotate}
                  onChange={(v) => patchSettings({ orbitAutoRotate: v })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Lightbulb className="h-5 w-5" />
                  Lighting
                </CardTitle>
                <Button size="sm" variant="secondary" onClick={addPointLight} disabled={pointLights.length >= MAX_POINT_LIGHTS}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add light
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <ToggleField
                  label="Ambient enabled"
                  checked={settings.useAmbientLight}
                  onChange={(v) => patchSettings({ useAmbientLight: v })}
                />
                <SliderField
                  label="Ambient intensity"
                  value={settings.ambientIntensity}
                  min={0}
                  max={3}
                  step={0.05}
                  onChange={(v) => patchSettings({ ambientIntensity: v })}
                />
                <ToggleField
                  label="Directional enabled"
                  checked={settings.useDirectionalLight}
                  onChange={(v) => patchSettings({ useDirectionalLight: v })}
                />
                <SliderField
                  label="Directional intensity"
                  value={settings.directionalIntensity}
                  min={0}
                  max={5}
                  step={0.05}
                  onChange={(v) => patchSettings({ directionalIntensity: v })}
                />
                <SliderField
                  label="Directional X"
                  value={settings.directionalX}
                  min={-30}
                  max={30}
                  step={0.5}
                  onChange={(v) => patchSettings({ directionalX: v })}
                />
                <SliderField
                  label="Directional Y"
                  value={settings.directionalY}
                  min={-30}
                  max={30}
                  step={0.5}
                  onChange={(v) => patchSettings({ directionalY: v })}
                />
                <SliderField
                  label="Directional Z"
                  value={settings.directionalZ}
                  min={-30}
                  max={30}
                  step={0.5}
                  onChange={(v) => patchSettings({ directionalZ: v })}
                />

                {pointLights.map((light, index) => (
                  <Card key={light.id} className="border-border/80">
                    <CardHeader className="flex-row items-center justify-between space-y-0">
                      <CardTitle>Point Light {index + 1}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={light.enabled}
                          onCheckedChange={(v) => updatePointLight(light.id, { enabled: v })}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => removePointLight(light.id)}
                          disabled={pointLights.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ColorField
                        label="Color"
                        value={light.color}
                        onChange={(value) => updatePointLight(light.id, { color: value })}
                      />
                      <SliderField
                        label="Intensity"
                        value={light.intensity}
                        min={0}
                        max={20}
                        step={0.05}
                        onChange={(v) => updatePointLight(light.id, { intensity: v })}
                      />
                      <SliderField
                        label="Distance"
                        value={light.distance}
                        min={0}
                        max={500}
                        step={1}
                        onChange={(v) => updatePointLight(light.id, { distance: v })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Distance 0 means no cutoff (infinite).
                      </p>
                      <SliderField
                        label="Decay"
                        value={light.decay}
                        min={0}
                        max={4}
                        step={0.1}
                        onChange={(v) => updatePointLight(light.id, { decay: v })}
                      />
                      <SliderField
                        label="X"
                        value={light.x}
                        min={-100}
                        max={100}
                        step={0.5}
                        onChange={(v) => updatePointLight(light.id, { x: v })}
                      />
                      <SliderField
                        label="Y"
                        value={light.y}
                        min={-100}
                        max={100}
                        step={0.5}
                        onChange={(v) => updatePointLight(light.id, { y: v })}
                      />
                      <SliderField
                        label="Z"
                        value={light.z}
                        min={-100}
                        max={100}
                        step={0.5}
                        onChange={(v) => updatePointLight(light.id, { z: v })}
                      />
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Code2 className="h-5 w-5" />
                  Variables (Editable JSON)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border bg-slate-50 p-2 shadow-inner dark:bg-zinc-950">
                  <div className="mb-2 flex justify-end">
                    <Button size="sm" variant="outline" onClick={formatConfig}>
                      <Code2 className="mr-2 h-4 w-4" />
                      Format JSON
                    </Button>
                  </div>
                  <Textarea
                    value={configText}
                    onChange={(e) => {
                      setConfigText(e.target.value);
                      setConfigDirty(true);
                      setHasUnsavedChanges(true);
                      setConfigMessage(null);
                    }}
                    rows={16}
                    className="font-mono shadow-inner"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={copyConfig}>
                    <Clipboard className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={saveConfigLocal}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Local
                  </Button>
                  <Button size="sm" variant="outline" onClick={loadConfigLocal}>
                    <Download className="mr-2 h-4 w-4" />
                    Load Local
                  </Button>
                  <Button size="sm" onClick={applyConfigFromText}>
                    <Check className="mr-2 h-4 w-4" />
                    Apply
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="justify-end">
                {configMessage ? (
                  <p
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
                      configStatusTone === "error" ? "text-red-500" : "text-muted-foreground"
                    )}
                  >
                    <Circle
                      className={cn(
                        "h-2.5 w-2.5",
                        configStatusTone === "success" ? "fill-green-500 text-green-500" : "fill-red-500 text-red-500"
                      )}
                    />
                    {configMessage}
                  </p>
                ) : null}
              </CardFooter>
            </Card>
              </CardContent>
            ) : null}
          </Card>
        </aside>
      ) : null}

      {hasModel && viewMode === "animate" ? (
        <aside className="pointer-events-none absolute bottom-0 left-0 right-0 z-40">
          <div
            className="pointer-events-auto mb-1 h-2 cursor-ns-resize rounded-sm bg-border/80"
            onPointerDown={(event) => {
              event.preventDefault();
              timelineResizeRef.current = {
                startY: event.clientY,
                startHeight: timelinePanelHeight,
              };
            }}
            title="Drag to resize timeline height"
          />
          <Card className="pointer-events-auto border bg-card/95 backdrop-blur">
            <CardContent className="space-y-3 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium">Timeline</div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="timeline-current-vh" className="text-xs text-muted-foreground">
                    Current (vh)
                  </Label>
                  <Input
                    id="timeline-current-vh"
                    type="number"
                    min={0}
                    max={timelineLengthVh}
                    step={0.01}
                    value={timelineCurrentVh}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      if (Number.isNaN(parsed)) return;
                      setTimelineSeekVh(parsed);
                    }}
                    className="h-8 w-24 text-xs"
                  />
                  <Label htmlFor="timeline-length" className="text-xs text-muted-foreground">
                    Length (vh)
                  </Label>
                  <Input
                    id="timeline-length"
                    type="number"
                    min={50}
                    max={5000}
                    step={10}
                    value={timelineLengthVh}
                    onChange={(event) => updateTimelineLengthVh(event.target.value)}
                    className="h-8 w-24 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => adjustTimelineZoom("out")}
                  >
                    -
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => adjustTimelineZoom("in")}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="rounded-md border bg-background/70">
                {(() => {
                  const timelineRows = getTimelineRows();
                  const trackWidth = Math.max(1200, timelineLengthVh * 3 * timelineZoom);
                  const markerStep =
                    timelineLengthVh <= 200 ? 25 : timelineLengthVh <= 500 ? 50 : 100;
                  const markerCount = Math.floor(timelineLengthVh / markerStep);
                  return (
                    <div className="overflow-auto" style={{ maxHeight: `${timelinePanelHeight}px` }}>
                      <div style={{ width: `${320 + trackWidth}px` }}>
                        <div className="sticky top-0 z-30 grid grid-cols-[320px_1fr] border-b bg-card">
                          <div className="sticky left-0 z-30 border-r bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground">
                            Layers
                          </div>
                          <div ref={timelineRulerRef} className="relative h-7 bg-card">
                            {Array.from({ length: markerCount + 1 }).map((_, index) => {
                              const valueVh = index * markerStep;
                              const left = (valueVh / timelineLengthVh) * 100;
                              return (
                                <div
                                  key={`marker-${valueVh}`}
                                  className="absolute bottom-0 top-0"
                                  style={{ left: `${left}%` }}
                                >
                                  <span className="absolute top-0 -translate-x-1/2 text-[10px] text-muted-foreground">
                                    {valueVh}vh
                                  </span>
                                  <span className="absolute bottom-0 top-3 w-px bg-border/70" />
                                </div>
                              );
                            })}
                            <span
                              className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-primary"
                              style={{ left: `${Math.max(0, Math.min(1, timelineProgress)) * 100}%` }}
                            />
                            <button
                              type="button"
                              className="absolute top-0 z-20 h-4 w-4 -translate-x-1/2 cursor-ew-resize"
                              style={{ left: `${Math.max(0, Math.min(1, timelineProgress)) * 100}%` }}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                timelineSeekDragRef.current = true;
                                if (timelineRulerRef.current) {
                                  const rect = timelineRulerRef.current.getBoundingClientRect();
                                  const ratio = THREE.MathUtils.clamp(
                                    (event.clientX - rect.left) / Math.max(1, rect.width),
                                    0,
                                    1
                                  );
                                  setTimelineSeekVh(ratio * timelineLengthVh);
                                }
                              }}
                              title="Drag playhead"
                            >
                              <span className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-primary" />
                            </button>
                          </div>
                        </div>

                        {timelineRows.map((row) => (
                          <div key={row.key} className="grid grid-cols-[320px_1fr] border-b last:border-b-0">
                            {row.kind === "layer" ? (
                              <div
                                className={cn(
                                  "sticky left-0 z-20 flex h-8 items-center gap-1 border-r bg-card px-2 text-xs",
                                  selectedLayerId === row.layer.id ? "bg-primary/10" : ""
                                )}
                                style={
                                  selectedLayerId === row.layer.id
                                    ? undefined
                                    : { backgroundColor: `rgba(100, 116, 139, ${getDepthShade(row.layer.depth)})` }
                                }
                              >
                                {row.layer.hasChildren ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setCollapsedGroupIds((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(row.layer.id)) next.delete(row.layer.id);
                                        else next.add(row.layer.id);
                                        return next;
                                      });
                                    }}
                                  >
                                    <span className="text-xs font-semibold leading-none">
                                      {collapsedGroupIds.has(row.layer.id) ? "+" : "-"}
                                    </span>
                                  </Button>
                                ) : (
                                  <span className="inline-block h-6 w-6" />
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={() =>
                                    setTimelineExpandedLayerIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(row.layer.id)) next.delete(row.layer.id);
                                      else next.add(row.layer.id);
                                      return next;
                                    })
                                  }
                                >
                                  {timelineExpandedLayerIds.has(row.layer.id) ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 truncate text-left"
                                  onClick={() => selectLayer(row.layer.id)}
                                  title={row.layer.name}
                                >
                                  <span
                                    className={cn(
                                      "block truncate",
                                      row.layer.depth > 0 ? "border-l-2 border-slate-500/70 pl-2" : ""
                                    )}
                                    style={{ marginLeft: `${Math.min(row.layer.depth, 6) * 10}px` }}
                                  >
                                    {row.layer.name}
                                  </span>
                                </button>
                                <Switch
                                  checked={row.layer.visible}
                                  onCheckedChange={(checked) => setLayerVisibility(row.layer.id, checked)}
                                />
                              </div>
                            ) : (
                              <div
                                className="sticky left-0 z-20 flex h-7 min-w-0 items-center gap-1 border-r bg-card px-2 text-[11px] text-muted-foreground"
                                style={{
                                  backgroundColor: `rgba(241, 245, 249, ${Math.max(0.18, getDepthShade(row.layer.depth) * 0.28)})`,
                                }}
                              >
                                <span className="inline-block w-6 shrink-0" />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 shrink-0 p-0"
                                  onClick={() =>
                                    toggleTrackAnimation(
                                      row.layer,
                                      row.propertyId,
                                      !hasTrackKeyframes(row.layer.id, row.propertyId)
                                    )
                                  }
                                  title={
                                    hasTrackKeyframes(row.layer.id, row.propertyId)
                                      ? "Disable animation (remove keyframes)"
                                      : "Enable animation"
                                  }
                                >
                                  <Clock3
                                    className={cn(
                                      "h-3.5 w-3.5",
                                      hasTrackKeyframes(row.layer.id, row.propertyId)
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                    )}
                                  />
                                </Button>
                                <div className="min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      "inline-flex min-w-0 items-center gap-1 truncate whitespace-nowrap",
                                      row.layer.depth > 0 ? "border-l-2 border-slate-500/70 pl-2" : "",
                                      "cursor-ew-resize select-none"
                                    )}
                                    style={{ marginLeft: `${Math.min(row.layer.depth + 1, 7) * 10}px` }}
                                    title="Drag left/right to change value"
                                    onPointerDown={(event) =>
                                      startTimelineModifierDrag(event, row.layer, row.propertyId)
                                    }
                                  >
                                    <span className="truncate whitespace-nowrap">{row.label}</span>
                                  </span>
                                </div>
                                <div className="flex w-[54px] shrink-0 items-center justify-end gap-0.5">
                                  {hasTrackKeyframes(row.layer.id, row.propertyId) ? (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-4 w-4 p-0"
                                        onClick={() => navigateTrackKeyframe(row.layer.id, row.propertyId, "prev")}
                                        title="Previous keyframe"
                                      >
                                        <ChevronLeft className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-4 w-4 p-0"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          upsertKeyframeAtCurrentTime(row.layer, row.propertyId);
                                        }}
                                        title={
                                          hasKeyframeAtCurrentTime(row.layer.id, row.propertyId)
                                            ? "Overwrite keyframe at current seek"
                                            : "Add keyframe at current seek"
                                        }
                                      >
                                        <Diamond
                                          className={cn(
                                            "h-2.5 w-2.5 rotate-45",
                                            hasKeyframeAtCurrentTime(row.layer.id, row.propertyId)
                                              ? "fill-primary text-primary"
                                              : "text-muted-foreground"
                                          )}
                                        />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-4 w-4 p-0"
                                        onClick={() => navigateTrackKeyframe(row.layer.id, row.propertyId, "next")}
                                        title="Next keyframe"
                                      >
                                        <ChevronRight className="h-3 w-3" />
                                      </Button>
                                    </>
                                  ) : null}
                                </div>
                                <Input
                                  type="number"
                                  step={getTimelinePropertyStep(row.propertyId)}
                                  value={getTimelinePropertyValue(row.layer, row.propertyId)}
                                  onFocus={() => beginTimelinePropertyEdit(row.layer, row.propertyId)}
                                  onBlur={() => commitTimelinePropertyEdit(row.layer, row.propertyId)}
                                  onChange={(event) =>
                                    applyTimelinePropertyValue(row.layer, row.propertyId, event.target.value)
                                  }
                                  className="h-6 w-16 shrink-0 text-[11px]"
                                />
                              </div>
                            )}

                            <div
                              className={cn(
                                "relative",
                                row.kind === "layer"
                                  ? "h-8 bg-[linear-gradient(to_right,transparent_0,transparent_calc(25%-1px),rgba(148,163,184,0.2)_25%,transparent_calc(25%+1px),transparent_calc(50%-1px),rgba(148,163,184,0.2)_50%,transparent_calc(50%+1px),transparent_calc(75%-1px),rgba(148,163,184,0.2)_75%,transparent_calc(75%+1px),transparent_100%)]"
                                  : "h-7 bg-[linear-gradient(to_right,transparent_0,transparent_calc(25%-1px),rgba(148,163,184,0.16)_25%,transparent_calc(25%+1px),transparent_calc(50%-1px),rgba(148,163,184,0.16)_50%,transparent_calc(50%+1px),transparent_calc(75%-1px),rgba(148,163,184,0.16)_75%,transparent_calc(75%+1px),transparent_100%)]"
                              )}
                              style={{
                                backgroundColor:
                                  row.kind === "layer"
                                    ? `rgba(100, 116, 139, ${getDepthShade(row.layer.depth) * 0.85})`
                                    : `rgba(241, 245, 249, ${Math.max(0.12, getDepthShade(row.layer.depth) * 0.22)})`,
                              }}
                              onClick={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                const ratio = THREE.MathUtils.clamp(
                                  (event.clientX - rect.left) / Math.max(1, rect.width),
                                  0,
                                  1
                                );
                                setTimelineSeekVh(ratio * timelineLengthVh);
                              }}
                            >
                              {row.kind === "property"
                                ? (() => {
                                    const track = getTrack(row.layer.id, row.propertyId);
                                    if (!track || track.keyframes.length === 0) return null;
                                    return track.keyframes.map((kf, idx) => (
                                      <span
                                        key={`kf-${row.layer.id}-${row.propertyId}-${idx}`}
                                        className={cn(
                                          "absolute top-1/2 h-2 w-2 -translate-y-1/2 -translate-x-1/2 rotate-45 border bg-background/95",
                                          Number(kf.atVh.toFixed(2)) === Number(timelineCurrentVh.toFixed(2))
                                            ? "border-primary bg-primary"
                                            : "border-muted-foreground/70"
                                        )}
                                        style={{
                                          left: `${THREE.MathUtils.clamp(
                                            kf.atVh / Math.max(1, timelineLengthVh),
                                            0,
                                            1
                                          ) * 100}%`,
                                        }}
                                      />
                                    ));
                                  })()
                                : null}
                              <span
                                className="pointer-events-none absolute bottom-0 top-0 w-[2px] bg-primary"
                                style={{ left: `${Math.max(0, Math.min(1, timelineProgress)) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </aside>
      ) : null}

      {layerContextMenu ? (
        <div
          className="fixed z-50 min-w-[180px] rounded-md border border-border bg-card p-1 shadow-lg"
          style={{ left: layerContextMenu.x, top: layerContextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="w-full rounded-sm px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent"
            onClick={() => {
              duplicateLayer(layerContextMenu.layerId);
              setLayerContextMenu(null);
            }}
          >
            Duplicate layer
          </button>
        </div>
      ) : null}
    </div>
  );
}
