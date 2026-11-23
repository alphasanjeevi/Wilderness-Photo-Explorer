import * as THREE from 'three';
import { HabitatZone } from '../types/game';

export const PLAYABLE_RADIUS = 108;
export const WORLD_SIZE = 340;

export interface LandmarkCenter {
  habitat: HabitatZone;
  label: string;
  x: number;
  z: number;
  radius: number;
}

export const HABITAT_ZONES: LandmarkCenter[] = [
  { habitat: 'camp', label: 'Ranger Outskirts', x: 0, z: 0, radius: 28 },
  { habitat: 'clearing', label: 'Sunlit Meadow', x: 48, z: -32, radius: 34 },
  { habitat: 'river', label: 'Emerald Riverbank', x: 18, z: 48, radius: 34 },
  { habitat: 'ruins', label: 'Mossy Stone Ruins', x: -50, z: 22, radius: 32 },
  { habitat: 'canopy', label: 'High Canopy Trail', x: -38, z: -48, radius: 36 },
];

// Closed dirt-road loop passing all 5 habitats
const ROAD_CONTROL_POINTS: [number, number][] = [
  [0, 6],
  [24, -10],
  [48, -28],
  [58, 6],
  [36, 42],
  [12, 48], // Bridge crossing
  [-18, 48],
  [-48, 28],
  [-54, -8],
  [-38, -44],
  [-10, -34],
  [-4, -12],
];

const ROAD_SAMPLES: { x: number; z: number }[] = [];
(() => {
  const curve = new THREE.CatmullRomCurve3(
    ROAD_CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'catmullrom',
    0.5
  );
  const pts = curve.getPoints(220);
  for (const p of pts) {
    ROAD_SAMPLES.push({ x: p.x, z: p.z });
  }
})();

export function getRoadSamples(): { x: number; z: number }[] {
  return ROAD_SAMPLES;
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

// Winding river curve across the southern/western valley
export function riverCenterZ(x: number): number {
  return 47 + Math.sin(x * 0.045) * 11 + Math.cos(x * 0.022) * 5;
}

export function distanceToRiver(x: number, z: number): number {
  const rz = riverCenterZ(x);
  return Math.abs(z - rz);
}

export function isOnBridge(x: number, z: number): boolean {
  // Bridge spans the river crossing near x = 12, z = riverCenterZ(12)
  const bx = 12;
  const bz = riverCenterZ(bx);
  return Math.abs(x - bx) < 5.6 && Math.abs(z - bz) < 9.5;
}

export function baseTerrainHeight(x: number, z: number): number {
  const distFromOrigin = Math.hypot(x, z);

  // Soft rolling tropical hills
  let h =
    Math.sin(x * 0.036) * Math.cos(z * 0.032) * 2.1 +
    Math.sin(x * 0.075 + 1.1) * Math.sin(z * 0.068) * 0.75;

  // Flatten camp & clearing gently
  const campFactor = Math.max(0, 1 - Math.hypot(x, z) / 22);
  const clearingFactor = Math.max(0, 1 - Math.hypot(x - 48, z + 32) / 26);
  const ruinsFactor = Math.max(0, 1 - Math.hypot(x + 50, z - 22) / 22);
  const flatBlend = Math.min(1, campFactor + clearingFactor * 0.85 + ruinsFactor * 0.85);
  h *= 1 - flatBlend * 0.75;

  // Elevated canopy ridge in northwest
  const canopyLift = Math.max(0, 1 - Math.hypot(x + 38, z + 48) / 42);
  h += canopyLift * 2.6;

  // River depression
  const rDist = distanceToRiver(x, z);
  const riverWidth = 7.4;
  if (rDist < riverWidth + 4.5) {
    const t = Math.max(0, Math.min(1, (rDist - (riverWidth - 2.5)) / 7.0));
    const smooth = t * t * (3 - 2 * t);
    h = THREE.MathUtils.lerp(-1.45, h, smooth);
  }

  // Smooth natural valley rim cliffs beyond playable radius
  if (distFromOrigin > PLAYABLE_RADIUS - 8) {
    const rimT = Math.max(0, (distFromOrigin - (PLAYABLE_RADIUS - 8)) / 36);
    h += rimT * rimT * 18.0 + Math.sin(x * 0.14 + z * 0.11) * rimT * 2.8;
  }

  return h;
}

export function groundHeightAt(x: number, z: number): number {
  let h = baseTerrainHeight(x, z);

  // Road flattening (keeps trail smooth for comfortable driving)
  const rDist = distanceToRoad(x, z);
  if (rDist < 7.0) {
    const t = Math.max(0, Math.min(1, (rDist - 3.2) / 3.8));
    const smooth = t * t * (3 - 2 * t);
    const roadBase = Math.max(0.18, h);
    h = THREE.MathUtils.lerp(roadBase, h, smooth);
  }

  // Bridge deck height over river crossing
  if (isOnBridge(x, z)) {
    const bx = 12;
    const bz = riverCenterZ(bx);
    const localZ = Math.abs(z - bz) / 9.5;
    const arch = Math.cos(localZ * Math.PI * 0.5) * 0.55;
    return Math.max(h, 0.55 + arch);
  }

  return h;
}

export function surfaceTypeAt(x: number, z: number): 'road' | 'bridge' | 'water' | 'clearing' | 'forest' {
  if (isOnBridge(x, z)) return 'bridge';
  if (distanceToRoad(x, z) < 3.7) return 'road';
  if (distanceToRiver(x, z) < 6.4 && groundHeightAt(x, z) < -0.15) return 'water';
  if (Math.hypot(x - 48, z + 32) < 25 || Math.hypot(x, z) < 19) return 'clearing';
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
  const segments = 128;
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
    const y = baseTerrainHeight(x, z);

    // Flatten road vertices gently too
    const roadD = distanceToRoad(x, z);
    let finalY = y;
    if (roadD < 6.5) {
      const t = Math.max(0, Math.min(1, (roadD - 3.0) / 3.5));
      const smooth = t * t * (3 - 2 * t);
      finalY = THREE.MathUtils.lerp(Math.max(0.18, y), y, smooth);
    }
    pos.setY(i, finalY);

    const riverD = distanceToRiver(x, z);
    const distOrigin = Math.hypot(x, z);
    const meadowBlend = Math.max(0, 1 - Math.hypot(x - 48, z + 32) / 28);
    const campBlend = Math.max(0, 1 - Math.hypot(x, z) / 20);

    tmp.copy(cForest);
    if (Math.sin(x * 0.1 + z * 0.08) > 0.25) {
      tmp.lerp(cForestDeep, 0.45);
    }
    if (meadowBlend > 0 || campBlend > 0) {
      tmp.lerp(cClearing, Math.min(1, meadowBlend + campBlend * 0.7));
    }
    if (riverD < 8.6) {
      const bankT = Math.max(0, Math.min(1, 1 - (riverD - 5.2) / 3.4));
      tmp.lerp(cSand, bankT * 0.88);
    }
    if (roadD < 5.0) {
      const roadT = Math.max(0, Math.min(1, 1 - (roadD - 2.6) / 2.4));
      tmp.lerp(cRoad, roadT * 0.92);
    }
    if (distOrigin > PLAYABLE_RADIUS - 4) {
      const rimT = Math.min(1, (distOrigin - (PLAYABLE_RADIUS - 4)) / 24);
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
