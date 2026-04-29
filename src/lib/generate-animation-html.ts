export type ExportConfig = {
  backgroundColor: string;
  useAmbientLight: boolean;
  ambientIntensity: number;
  pointLights: { color: string; intensity: number; x: number; y: number; z: number }[];
  pinnedCameraView: { position: [number, number, number]; target: [number, number, number]; fov: number; zoom: number } | null;
  timelineLengthVh: number;
  tracks: { layerName: string; propertyId: string; keyframes: { atVh: number; value: number; easing: string }[] }[];
};

export function generateAnimationHtml(modelDataUrl: string, cfg: ExportConfig): string {
  const cfgJson = JSON.stringify(cfg);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Animation</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html { overflow-x: hidden; }
body { background: ${cfg.backgroundColor}; }
#canvas-wrap { position: fixed; inset: 0; }
canvas { display: block; width: 100% !important; height: 100% !important; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/"
  }
}
</script>
</head>
<body>
<div id="canvas-wrap"><canvas id="c"></canvas></div>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CFG = ${cfgJson};
const MODEL_DATA_URL = '${modelDataUrl}';

function applyEasing(t, easing) {
  switch (easing) {
    case 'easeIn':         return t * t;
    case 'easeOut':        return t * (2 - t);
    case 'easeInOut':      return t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    case 'easeInOutCubic': return t < 0.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1;
    default:               return t;
  }
}

function evaluateTrack(track, atVh) {
  const kfs = track.keyframes;
  if (!kfs.length) return 0;
  if (kfs.length === 1 || atVh <= kfs[0].atVh) return kfs[0].value;
  if (atVh >= kfs[kfs.length - 1].atVh) return kfs[kfs.length - 1].value;
  for (let i = 0; i < kfs.length - 1; i++) {
    if (kfs[i].atVh <= atVh && kfs[i + 1].atVh >= atVh) {
      const raw = (atVh - kfs[i].atVh) / Math.max(1e-9, kfs[i + 1].atVh - kfs[i].atVh);
      const t = applyEasing(raw, kfs[i].easing || 'linear');
      return kfs[i].value + t * (kfs[i + 1].value - kfs[i].value);
    }
  }
  return kfs[kfs.length - 1].value;
}

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(CFG.backgroundColor);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.backgroundColor);

const camera = new THREE.PerspectiveCamera(
  CFG.pinnedCameraView ? CFG.pinnedCameraView.fov : 45,
  window.innerWidth / window.innerHeight, 0.001, 100000
);
if (CFG.pinnedCameraView) {
  const p = CFG.pinnedCameraView.position;
  const t = CFG.pinnedCameraView.target;
  camera.position.set(p[0], p[1], p[2]);
  camera.lookAt(new THREE.Vector3(t[0], t[1], t[2]));
  camera.zoom = CFG.pinnedCameraView.zoom != null ? CFG.pinnedCameraView.zoom : 1;
  camera.updateProjectionMatrix();
}

if (CFG.useAmbientLight) {
  scene.add(new THREE.AmbientLight(0xffffff, CFG.ambientIntensity));
}
CFG.pointLights.forEach(function(l) {
  const light = new THREE.PointLight(l.color, l.intensity, 100);
  light.position.set(l.x, l.y, l.z);
  scene.add(light);
});

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
onResize();
window.addEventListener('resize', onResize);

document.body.style.height = (CFG.timelineLengthVh + 100) + 'vh';
let currentVh = 0;
function onScroll() {
  const maxScroll = (CFG.timelineLengthVh / 100) * window.innerHeight;
  currentVh = Math.min(Math.max(
    (window.scrollY / Math.max(1, maxScroll)) * CFG.timelineLengthVh, 0
  ), CFG.timelineLengthVh);
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);

const objMap = {};

// Per-object rotation pivot: bounding-box centre + base state, captured once on
// first rotation call so the object spins around its visual centre (not its
// potentially offset local origin) without accumulating position drift.
const pivotMap = {};
function getOrCapturePivot(obj) {
  if (pivotMap[obj.name]) return pivotMap[obj.name];
  const bbox = new THREE.Box3().setFromObject(obj);
  if (bbox.isEmpty()) return null;
  const centerWorld = new THREE.Vector3();
  bbox.getCenter(centerWorld);
  const centerLocal = obj.parent
    ? obj.parent.worldToLocal(centerWorld.clone())
    : centerWorld.clone();
  pivotMap[obj.name] = {
    centerLocal,
    basePos: obj.position.clone(),
    baseQuat: obj.quaternion.clone(),
  };
  return pivotMap[obj.name];
}

// Per-object scale pivot: same drift-free pattern as rotation.
const scalePivotMap = {};
function getOrCaptureScalePivot(obj) {
  if (scalePivotMap[obj.name]) return scalePivotMap[obj.name];
  const bbox = new THREE.Box3().setFromObject(obj);
  if (bbox.isEmpty()) return null;
  const centerWorld = new THREE.Vector3();
  bbox.getCenter(centerWorld);
  const centerLocal = obj.parent
    ? obj.parent.worldToLocal(centerWorld.clone())
    : centerWorld.clone();
  scalePivotMap[obj.name] = {
    centerLocal,
    basePos: obj.position.clone(),
    baseScale: obj.scale.x,
  };
  return scalePivotMap[obj.name];
}

// Camera dolly: direction from target to camera, captured once on first dolly track evaluation.
let dollyCapture = null;

function applyValue(obj, propertyId, value) {
  switch (propertyId) {
    case 'position.x': obj.position.x = value; break;
    case 'position.y': obj.position.y = value; break;
    case 'position.z': obj.position.z = value; break;
    case 'rotation.x':
    case 'rotation.y':
    case 'rotation.z': {
      const axis = propertyId.split('.')[1];
      const rad = THREE.MathUtils.degToRad(value);
      const newRotX = axis === 'x' ? rad : obj.rotation.x;
      const newRotY = axis === 'y' ? rad : obj.rotation.y;
      const newRotZ = axis === 'z' ? rad : obj.rotation.z;
      const pivot = getOrCapturePivot(obj);
      if (pivot) {
        const newQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(newRotX, newRotY, newRotZ, obj.rotation.order)
        );
        const deltaQuat = newQuat.clone().multiply(pivot.baseQuat.clone().invert());
        const V = new THREE.Vector3().subVectors(pivot.centerLocal, pivot.basePos);
        obj.position.subVectors(pivot.centerLocal, V.clone().applyQuaternion(deltaQuat));
      }
      obj.rotation.set(newRotX, newRotY, newRotZ, obj.rotation.order);
      break;
    }
    case 'scale.uniform': {
      const scalePivot = getOrCaptureScalePivot(obj);
      obj.scale.setScalar(value);
      if (scalePivot && Math.abs(scalePivot.baseScale) > 1e-9) {
        const ratio = value / scalePivot.baseScale;
        const V = new THREE.Vector3().subVectors(scalePivot.centerLocal, scalePivot.basePos);
        obj.position.subVectors(scalePivot.centerLocal, V.multiplyScalar(ratio));
      }
      break;
    }
    case 'opacity':
      obj.traverse(function(child) {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = Math.min(Math.max(value, 0), 1);
          child.material.needsUpdate = true;
        }
      });
      break;
  }
}

function applyTracks() {
  CFG.tracks.forEach(function(track) {
    if (track.layerName === '__camera__') {
      const value = evaluateTrack(track, currentVh);
      if (track.propertyId === 'camera.fov') {
        camera.fov = Math.min(Math.max(value, 10), 120);
        camera.updateProjectionMatrix();
      } else if (track.propertyId === 'camera.dolly') {
        if (!dollyCapture && CFG.pinnedCameraView) {
          const tgt = new THREE.Vector3(
            CFG.pinnedCameraView.target[0],
            CFG.pinnedCameraView.target[1],
            CFG.pinnedCameraView.target[2]
          );
          dollyCapture = {
            direction: camera.position.clone().sub(tgt).normalize(),
            target: tgt,
          };
        }
        if (dollyCapture && value > 0) {
          camera.position.copy(dollyCapture.target).addScaledVector(dollyCapture.direction, value);
        }
      }
      return;
    }
    const obj = objMap[track.layerName];
    if (!obj) return;
    applyValue(obj, track.propertyId, evaluateTrack(track, currentVh));
  });
}

const loader = new GLTFLoader();
loader.load(MODEL_DATA_URL, function(gltf) {
  scene.add(gltf.scene);

  // Centre at world origin — matches Drei's <Center> in the editor so
  // the saved camera target [0,0,0] points at the model correctly.
  var box = new THREE.Box3().setFromObject(gltf.scene);
  if (!box.isEmpty()) {
    var center = box.getCenter(new THREE.Vector3());
    gltf.scene.position.sub(center);
    gltf.scene.updateMatrixWorld(true);
  }

  gltf.scene.traverse(function(obj) {
    if (obj.name) objMap[obj.name] = obj;
  });
  applyTracks();
  requestAnimationFrame(render);
}, undefined, function(err) {
  console.error('Model load error', err);
});

function render() {
  applyTracks();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
</script>
</body>
</html>`;
}
