import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { CameraOverlay } from './components/CameraOverlay';
import { DrivingHud } from './components/DrivingHud';
import { FieldJournalModal } from './components/FieldJournalModal';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { TROPICAL_SPECIES } from './data/species';
import { WorldEngine } from './game/WorldEngine';
import {
  clearSaveState,
  loadSaveState,
  persistSaveState,
  recordCapturedPhoto,
  updateSettings,
} from './storage/saveManager';
import {
  CapturedPhoto,
  FocusTargetInfo,
  GamePhase,
  GameSettings,
  SaveState,
  WeatherType,
  WorldHudTelemetry,
} from './types/game';

const INITIAL_TELEMETRY: WorldHudTelemetry = {
  speedKmh: 0,
  headingDeg: 14,
  compassLabel: 'N',
  habitat: 'camp',
  habitatLabel: 'Ranger Outskirts',
  timeNormalized: 0.24,
  timeLabel: 'Morning Sun',
  weather: 'clear',
  zoom: 1.0,
  nearestCue: null,
  jeepX: 0,
  jeepZ: 5,
  jeepYaw: 0.25,
  nearbyWildlife: [],
};

interface CaptureBannerState {
  photo: CapturedPhoto;
  speciesName: string | null;
  isNewSpecies: boolean;
  unlockedBehavior: boolean;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WorldEngine | null>(null);

  const [saveState, setSaveState] = useState<SaveState>(() => loadSaveState());
  const [phase, setPhase] = useState<GamePhase>('title');
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalInitialSpecies, setJournalInitialSpecies] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<WorldHudTelemetry>(INITIAL_TELEMETRY);
  const [focus, setFocus] = useState<FocusTargetInfo | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [lastCaptureBanner, setLastCaptureBanner] = useState<CaptureBannerState | null>(null);
  const [allDiscoveredBanner, setAllDiscoveredBanner] = useState(false);

  const phaseRef = useRef<GamePhase>(phase);
  const journalOpenRef = useRef<boolean>(journalOpen);
  const saveStateRef = useRef<SaveState>(saveState);

  phaseRef.current = phase;
  journalOpenRef.current = journalOpen;
  saveStateRef.current = saveState;

  const discoveredCount = useMemo(
    () => TROPICAL_SPECIES.filter((s) => saveState.progress[s.id]?.unlocked).length,
    [saveState.progress]
  );

  // Initialize Three.js WorldEngine once in isolated canvas container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new WorldEngine(mount, {
      onTelemetry: (t) => setTelemetry(t),
      onFocusChange: (f) => setFocus(f),
    });

    const initialSettings = saveStateRef.current.settings;
    soundEngine.setMuted(initialSettings.muted);
    engine.setAutoTimeCycle(initialSettings.autoTimeCycle);
    engine.setCameraSensitivity(initialSettings.cameraSensitivity);

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync phase to engine
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (journalOpen) {
      engine.setPhase('paused');
    } else {
      engine.setPhase(phase);
    }
  }, [phase, journalOpen]);

  const handleStartExpedition = useCallback(() => {
    soundEngine.unlockAndStart();
    setJournalOpen(false);
    setPhase('playing');
  }, []);

  const handleEnterPhotoMode = useCallback(() => {
    soundEngine.unlockAndStart();
    setPhase('photo');
  }, []);

  const handleExitPhotoMode = useCallback(() => {
    setPhase('playing');
    setFocus(null);
  }, []);

  const handleShutter = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || phaseRef.current !== 'photo') return;

    soundEngine.playShutterClick();
    setShutterFlash(true);
    window.setTimeout(() => setShutterFlash(false), 140);

    const result = engine.capturePhoto();
    if (!result) return;

    const { photo, focus: capturedFocus } = result;
    if (capturedFocus && photo.speciesId) {
      const prevCount = TROPICAL_SPECIES.filter(
        (s) => saveStateRef.current.progress[s.id]?.unlocked
      ).length;

      const { nextState, isNewSpecies, unlockedBehavior } = recordCapturedPhoto(
        saveStateRef.current,
        photo
      );
      setSaveState(nextState);

      if (isNewSpecies) {
        soundEngine.playSpeciesUnlock();
        const nextTotal = prevCount + 1;
        if (nextTotal === TROPICAL_SPECIES.length) {
          setAllDiscoveredBanner(true);
          window.setTimeout(() => setAllDiscoveredBanner(false), 6000);
        }
      }

      setLastCaptureBanner({
        photo,
        speciesName: capturedFocus.species.commonName,
        isNewSpecies,
        unlockedBehavior,
      });
    } else {
      // Save scenic photo too
      const nextState: SaveState = {
        ...saveStateRef.current,
        photos: [photo, ...saveStateRef.current.photos].slice(0, 40),
      };
      persistSaveState(nextState);
      setSaveState(nextState);
      setLastCaptureBanner({
        photo,
        speciesName: null,
        isNewSpecies: false,
        unlockedBehavior: false,
      });
    }

    window.setTimeout(() => {
      setLastCaptureBanner((curr) => (curr?.photo.id === photo.id ? null : curr));
    }, 3600);
  }, []);

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSaveState((prev) => {
      const next = updateSettings(prev, patch);
      soundEngine.setMuted(next.settings.muted);
      engineRef.current?.setAutoTimeCycle(next.settings.autoTimeCycle);
      engineRef.current?.setCameraSensitivity(next.settings.cameraSensitivity);
      return next;
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    soundEngine.unlockAndStart();
    handleUpdateSettings({ muted: !saveStateRef.current.settings.muted });
  }, [handleUpdateSettings]);

  const handleDeletePhoto = useCallback((photoId: string) => {
    setSaveState((prev) => {
      const next: SaveState = {
        ...prev,
        photos: prev.photos.filter((p) => p.id !== photoId),
      };
      persistSaveState(next);
      return next;
    });
  }, []);

  const handleResetSave = useCallback(() => {
    const fresh = clearSaveState();
    setSaveState(fresh);
    soundEngine.setMuted(fresh.settings.muted);
    engineRef.current?.setAutoTimeCycle(fresh.settings.autoTimeCycle);
    engineRef.current?.setCameraSensitivity(fresh.settings.cameraSensitivity);
  }, []);

  // Global keyboard controls for Game Shell transitions
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (journalOpenRef.current) {
        if (e.code === 'Escape' || e.code === 'KeyJ') {
          e.preventDefault();
          setJournalOpen(false);
        }
        return;
      }

      const curr = phaseRef.current;

      if (curr === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartExpedition();
        } else if (e.code === 'KeyJ') {
          e.preventDefault();
          setJournalInitialSpecies(null);
          setJournalOpen(true);
        }
        return;
      }

      if (curr === 'playing') {
        if (e.code === 'KeyC') {
          e.preventDefault();
          handleEnterPhotoMode();
        } else if (e.code === 'KeyH') {
          e.preventDefault();
          engineRef.current?.honk();
        } else if (e.code === 'KeyJ') {
          e.preventDefault();
          setJournalInitialSpecies(null);
          setJournalOpen(true);
        } else if (e.code === 'Escape') {
          e.preventDefault();
          setPhase('paused');
        }
        return;
      }

      if (curr === 'photo') {
        if (e.code === 'KeyC' || e.code === 'Escape') {
          e.preventDefault();
          handleExitPhotoMode();
        } else if (e.code === 'KeyF' || e.code === 'Space') {
          e.preventDefault();
          handleShutter();
        } else if (e.code === 'KeyJ') {
          e.preventDefault();
          setJournalInitialSpecies(null);
          setJournalOpen(true);
        }
        return;
      }

      if (curr === 'paused') {
        if (e.code === 'Escape') {
          e.preventDefault();
          setPhase('playing');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleEnterPhotoMode, handleExitPhotoMode, handleShutter, handleStartExpedition]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#182219]">
      {/* Isolated WebGL canvas container (never re-rendered on React state updates) */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full" />

      {/* Title Screen */}
      {phase === 'title' && (
        <TitleScreen
          discoveredCount={discoveredCount}
          totalSpecies={TROPICAL_SPECIES.length}
          muted={saveState.settings.muted}
          onStart={handleStartExpedition}
          onOpenJournal={() => {
            soundEngine.unlockAndStart();
            setJournalInitialSpecies(null);
            setJournalOpen(true);
          }}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Driving HUD */}
      {phase === 'playing' && !journalOpen && (
        <DrivingHud
          telemetry={telemetry}
          discoveredCount={discoveredCount}
          totalSpecies={TROPICAL_SPECIES.length}
          muted={saveState.settings.muted}
          showTouchControls={saveState.settings.showTouchControls}
          onEnterPhotoMode={handleEnterPhotoMode}
          onOpenJournal={() => {
            setJournalInitialSpecies(null);
            setJournalOpen(true);
          }}
          onPause={() => setPhase('paused')}
          onToggleMute={handleToggleMute}
          onHonk={() => engineRef.current?.honk()}
          onSetWeather={(w: WeatherType) => engineRef.current?.setWeather(w)}
          onSetTimePreset={(t: number) => engineRef.current?.setTimeNormalized(t)}
          onVirtualInput={(throttle, steer) =>
            engineRef.current?.setVirtualInput(throttle, steer)
          }
        />
      )}

      {/* Camera Viewfinder Mode */}
      {phase === 'photo' && !journalOpen && (
        <CameraOverlay
          telemetry={telemetry}
          focus={focus}
          shutterFlash={shutterFlash}
          lastCaptureBanner={lastCaptureBanner}
          onExitPhotoMode={handleExitPhotoMode}
          onShutter={handleShutter}
          onSetZoom={(z) => engineRef.current?.setZoom(z)}
          onOpenJournal={() => {
            setJournalInitialSpecies(
              lastCaptureBanner?.photo.speciesId || focus?.species.id || null
            );
            setJournalOpen(true);
          }}
          onTouchAimDelta={(dx, dy) => engineRef.current?.addCameraLookDelta(dx, dy)}
        />
      )}

      {/* Pause Modal */}
      {phase === 'paused' && !journalOpen && (
        <PauseModal
          settings={saveState.settings}
          discoveredCount={discoveredCount}
          totalSpecies={TROPICAL_SPECIES.length}
          onResume={() => setPhase('playing')}
          onOpenJournal={() => {
            setJournalInitialSpecies(null);
            setJournalOpen(true);
          }}
          onUpdateSettings={handleUpdateSettings}
          onReturnToCamp={() => engineRef.current?.resetJeepToCamp()}
          onReturnToTitle={() => setPhase('title')}
          onResetSave={handleResetSave}
        />
      )}

      {/* Wildlife Field Journal Modal */}
      {journalOpen && (
        <FieldJournalModal
          saveState={saveState}
          initialSpeciesId={journalInitialSpecies}
          onClose={() => setJournalOpen(false)}
          onDeletePhoto={handleDeletePhoto}
        />
      )}

      {/* Journal Completion Celebration Toast */}
      {allDiscoveredBanner && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#F4EFE6] text-[#1D261E] border border-[#D9822B] rounded-xl px-5 py-3 shadow-2xl text-center">
          <div className="font-display font-semibold text-base text-[#1D261E]">
            Tropical Forest Reserve Complete!
          </div>
          <div className="text-xs text-[#4F5B50]">
            You discovered and photographed all 20 wildlife species in your field journal.
          </div>
        </div>
      )}
    </div>
  );
}
