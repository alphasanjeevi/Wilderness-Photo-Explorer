export type SpeciesCategory = 'mammal' | 'bird' | 'insect';

export type HabitatZone = 'camp' | 'clearing' | 'river' | 'ruins' | 'canopy';

export type ActiveTime = 'any' | 'day' | 'dusk';

export type WeatherAffinity = 'any' | 'clear' | 'rain';

export type RarityTier = 'common' | 'uncommon' | 'rare';

export type BehaviorArchetype = 'graze' | 'perch' | 'flutter' | 'prowl' | 'amphibian';

export type WeatherType = 'clear' | 'rainy';

export type GamePhase = 'title' | 'playing' | 'photo' | 'paused';

export interface SpeciesColorPalette {
  primary: number;
  secondary: number;
  accent: number;
  eye: number;
}

export interface SpeciesDefinition {
  id: string;
  number: number;
  commonName: string;
  scientificName: string;
  category: SpeciesCategory;
  habitat: HabitatZone;
  habitatLabel: string;
  activeTime: ActiveTime;
  prefersWeather: WeatherAffinity;
  rarity: RarityTier;
  diet: string;
  behaviorArchetype: BehaviorArchetype;
  behaviorSummary: string;
  funFact: string;
  scale: number;
  flightHeight: number;
  speed: number;
  shyness: number;
  colors: SpeciesColorPalette;
}

export interface CapturedPhoto {
  id: string;
  speciesId: string;
  dataUrl: string;
  capturedAt: string;
  habitatLabel: string;
  timeOfDayLabel: string;
  weather: WeatherType;
  qualityLabel: 'Well Framed' | 'Clear Focus' | 'Distant Subject';
}

export interface SpeciesProgress {
  speciesId: string;
  unlocked: boolean;
  firstDiscoveredAt: string | null;
  discoveryCount: number;
  behaviorNotesUnlocked: boolean;
}

export interface GameSettings {
  muted: boolean;
  cameraSensitivity: number;
  showTouchControls: boolean;
  autoTimeCycle: boolean;
}

export interface SaveState {
  version: number;
  progress: Record<string, SpeciesProgress>;
  photos: CapturedPhoto[];
  settings: GameSettings;
}

export interface FocusTargetInfo {
  species: SpeciesDefinition;
  distance: number;
  focusProgress: number; // 0 to 1
  locked: boolean;
  screenX: number; // 0 to 1
  screenY: number; // 0 to 1
  qualityLabel: 'Well Framed' | 'Clear Focus' | 'Distant Subject';
}

export interface NearbyWildlifeBlip {
  x: number;
  z: number;
  category: SpeciesCategory;
}

export interface WorldHudTelemetry {
  speedKmh: number;
  headingDeg: number;
  compassLabel: string;
  habitat: HabitatZone;
  habitatLabel: string;
  timeNormalized: number; // 0 = morning, 0.5 = noon, 0.78 = golden dusk
  timeLabel: string;
  weather: WeatherType;
  zoom: number;
  nearestCue: string | null;
  jeepX: number;
  jeepZ: number;
  jeepYaw: number;
  nearbyWildlife: NearbyWildlifeBlip[];
}
