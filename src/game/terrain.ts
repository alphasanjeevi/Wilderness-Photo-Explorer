import * as THREE from 'three';
import { HabitatZone } from '../types/game';

export const PLAYABLE_RADIUS = 195;
export const WORLD_SIZE = 540;

export const CAMP_X = -16;
export const CAMP_Z = -12;

export const BRIDGE_X = 24;
export const BRIDGE_HALF_W = 4.6;
export const BRIDGE_HALF_L = 10.5;
export const BRIDGE_RAMP_L = 7.0;

export const RUINS_X = -96;
export const RUINS_Z = 44;

export const WATERFALL_X = -126;

export interface LandmarkCenter {
  habitat: HabitatZone;
  label: string;
  x: number;
  z: number;
  radius: number;
}

export interface MapPoi {
  id: string;
  label: string;
  shortLabel: string;
  x: number;
  z: number;
  kind: 'camp' | 'meadow' | 'river' | 'ruins' | 'canopy' | 'waterfall' | 'bridge';
}

export const HABITAT_ZONES: LandmarkCenter[] = [
  { habitat: 'camp', label: 'Ranger Outskirts', x: 0, z: 0, radius: 42 },
  { habitat: 'clearing', label: 'Sunlit Meadow', x: 96, z: -64, radius: 58 },
  { habitat: 'river', label: 'Emerald Riverbank', x: 26, z: 92, radius: 58 },
  { habitat: 'ruins', label: 'Mossy Stone Ruins', x: RUINS_X, z: RUINS_Z, radius: 52 },
  { habitat: 'canopy', label: 'High Canopy Trail', x: -78, z: -94, radius: 60 },
];

// Winding river curve across the southern valley
export function riverCenterZ(x: number): number {
  return 90 + Math.sin(x * 0.028) * 18 + Math.cos(x * 0.015) * 9;
}

export const BRIDGE_Z = riverCenterZ(BRIDGE_X);
export const WATERFALL_Z = riverCenterZ(WATERFALL_X);

export const MAP_POIS: MapPoi[] = [
  { id: 'camp', label: 'Research Camp', shortLabel: 'Camp', x: CAMP_X, z: CAMP_Z, kind: 'camp' },
  { id: 'meadow', label: 'Sunlit Meadow', shortLabel: 'Meadow', x: 96, z: -64, kind: 'meadow' },
  { id: 'bridge', label: 'River Bridge', shortLabel: 'Bridge', x: BRIDGE_X, z: BRIDGE_Z, kind: 'bridge' },
  { id: 'waterfall', label: 'Waterfall Cliff', shortLabel: 'Falls', x: WATERFALL_X + 10, z: WATERFALL_Z, kind: 'waterfall' },
  { id: 'ruins', label: 'Mossy Stone Ruins', shortLabel: 'Ruins', x: RUINS_X, z: RUINS_Z, kind: 'ruins' },
  { id: 'canopy', label: 'High Canopy Trail', shortLabel: 'Canopy', x: -78, z: -94, kind: 'canopy' },
];

// Sweeping dirt-road loop passing straight across the bridge (x = 24) and all 5 expanded biomes
const ROAD_CONTROL_POINTS: [number, number][] = [
  [0, 10],
  [44, -18],
  [94, -56],
  [126, -10],
  [112, 54],
  [54, 74],
  [BRIDGE_X, BRIDGE_Z - 24],
  [BRIDGE_X, BRIDGE_Z + 24],
  [-32, 92],
  [-88, 60],
  [-108, -4],
  [-80, -86],
  [-24, -64],
  [-6, -24],
];

const ROAD_SAMPLES: { x: number; z: number }[] = [];
(() => {
  const curve = new THREE.CatmullRomCurve3(
    ROAD_CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'catmullrom',
    0.5
  );
  const pts = curve.getPoints(340);
  for (const p of pts) {
    ROAD_SAMPLES.push({ x: p.x, z: p.z });
  }
})();

const RIVER_SAMPLES: { x: number; z: number }[] = [];
(() => {
  for (let x = -220; x <= 220; x += 8) {
    RIVER_SAMPLES.push({ x, z: riverCenterZ(x) });
  }
})();

export function getRoadSamples(): { x: number; z: number }[] {
  return ROAD_SAMPLES;
}

export function getRiverSamples(): { x: number; z: number }[] {
  return RIVER_SAMPLES;
}

export function distanceToRoad(x: number, z: number): number {
  let minSq = Infinity;
  for (let i = 0; i < ROAD_SAMPLES.length; i++) {
    const dx = x - ROAD_SAMPLES[i].x;
    const dz = z - ROAD_SAMPLES[i].z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minSq) minSq = dSq;
  }
  return Math.sqrt(minSq);
}

export function distanceToRiver(x: number, z: number): number {
  const rz = riverCenterZ(x);
  return Math.abs(z - rz);
}

export function isOnBridge(x: number, z: number): boolean {
  return (
    Math.abs(x - BRIDGE_X) <= BRIDGE_HALF_W &&
    Math.abs(z - BRIDGE_Z) <= BRIDGE_HALF_L + BRIDGE_RAMP_L
  );
}

export function baseTerrainHeight(x: number, z: number): number {
  const distFromOrigin = Math.hypot(x, z);

  // Soft rolling tropical hills spread across the larger reserve
  let h =
    Math.sin(x * 0.024) * Math.cos(z * 0.022) * 2.8 +
    Math.sin(x * 0.052 + 1.1) * Math.sin(z * 0.048) * 0.95;

  // Gentle flattening around camp, meadow, ruins
  const campFactor = Math.max(0, 1 - Math.hypot(x - CAMP_X, z - CAMP_Z) / 34);
  const clearingFactor = Math.max(0, 1 - Math.hypot(x - 96, z + 64) / 44);
  const ruinsFactor = Math.max(0, 1 - Math.hypot(x - RUINS_X, z - RUINS_Z) / 34);
  const flatBlend = Math.min(1, campFactor + clearingFactor * 0.85 + ruinsFactor * 0.85);
  h *= 1 - flatBlend * 0.72;

  // Elevated canopy ridge in northwest
  const canopyLift = Math.max(0, 1 - Math.hypot(x + 78, z + 94) / 68);
  h += canopyLift * 4.2;

  // River depression
  const rDist = distanceToRiver(x, z);
  const riverWidth = 8.4;
  if (rDist < riverWidth + 6.5) {
    const t = Math.max(0, Math.min(1, (rDist - (riverWidth - 2.8)) / 9.0));
    const smooth = t * t * (3 - 2 * t);
    h = THREE.MathUtils.lerp(-1.6, h, smooth);
  }

  // Smooth natural valley rim cliffs beyond playable radius
  if (distFromOrigin > PLAYABLE_RADIUS - 10) {
    const rimT = Math.max(0, (distFromOrigin - (PLAYABLE_RADIUS - 10)) / 48);
    h += rimT * rimT * 24.0 + Math.sin(x * 0.1 + z * 0.09) * rimT * 3.2;
  }

  return h;
}

export function groundHeightAt(x: number, z: number): number {
  let h = baseTerrainHeight(x, z);

  // Road flattening (keeps trail smooth for comfortable driving)
  const rDist = distanceToRoad(x, z);
  if (rDist < 8.5) {
    const t = Math.max(0, Math.min(1, (rDist - 3.8) / 4.7));
    const smooth = t * t * (3 - 2 * t);
    const roadBase = Math.max(0.22, h);
    h = THREE.MathUtils.lerp(roadBase, h, smooth);
  }

  // Smooth bridge deck & approach ramps across the river
  if (isOnBridge(x, z)) {
    const dz = Math.abs(z - BRIDGE_Z);
    const deckY = 1.05 + Math.cos(Math.min(1, dz / BRIDGE_HALF_L) * Math.PI * 0.5) * 0.45;
    if (dz <= BRIDGE_HALF_L) {
      return Math.max(h, deckY);
    }
    // Gentle ramp down from bridge ends to riverbank road
    const rampT = 1 - (dz - BRIDGE_HALF_L) / BRIDGE_RAMP_L;
    const smoothRamp = rampT * rampT * (3 - 2 * rampT);
    return THREE.MathUtils.lerp(Math.max(0.22, h), 1.05, smoothRamp);
  }

  return h;
}

export function surfaceTypeAt(x: number, z: number): 'road' | 'bridge' | 'water' | 'clearing' | 'forest' {
  if (isOnBridge(x, z)) return 'bridge';
  if (distanceToRoad(x, z) < 4.2) return 'road';
  if (distanceToRiver(x, z) < 7.2 && groundHeightAt(x, z) < -0.15) return 'water';
  if (Math.hypot(x - 96, z + 64) < 42 || Math.hypot(x, z) < 28) return 'clearing';
  return 'forest';
}

export function getHabitatAt(x: number, z: number): { habitat: HabitatZone; label: string } {
  let best = HABITAT_ZONES[0];
  let bestDist = Infinity;
  for (const zone of HABITAT_ZONES) {
    const d = Math.hypot(x - zone.x, z - zone.z);
    if (d < bestDist) {
      bestDist = d;
      best = zone;
    }
  }
  return { habitat: best.habitat, label: best.label };
}

export function createTerrainMesh(groundTex: THREE.CanvasTexture): THREE.Mesh {
  const segments = 180;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cForest = new THREE.Color(0x4f7a44);
  const cForestDeep = new THREE.Color(0x3a6136);
  const cClearing = new THREE.Color(0x6e984c);
  const cRoad = new THREE.Color(0xb89668);
  const cSand = new THREE.Color(0xa68f63);
  const cRidge = new THREE.Color(0x556452);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let finalY = baseTerrainHeight(x, z);

    const roadD = distanceToRoad(x, z);
    if (roadD < 7.8) {
      const t = Math.max(0, Math.min(1, (roadD - 3.6) / 4.2));
      const smooth = t * t * (3 - 2 * t);
      finalY = THREE.MathUtils.lerp(Math.max(0.22, finalY), finalY, smooth);
    }
    pos.setY(i, finalY);

    const riverD = distanceToRiver(x, z);
    const distOrigin = Math.hypot(x, z);
    const meadowBlend = Math.max(0, 1 - Math.hypot(x - 96, z + 64) / 46);
    const campBlend = Math.max(0, 1 - Math.hypot(x, z) / 30);

    tmp.copy(cForest);
    if (Math.sin(x * 0.06 + z * 0.05) > 0.22) {
      tmp.lerp(cForestDeep, 0.45);
    }
    if (meadowBlend > 0 || campBlend > 0) {
      tmp.lerp(cClearing, Math.min(1, meadowBlend + campBlend * 0.7));
    }
    if (riverD < 10.0) {
      const bankT = Math.max(0, Math.min(1, 1 - (riverD - 6.0) / 4.0));
      tmp.lerp(cSand, bankT * 0.88);
    }
    if (roadD < 5.6) {
      const roadT = Math.max(0, Math.min(1, 1 - (roadD - 3.1) / 2.5));
      tmp.lerp(cRoad, roadT * 0.92);
    }
    if (distOrigin > PLAYABLE_RADIUS - 6) {
      const rimT = Math.min(1, (distOrigin - (PLAYABLE_RADIUS - 6)) / 32);
      tmp.lerp(cRidge, rimT * 0.85);
    }

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: groundTex,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}
