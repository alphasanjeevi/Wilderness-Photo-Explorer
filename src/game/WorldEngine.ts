import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/soundEngine';
import { TROPICAL_SPECIES } from '../data/species';
import {
  CapturedPhoto,
  FocusTargetInfo,
  GamePhase,
  HabitatZone,
  SpeciesDefinition,
  WeatherType,
  WorldHudTelemetry,
} from '../types/game';
import {
  AnimalRig,
  buildSpeciesMesh,
  createInstancedFlora,
  createJeepModel,
  createLandmarks,
  JeepRig,
} from './models';
import {
  BRIDGE_HALF_L,
  BRIDGE_HALF_W,
  BRIDGE_X,
  BRIDGE_Z,
  createTerrainMesh,
  distanceToRiver,
  getHabitatAt,
  groundHeightAt,
  HABITAT_ZONES,
  isOnBridge,
  PLAYABLE_RADIUS,
  riverCenterZ,
} from './terrain';
import { ColliderWorld } from './physics';
import {
  createContactShadowTexture,
  createGroundDetailTexture,
  createWoodPlankTexture,
} from './textures';

type AnimalState = 'idle' | 'wander' | 'graze' | 'flee';

interface WildlifeActor {
  species: SpeciesDefinition;
  rig: AnimalRig;
  homeX: number;
  homeZ: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  state: AnimalState;
  stateTimer: number;
  animPhase: number;
  hopHeight: number;
  baseRadius: number;
}

export interface WorldCallbacks {
  onTelemetry: (telemetry: WorldHudTelemetry) => void;
  onFocusChange: (focus: FocusTargetInfo | null) => void;
  onNearestCue?: (cue: string | null) => void;
}

// Pre-allocated scratch math objects (zero GC in animation loop)
const _vec3 = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _colorSky = new THREE.Color();
const _colorFog = new THREE.Color();
const _colorSun = new THREE.Color();
const _colorHemiSky = new THREE.Color();
const _colorHemiGround = new THREE.Color();

const SKY_MORNING = new THREE.Color(0x9fd0e6);
const SKY_NOON = new THREE.Color(0x8bc9e8);
const SKY_DUSK = new THREE.Color(0xe69f6c);
const SKY_RAIN = new THREE.Color(0x748b8d);

const SUN_MORNING = new THREE.Color(0xfff0cc);
const SUN_NOON = new THREE.Color(0xfff7e3);
const SUN_DUSK = new THREE.Color(0xff9b54);
const SUN_RAIN = new THREE.Color(0xc5d6d9);

export class WorldEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private callbacks: WorldCallbacks;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private jeep: JeepRig;
  private colliders = new ColliderWorld();
  private actors: WildlifeActor[] = [];
  private waterfallParticles: THREE.Points;
  private fireflies: THREE.Points;
  private rainPoints: THREE.Points;
  private rainMat: THREE.PointsMaterial;

  private groundTex: THREE.CanvasTexture;
  private shadowTex: THREE.CanvasTexture;
  private woodTex: THREE.CanvasTexture;

  private frameId = 0;
  private lastTimeMs = 0;
  private lastBumpMs = 0;
  private elapsedSec = 0;
  private disposed = false;

  // Game & Simulation state
  private phase: GamePhase = 'title';
  private weather: WeatherType = 'clear';
  private timeNormalized = 0.24; // Starts in warm morning sun
  private autoTimeCycle = true;
  private cameraSensitivity = 1.0;

  // Jeep physics state
  private jeepX = 0;
  private jeepZ = 5;
  private jeepY = 0;
  private jeepYaw = 0.25;
  private jeepSpeed = 0; // m/s
  private jeepSteer = 0;
  private wheelSpin = 0;
  private chaseYawOffset = 0;

  // Photo mode camera state
  private photoYaw = 0.25;
  private photoPitch = 0.04;
  private photoZoom = 1.0;
  private cameraPos = new THREE.Vector3(0, 6, -12);
  private cameraLookAt = new THREE.Vector3(0, 1.5, 5);
  private currentFov = 58;

  // Focus tracking
  private focusedSpeciesId: string | null = null;
  private focusProgress = 0;
  private focusLockPlayed = false;
  private lastHudPush = 0;

  // Input state (separated held vs edge)
  private heldKeys = new Set<string>();
  private virtualThrottle = 0;
  private virtualSteer = 0;
  private pointerDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Snapshots crop canvas
  private cropCanvas: HTMLCanvasElement;

  constructor(container: HTMLElement, callbacks: WorldCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.cropCanvas = document.createElement('canvas');
    this.cropCanvas.width = 480;
    this.cropCanvas.height = 360;

    // 1. Software WebGL detection per Three.js skill
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = SKY_MORNING.clone();
    this.scene.fog = new THREE.FogExp2(SKY_MORNING.getHex(), 0.0052);

    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.25, 420);

    // 4. Studio Environment Map via RoomEnvironment (mandatory on every device)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 5. Warm Key Sun + Cool Hemisphere Fill
    this.hemiLight = new THREE.HemisphereLight(0xaad9ee, 0x4b5c3b, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff0cc, 1.85);
    this.sunLight.position.set(45, 62, 32);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 175;
    const d = 52;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 6. Procedural Textures
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.groundTex = createGroundDetailTexture();
    this.groundTex.anisotropy = maxAniso;
    this.shadowTex = createContactShadowTexture();
    this.woodTex = createWoodPlankTexture();
    this.woodTex.anisotropy = maxAniso;

    // 7. World Geometry: Terrain, Landmarks, Flora, Jeep, Rain, Wildlife
    const terrain = createTerrainMesh(this.groundTex);
    this.scene.add(terrain);

    const { waterfallParticles, fireflies } = createLandmarks(this.scene, this.woodTex, this.colliders);
    this.waterfallParticles = waterfallParticles;
    this.fireflies = fireflies;

    createInstancedFlora(this.scene, this.colliders);

    this.jeep = createJeepModel(this.shadowTex);
    this.jeepY = groundHeightAt(this.jeepX, this.jeepZ);
    this.jeep.group.position.set(this.jeepX, this.jeepY, this.jeepZ);
    this.jeep.group.rotation.y = this.jeepYaw;
    this.scene.add(this.jeep.group);

    // Rain system
    const rainCount = 700;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 60;
      rainPositions[i * 3 + 1] = Math.random() * 24;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0xd9eef5,
      size: 0.22,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainPoints = new THREE.Points(rainGeo, this.rainMat);
    this.scene.add(this.rainPoints);

    // Spawn all 20 species across their habitats
    this.spawnWildlife();

    // Pre-warm shaders on GPU devices
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Attach listeners
    this.bindEvents();
    this.updateAtmosphere(0);

    // Start loop
    this.lastTimeMs = performance.now();
    this.scheduleNextTick();
  }

  private spawnWildlife(): void {
    const zoneMap = new Map(HABITAT_ZONES.map((z) => [z.habitat, z]));

    TROPICAL_SPECIES.forEach((species, idx) => {
      const zone = zoneMap.get(species.habitat) ?? HABITAT_ZONES[0];
      const count = species.rarity === 'common' ? 2 : 1;
      for (let copy = 0; copy < count; copy++) {
        const angle = ((idx * 1.9 + copy * 2.7) % (Math.PI * 2));
        const radius = 16 + ((idx * 11 + copy * 19) % 34);
        let sx = zone.x + Math.cos(angle) * radius;
        let sz = zone.z + Math.sin(angle) * radius;

        // River species spread along the wide riverbank & waterfall stretches
        if (species.habitat === 'river') {
          sx = -95 + ((idx * 17 + copy * 37) % 190);
          if (Math.abs(sx - BRIDGE_X) < 12) sx += 18;
          const rz = riverCenterZ(sx);
          sz = rz + (copy % 2 === 0 ? -9.5 : 9.8);
        }

        if (species.flightHeight === 0) {
          const safe = this.colliders.resolveAnimal(sx, sz, 0.75);
          sx = safe.x;
          sz = safe.z;
        }

        const rig = buildSpeciesMesh(species, this.shadowTex);
        const sy = groundHeightAt(sx, sz) + species.flightHeight;
        rig.root.position.set(sx, sy, sz);
        rig.root.rotation.y = angle + Math.PI;
        this.scene.add(rig.root);

        this.actors.push({
          species,
          rig,
          homeX: sx,
          homeZ: sz,
          x: sx,
          y: sy,
          z: sz,
          yaw: angle,
          targetX: sx + Math.cos(angle + 1) * 9,
          targetZ: sz + Math.sin(angle + 1) * 9,
          state: 'idle',
          stateTimer: 1.5 + (idx % 4),
          animPhase: idx * 0.8 + copy * 1.9,
          hopHeight: 0,
          baseRadius: 22,
        });
      }
    });
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onBlur = (): void => {
    this.heldKeys.clear();
    this.virtualThrottle = 0;
    this.virtualSteer = 0;
    this.pointerDragging = false;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    this.heldKeys.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.phase === 'playing' || this.phase === 'photo') {
      this.pointerDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.phase === 'photo') {
      const dx = e.movementX || (this.pointerDragging ? e.clientX - this.lastPointerX : 0);
      const dy = e.movementY || (this.pointerDragging ? e.clientY - this.lastPointerY : 0);
      if (this.pointerDragging || document.pointerLockElement === this.renderer.domElement) {
        this.addCameraLookDelta(dx, dy);
      } else if (Math.abs(dx) < 80 && Math.abs(dy) < 80) {
        // Gentle hover aim in photo mode on desktop without requiring drag
        this.addCameraLookDelta(dx * 0.55, dy * 0.55);
      }
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else if (this.phase === 'playing' && this.pointerDragging) {
      const dx = e.clientX - this.lastPointerX;
      this.chaseYawOffset = THREE.MathUtils.clamp(
        this.chaseYawOffset - dx * 0.0045 * this.cameraSensitivity,
        -1.35,
        1.35
      );
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onPointerUp = (): void => {
    this.pointerDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.phase !== 'photo') return;
    e.preventDefault();
    this.setZoom(this.photoZoom - Math.sign(e.deltaY) * 0.35);
  };

  public addCameraLookDelta(dx: number, dy: number): void {
    const zoomDamp = 1 / Math.max(1, this.photoZoom * 0.72);
    const sens = 0.0028 * this.cameraSensitivity * zoomDamp;
    this.photoYaw -= dx * sens;
    this.photoPitch = THREE.MathUtils.clamp(this.photoPitch - dy * sens, -0.45, 0.72);
  }

  public setVirtualInput(throttle: number, steer: number): void {
    this.virtualThrottle = THREE.MathUtils.clamp(throttle, -1, 1);
    this.virtualSteer = THREE.MathUtils.clamp(steer, -1, 1);
  }

  public setPhase(next: GamePhase): void {
    const prev = this.phase;
    this.phase = next;
    this.heldKeys.clear();
    if (next === 'photo' && prev !== 'photo') {
      this.photoYaw = this.jeepYaw;
      this.photoPitch = 0.05;
      this.photoZoom = 1.35;
      this.focusProgress = 0;
      this.focusedSpeciesId = null;
      this.focusLockPlayed = false;
      this.jeepSpeed *= 0.25;
    } else if (next === 'playing' && prev === 'photo') {
      this.focusProgress = 0;
      this.focusedSpeciesId = null;
      this.callbacks.onFocusChange(null);
    }
  }

  public setWeather(weather: WeatherType): void {
    this.weather = weather;
  }

  public setTimeNormalized(t: number): void {
    this.timeNormalized = ((t % 1) + 1) % 1;
  }

  public setAutoTimeCycle(enabled: boolean): void {
    this.autoTimeCycle = enabled;
  }

  public setCameraSensitivity(sens: number): void {
    this.cameraSensitivity = sens;
  }

  public setZoom(z: number): void {
    this.photoZoom = THREE.MathUtils.clamp(z, 1.0, 5.0);
  }

  public honk(): void {
    soundEngine.playHorn();
    // Gentle wildlife startle within 24m
    for (const a of this.actors) {
      const dist = Math.hypot(a.x - this.jeepX, a.z - this.jeepZ);
      if (dist < 24 && a.species.shyness > 0.35) {
        a.state = 'flee';
        a.stateTimer = 4.5;
      }
    }
  }

  public resetJeepToCamp(): void {
    this.jeepX = 0;
    this.jeepZ = 5;
    this.jeepYaw = 0.25;
    this.jeepSpeed = 0;
    this.chaseYawOffset = 0;
  }

  public capturePhoto(): { photo: CapturedPhoto; focus: FocusTargetInfo | null } | null {
    if (this.phase !== 'photo') return null;

    // Render crisp current frame immediately before extracting canvas pixels
    this.renderer.render(this.scene, this.camera);

    const srcCanvas = this.renderer.domElement;
    const sw = srcCanvas.width;
    const sh = srcCanvas.height;
    const targetAspect = 4 / 3;
    let cropW = sw * 0.78;
    let cropH = cropW / targetAspect;
    if (cropH > sh * 0.82) {
      cropH = sh * 0.82;
      cropW = cropH * targetAspect;
    }
    const sx = (sw - cropW) / 2;
    const sy = (sh - cropH) / 2;

    const ctx = this.cropCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(
      srcCanvas,
      sx,
      sy,
      cropW,
      cropH,
      0,
      0,
      this.cropCanvas.width,
      this.cropCanvas.height
    );

    const dataUrl = this.cropCanvas.toDataURL('image/jpeg', 0.85);
    const focus = this.evaluateFocusTarget(0, true);
    if (!focus) {
      return {
        photo: {
          id: `scenic_${Date.now()}`,
          speciesId: '',
          dataUrl,
          capturedAt: new Date().toISOString(),
          habitatLabel: getHabitatAt(this.jeepX, this.jeepZ).label,
          timeOfDayLabel: this.getTimeLabel(),
          weather: this.weather,
          qualityLabel: 'Distant Subject',
        },
        focus: null,
      };
    }

    const photo: CapturedPhoto = {
      id: `photo_${focus.species.id}_${Date.now()}`,
      speciesId: focus.species.id,
      dataUrl,
      capturedAt: new Date().toISOString(),
      habitatLabel: getHabitatAt(this.jeepX, this.jeepZ).label,
      timeOfDayLabel: this.getTimeLabel(),
      weather: this.weather,
      qualityLabel: focus.qualityLabel,
    };
    return { photo, focus };
  }

  private getTimeLabel(): string {
    if (this.timeNormalized < 0.35) return 'Morning Sun';
    if (this.timeNormalized < 0.65) return 'Midday Canopy';
    return 'Golden Dusk';
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    this.elapsedSec += dt;

    if (this.phase !== 'paused') {
      if (this.autoTimeCycle && this.phase !== 'title') {
        // 15-minute full gentle cycle (wrapping between morning and golden dusk)
        this.timeNormalized = (this.timeNormalized + dt / 900) % 1;
      }
      this.updateAtmosphere(dt);
      this.updateParticles(dt);
      this.updateWildlife(dt);
    }

    if (this.phase === 'title') {
      this.updateTitleCamera(dt);
    } else if (this.phase === 'playing') {
      this.updateJeepPhysics(dt);
      this.updateChaseCamera(dt);
      this.chaseYawOffset = THREE.MathUtils.damp(this.chaseYawOffset, 0, 1.4, dt);
    } else if (this.phase === 'photo') {
      this.jeepSpeed = THREE.MathUtils.damp(this.jeepSpeed, 0, 8, dt);
      this.updatePhotoCamera(dt);
      const focus = this.evaluateFocusTarget(dt, false);
      this.callbacks.onFocusChange(focus);
    }

    // Update audio engine smoothly
    const speedKmh = Math.abs(this.jeepSpeed) * 3.6;
    soundEngine.updateAmbience(speedKmh, this.weather, this.timeNormalized, this.phase === 'photo');

    // Push HUD telemetry at ~12Hz so React HUD stays super responsive without over-rendering
    if (now - this.lastHudPush > 80) {
      this.lastHudPush = now;
      this.pushTelemetry(speedKmh);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  }

  private updateAtmosphere(dt: number): void {
    const t = this.timeNormalized;
    // Map t in [0..1] smoothly across Morning -> Noon -> Golden Dusk -> Morning
    let sunElev = 0.72;
    if (t < 0.45) {
      const k = t / 0.45;
      _colorSky.copy(SKY_MORNING).lerp(SKY_NOON, k);
      _colorSun.copy(SUN_MORNING).lerp(SUN_NOON, k);
      sunElev = THREE.MathUtils.lerp(0.62, 0.95, k);
    } else if (t < 0.85) {
      const k = (t - 0.45) / 0.4;
      _colorSky.copy(SKY_NOON).lerp(SKY_DUSK, k);
      _colorSun.copy(SUN_NOON).lerp(SUN_DUSK, k);
      sunElev = THREE.MathUtils.lerp(0.95, 0.28, k);
    } else {
      const k = (t - 0.85) / 0.15;
      _colorSky.copy(SKY_DUSK).lerp(SKY_MORNING, k);
      _colorSun.copy(SUN_DUSK).lerp(SUN_MORNING, k);
      sunElev = THREE.MathUtils.lerp(0.28, 0.62, k);
    }

    const isRain = this.weather === 'rainy';
    if (isRain) {
      _colorSky.lerp(SKY_RAIN, 0.68);
      _colorSun.lerp(SUN_RAIN, 0.65);
    }

    _colorFog.copy(_colorSky);
    (this.scene.background as THREE.Color).copy(_colorSky);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(_colorFog);
      this.scene.fog.density = THREE.MathUtils.damp(
        this.scene.fog.density,
        isRain ? 0.0095 : t > 0.65 ? 0.0062 : 0.0048,
        2.5,
        dt
      );
    }

    // Orbit sun smoothly around the jeep so shadow frustum stays tight and crisp
    const sunAngle = t * Math.PI * 1.4 - 0.6;
    const sunDist = 65;
    this.sunLight.position.set(
      this.jeepX + Math.cos(sunAngle) * sunDist,
      20 + sunElev * 56,
      this.jeepZ + Math.sin(sunAngle) * sunDist
    );
    this.sunLight.target.position.set(this.jeepX, this.jeepY, this.jeepZ);
    this.sunLight.color.copy(_colorSun);
    this.sunLight.intensity = isRain ? 1.05 : 1.45 + sunElev * 0.55;

    _colorHemiSky.copy(_colorSky);
    _colorHemiGround.setHex(t > 0.65 ? 0x3b4432 : 0x4c5e3a);
    this.hemiLight.color.copy(_colorHemiSky);
    this.hemiLight.groundColor.copy(_colorHemiGround);
    this.hemiLight.intensity = isRain ? 0.85 : 0.72;

    // Jeep headlights brighten automatically at golden dusk or in rain
    const lampsOn = t > 0.66 || isRain;
    this.jeep.headlightMat.emissiveIntensity = lampsOn ? 1.85 : 0.25;
  }

  private updateParticles(dt: number): void {
    // Waterfall mist drift
    const mistPos = this.waterfallParticles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < mistPos.count; i++) {
      let y = mistPos.getY(i) - dt * 2.2;
      if (y < 0.2) y = 5.4;
      mistPos.setY(i, y);
    }
    mistPos.needsUpdate = true;

    // Raindrops centered around camera
    const targetRainOp = this.weather === 'rainy' ? 0.65 : 0;
    this.rainMat.opacity = THREE.MathUtils.damp(this.rainMat.opacity, targetRainOp, 3.0, dt);
    if (this.rainMat.opacity > 0.02) {
      const rp = this.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
      this.rainPoints.position.set(this.jeepX, 0, this.jeepZ);
      for (let i = 0; i < rp.count; i++) {
        let ry = rp.getY(i) - dt * 26;
        if (ry < 0) ry = 23;
        rp.setY(i, ry);
      }
      rp.needsUpdate = true;
    }

    // Fireflies glow gently at golden dusk
    const ffMat = this.fireflies.material as THREE.PointsMaterial;
    const targetFf = this.timeNormalized > 0.64 && this.weather === 'clear' ? 0.88 : 0;
    ffMat.opacity = THREE.MathUtils.damp(ffMat.opacity, targetFf, 2.0, dt);
    if (ffMat.opacity > 0.03) {
      this.fireflies.position.y = Math.sin(this.elapsedSec * 1.4) * 0.25;
    }
  }

  private updateJeepPhysics(dt: number): void {
    const forwardInput =
      (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') ? 1 : 0) -
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') ? 1 : 0) +
      this.virtualThrottle;
    const steerInput =
      (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') ? 1 : 0) -
      (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') ? 1 : 0) +
      this.virtualSteer;
    const braking = this.heldKeys.has('Space');

    const clampedThrottle = THREE.MathUtils.clamp(forwardInput, -1, 1);
    const clampedSteer = THREE.MathUtils.clamp(steerInput, -1, 1);

    // PRD §6.2: max ~30 km/h (8.33 m/s)
    const onRiverWater =
      !isOnBridge(this.jeepX, this.jeepZ) &&
      distanceToRiver(this.jeepX, this.jeepZ) < 6.4 &&
      groundHeightAt(this.jeepX, this.jeepZ) < -0.15;

    const maxForwardSpeed = onRiverWater ? 4.4 : 8.4; // ~30.2 km/h on trails
    const maxReverseSpeed = 3.5;

    if (braking) {
      this.jeepSpeed = THREE.MathUtils.damp(this.jeepSpeed, 0, 7.5, dt);
    } else if (Math.abs(clampedThrottle) > 0.05) {
      const target =
        clampedThrottle > 0
          ? clampedThrottle * maxForwardSpeed
          : clampedThrottle * maxReverseSpeed;
      this.jeepSpeed = THREE.MathUtils.damp(this.jeepSpeed, target, 3.2, dt);
    } else {
      this.jeepSpeed = THREE.MathUtils.damp(this.jeepSpeed, 0, 2.4, dt);
    }

    this.jeepSteer = THREE.MathUtils.damp(this.jeepSteer, clampedSteer * 0.42, 9.0, dt);

    // Turning scales cleanly with forward/reverse motion
    if (Math.abs(this.jeepSpeed) > 0.15) {
      const dirSign = this.jeepSpeed >= 0 ? 1 : -1;
      const speedFactor = Math.min(1, Math.abs(this.jeepSpeed) / 3.2);
      this.jeepYaw += this.jeepSteer * 2.55 * speedFactor * dirSign * dt;
    }

    const sinY = Math.sin(this.jeepYaw);
    const cosY = Math.cos(this.jeepYaw);
    const vx = sinY * this.jeepSpeed;
    const vz = cosY * this.jeepSpeed;

    let nextX = this.jeepX + vx * dt;
    let nextZ = this.jeepZ + vz * dt;

    // Resolve solid collisions against trees, rocks, bridge railings, camp, ruins, and cliffs
    const colRes = this.colliders.resolveJeep(nextX, nextZ, this.jeepYaw, vx, vz);
    nextX = colRes.x;
    nextZ = colRes.z;

    if (colRes.collided) {
      this.jeepSpeed = sinY * colRes.vx + cosY * colRes.vz;
      const nowMs = performance.now();
      if (colRes.impactStrength > 1.3 && nowMs - this.lastBumpMs > 250) {
        this.lastBumpMs = nowMs;
        soundEngine.playBump(colRes.impactStrength);
      }
    }

    // Prevent driving sideways underneath the raised bridge deck from river water
    if (
      Math.abs(nextX - BRIDGE_X) <= BRIDGE_HALF_W + 0.95 &&
      Math.abs(nextX - BRIDGE_X) > BRIDGE_HALF_W - 0.1 &&
      Math.abs(nextZ - BRIDGE_Z) <= BRIDGE_HALF_L + 1.2
    ) {
      nextX = BRIDGE_X + Math.sign(nextX - BRIDGE_X) * (BRIDGE_HALF_W + 0.95);
    }

    // Natural perimeter boundary keep-in (gentle mountain rim)
    const dist = Math.hypot(nextX, nextZ);
    if (dist < PLAYABLE_RADIUS - 3) {
      this.jeepX = nextX;
      this.jeepZ = nextZ;
    } else {
      const scale = (PLAYABLE_RADIUS - 3) / dist;
      this.jeepX = nextX * scale;
      this.jeepZ = nextZ * scale;
      this.jeepSpeed *= 0.65;
    }

    const targetY = groundHeightAt(this.jeepX, this.jeepZ);
    this.jeepY = THREE.MathUtils.damp(this.jeepY, targetY, 16, dt);

    // Terrain pitch & roll sampling
    const fwdX = Math.sin(this.jeepYaw) * 1.15;
    const fwdZ = Math.cos(this.jeepYaw) * 1.15;
    const rightX = Math.cos(this.jeepYaw) * 0.85;
    const rightZ = -Math.sin(this.jeepYaw) * 0.85;

    const hFront = groundHeightAt(this.jeepX + fwdX, this.jeepZ + fwdZ);
    const hBack = groundHeightAt(this.jeepX - fwdX, this.jeepZ - fwdZ);
    const hLeft = groundHeightAt(this.jeepX + rightX, this.jeepZ + rightZ);
    const hRight = groundHeightAt(this.jeepX - rightX, this.jeepZ - rightZ);

    const pitchAngle = Math.atan2(hBack - hFront, 2.3);
    const rollAngle = Math.atan2(hLeft - hRight, 1.7);

    this.jeep.group.position.set(this.jeepX, this.jeepY, this.jeepZ);
    this.jeep.group.rotation.y = this.jeepYaw;
    this.jeep.bodyGroup.rotation.x = THREE.MathUtils.damp(
      this.jeep.bodyGroup.rotation.x,
      pitchAngle + clampedThrottle * -0.025,
      10,
      dt
    );
    this.jeep.bodyGroup.rotation.z = THREE.MathUtils.damp(
      this.jeep.bodyGroup.rotation.z,
      rollAngle + this.jeepSteer * 0.08 * (this.jeepSpeed / 8),
      10,
      dt
    );

    // Wheel spin & front wheel steering
    this.wheelSpin += (this.jeepSpeed / 0.42) * dt;
    this.jeep.wheelPivots[0].rotation.y = this.jeepSteer;
    this.jeep.wheelPivots[1].rotation.y = this.jeepSteer;
    for (const wm of this.jeep.wheelMeshes) {
      wm.rotation.x = this.wheelSpin;
    }

    // Brake taillights glow brighter when braking or reversing
    this.jeep.tailLightMat.emissiveIntensity = braking || this.jeepSpeed < -0.2 ? 1.8 : 0.35;
  }

  private updateTitleCamera(dt: number): void {
    const angle = this.elapsedSec * 0.14;
    const radius = 15.5;
    const tx = this.jeepX + Math.sin(angle) * radius;
    const tz = this.jeepZ + Math.cos(angle) * radius;
    const ty = groundHeightAt(tx, tz) + 4.8;

    _vec3.set(tx, ty, tz);
    this.cameraPos.lerp(_vec3, 1 - Math.exp(-3.5 * dt));
    _vec3B.set(this.jeepX, this.jeepY + 1.4, this.jeepZ);
    this.cameraLookAt.lerp(_vec3B, 1 - Math.exp(-4.0 * dt));

    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraLookAt);
    this.currentFov = THREE.MathUtils.damp(this.currentFov, 52, 4, dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();
  }

  private updateChaseCamera(dt: number): void {
    const camYaw = this.jeepYaw + this.chaseYawOffset;
    const backDist = 8.4;
    const camX = this.jeepX - Math.sin(camYaw) * backDist;
    const camZ = this.jeepZ - Math.cos(camYaw) * backDist;
    const groundY = groundHeightAt(camX, camZ);
    const camY = Math.max(this.jeepY + 3.85, groundY + 2.2);

    _vec3.set(camX, camY, camZ);
    const k = 1 - Math.exp(-7.2 * dt);
    this.cameraPos.lerp(_vec3, k);

    _vec3B.set(
      this.jeepX + Math.sin(this.jeepYaw) * 2.5,
      this.jeepY + 1.45,
      this.jeepZ + Math.cos(this.jeepYaw) * 2.5
    );
    this.cameraLookAt.lerp(_vec3B, 1 - Math.exp(-9.0 * dt));

    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraLookAt);

    const targetFov = 56 + Math.min(6, Math.abs(this.jeepSpeed) * 0.65);
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 5, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private updatePhotoCamera(dt: number): void {
    // Photographer stands just above jeep roof / open cabin vantage for unobstructed 360 views
    const eyeX = this.jeepX;
    const eyeY = this.jeepY + 2.45;
    const eyeZ = this.jeepZ;

    _vec3.set(eyeX, eyeY, eyeZ);
    this.cameraPos.lerp(_vec3, 1 - Math.exp(-12 * dt));

    const lookDist = 18;
    const cosP = Math.cos(this.photoPitch);
    _vec3B.set(
      eyeX + Math.sin(this.photoYaw) * cosP * lookDist,
      eyeY + Math.sin(this.photoPitch) * lookDist,
      eyeZ + Math.cos(this.photoYaw) * cosP * lookDist
    );
    this.cameraLookAt.lerp(_vec3B, 1 - Math.exp(-16 * dt));

    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraLookAt);

    const targetFov = 56 / this.photoZoom;
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 11, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.04) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private updateWildlife(dt: number): void {
    const jeepSpeedAbs = Math.abs(this.jeepSpeed);

    for (const a of this.actors) {
      const distToJeep = Math.hypot(a.x - this.jeepX, a.z - this.jeepZ);
      const speedStartle = jeepSpeedAbs > 4.6 ? 18 : 9;

      // Peaceful behavior state machine: fast driving startles shy species; slow approach lets them stay calm
      if (
        this.phase === 'playing' &&
        distToJeep < speedStartle * a.species.shyness &&
        jeepSpeedAbs > 2.6 &&
        a.state !== 'flee'
      ) {
        a.state = 'flee';
        a.stateTimer = 3.6;
        const awayAngle = Math.atan2(a.x - this.jeepX, a.z - this.jeepZ);
        a.targetX = a.homeX + Math.sin(awayAngle) * 14;
        a.targetZ = a.homeZ + Math.cos(awayAngle) * 14;
      }

      a.stateTimer -= dt;
      if (a.stateTimer <= 0) {
        if (a.state === 'flee' || a.state === 'wander') {
          a.state = a.species.behaviorArchetype === 'graze' ? 'graze' : 'idle';
          a.stateTimer = 2.5 + Math.random() * 3.5;
        } else {
          a.state = 'wander';
          a.stateTimer = 3.5 + Math.random() * 4.0;
          const ang = Math.random() * Math.PI * 2;
          const rad = 3 + Math.random() * a.baseRadius;
          a.targetX = a.homeX + Math.cos(ang) * rad;
          a.targetZ = a.homeZ + Math.sin(ang) * rad;
        }
      }

      const moveSpeed =
        a.state === 'flee'
          ? a.species.speed * 1.65
          : a.state === 'wander'
            ? a.species.speed * 0.55
            : 0;

      if (moveSpeed > 0.01) {
        const dx = a.targetX - a.x;
        const dz = a.targetZ - a.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.5) {
          const desiredYaw = Math.atan2(dx, dz);
          let diff = desiredYaw - a.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          a.yaw += diff * Math.min(1, dt * 4.5);
          a.x += (dx / d) * moveSpeed * dt;
          a.z += (dz / d) * moveSpeed * dt;
          if (a.species.flightHeight === 0) {
            const resolved = this.colliders.resolveAnimal(a.x, a.z, 0.55);
            a.x = resolved.x;
            a.z = resolved.z;
          }
        } else if (a.state === 'wander') {
          a.state = 'idle';
          a.stateTimer = 2.0;
        }
      }

      // Affinity visibility boost: rain-loving frogs and dusk-loving cats remain visible, with extra energetic hops/patrols
      a.animPhase += dt * (moveSpeed > 0.1 ? 6.5 : 2.2);

      let extraY = 0;
      if (a.species.behaviorArchetype === 'perch' || a.species.behaviorArchetype === 'flutter') {
        extraY = Math.sin(a.animPhase * 0.8) * 0.45;
      } else if (a.species.behaviorArchetype === 'amphibian' && moveSpeed > 0.1) {
        extraY = Math.abs(Math.sin(a.animPhase * 1.3)) * 0.38;
      }

      // Birds perch slightly higher or lower depending on whether player approaches calmly
      const targetGroundY = groundHeightAt(a.x, a.z) + a.species.flightHeight;
      a.y = THREE.MathUtils.damp(a.y, targetGroundY + extraY, 10, dt);

      a.rig.root.position.set(a.x, a.y, a.z);
      a.rig.root.rotation.y = a.yaw;

      // Animate articulated limbs/wings/head
      if (a.rig.legs.length > 0) {
        const stride = moveSpeed > 0.1 ? 0.52 : 0.04;
        a.rig.legs.forEach((leg, i) => {
          const phaseOffset = i % 2 === 0 ? 0 : Math.PI;
          leg.rotation.x = Math.sin(a.animPhase + phaseOffset) * stride;
        });
      }
      if (a.rig.wings.length > 0) {
        const flapSpeed = a.species.category === 'insect' ? 3.2 : 1.7;
        const flapAmp = a.species.category === 'insect' ? 0.72 : 0.55;
        a.rig.wings.forEach((wing, i) => {
          const sign = i === 0 ? 1 : -1;
          wing.rotation.z = sign * Math.sin(a.animPhase * flapSpeed) * flapAmp;
        });
      }
      if (a.rig.head) {
        if (a.state === 'graze') {
          a.rig.head.rotation.x = 0.42 + Math.sin(a.animPhase * 0.9) * 0.12;
        } else {
          a.rig.head.rotation.x = Math.sin(a.animPhase * 0.5) * 0.08;
          a.rig.head.rotation.y = Math.sin(a.animPhase * 0.35) * 0.22;
        }
      }
      if (a.rig.tail) {
        a.rig.tail.rotation.y = Math.sin(a.animPhase * 0.9) * 0.24;
      }
    }
  }

  private evaluateFocusTarget(dt: number, immediate: boolean): FocusTargetInfo | null {
    let bestActor: WildlifeActor | null = null;
    let bestScore = Infinity;
    let bestDist = Infinity;
    let bestScreenX = 0.5;
    let bestScreenY = 0.5;

    const maxRange = 28 + this.photoZoom * 14;
    const reticleRadius = 0.16;

    for (const a of this.actors) {
      _vec3.set(a.x, a.y + (a.species.flightHeight > 0 ? 0 : 0.55), a.z);
      const dist = _vec3.distanceTo(this.camera.position);
      if (dist > maxRange || dist < 1.8) continue;

      // Ensure subject is in front of camera
      _vec3C.copy(_vec3).sub(this.camera.position);
      this.camera.getWorldDirection(_vec3B);
      if (_vec3C.dot(_vec3B) <= 0) continue;

      _vec3.project(this.camera);
      const sx = (_vec3.x + 1) * 0.5;
      const sy = (1 - _vec3.y) * 0.5;
      const centerDist = Math.hypot(sx - 0.5, sy - 0.5);

      if (centerDist < reticleRadius) {
        const score = centerDist * 40 + dist * 0.12;
        if (score < bestScore) {
          bestScore = score;
          bestActor = a;
          bestDist = dist;
          bestScreenX = sx;
          bestScreenY = sy;
        }
      }
    }

    if (!bestActor) {
      this.focusProgress = THREE.MathUtils.damp(this.focusProgress, 0, 6, dt);
      if (this.focusProgress < 0.05) {
        this.focusedSpeciesId = null;
        this.focusLockPlayed = false;
      }
      return null;
    }

    if (this.focusedSpeciesId !== bestActor.species.id) {
      this.focusedSpeciesId = bestActor.species.id;
      this.focusProgress = immediate ? 1 : 0.25;
      this.focusLockPlayed = false;
    } else if (!immediate) {
      this.focusProgress = Math.min(1, this.focusProgress + dt * 1.65);
    }

    const locked = this.focusProgress >= 0.96;
    if (locked && !this.focusLockPlayed && !immediate) {
      this.focusLockPlayed = true;
      soundEngine.playFocusLock();
    }

    const effectiveDist = bestDist / this.photoZoom;
    const qualityLabel: FocusTargetInfo['qualityLabel'] =
      effectiveDist < 12 && locked
        ? 'Well Framed'
        : locked
          ? 'Clear Focus'
          : 'Distant Subject';

    return {
      species: bestActor.species,
      distance: Math.round(bestDist),
      focusProgress: this.focusProgress,
      locked,
      screenX: bestScreenX,
      screenY: bestScreenY,
      qualityLabel,
    };
  }

  private pushTelemetry(speedKmh: number): void {
    const hab = getHabitatAt(this.jeepX, this.jeepZ);
    const deg = (((-THREE.MathUtils.radToDeg(this.jeepYaw) % 360) + 360) % 360);
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const compassLabel = dirs[Math.round(deg / 45) % 8];

    // Find closest wildlife hint + nearby minimap blips within 75m
    let nearestCue: string | null = null;
    let nearestD = 28;
    const nearbyWildlife: WorldHudTelemetry['nearbyWildlife'] = [];
    for (const a of this.actors) {
      const d = Math.hypot(a.x - this.jeepX, a.z - this.jeepZ);
      if (d < 75) {
        nearbyWildlife.push({
          x: a.x,
          z: a.z,
          category: a.species.category,
        });
      }
      if (d < nearestD) {
        nearestD = d;
        nearestCue = `${a.species.category === 'bird' ? 'Birdsong' : a.species.category === 'insect' ? 'Rustling' : 'Tracks'} nearby`;
      }
    }

    this.callbacks.onTelemetry({
      speedKmh: Math.round(speedKmh),
      headingDeg: Math.round(deg),
      compassLabel,
      habitat: hab.habitat as HabitatZone,
      habitatLabel: hab.label,
      timeNormalized: this.timeNormalized,
      timeLabel: this.getTimeLabel(),
      weather: this.weather,
      zoom: Number(this.photoZoom.toFixed(1)),
      nearestCue,
      jeepX: this.jeepX,
      jeepZ: this.jeepZ,
      jeepYaw: this.jeepYaw,
      nearbyWildlife,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    this.groundTex.dispose();
    this.shadowTex.dispose();
    this.woodTex.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
