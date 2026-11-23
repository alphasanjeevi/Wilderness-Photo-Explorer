import { TROPICAL_SPECIES } from '../data/species';
import { CapturedPhoto, GameSettings, SaveState, SpeciesProgress } from '../types/game';

const STORAGE_KEY = 'wilderness_photo_explorer_save_v1';

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
  const isCoarsePointer =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches;

  return {
    version: 1,
    progress: createDefaultProgress(),
    photos: [],
    settings: {
      muted: false,
      cameraSensitivity: 1.0,
      showTouchControls: Boolean(isCoarsePointer),
      autoTimeCycle: true,
    },
  };
}

export function loadSaveState(): SaveState {
  const fallback = createDefaultSaveState();
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SaveState>;
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
      photos: Array.isArray(parsed.photos) ? parsed.photos.slice(0, 60) : [],
      settings: {
        ...fallback.settings,
        ...(parsed.settings ?? {}),
      },
    };
  } catch {
    return fallback;
  }
}

export function persistSaveState(state: SaveState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // If localStorage quota is full due to many base64 snapshots, trim oldest non-unique photos
    try {
      const trimmed: SaveState = {
        ...state,
        photos: state.photos.slice(0, 24),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore storage failure cleanly
    }
  }
}

export function recordCapturedPhoto(
  state: SaveState,
  photo: CapturedPhoto
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

  // Keep up to 40 photos most recent first, ensuring at least 1 photo per species is kept
  const nextPhotos = [photo, ...state.photos].slice(0, 40);

  const nextState: SaveState = {
    ...state,
    progress: nextProgress,
    photos: nextPhotos,
  };

  persistSaveState(nextState);
  return { nextState, isNewSpecies, unlockedBehavior };
}

export function updateSettings(
  state: SaveState,
  patch: Partial<GameSettings>
): SaveState {
  const nextState: SaveState = {
    ...state,
    settings: {
      ...state.settings,
      ...patch,
    },
  };
  persistSaveState(nextState);
  return nextState;
}

export function clearSaveState(): SaveState {
  const fresh = createDefaultSaveState();
  persistSaveState(fresh);
  return fresh;
}
