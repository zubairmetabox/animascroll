// Shared types used across model-editor, ai-chat-panel, and API routes.

export type EasingType = "linear" | "easeIn" | "easeOut" | "easeInOut" | "easeInOutCubic";

export type Keyframe = {
  atVh: number;
  value: number;
  easing?: EasingType;
};

export type Operation =
  | { type: "set_track"; layerName: string; propertyId: string; keyframes: Keyframe[] }
  | { type: "delete_track"; layerName: string; propertyId: string }
  | { type: "clear_all" }
  | { type: "set_timeline_length"; vh: number }
  | { type: "set_scene"; settings: Record<string, unknown> }
  | { type: "set_point_light"; index: number; patch: Record<string, unknown> }
  | { type: "exploded_view"; vh: number; multiplier?: number };

export type AnimationTrack = {
  layerId: string;
  layerName?: string;
  propertyId: string;
  keyframes: Keyframe[];
};

export type LayerItem = {
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

export type SceneSettings = {
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
  useEnvironmentMap: boolean;
  environmentPreset: string;
  environmentIntensity: number;
  toneMappingExposure: number;
};

export type PointLightConfig = {
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
