"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bounds, Center, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  Box,
  Camera,
  Check,
  Circle,
  Clipboard,
  Code2,
  Download,
  Globe2,
  Lightbulb,
  PanelLeft,
  Plus,
  Save,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import * as THREE from "three";

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
  fogColor: string;
  showFog: boolean;
  fogNear: number;
  fogFar: number;
  showGrid: boolean;
  gridSize: number;
  gridDivisions: number;
  gridFadeDistance: number;
  useAmbientLight: boolean;
  ambientIntensity: number;
  useDirectionalLight: boolean;
  directionalIntensity: number;
  directionalX: number;
  directionalY: number;
  directionalZ: number;
  orbitEnablePan: boolean;
  orbitEnableZoom: boolean;
  orbitAutoRotate: boolean;
  orbitDamping: number;
  cameraFov: number;
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

const MAX_POINT_LIGHTS = 4;
const CONFIG_STORAGE_KEY = "glb_tool_viewer_config_v1";

const DEFAULT_SETTINGS: ViewerSettings = {
  backgroundColor: "#0b0f13",
  fogColor: "#b8c3d1",
  showFog: false,
  fogNear: 1,
  fogFar: 10,
  showGrid: true,
  gridSize: 20,
  gridDivisions: 20,
  gridFadeDistance: 30,
  useAmbientLight: false,
  ambientIntensity: 0.4,
  useDirectionalLight: false,
  directionalIntensity: 1,
  directionalX: 5,
  directionalY: 6,
  directionalZ: 4,
  orbitEnablePan: true,
  orbitEnableZoom: true,
  orbitAutoRotate: false,
  orbitDamping: 45,
  cameraFov: 45,
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

function clampSettings(raw: ViewerSettings): ViewerSettings {
  const fogNear = THREE.MathUtils.clamp(raw.fogNear, 0.1, 50);
  const fogFar = Math.max(fogNear + 0.1, THREE.MathUtils.clamp(raw.fogFar, fogNear + 0.1, 200));

  return {
    ...raw,
    cameraFov: THREE.MathUtils.clamp(raw.cameraFov, 20, 100),
    orbitDamping: THREE.MathUtils.clamp(raw.orbitDamping, 0, 100),
    gridSize: THREE.MathUtils.clamp(raw.gridSize, 2, 200),
    gridDivisions: THREE.MathUtils.clamp(raw.gridDivisions, 2, 300),
    gridFadeDistance: THREE.MathUtils.clamp(raw.gridFadeDistance, 1, 200),
    fogNear,
    fogFar,
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

export function GlbViewer() {
  const [modelScene, setModelScene] = useState<THREE.Object3D | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showUploadSidebar, setShowUploadSidebar] = useState(true);
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_SETTINGS);
  const [pointLights, setPointLights] = useState<PointLightConfig[]>([createDefaultPointLight(0)]);
  const [configText, setConfigText] = useState("");
  const [configDirty, setConfigDirty] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const loadIdRef = useRef(0);

  const hasModel = modelScene !== null;
  const orbitDampingFactor = useMemo(
    () => THREE.MathUtils.lerp(0.01, 0.35, settings.orbitDamping / 100),
    [settings.orbitDamping]
  );

  useEffect(() => {
    if (configDirty) return;
    const text = JSON.stringify({ settings, pointLights }, null, 2);
    setConfigText(text);
  }, [settings, pointLights, configDirty]);

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
          if (previousScene) disposeScene(previousScene);
          setShowUploadSidebar(false);
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

  const uploadPanel = (
    <Card
      className={cn(
        "border-dashed bg-card/95 backdrop-blur transition",
        isDragging ? "border-primary" : "border-border"
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Upload .glb
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
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
      </CardContent>
    </Card>
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
            <PerspectiveCamera makeDefault position={[2, 2, 2]} fov={settings.cameraFov} />
            <color attach="background" args={[settings.backgroundColor]} />
            {settings.showFog ? (
              <fog attach="fog" args={[settings.fogColor, settings.fogNear, settings.fogFar]} />
            ) : null}

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
              size={settings.gridSize}
              divisions={settings.gridDivisions}
              fadeDistance={settings.gridFadeDistance}
            />

            <Bounds fit clip observe margin={1.1}>
              <Center>
                <primitive object={modelScene} dispose={null} />
              </Center>
            </Bounds>

            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={orbitDampingFactor}
              enablePan={settings.orbitEnablePan}
              enableZoom={settings.orbitEnableZoom}
              autoRotate={settings.orbitAutoRotate}
            />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center bg-[#0b0f13] text-sm text-slate-300">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/70 px-4 py-2">
              <Box className="h-4 w-4" />
              Drop a model to begin.
            </div>
          </div>
        )}
      </div>

      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-30 border-2 border-dashed border-primary/70 bg-primary/10" />
      ) : null}

      {!hasModel ? <div className="absolute inset-0 z-40 flex items-center justify-center p-4">{uploadPanel}</div> : null}

      {hasModel && !showUploadSidebar ? (
        <Button
          size="sm"
          className="absolute left-4 top-4 z-40"
          variant="secondary"
          onClick={() => setShowUploadSidebar(true)}
        >
          <PanelLeft className="mr-2 h-4 w-4" />
          Upload
        </Button>
      ) : null}

      {hasModel && showUploadSidebar ? (
        <aside className="absolute left-4 top-4 z-40 w-[340px]">
          <div className="mb-2 flex items-center justify-end">
            <Button size="sm" variant="secondary" onClick={() => setShowUploadSidebar(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {uploadPanel}
        </aside>
      ) : null}

      {hasModel ? (
        <Button
          size="sm"
          className="absolute right-4 top-4 z-40"
          variant="secondary"
          onClick={() => setShowCustomize((prev) => !prev)}
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Customize
        </Button>
      ) : null}

      {hasModel ? (
        <aside
          className={cn(
            "absolute right-0 top-0 z-40 h-full w-full max-w-md overflow-y-auto border-l bg-card/95 p-6 backdrop-blur transition-transform",
            showCustomize ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Customize Viewer</h2>
            <Button size="sm" variant="secondary" onClick={() => setShowCustomize(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6">
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
                  label="Enable fog"
                  checked={settings.showFog}
                  onChange={(v) => setSettings((p) => ({ ...p, showFog: v }))}
                />
                <ColorField
                  label="Fog color"
                  value={settings.fogColor}
                  onChange={(value) => setSettings((p) => ({ ...p, fogColor: value }))}
                />
                <SliderField
                  label="Fog near"
                  value={settings.fogNear}
                  min={0.1}
                  max={50}
                  step={0.1}
                  onChange={(v) =>
                    setSettings((p) => clampSettings({ ...p, fogNear: v, fogFar: Math.max(v + 0.1, p.fogFar) }))
                  }
                />
                <SliderField
                  label="Fog far"
                  value={settings.fogFar}
                  min={0.2}
                  max={200}
                  step={0.1}
                  onChange={(v) => setSettings((p) => clampSettings({ ...p, fogFar: v }))}
                />
                <p className="text-xs text-muted-foreground">
                  Fog mixes distant model parts into fog color. Lower near/far for stronger effect.
                </p>
                <ToggleField
                  label="Show grid"
                  checked={settings.showGrid}
                  onChange={(v) => setSettings((p) => ({ ...p, showGrid: v }))}
                />
                <SliderField
                  label="Grid size"
                  value={settings.gridSize}
                  min={2}
                  max={200}
                  step={1}
                  onChange={(v) => setSettings((p) => ({ ...p, gridSize: v }))}
                />
                <SliderField
                  label="Grid divisions"
                  value={settings.gridDivisions}
                  min={2}
                  max={300}
                  step={1}
                  onChange={(v) => setSettings((p) => ({ ...p, gridDivisions: v }))}
                />
                <SliderField
                  label="Grid fade distance"
                  value={settings.gridFadeDistance}
                  min={1}
                  max={200}
                  step={1}
                  onChange={(v) => setSettings((p) => ({ ...p, gridFadeDistance: v }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <Camera className="h-5 w-5" />
                  Camera + Orbit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SliderField
                  label="Camera FOV"
                  value={settings.cameraFov}
                  min={20}
                  max={100}
                  step={1}
                  onChange={(v) => setSettings((p) => ({ ...p, cameraFov: v }))}
                />
                <SliderField
                  label="Orbit smoothing"
                  value={settings.orbitDamping}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setSettings((p) => ({ ...p, orbitDamping: v }))}
                />
                <p className="text-xs text-muted-foreground">
                  Smoothing maps to damping factor {orbitDampingFactor.toFixed(3)}.
                </p>
                <ToggleField
                  label="Enable pan"
                  checked={settings.orbitEnablePan}
                  onChange={(v) => setSettings((p) => ({ ...p, orbitEnablePan: v }))}
                />
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
          </div>
        </aside>
      ) : null}
    </div>
  );
}
