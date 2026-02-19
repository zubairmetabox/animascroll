"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, Center, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  Box,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clipboard,
  Code2,
  Download,
  Globe2,
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
  name: string;
  type: string;
  depth: number;
  visible: boolean;
  position: { x: number; y: number; z: number };
  worldPosition: { x: number; y: number; z: number };
};

type LayerSnapshot = Record<
  string,
  {
    visible: boolean;
    position: { x: number; y: number; z: number };
  }
>;

const MAX_POINT_LIGHTS = 4;
const CONFIG_STORAGE_KEY = "glb_tool_viewer_config_v1";

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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
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
}: {
  label: string;
  value: number;
  onBeginChange?: () => void;
  onValueChange: (value: number) => void;
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
      const next = Number((drag.startValue + delta * 0.005).toFixed(3));
      onValueChange(next);
    };

    const handleUp = () => {
      if (dragRef.current) dragRef.current.active = false;
      dragRef.current = null;
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
        step="0.01"
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
      name,
      type: object.type,
      depth,
      visible: object.visible,
      ...getObjectPositionInfo(object),
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
  const [showCustomize, setShowCustomize] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(true);
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS);
  const [pointLights, setPointLights] = useState<PointLightConfig[]>([createDefaultPointLight(0)]);
  const [layerItems, setLayerItems] = useState<LayerItem[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerDetailsOpen, setLayerDetailsOpen] = useState<Record<string, boolean>>({});
  const [configText, setConfigText] = useState("");
  const [configDirty, setConfigDirty] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const loadIdRef = useRef(0);
  const layerObjectMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
  const undoStackRef = useRef<LayerSnapshot[]>([]);
  const redoStackRef = useRef<LayerSnapshot[]>([]);

  const hasModel = modelScene !== null;

  useEffect(() => {
    if (configDirty) return;
    const text = JSON.stringify({ settings, pointLights }, null, 2);
    setConfigText(text);
  }, [settings, pointLights, configDirty]);

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
          setLayerDetailsOpen({});
          undoStackRef.current = [];
          redoStackRef.current = [];
          setUndoCount(0);
          setRedoCount(0);
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
    setPointLights((prev) => prev.map((l) => (l.id === id ? sanitizePointLight({ ...l, ...patch }, 0) : l)));
  };

  const addPointLight = () => {
    setPointLights((prev) => {
      if (prev.length >= MAX_POINT_LIGHTS) return prev;
      return [...prev, createDefaultPointLight(prev.length)];
    });
  };

  const removePointLight = (id: string) => {
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
        visible: object.visible,
        position: {
          x: object.position.x,
          y: object.position.y,
          z: object.position.z,
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
          visible: object.visible,
          ...getObjectPositionInfo(object),
        };
      })
    );
  };

  const pushHistory = () => {
    undoStackRef.current = [...undoStackRef.current.slice(-9), captureLayerSnapshot()];
    redoStackRef.current = [];
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
  };

  const applyLayerSnapshot = (snapshot: LayerSnapshot) => {
    Object.entries(snapshot).forEach(([id, value]) => {
      const object = layerObjectMapRef.current.get(id);
      if (!object) return;
      object.visible = value.visible;
      object.position.set(value.position.x, value.position.y, value.position.z);
      object.updateMatrixWorld();
    });
    refreshLayerItemsFromScene();
  };

  const undoLayerChange = () => {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return;
    const current = captureLayerSnapshot();
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [...redoStackRef.current.slice(-9), current];
    applyLayerSnapshot(previous);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
  };

  const redoLayerChange = () => {
    const next = redoStackRef.current.at(-1);
    if (!next) return;
    const current = captureLayerSnapshot();
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    undoStackRef.current = [...undoStackRef.current.slice(-9), current];
    applyLayerSnapshot(next);
    setUndoCount(undoStackRef.current.length);
    setRedoCount(redoStackRef.current.length);
  };

  const resetLayerChanges = () => {
    const baseline = undoStackRef.current[0];
    if (!baseline) return;
    pushHistory();
    applyLayerSnapshot(baseline);
  };

  const deleteLayer = (layerId: string) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object || !object.parent) return;

    const idsToDelete: string[] = [];
    object.traverse((child) => {
      idsToDelete.push(child.uuid);
    });
    object.parent.remove(object);

    idsToDelete.forEach((id) => {
      layerObjectMapRef.current.delete(id);
    });

    setLayerItems((prev) => prev.filter((layer) => !idsToDelete.includes(layer.id)));
    setLayerDetailsOpen((prev) => {
      const next = { ...prev };
      idsToDelete.forEach((id) => {
        delete next[id];
      });
      return next;
    });

    if (selectedLayerId && idsToDelete.includes(selectedLayerId)) {
      setSelectedLayerId(null);
    }

    // Structural change invalidates prior snapshots.
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoCount(0);
    setRedoCount(0);
    setLayerMessage("Layer deleted.");
  };

  const setLayerVisibility = (layerId: string, visible: boolean) => {
    pushHistory();
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    object.visible = visible;
    if (!visible && selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
    setLayerItems((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, visible } : layer))
    );
  };

  const syncLayerPosition = (layerId: string) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    const info = getObjectPositionInfo(object);
    setLayerItems((prev) =>
      prev.map((layer) => (layer.id === layerId ? { ...layer, ...info } : layer))
    );
  };

  const updateLayerCoordinate = (
    layerId: string,
    axis: "x" | "y" | "z",
    rawValue: string,
    options?: { recordHistory?: boolean }
  ) => {
    const object = layerObjectMapRef.current.get(layerId);
    if (!object) return;
    const value = Number(rawValue);
    if (Number.isNaN(value)) return;
    if (options?.recordHistory !== false) {
      pushHistory();
    }
    object.position[axis] = value;
    object.updateMatrixWorld();
    syncLayerPosition(layerId);
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
        setLayerMessage("Model exported.");
      },
      () => {
        setLayerMessage("Failed to export model.");
      },
      { binary: true, onlyVisible: false, includeCustomExtensions: true }
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

  const layersPanel = (
    <div className="space-y-3">
      {layerItems.length === 0 ? (
        <p className="text-xs text-muted-foreground">No layers found for this model.</p>
      ) : (
        <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {layerItems.map((layer) => (
              <div key={layer.id} className="space-y-1">
                <div
                  className={cn(
                    "flex items-center justify-between rounded-md border px-2 py-1.5",
                    selectedLayerId === layer.id ? "border-primary bg-primary/5" : ""
                  )}
                  style={{ marginLeft: `${Math.min(layer.depth, 6) * 10}px` }}
                >
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => {
                      selectLayer(layer.id);
                    }}
                  >
                    <p className="truncate text-xs font-medium">{layer.name}</p>
                    <p className="text-[11px] text-muted-foreground">{layer.type}</p>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLayerDetailsOpen((prev) => ({
                          ...prev,
                          [layer.id]: !prev[layer.id],
                        }));
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
                        onBeginChange={pushHistory}
                        onValueChange={(next) =>
                          updateLayerCoordinate(layer.id, "x", next.toString(), {
                            recordHistory: false,
                          })
                        }
                      />
                      <ScrubbableNumberField
                        label="Y"
                        value={layer.position.y}
                        onBeginChange={pushHistory}
                        onValueChange={(next) =>
                          updateLayerCoordinate(layer.id, "y", next.toString(), {
                            recordHistory: false,
                          })
                        }
                      />
                      <ScrubbableNumberField
                        label="Z"
                        value={layer.position.z}
                        onBeginChange={pushHistory}
                        onValueChange={(next) =>
                          updateLayerCoordinate(layer.id, "z", next.toString(), {
                            recordHistory: false,
                          })
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      )}
    </div>
  );

  return (
    <div
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
              makeDefault
              position={[2, 2, 2]}
              fov={45}
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
              show={settings.showGrid}
              size={20}
              divisions={20}
              fadeDistance={30}
            />

            <Bounds fit clip={false} observe margin={1.1}>
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
              enablePan
              enableZoom={settings.orbitEnableZoom}
              autoRotate={settings.orbitAutoRotate}
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
        </aside>
      ) : null}

      {hasModel ? (
        <aside className="absolute right-4 top-4 z-40 w-full max-w-md">
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
                  onChange={(value) => setSettings((p) => ({ ...p, backgroundColor: value }))}
                />
                <ToggleField
                  label="Show grid"
                  checked={settings.showGrid}
                  onChange={(v) => setSettings((p) => ({ ...p, showGrid: v }))}
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
                  onChange={(v) => setSettings((p) => ({ ...p, orbitEnableZoom: v }))}
                />
                <ToggleField
                  label="Auto rotate"
                  checked={settings.orbitAutoRotate}
                  onChange={(v) => setSettings((p) => ({ ...p, orbitAutoRotate: v }))}
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
                  onChange={(v) => setSettings((p) => ({ ...p, useAmbientLight: v }))}
                />
                <SliderField
                  label="Ambient intensity"
                  value={settings.ambientIntensity}
                  min={0}
                  max={3}
                  step={0.05}
                  onChange={(v) => setSettings((p) => ({ ...p, ambientIntensity: v }))}
                />
                <ToggleField
                  label="Directional enabled"
                  checked={settings.useDirectionalLight}
                  onChange={(v) => setSettings((p) => ({ ...p, useDirectionalLight: v }))}
                />
                <SliderField
                  label="Directional intensity"
                  value={settings.directionalIntensity}
                  min={0}
                  max={5}
                  step={0.05}
                  onChange={(v) => setSettings((p) => ({ ...p, directionalIntensity: v }))}
                />
                <SliderField
                  label="Directional X"
                  value={settings.directionalX}
                  min={-30}
                  max={30}
                  step={0.5}
                  onChange={(v) => setSettings((p) => ({ ...p, directionalX: v }))}
                />
                <SliderField
                  label="Directional Y"
                  value={settings.directionalY}
                  min={-30}
                  max={30}
                  step={0.5}
                  onChange={(v) => setSettings((p) => ({ ...p, directionalY: v }))}
                />
                <SliderField
                  label="Directional Z"
                  value={settings.directionalZ}
                  min={-30}
                  max={30}
                  step={0.5}
                  onChange={(v) => setSettings((p) => ({ ...p, directionalZ: v }))}
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
    </div>
  );
}
