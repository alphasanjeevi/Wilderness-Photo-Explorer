import { TROPICAL_SPECIES } from '../data/species';
import { crazyGames } from '../sdk/crazyGames';
import { CapturedPhoto, GameSettings, SaveState, SpeciesProgress } from '../types/game';

const LEGACY_STORAGE_KEY = 'wilderness_photo_explorer_save_v1';
const META_KEY_PREFIX = 'wilderness_meta_v2_';
const PHOTOS_KEY_PREFIX = 'wilderness_photos_v2_';
// Keep combined CrazyGames SDK.data JSON safely below the 1 MB (1,048,576 byte) cloud sync limit
const MAX_TOTAL_STORAGE_CHARS = 780_000;

interface MetaPayload {
  version: number;
  progress: Record<string, SpeciesProgress>;
  settings: GameSettings;
}

export function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse =
    window.matchMedia?.('(pointer: coarse)')?.matches ||
    window.matchMedia?.('(any-pointer: coarse)')?.matches;
  const touchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return Boolean(coarse || touchPoints);
}

function getScopeKeys(scope: string): { metaKey: string; photosKey: string } {
  const safeScope = scope || 'guest';
  return {
    metaKey: `${META_KEY_PREFIX}${safeScope}`,
    photosKey: `${PHOTOS_KEY_PREFIX}${safeScope}`,
  };
}

function createDefaultProgress(): Record<string, SpeciesProgress> {
  const progress: Record<string, SpeciesProgress> = {};
  for (const s of TROPICAL_SPECIES) {
    progress[s.id] = {
      speciesId: s.id,
      unlocked: false,
      firstDiscoveredAt: null,
      discoveryCount: 0,
      behaviorNotesUnlocked: false,
    };
  }
  return progress;
}

export function createDefaultSaveState(): SaveState {
  return {
    version: 1,
    progress: createDefaultProgress(),
    photos: [],
    settings: {
      muted: false,
      cameraSensitivity: 1.0,
      showTouchControls: detectTouchDevice(),
      autoTimeCycle: true,
    },
  };
}

function normalizeState(parsed: Partial<SaveState> | null, fallback: SaveState): SaveState {
  if (!parsed) return fallback;
  const mergedProgress = createDefaultProgress();
  if (parsed.progress) {
    for (const s of TROPICAL_SPECIES) {
      if (parsed.progress[s.id]) {
        mergedProgress[s.id] = {
          ...mergedProgress[s.id],
          ...parsed.progress[s.id],
        };
      }
    }
  }
  return {
    version: 1,
    progress: mergedProgress,
    photos: Array.isArray(parsed.photos) ? parsed.photos.slice(0, 40) : [],
    settings: {
      ...fallback.settings,
      ...(parsed.settings ?? {}),
    },
  };
}

export function loadSaveState(scope = crazyGames.getUserStorageScope()): SaveState {
  const fallback = createDefaultSaveState();
  if (typeof window === 'undefined') return fallback;

  const { metaKey, photosKey } = getScopeKeys(scope);

  try {
    const rawMeta = crazyGames.dataGetItem(metaKey);
    const rawPhotos = crazyGames.dataGetItem(photosKey);

    if (rawMeta) {
      const parsedMeta = JSON.parse(rawMeta) as Partial<MetaPayload>;
      const parsedPhotos = rawPhotos ? (JSON.parse(rawPhotos) as CapturedPhoto[]) : [];
      return normalizeState(
        {
          version: parsedMeta.version,
          progress: parsedMeta.progress,
          settings: parsedMeta.settings,
          photos: Array.isArray(parsedPhotos) ? parsedPhotos : [],
        },
        fallback
      );
    }

    // One-time migration from v1 localStorage only when playing standalone outside CrazyGames SDK Data
    if (scope === 'guest' && !crazyGames.isUsingSdkData()) {
      const legacyRaw = crazyGames.dataGetItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const migrated = normalizeState(JSON.parse(legacyRaw) as Partial<SaveState>, fallback);
        persistSaveState(migrated, 'guest');
        return migrated;
      }
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export function clearGuestSessionData(): void {
  const { metaKey, photosKey } = getScopeKeys('guest');
  crazyGames.dataRemoveItem(metaKey);
  crazyGames.dataRemoveItem(photosKey);
}

function prioritizePhotos(photos: CapturedPhoto[], maxCount: number): CapturedPhoto[] {
  if (photos.length <= maxCount) return photos;
  const kept: CapturedPhoto[] = [];
  const seenSpecies = new Set<string>();
  const extras: CapturedPhoto[] = [];

  for (const photo of photos) {
    if (photo.speciesId && !seenSpecies.has(photo.speciesId)) {
      seenSpecies.add(photo.speciesId);
      kept.push(photo);
    } else {
      extras.push(photo);
    }
  }

  for (const extra of extras) {
    if (kept.length >= maxCount) break;
    kept.push(extra);
  }
  return kept.slice(0, maxCount);
}

export function persistSaveState(
  state: SaveState,
  scope = crazyGames.getUserStorageScope()
): void {
  if (typeof window === 'undefined') return;
  const { metaKey, photosKey } = getScopeKeys(scope);

  const metaPayload: MetaPayload = {
    version: 1,
    progress: state.progress,
    settings: state.settings,
  };
  const metaJson = JSON.stringify(metaPayload);

  // Persist compact progress & settings first so species discovery never gets dropped
  crazyGames.dataSetItem(metaKey, metaJson);

  let photosToSave = prioritizePhotos(state.photos, 36);
  let photosJson = JSON.stringify(photosToSave);

  while (metaJson.length + photosJson.length > MAX_TOTAL_STORAGE_CHARS && photosToSave.length > 0) {
    const nextCap = Math.max(0, Math.floor(photosToSave.length * 0.75) - 1);
    photosToSave = prioritizePhotos(photosToSave, nextCap);
    photosJson = JSON.stringify(photosToSave);
  }

  if (!crazyGames.dataSetItem(photosKey, photosJson)) {
    // Secondary fallback trim in case host localStorage quota is tightly constrained
    const compact = prioritizePhotos(photosToSave, 12);
    crazyGames.dataSetItem(photosKey, JSON.stringify(compact));
  }
}

export function mergeSaveStates(primary: SaveState, guest: SaveState): SaveState {
  const mergedProgress = createDefaultProgress();
  for (const s of TROPICAL_SPECIES) {
    const a = primary.progress[s.id];
    const b = guest.progress[s.id];
    const unlocked = Boolean(a?.unlocked || b?.unlocked);
    const count = Math.max(a?.discoveryCount ?? 0, b?.discoveryCount ?? 0);
    const first =
      a?.firstDiscoveredAt && b?.firstDiscoveredAt
        ? a.firstDiscoveredAt < b.firstDiscoveredAt
          ? a.firstDiscoveredAt
          : b.firstDiscoveredAt
        : a?.firstDiscoveredAt ?? b?.firstDiscoveredAt ?? null;

    mergedProgress[s.id] = {
      speciesId: s.id,
      unlocked,
      firstDiscoveredAt: first,
      discoveryCount: count,
      behaviorNotesUnlocked: Boolean(
        a?.behaviorNotesUnlocked || b?.behaviorNotesUnlocked || count >= 2
      ),
    };
  }

  const seenIds = new Set<string>();
  const combinedPhotos: CapturedPhoto[] = [];
  for (const p of [...primary.photos, ...guest.photos]) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      combinedPhotos.push(p);
    }
  }

  return {
    version: 1,
    progress: mergedProgress,
    photos: prioritizePhotos(combinedPhotos, 36),
    settings: primary.settings,
  };
}

export function recordCapturedPhoto(
  state: SaveState,
  photo: CapturedPhoto,
  scope = crazyGames.getUserStorageScope()
): { nextState: SaveState; isNewSpecies: boolean; unlockedBehavior: boolean } {
  const prevEntry = state.progress[photo.speciesId] ?? {
    speciesId: photo.speciesId,
    unlocked: false,
    firstDiscoveredAt: null,
    discoveryCount: 0,
    behaviorNotesUnlocked: false,
  };

  const isNewSpecies = !prevEntry.unlocked;
  const nextCount = prevEntry.discoveryCount + 1;
  const unlockedBehavior = !prevEntry.behaviorNotesUnlocked && nextCount >= 2;

  const nextProgress: Record<string, SpeciesProgress> = {
    ...state.progress,
    [photo.speciesId]: {
      speciesId: photo.speciesId,
      unlocked: true,
      firstDiscoveredAt: prevEntry.firstDiscoveredAt ?? photo.capturedAt,
      discoveryCount: nextCount,
      behaviorNotesUnlocked: prevEntry.behaviorNotesUnlocked || nextCount >= 2,
    },
  };

  const nextPhotos = prioritizePhotos([photo, ...state.photos], 36);

  const nextState: SaveState = {
    ...state,
    progress: nextProgress,
    photos: nextPhotos,
  };

  persistSaveState(nextState, scope);
  return { nextState, isNewSpecies, unlockedBehavior };
}

export function updateSettings(
  state: SaveState,
  patch: Partial<GameSettings>,
  scope = crazyGames.getUserStorageScope()
): SaveState {
  const nextState: SaveState = {
    ...state,
    settings: {
      ...state.settings,
      ...patch,
    },
  };
  persistSaveState(nextState, scope);
  return nextState;
}

export function clearSaveState(scope = crazyGames.getUserStorageScope()): SaveState {
  const fresh = createDefaultSaveState();
  const { metaKey, photosKey } = getScopeKeys(scope);
  crazyGames.dataRemoveItem(metaKey);
  crazyGames.dataRemoveItem(photosKey);
  persistSaveState(fresh, scope);
  return fresh;
}
