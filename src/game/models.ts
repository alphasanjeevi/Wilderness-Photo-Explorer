import * as THREE from 'three';
import { SpeciesDefinition } from '../types/game';
import { ColliderWorld } from './physics';
import {
  BRIDGE_HALF_L,
  BRIDGE_HALF_W,
  BRIDGE_RAMP_L,
  BRIDGE_X,
  BRIDGE_Z,
  CAMP_X,
  CAMP_Z,
  distanceToRiver,
  distanceToRoad,
  groundHeightAt,
  PLAYABLE_RADIUS,
  riverCenterZ,
  RUINS_X,
  RUINS_Z,
  WATERFALL_X,
  WATERFALL_Z,
} from './terrain';

export interface JeepRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheelPivots: THREE.Group[]; // [FL, FR, RL, RR]
  wheelMeshes: THREE.Group[];
  headlightMat: THREE.MeshStandardMaterial;
  tailLightMat: THREE.MeshStandardMaterial;
}

export interface AnimalRig {
  root: THREE.Group;
  visual: THREE.Group;
  head: THREE.Object3D | null;
  tail: THREE.Object3D | null;
  legs: THREE.Object3D[];
  wings: THREE.Object3D[];
  shadowPlane: THREE.Mesh | null;
}

export function createJeepModel(shadowTex: THREE.CanvasTexture): JeepRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const paintMat = new THREE.MeshStandardMaterial({
    color: 0x5c7650, // cozy forest sage olive
    roughness: 0.42,
    metalness: 0.12,
    flatShading: true,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x2b2d2a,
    roughness: 0.78,
    metalness: 0.25,
    flatShading: true,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xc2b8a3,
    roughness: 0.28,
    metalness: 0.78,
    flatShading: true,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9ec4d4,
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.72,
  });
  const canvasTopMat = new THREE.MeshStandardMaterial({
    color: 0xdccbb1,
    roughness: 0.88,
    metalness: 0.02,
    flatShading: true,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0xc47b35,
    roughness: 0.65,
    metalness: 0.08,
    flatShading: true,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff3cc,
    emissive: 0xffd27d,
    emissiveIntensity: 0.25,
    roughness: 0.2,
  });
  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0xd94336,
    emissive: 0xb52b20,
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });

  // 1. Primary Chassis Hull (Beveled ExtrudeGeometry)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-1.85, 0.0);
  hullShape.lineTo(1.85, 0.0);
  hullShape.lineTo(1.85, 0.56);
  hullShape.lineTo(0.82, 0.62);
  hullShape.lineTo(0.56, 0.76);
  hullShape.lineTo(-1.75, 0.76);
  hullShape.lineTo(-1.85, 0.56);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.56,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  hullGeo.translate(0, 0, -0.78);
  hullGeo.rotateY(Math.PI / 2); // Forward is +Z
  const hullMesh = new THREE.Mesh(hullGeo, paintMat);
  hullMesh.position.y = 0.42;
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  bodyGroup.add(hullMesh);

  // 2. Cabin Canopy + Roll Pillars
  const cabinRoof = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.14, 1.95),
    canvasTopMat
  );
  cabinRoof.position.set(0, 1.72, -0.42);
  cabinRoof.castShadow = true;
  bodyGroup.add(cabinRoof);

  const pillarPositions: [number, number][] = [
    [-0.68, 0.48],
    [0.68, 0.48],
    [-0.68, -0.45],
    [0.68, -0.45],
    [-0.68, -1.32],
    [0.68, -1.32],
  ];
  const pillarGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.64, 6);
  for (const [px, pz] of pillarPositions) {
    const pillar = new THREE.Mesh(pillarGeo, trimMat);
    pillar.position.set(px, 1.38, pz);
    pillar.castShadow = true;
    bodyGroup.add(pillar);
  }

  // 3. Windshield Frame & Glass
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.52, 0.05), glassMat);
  windshield.position.set(0, 1.42, 0.56);
  windshield.rotation.x = -0.18;
  bodyGroup.add(windshield);

  // 4. Front Bumper & Grille
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.22, 0.26), trimMat);
  bumper.position.set(0, 0.54, 1.92);
  bumper.castShadow = true;
  bodyGroup.add(bumper);

  const bullBar = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 12, Math.PI), metalMat);
  bullBar.position.set(0, 0.68, 1.95);
  bodyGroup.add(bullBar);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.34, 0.08), metalMat);
  grille.position.set(0, 0.88, 1.88);
  bodyGroup.add(grille);

  // 5. Headlights & Taillights
  const lampGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10);
  lampGeo.rotateX(Math.PI / 2);
  for (const sx of [-0.56, 0.56]) {
    const hl = new THREE.Mesh(lampGeo, headlightMat);
    hl.position.set(sx, 0.9, 1.89);
    bodyGroup.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), tailLightMat);
    tl.position.set(sx, 0.88, -1.89);
    bodyGroup.add(tl);
  }

  // 6. Roof Rack + Expedition Gear (Crate + Rolled Sleeping Mat)
  const rackGroup = new THREE.Group();
  rackGroup.position.set(0, 1.82, -0.45);
  const railGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.75, 6);
  railGeo.rotateX(Math.PI / 2);
  for (const rx of [-0.62, 0.62]) {
    const rail = new THREE.Mesh(railGeo, metalMat);
    rail.position.set(rx, 0.04, 0);
    rackGroup.add(rail);
  }
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.28, 0.54), crateMat);
  crate.position.set(-0.22, 0.16, -0.2);
  crate.castShadow = true;
  rackGroup.add(crate);

  const tarpRoll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.85, 8),
    new THREE.MeshStandardMaterial({ color: 0x3f6a73, roughness: 0.8, flatShading: true })
  );
  tarpRoll.rotation.z = Math.PI / 2;
  tarpRoll.position.set(0.15, 0.14, 0.42);
  rackGroup.add(tarpRoll);
  bodyGroup.add(rackGroup);

  // 7. Rear Spare Tire
  const spareGroup = new THREE.Group();
  spareGroup.position.set(0, 0.94, -1.96);
  const spareTire = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.11, 8, 14), trimMat);
  const spareHub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10), metalMat);
  spareHub.rotation.x = Math.PI / 2;
  spareGroup.add(spareTire, spareHub);
  bodyGroup.add(spareGroup);

  // 8. Interior Seats & Steering Wheel (visible through open sides)
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x7c5534, roughness: 0.85, flatShading: true });
  for (const sx of [-0.36, 0.36]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.48, 0.42), seatMat);
    seat.position.set(sx, 1.08, -0.15);
    bodyGroup.add(seat);
  }

  // 9. Four Articulated Wheels (Bottom of tires sit flush at y = 0)
  const wheelOffsets: [number, number, number][] = [
    [-0.92, 0.42, 1.18], // FL
    [0.92, 0.42, 1.18], // FR
    [-0.92, 0.42, -1.16], // RL
    [0.92, 0.42, -1.16], // RR
  ];
  const wheelPivots: THREE.Group[] = [];
  const wheelMeshes: THREE.Group[] = [];
  const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 8);
  rimGeo.rotateZ(Math.PI / 2);

  for (const [wx, wy, wz] of wheelOffsets) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, wy, wz);
    const wheelMesh = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, trimMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, metalMat);
    wheelMesh.add(tire, rim);
    pivot.add(wheelMesh);
    group.add(pivot);
    wheelPivots.push(pivot);
    wheelMeshes.push(wheelMesh);
  }

  // 10. Soft Radial Contact Shadow Plane
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 4.9),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.03;
  group.add(shadowPlane);

  return {
    group,
    bodyGroup,
    wheelPivots,
    wheelMeshes,
    headlightMat,
    tailLightMat,
  };
}

export function createLandmarks(
  scene: THREE.Scene,
  woodTex: THREE.CanvasTexture,
  colliders: ColliderWorld
): { waterfallParticles: THREE.Points; fireflies: THREE.Points } {
  const landmarkGroup = new THREE.Group();
  scene.add(landmarkGroup);

  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.85,
    metalness: 0.04,
    flatShading: true,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x7e8075,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x4b7c42,
    roughness: 0.88,
    flatShading: true,
  });
  const canvasMat = new THREE.MeshStandardMaterial({
    color: 0xe6d7bd,
    roughness: 0.85,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  // === 1. RESEARCH CAMP BASE ===
  const campGroup = new THREE.Group();
  campGroup.position.set(CAMP_X, groundHeightAt(CAMP_X, CAMP_Z), CAMP_Z);
  campGroup.rotation.y = 0.4;

  const deck = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 5.6), woodMat);
  deck.position.y = 0.175;
  deck.receiveShadow = true;
  deck.castShadow = true;
  campGroup.add(deck);

  // Solid collider for the raised camp deck, tent, crates, and lantern post
  colliders.addBox(CAMP_X, CAMP_Z, 3.85, 3.05, 0.4, 'camp_deck');

  // Expedition A-Frame Tent (multi-part)
  const tentBody = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.7, 4), canvasMat);
  tentBody.rotation.y = Math.PI / 4;
  tentBody.scale.set(1.2, 1, 0.95);
  tentBody.position.set(-0.8, 1.65, -0.3);
  tentBody.castShadow = true;
  tentBody.receiveShadow = true;
  campGroup.add(tentBody);

  const tentTrim = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.18, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xc86e2e, roughness: 0.7, flatShading: true })
  );
  tentTrim.position.set(-0.8, 2.95, -0.3);
  campGroup.add(tentTrim);

  // Radio mast + warm camp lantern
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.4, 6), stoneMat);
  mast.position.set(2.4, 2.35, -1.6);
  mast.castShadow = true;
  campGroup.add(mast);

  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffe29a,
      emissive: 0xffaa33,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    })
  );
  lantern.position.set(2.4, 2.55, 1.3);
  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6), woodMat);
  lanternPost.position.set(2.4, 1.35, 1.3);
  campGroup.add(lantern, lanternPost);

  // Supply crates
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xb97a3d, roughness: 0.72, flatShading: true });
  const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.85), crateMat);
  c1.position.set(1.6, 0.72, 1.4);
  c1.castShadow = true;
  const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.58, 0.72), crateMat);
  c2.position.set(1.7, 1.38, 1.35);
  c2.rotation.y = 0.35;
  c2.castShadow = true;
  campGroup.add(c1, c2);

  // Trailhead Signpost near road
  const signPost = new THREE.Group();
  const sx = 7.5;
  const sz = 2.0;
  signPost.position.set(sx, groundHeightAt(sx, sz), sz);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.3, 6), woodMat);
  post.position.y = 1.15;
  post.castShadow = true;
  const signBoard1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 0.08), woodMat);
  signBoard1.position.set(0.35, 1.95, 0);
  signBoard1.rotation.y = 0.25;
  const signBoard2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.08), woodMat);
  signBoard2.position.set(-0.3, 1.55, 0);
  signBoard2.rotation.y = -0.35;
  signPost.add(post, signBoard1, signBoard2);
  landmarkGroup.add(campGroup, signPost);
  colliders.addCircle(sx, sz, 0.45, 'signpost');

  // === 2. WOODEN BRIDGE OVER RIVER (with smooth approach ramps & solid side railings) ===
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(BRIDGE_X, 0, BRIDGE_Z);

  const deckWidth = BRIDGE_HALF_W * 2;
  const deckLength = BRIDGE_HALF_L * 2;
  const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(deckWidth, 0.42, deckLength), woodMat);
  deckMesh.position.y = 0.92;
  deckMesh.receiveShadow = true;
  deckMesh.castShadow = true;
  bridgeGroup.add(deckMesh);

  // Approach wooden ramps on North and South ends so driving onto the bridge is smooth
  const rampRise = 0.82;
  const rampAngle = Math.atan2(rampRise, BRIDGE_RAMP_L);
  const rampHyp = Math.hypot(BRIDGE_RAMP_L, rampRise);
  for (const dir of [-1, 1]) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(deckWidth, 0.34, rampHyp), woodMat);
    ramp.position.set(0, 0.56, dir * (BRIDGE_HALF_L + BRIDGE_RAMP_L * 0.48));
    ramp.rotation.x = dir * rampAngle;
    ramp.receiveShadow = true;
    ramp.castShadow = true;
    bridgeGroup.add(ramp);
  }

  // Side guard rails, posts & pilings + solid rail colliders
  const railSpan = deckLength + 2.0;
  for (const sideSign of [-1, 1]) {
    const sideX = sideSign * (BRIDGE_HALF_W - 0.28);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, railSpan), woodMat);
    rail.position.set(sideX, 1.88, 0);
    rail.castShadow = true;
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, railSpan), woodMat);
    midRail.position.set(sideX, 1.44, 0);
    bridgeGroup.add(rail, midRail);

    for (let pz = -BRIDGE_HALF_L; pz <= BRIDGE_HALF_L; pz += 4.2) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 3.9, 7), woodMat);
      piling.position.set(sideX, 0.2, pz);
      piling.castShadow = true;
      bridgeGroup.add(piling);
    }

    // Solid side railing + side abutment collider prevents sideways clipping through the bridge
    colliders.addBox(
      BRIDGE_X + sideX,
      BRIDGE_Z,
      0.55,
      BRIDGE_HALF_L + BRIDGE_RAMP_L * 0.45,
      0,
      'bridge_railing'
    );
  }
  landmarkGroup.add(bridgeGroup);

  // === 3. MOSSY STONE RUINS ===
  const ruinsGroup = new THREE.Group();
  ruinsGroup.position.set(RUINS_X, groundHeightAt(RUINS_X, RUINS_Z), RUINS_Z);
  ruinsGroup.rotation.y = 0.55;

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.65, 9.0), stoneMat);
  plinth.position.y = 0.3;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  ruinsGroup.add(plinth);

  // Solid collider for the stone plinth & columns
  colliders.addBox(RUINS_X, RUINS_Z, 5.6, 4.6, 0.55, 'stone_ruins');

  const colPositions: [number, number, number][] = [
    [-3.6, 2.2, -2.8],
    [3.6, 2.5, -2.8],
    [-3.6, 1.4, 2.8],
    [3.6, 2.4, 2.8],
  ];
  for (const [cx, ch, cz] of colPositions) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, ch * 2, 7), stoneMat);
    col.position.set(cx, ch + 0.4, cz);
    col.castShadow = true;
    col.receiveShadow = true;
    ruinsGroup.add(col);

    const mossCap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), mossMat);
    mossCap.scale.set(1.2, 0.45, 1.2);
    mossCap.position.set(cx, ch * 2 + 0.35, cz);
    ruinsGroup.add(mossCap);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.72, 1.15), stoneMat);
  lintel.position.set(0, 4.95, -2.8);
  lintel.castShadow = true;
  ruinsGroup.add(lintel);

  const fallenCol = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 3.2, 7), stoneMat);
  fallenCol.rotation.z = Math.PI / 2;
  fallenCol.rotation.y = 0.38;
  fallenCol.position.set(-1.2, 0.95, 2.1);
  fallenCol.castShadow = true;
  ruinsGroup.add(fallenCol);
  landmarkGroup.add(ruinsGroup);

  // === 4. WATERFALL CLIFF & SPLASH POOL ===
  const wfGroup = new THREE.Group();
  wfGroup.position.set(WATERFALL_X, 0, WATERFALL_Z);

  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0x5c6358,
    roughness: 0.94,
    flatShading: true,
  });
  for (let i = 0; i < 6; i++) {
    const rad = 3.6 + (i % 3) * 1.5;
    const rx = -4.5 + (i % 2) * 2.6;
    const rz = (i - 2.5) * 3.6;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 0), cliffMat);
    rock.position.set(rx, 2.6 + i * 1.2, rz);
    rock.scale.set(1.2, 1.4, 1.1);
    rock.castShadow = true;
    rock.receiveShadow = true;
    wfGroup.add(rock);
    colliders.addCircle(WATERFALL_X + rx, WATERFALL_Z + rz, rad * 0.95, 'waterfall_cliff');
  }

  const cascadeMat = new THREE.MeshStandardMaterial({
    color: 0xa6e3eb,
    emissive: 0x3b8ea5,
    emissiveIntensity: 0.35,
    roughness: 0.15,
    transparent: true,
    opacity: 0.78,
  });
  const cascade = new THREE.Mesh(new THREE.BoxGeometry(1.8, 9.2, 5.2), cascadeMat);
  cascade.position.set(-1.4, 3.8, 0);
  cascade.rotation.z = -0.18;
  wfGroup.add(cascade);
  landmarkGroup.add(wfGroup);

  // === 5. CONTINUOUS RIVER WATER RIBBON ===
  const riverGeo = new THREE.PlaneGeometry(480, 16.5, 110, 4);
  riverGeo.rotateX(-Math.PI / 2);
  const rPos = riverGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vz = rPos.getZ(i);
    rPos.setZ(i, vz + riverCenterZ(vx));
  }
  riverGeo.computeVertexNormals();
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x3d999e,
    roughness: 0.14,
    metalness: 0.22,
    transparent: true,
    opacity: 0.84,
  });
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.position.y = -0.38;
  riverMesh.receiveShadow = true;
  landmarkGroup.add(riverMesh);

  // Waterfall mist particles
  const mistCount = 70;
  const mistPos = new Float32Array(mistCount * 3);
  for (let i = 0; i < mistCount; i++) {
    mistPos[i * 3] = WATERFALL_X + (Math.random() - 0.5) * 5.5;
    mistPos[i * 3 + 1] = Math.random() * 6.5;
    mistPos[i * 3 + 2] = WATERFALL_Z + (Math.random() - 0.5) * 6.5;
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  const mistMat = new THREE.PointsMaterial({
    color: 0xe6f8fa,
    size: 0.7,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const waterfallParticles = new THREE.Points(mistGeo, mistMat);
  scene.add(waterfallParticles);

  // Dusk Fireflies across the expanded valley
  const fireflyCount = 110;
  const ffPos = new Float32Array(fireflyCount * 3);
  for (let i = 0; i < fireflyCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 16 + Math.random() * 145;
    const fx = Math.cos(ang) * rad;
    const fz = Math.sin(ang) * rad;
    ffPos[i * 3] = fx;
    ffPos[i * 3 + 1] = groundHeightAt(fx, fz) + 1.0 + Math.random() * 3.0;
    ffPos[i * 3 + 2] = fz;
  }
  const ffGeo = new THREE.BufferGeometry();
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffMat = new THREE.PointsMaterial({
    color: 0xffe47a,
    size: 0.45,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  scene.add(fireflies);

  return { waterfallParticles, fireflies };
}

export function createInstancedFlora(scene: THREE.Scene, colliders: ColliderWorld): void {
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x694a33,
    roughness: 0.9,
    flatShading: true,
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    flatShading: true,
  });
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    flatShading: true,
  });

  // Deterministic PRNG so world layout & colliders are reproducible
  let seed = 4219;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const canopyTrees: { x: number; y: number; z: number; s: number; rot: number }[] = [];
  const palmTrees: { x: number; y: number; z: number; s: number; rot: number }[] = [];

  for (let i = 0; i < 1400 && canopyTrees.length < 340; i++) {
    const angle = rand() * Math.PI * 2;
    const r = 18 + Math.pow(rand(), 0.72) * (PLAYABLE_RADIUS + 28);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    if (distanceToRoad(x, z) < 7.8) continue;
    if (distanceToRiver(x, z) < 10.2) continue;
    if (Math.hypot(x - CAMP_X, z - CAMP_Z) < 14) continue;
    if (Math.hypot(x - RUINS_X, z - RUINS_Z) < 14) continue;
    if (Math.hypot(x - BRIDGE_X, z - BRIDGE_Z) < 16) continue;
    if (Math.hypot(x - 96, z + 64) < 24 && rand() < 0.78) continue; // Sunlit Meadow clearing

    const y = groundHeightAt(x, z);
    const s = 0.86 + rand() * 0.34;
    const rot = rand() * Math.PI * 2;
    if (rand() < 0.34 && distanceToRiver(x, z) < 48) {
      palmTrees.push({ x, y, z, s, rot });
    } else {
      canopyTrees.push({ x, y, z, s, rot });
    }
  }

  // === CANOPY TREES (Composite: trunk + lower crown + upper crown) ===
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.52, 4.5, 6);
  trunkGeo.translate(0, 2.0, 0); // Extends 0.25 below origin so slopes never show gaps
  const crownLowGeo = new THREE.DodecahedronGeometry(2.35, 0);
  crownLowGeo.scale(1.1, 0.78, 1.1);
  crownLowGeo.translate(0, 4.6, 0);
  const crownTopGeo = new THREE.DodecahedronGeometry(1.68, 0);
  crownTopGeo.scale(1.0, 0.85, 1.0);
  crownTopGeo.translate(0.35, 6.1, -0.2);

  const countC = canopyTrees.length;
  const instTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, countC);
  const instCrownLow = new THREE.InstancedMesh(crownLowGeo, foliageMat, countC);
  const instCrownTop = new THREE.InstancedMesh(crownTopGeo, foliageMat, countC);
  instTrunks.castShadow = true;
  instCrownLow.castShadow = true;
  instCrownTop.castShadow = true;
  instCrownLow.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();
  const paletteGreens = [0x3d733c, 0x4b8744, 0x2f6138, 0x5d9449, 0x41784c];

  for (let i = 0; i < countC; i++) {
    const t = canopyTrees[i];
    dummy.position.set(t.x, t.y - 0.32, t.z);
    dummy.rotation.set(0, t.rot, 0);
    dummy.scale.setScalar(t.s);
    dummy.updateMatrix();
    instTrunks.setMatrixAt(i, dummy.matrix);
    instCrownLow.setMatrixAt(i, dummy.matrix);
    instCrownTop.setMatrixAt(i, dummy.matrix);

    cColor.setHex(paletteGreens[i % paletteGreens.length]);
    cColor.offsetHSL((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.06);
    instCrownLow.setColorAt(i, cColor);
    cColor.offsetHSL(0.01, 0, 0.05);
    instCrownTop.setColorAt(i, cColor);

    if (Math.hypot(t.x, t.z) < PLAYABLE_RADIUS + 4) {
      colliders.addCircle(t.x, t.z, 0.62 * t.s, 'canopy_tree');
    }
  }
  instTrunks.computeBoundingSphere();
  instCrownLow.computeBoundingSphere();
  instCrownTop.computeBoundingSphere();
  scene.add(instTrunks, instCrownLow, instCrownTop);

  // === PALM TREES (Composite: curved trunk + 5 fronds) ===
  if (palmTrees.length > 0) {
    const pCount = palmTrees.length;
    const pTrunkGeo = new THREE.CylinderGeometry(0.18, 0.36, 5.4, 6);
    pTrunkGeo.translate(0, 2.5, 0);
    pTrunkGeo.rotateZ(0.08);

    const frondGeo = new THREE.ConeGeometry(0.85, 3.0, 4);
    frondGeo.scale(0.65, 1, 0.22);
    frondGeo.rotateX(Math.PI * 0.38);
    frondGeo.translate(0, 5.1, 1.35);

    const pTrunks = new THREE.InstancedMesh(pTrunkGeo, trunkMat, pCount);
    const pFronds = new THREE.InstancedMesh(frondGeo, foliageMat, pCount * 5);
    pTrunks.castShadow = true;
    pFronds.castShadow = true;

    for (let i = 0; i < pCount; i++) {
      const p = palmTrees[i];
      dummy.position.set(p.x, p.y - 0.32, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      pTrunks.setMatrixAt(i, dummy.matrix);

      for (let f = 0; f < 5; f++) {
        dummy.rotation.set(0, p.rot + (f * Math.PI * 2) / 5, 0);
        dummy.updateMatrix();
        pFronds.setMatrixAt(i * 5 + f, dummy.matrix);
        cColor.setHex(0x529642);
        cColor.offsetHSL(0, 0, (rand() - 0.5) * 0.07);
        pFronds.setColorAt(i * 5 + f, cColor);
      }

      if (Math.hypot(p.x, p.z) < PLAYABLE_RADIUS + 4) {
        colliders.addCircle(p.x, p.z, 0.52 * p.s, 'palm_tree');
      }
    }
    pTrunks.computeBoundingSphere();
    pFronds.computeBoundingSphere();
    scene.add(pTrunks, pFronds);
  }

  // === ROCKS & BOULDERS (Solid colliders) ===
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 0);
  const rockCount = 150;
  const instRocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  instRocks.castShadow = true;
  instRocks.receiveShadow = true;
  let placedRocks = 0;
  for (let i = 0; i < 800 && placedRocks < rockCount; i++) {
    const x = (rand() - 0.5) * 360;
    const z = (rand() - 0.5) * 360;
    if (distanceToRoad(x, z) < 6.4) continue;
    if (Math.hypot(x - CAMP_X, z - CAMP_Z) < 10) continue;
    if (Math.hypot(x - BRIDGE_X, z - BRIDGE_Z) < 15) continue;
    const y = groundHeightAt(x, z);
    const sx = 0.65 + rand() * 1.15;
    const sy = 0.5 + rand() * 0.7;
    const sz = 0.65 + rand() * 1.05;
    dummy.position.set(x, y + 0.12, z);
    dummy.rotation.set(rand() * 2, rand() * 3, rand() * 2);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    instRocks.setMatrixAt(placedRocks, dummy.matrix);
    cColor.setHex(0x7c8276).offsetHSL(0, 0, (rand() - 0.5) * 0.1);
    instRocks.setColorAt(placedRocks, cColor);

    if (Math.hypot(x, z) < PLAYABLE_RADIUS + 2) {
      colliders.addCircle(x, z, Math.max(sx, sz) * 0.85, 'boulder');
    }
    placedRocks++;
  }
  instRocks.count = placedRocks;
  instRocks.computeBoundingSphere();
  scene.add(instRocks);

  // === FERNS & WILDFLOWERS (Passable ground cover) ===
  const fernGeo = new THREE.ConeGeometry(0.65, 0.9, 5);
  fernGeo.scale(1.1, 0.7, 1.1);
  fernGeo.translate(0, 0.35, 0);
  const fernCount = 360;
  const instFerns = new THREE.InstancedMesh(fernGeo, foliageMat, fernCount);
  let placedFerns = 0;
  for (let i = 0; i < 1100 && placedFerns < fernCount; i++) {
    const x = (rand() - 0.5) * 350;
    const z = (rand() - 0.5) * 350;
    if (distanceToRoad(x, z) < 4.8) continue;
    if (distanceToRiver(x, z) < 6.4) continue;
    const y = groundHeightAt(x, z);
    dummy.position.set(x, y - 0.08, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.75 + rand() * 0.75);
    dummy.updateMatrix();
    instFerns.setMatrixAt(placedFerns, dummy.matrix);
    cColor.setHex(rand() > 0.2 ? 0x518f40 : 0xd9a13b);
    instFerns.setColorAt(placedFerns, cColor);
    placedFerns++;
  }
  instFerns.count = placedFerns;
  instFerns.computeBoundingSphere();
  scene.add(instFerns);
}

export function buildSpeciesMesh(
  species: SpeciesDefinition,
  shadowTex: THREE.CanvasTexture
): AnimalRig {
  const root = new THREE.Group();
  const visual = new THREE.Group();
  visual.scale.setScalar(species.scale);
  root.add(visual);

  const legs: THREE.Object3D[] = [];
  const wings: THREE.Object3D[] = [];
  let head: THREE.Object3D | null = null;
  let tail: THREE.Object3D | null = null;

  const primaryMat = new THREE.MeshStandardMaterial({
    color: species.colors.primary,
    roughness: 0.78,
    metalness: 0.04,
    flatShading: true,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: species.colors.secondary,
    roughness: 0.85,
    metalness: 0.02,
    flatShading: true,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: species.colors.accent,
    roughness: 0.55,
    metalness: 0.08,
    flatShading: true,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: species.colors.eye,
    roughness: 0.2,
    metalness: 0.1,
  });

  if (species.category === 'mammal') {
    const isPrimate = species.id === 'spider_monkey' || species.id === 'marmoset';
    const isDeer = species.id === 'spotted_deer';
    const isCapy = species.id === 'capybara' || species.id === 'baird_tapir';

    // Torso
    const bodyLen = isCapy ? 1.25 : isPrimate ? 0.85 : 1.1;
    const bodyH = isCapy ? 0.62 : isPrimate ? 0.56 : 0.52;
    const bodyW = isCapy ? 0.62 : 0.48;
    const torso = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.45, 0),
      primaryMat
    );
    torso.scale.set(bodyW / 0.8, bodyH / 0.8, bodyLen / 0.8);
    torso.position.set(0, isDeer ? 0.78 : 0.56, 0);
    torso.castShadow = true;
    visual.add(torso);

    // Belly / Spots / Saddle accent
    const belly = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.36, 0),
      secondaryMat
    );
    belly.scale.set((bodyW * 0.75) / 0.7, (bodyH * 0.6) / 0.7, (bodyLen * 0.75) / 0.7);
    belly.position.set(0, isDeer ? 0.72 : 0.48, 0.02);
    visual.add(belly);

    if (species.id === 'spotted_deer' || species.id === 'jaguar' || species.id === 'ocelot') {
      for (let s = 0; s < 4; s++) {
        const spot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), secondaryMat);
        spot.position.set((s % 2 === 0 ? 1 : -1) * 0.21, isDeer ? 0.88 : 0.68, -0.2 + s * 0.15);
        visual.add(spot);
      }
    }

    // Head Group
    const headGrp = new THREE.Group();
    headGrp.position.set(0, isDeer ? 1.08 : 0.78, bodyLen * 0.48);
    const cranium = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), primaryMat);
    cranium.scale.set(0.95, 0.9, 1.1);
    cranium.castShadow = true;
    headGrp.add(cranium);

    const snout = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.16, species.id === 'baird_tapir' ? 0.34 : 0.22),
      species.id === 'red_panda' || species.id === 'coati' ? secondaryMat : primaryMat
    );
    snout.position.set(0, -0.05, 0.22);
    headGrp.add(snout);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.08), accentMat);
    nose.position.set(0, -0.02, species.id === 'baird_tapir' ? 0.39 : 0.32);
    headGrp.add(nose);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, isDeer || species.id === 'red_fox' ? 0.24 : 0.14, 4),
        species.id === 'marmoset' ? secondaryMat : accentMat
      );
      ear.position.set(side * 0.17, 0.24, -0.04);
      ear.rotation.z = -side * 0.25;
      headGrp.add(ear);

      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMat);
      eye.position.set(side * 0.14, 0.06, 0.18);
      headGrp.add(eye);
    }

    if (isDeer) {
      for (const side of [-1, 1]) {
        const antler = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.38, 5), accentMat);
        antler.position.set(side * 0.14, 0.36, -0.05);
        antler.rotation.z = -side * 0.35;
        headGrp.add(antler);
      }
    }
    visual.add(headGrp);
    head = headGrp;

    // 4 Articulated Limbs
    const legH = isDeer ? 0.68 : 0.44;
    const legGeo = new THREE.CylinderGeometry(0.07, 0.055, legH, 6);
    legGeo.translate(0, -legH / 2, 0);
    const legOffsets: [number, number, number][] = [
      [-0.19, legH + 0.05, bodyLen * 0.3],
      [0.19, legH + 0.05, bodyLen * 0.3],
      [-0.19, legH + 0.05, -bodyLen * 0.3],
      [0.19, legH + 0.05, -bodyLen * 0.3],
    ];
    for (const [lx, ly, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, accentMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      visual.add(leg);
      legs.push(leg);
    }

    // Tail
    const tailGrp = new THREE.Group();
    tailGrp.position.set(0, isDeer ? 0.8 : 0.6, -bodyLen * 0.48);
    if (!isCapy) {
      const tLen =
        species.id === 'spider_monkey' || species.id === 'coati' || species.id === 'red_panda'
          ? 0.72
          : 0.45;
      const tailMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, tLen, 6),
        species.id === 'red_fox' ? secondaryMat : primaryMat
      );
      tailMesh.rotation.x = species.id === 'coati' ? -0.3 : -Math.PI * 0.65;
      tailMesh.position.set(0, species.id === 'coati' ? 0.3 : -0.05, -tLen * 0.35);
      tailGrp.add(tailMesh);
    }
    visual.add(tailGrp);
    tail = tailGrp;
  } else if (species.category === 'bird') {
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), primaryMat);
    body.scale.set(0.85, 0.88, 1.35);
    body.castShadow = true;
    visual.add(body);

    const chest = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), secondaryMat);
    chest.position.set(0, -0.05, 0.14);
    visual.add(chest);

    const headGrp = new THREE.Group();
    headGrp.position.set(0, 0.2, 0.36);
    const hMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), primaryMat);
    headGrp.add(hMesh);

    const beakLen = species.id === 'toucan' ? 0.48 : 0.24;
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, beakLen, 5),
      species.id === 'toucan' ? secondaryMat : accentMat
    );
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.02, 0.16 + beakLen / 2);
    headGrp.add(beak);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), eyeMat);
      eye.position.set(side * 0.12, 0.05, 0.08);
      headGrp.add(eye);
    }
    visual.add(headGrp);
    head = headGrp;

    // Articulated Wings
    const wingGeo = new THREE.BoxGeometry(0.68, 0.06, 0.38);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.22, 0.08, 0.05);
      const wingMesh = new THREE.Mesh(wingGeo, side === 1 ? accentMat : secondaryMat);
      wingMesh.position.x = side * 0.34;
      wingMesh.castShadow = true;
      pivot.add(wingMesh);
      visual.add(pivot);
      wings.push(pivot);
    }

    // Tail Streamers
    const tailGrp = new THREE.Group();
    tailGrp.position.set(0, 0, -0.4);
    const tailLen = species.id === 'quetzal' ? 0.95 : 0.48;
    const tailFeather = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, tailLen), accentMat);
    tailFeather.position.z = -tailLen / 2;
    tailGrp.add(tailFeather);
    visual.add(tailGrp);
    tail = tailGrp;
  } else {
    // Insects & Amphibians
    if (species.behaviorArchetype === 'flutter') {
      // Butterfly or Dragonfly
      const isDragon = species.id === 'emerald_dragonfly';
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.04, isDragon ? 0.85 : 0.42, 6),
        secondaryMat
      );
      body.rotation.x = Math.PI / 2;
      visual.add(body);

      const wingGeo = isDragon
        ? new THREE.BoxGeometry(0.7, 0.02, 0.18)
        : new THREE.BoxGeometry(0.58, 0.02, 0.65);

      for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.04, 0.04, 0.04);
        const w = new THREE.Mesh(wingGeo, primaryMat);
        w.position.x = side * (isDragon ? 0.36 : 0.3);
        w.castShadow = true;
        pivot.add(w);
        visual.add(pivot);
        wings.push(pivot);
      }
    } else if (species.id === 'hercules_beetle') {
      const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), primaryMat);
      shell.scale.set(0.95, 0.72, 1.35);
      shell.position.y = 0.28;
      shell.castShadow = true;
      visual.add(shell);

      const hornGrp = new THREE.Group();
      hornGrp.position.set(0, 0.28, 0.38);
      const thorax = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), secondaryMat);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 5), secondaryMat);
      horn.rotation.x = Math.PI * 0.42;
      horn.position.set(0, 0.08, 0.24);
      hornGrp.add(thorax, horn);
      visual.add(hornGrp);
      head = hornGrp;
    } else {
      // Tree Frogs
      const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), primaryMat);
      body.scale.set(1.0, 0.75, 1.2);
      body.position.y = 0.26;
      body.castShadow = true;
      visual.add(body);

      const headGrp = new THREE.Group();
      headGrp.position.set(0, 0.34, 0.24);
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 6), eyeMat);
        eye.position.set(side * 0.14, 0.07, 0.04);
        headGrp.add(eye);
      }
      visual.add(headGrp);
      head = headGrp;

      for (const side of [-1, 1]) {
        const hindLeg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.24), secondaryMat);
        hindLeg.position.set(side * 0.24, 0.16, -0.14);
        visual.add(hindLeg);
        legs.push(hindLeg);
      }
    }
  }

  // Contact shadow disc for grounded creatures
  let shadowPlane: THREE.Mesh | null = null;
  if (species.flightHeight === 0) {
    shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3 * species.scale, 1.3 * species.scale),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.03;
    root.add(shadowPlane);
  }

  return {
    root,
    visual,
    head,
    tail,
    legs,
    wings,
    shadowPlane,
  };
}
