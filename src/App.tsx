import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { CameraOverlay } from './components/CameraOverlay';
import { DrivingHud } from './components/DrivingHud';
import { FieldJournalModal } from './components/FieldJournalModal';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { TROPICAL_SPECIES } from './data/species';
import { WorldEngine } from './game/WorldEngine';
import { crazyGames } from './sdk/crazyGames';
import {
  clearSaveState,
  detectTouchDevice,
  loadSaveState,
  mergeSaveStates,
  persistSaveState,
  recordCapturedPhoto,
  updateSettings,
} from './storage/saveManager';
import {
  CapturedPhoto,
  CrazyGamesUserProfile,
  FocusTargetInfo,
  GamePhase,
  GameSettings,
  SaveState,
  ScoutTarget,
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
  const engineReadyRef = useRef(false);

  const [isTouchDevice] = useState<boolean>(() => detectTouchDevice());
  const [cgUser, setCgUser] = useState<CrazyGamesUserProfile | null>(null);
  const [userAccountAvailable, setUserAccountAvailable] = useState(false);
  const [userScope, setUserScope] = useState<string>('guest');

  const [saveState, setSaveState] = useState<SaveState>(() => loadSaveState('guest'));
  const [phase, setPhase] = useState<GamePhase>('title');
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalInitialSpecies, setJournalInitialSpecies] = useState<string | null>(null);
  const [adPlaying, setAdPlaying] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [scoutTarget, setScoutTarget] = useState<ScoutTarget | null>(null);

  const [telemetry, setTelemetry] = useState<WorldHudTelemetry>(INITIAL_TELEMETRY);
  const [focus, setFocus] = useState<FocusTargetInfo | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [lastCaptureBanner, setLastCaptureBanner] = useState<CaptureBannerState | null>(null);
  const [allDiscoveredBanner, setAllDiscoveredBanner] = useState(false);

  const phaseRef = useRef<GamePhase>(phase);
  const journalOpenRef = useRef<boolean>(journalOpen);
  const adPlayingRef = useRef<boolean>(adPlaying);
  const saveStateRef = useRef<SaveState>(saveState);
  const userScopeRef = useRef<string>(userScope);

  phaseRef.current = phase;
  journalOpenRef.current = journalOpen;
  adPlayingRef.current = adPlaying;
  saveStateRef.current = saveState;
  userScopeRef.current = userScope;

  const showNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => {
      setStatusNotice((curr) => (curr === msg ? null : curr));
    }, 3600);
  }, []);

  const discoveredCount = useMemo(
    () => TROPICAL_SPECIES.filter((s) => saveState.progress[s.id]?.unlocked).length,
    [saveState.progress]
  );

  const applyUserScopeSave = useCallback((nextUser: CrazyGamesUserProfile | null) => {
    const nextScope = crazyGames.getUserStorageScope();
    const prevScope = userScopeRef.current;

    setCgUser(nextUser);
    setUserAccountAvailable(crazyGames.isUserAccountAvailable());

    if (nextScope !== prevScope) {
      const targetSave = loadSaveState(nextScope);
      const merged =
        prevScope === 'guest'
          ? mergeSaveStates(targetSave, saveStateRef.current)
          : targetSave;

      persistSaveState(merged, nextScope);
      setUserScope(nextScope);
      setSaveState(merged);
      soundEngine.setMuted(merged.settings.muted);
      engineRef.current?.setAutoTimeCycle(merged.settings.autoTimeCycle);
      engineRef.current?.setCameraSensitivity(merged.settings.cameraSensitivity);
    }
  }, []);

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
    engineReadyRef.current = true;

    return () => {
      engine.dispose();
      engineRef.current = null;
      engineReadyRef.current = false;
    };
  }, []);

  // Initialize CrazyGames SDK v3 (loading lifecycle, user profile, cloud data sync)
  useEffect(() => {
    let mounted = true;

    const unsubscribe = crazyGames.subscribeAuth((user) => {
      if (!mounted) return;
      applyUserScopeSave(user);
    });

    void crazyGames.init().then((user) => {
      if (!mounted) return;
      setUserAccountAvailable(crazyGames.isUserAccountAvailable());
      if (user) {
        applyUserScopeSave(user);
      } else {
        const guestReloaded = loadSaveState('guest');
        setSaveState(guestReloaded);
        soundEngine.setMuted(guestReloaded.settings.muted);
        engineRef.current?.setAutoTimeCycle(guestReloaded.settings.autoTimeCycle);
        engineRef.current?.setCameraSensitivity(guestReloaded.settings.cameraSensitivity);
      }
      if (engineReadyRef.current) {
        crazyGames.notifyLoadingStop();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [applyUserScopeSave]);

  // Unlock Web Audio cleanly on first touch/pointer gesture (especially iOS Safari)
  useEffect(() => {
    const unlockOnce = () => {
      soundEngine.unlockAndStart();
    };
    window.addEventListener('pointerdown', unlockOnce, { once: true, passive: true });
    return () => window.removeEventListener('pointerdown', unlockOnce);
  }, []);

  // Pause audio cleanly if mobile browser tab/app goes into background
  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden) {
        soundEngine.setAdPaused(true);
        crazyGames.setGameplayActive(false);
      } else if (!adPlayingRef.current) {
        soundEngine.setAdPaused(false);
        const active =
          (phaseRef.current === 'playing' || phaseRef.current === 'photo') &&
          !journalOpenRef.current;
        crazyGames.setGameplayActive(active);
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  // Sync phase + CrazyGames gameplayStart/gameplayStop to engine & SDK
  useEffect(() => {
    const engine = engineRef.current;
    const isActivePlay = (phase === 'playing' || phase === 'photo') && !journalOpen && !adPlaying;

    if (engine) {
      if (adPlaying || journalOpen) {
        engine.setPhase('paused');
      } else {
        engine.setPhase(phase);
      }
    }

    crazyGames.setGameplayActive(isActivePlay);
  }, [phase, journalOpen, adPlaying]);

  // Clear expired scout beacon automatically
  useEffect(() => {
    if (!scoutTarget) return;
    const remaining = scoutTarget.expiresAtMs - Date.now();
    if (remaining <= 0) {
      setScoutTarget(null);
      return;
    }
    const timer = window.setTimeout(() => setScoutTarget(null), remaining);
    return () => window.clearTimeout(timer);
  }, [scoutTarget]);

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

  const handleSignIn = useCallback(async () => {
    const { user, errorCode } = await crazyGames.promptSignIn();
    if (user) {
      applyUserScopeSave(user);
      showNotice(`Signed in as ${user.username} — journal synced!`);
    } else if (errorCode === 'unavailable') {
      showNotice('Account sign-in is available when played on CrazyGames.');
    }
  }, [applyUserScopeSave, showNotice]);

  const runMidgameAdThen = useCallback(async (action: () => void) => {
    const result = await crazyGames.requestAd('midgame', {
      onAdStart: () => {
        setAdPlaying(true);
        soundEngine.setAdPaused(true);
      },
      onAdEnd: () => {
        setAdPlaying(false);
        soundEngine.setAdPaused(false);
      },
    });
    if (result.completed || result.reason) {
      action();
    }
  }, []);

  const handleRequestScoutBeacon = useCallback(
    async (preferredSpeciesId?: string) => {
      const engine = engineRef.current;
      if (!engine) return;

      const unlockedIds = new Set(
        TROPICAL_SPECIES.filter((s) => saveStateRef.current.progress[s.id]?.unlocked).map(
          (s) => s.id
        )
      );
      const candidate = engine.getScoutTarget(unlockedIds, preferredSpeciesId);
      if (!candidate) {
        showNotice('All 20 wildlife species have already been discovered!');
        return;
      }

      const res = await crazyGames.requestAd('rewarded', {
        onAdStart: () => {
          setAdPlaying(true);
          soundEngine.setAdPaused(true);
        },
        onAdEnd: () => {
          setAdPlaying(false);
          soundEngine.setAdPaused(false);
        },
      });

      if (res.completed) {
        setScoutTarget({
          ...candidate,
          expiresAtMs: Date.now() + 90_000,
        });
        setJournalOpen(false);
        setPhase('playing');
        showNotice(`Scout Beacon active for ${candidate.commonName} (${candidate.habitatLabel})`);
      } else {
        showNotice(
          res.reason === 'unavailable'
            ? 'Rewarded Scout ads are active on CrazyGames. Explore the river & canopy!'
            : 'Ad unavailable right now — try again shortly.'
        );
      }
    },
    [showNotice]
  );

  const handleShutter = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || phaseRef.current !== 'photo' || adPlayingRef.current) return;

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
        photo,
        userScopeRef.current
      );
      setSaveState(nextState);

      if (scoutTarget?.speciesId === photo.speciesId) {
        setScoutTarget(null);
      }

      if (isNewSpecies) {
        soundEngine.playSpeciesUnlock();
        const nextTotal = prevCount + 1;
        if (nextTotal === 5 || nextTotal === 10 || nextTotal === 15 || nextTotal === TROPICAL_SPECIES.length) {
          crazyGames.triggerHappytime();
        }
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
      const nextState: SaveState = {
        ...saveStateRef.current,
        photos: [photo, ...saveStateRef.current.photos].slice(0, 36),
      };
      persistSaveState(nextState, userScopeRef.current);
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
  }, [scoutTarget]);

  const handleUpdateSettings = useCallback((patch: Partial<GameSettings>) => {
    setSaveState((prev) => {
      const next = updateSettings(prev, patch, userScopeRef.current);
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
      persistSaveState(next, userScopeRef.current);
      return next;
    });
  }, []);

  const handleResetSave = useCallback(() => {
    const fresh = clearSaveState(userScopeRef.current);
    setSaveState(fresh);
    setScoutTarget(null);
    soundEngine.setMuted(fresh.settings.muted);
    engineRef.current?.setAutoTimeCycle(fresh.settings.autoTimeCycle);
    engineRef.current?.setCameraSensitivity(fresh.settings.cameraSensitivity);
  }, []);

  // Global keyboard controls for Game Shell transitions
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || adPlayingRef.current) return;

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
      {phase === 'title' && !journalOpen && (
        <TitleScreen
          discoveredCount={discoveredCount}
          totalSpecies={TROPICAL_SPECIES.length}
          muted={saveState.settings.muted}
          user={cgUser}
          userAccountAvailable={userAccountAvailable}
          isTouchDevice={isTouchDevice}
          onStart={handleStartExpedition}
          onOpenJournal={() => {
            soundEngine.unlockAndStart();
            setJournalInitialSpecies(null);
            setJournalOpen(true);
          }}
          onToggleMute={handleToggleMute}
          onSignIn={() => void handleSignIn()}
        />
      )}

      {/* Driving HUD */}
      {phase === 'playing' && !journalOpen && !adPlaying && (
        <DrivingHud
          telemetry={telemetry}
          discoveredCount={discoveredCount}
          totalSpecies={TROPICAL_SPECIES.length}
          muted={saveState.settings.muted}
          showTouchControls={saveState.settings.showTouchControls}
          scoutTarget={scoutTarget}
          canScoutMore={discoveredCount < TROPICAL_SPECIES.length}
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
          onVirtualBrake={(active) => engineRef.current?.setVirtualBrake(active)}
          onRequestScoutBeacon={() => void handleRequestScoutBeacon()}
        />
      )}

      {/* Camera Viewfinder Mode */}
      {phase === 'photo' && !journalOpen && !adPlaying && (
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
      {phase === 'paused' && !journalOpen && !adPlaying && (
        <PauseModal
          settings={saveState.settings}
          discoveredCount={discoveredCount}
          totalSpecies={TROPICAL_SPECIES.length}
          user={cgUser}
          userAccountAvailable={userAccountAvailable}
          onResume={() => setPhase('playing')}
          onOpenJournal={() => {
            setJournalInitialSpecies(null);
            setJournalOpen(true);
          }}
          onUpdateSettings={handleUpdateSettings}
          onReturnToCamp={() =>
            void runMidgameAdThen(() => {
              engineRef.current?.resetJeepToCamp();
              setPhase('playing');
            })
          }
          onReturnToTitle={() =>
            void runMidgameAdThen(() => {
              setPhase('title');
            })
          }
          onResetSave={handleResetSave}
          onSignIn={() => void handleSignIn()}
        />
      )}

      {/* Wildlife Field Journal Modal */}
      {journalOpen && !adPlaying && (
        <FieldJournalModal
          saveState={saveState}
          initialSpeciesId={journalInitialSpecies}
          user={cgUser}
          userAccountAvailable={userAccountAvailable}
          onClose={() => setJournalOpen(false)}
          onDeletePhoto={handleDeletePhoto}
          onSignIn={() => void handleSignIn()}
          onTrackSpecies={(speciesId) => void handleRequestScoutBeacon(speciesId)}
        />
      )}

      {/* Non-blocking status / Scout / SDK notice */}
      {statusNotice && !allDiscoveredBanner && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#182219]/95 text-[#F4EFE6] border border-[#E5B869]/45 rounded-xl px-4 py-2 shadow-xl text-xs font-medium text-center max-w-[90vw]">
          {statusNotice}
        </div>
      )}

      {/* Journal Completion Celebration Toast */}
      {allDiscoveredBanner && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#F4EFE6] text-[#1D261E] border border-[#D9822B] rounded-xl px-5 py-3 shadow-2xl text-center max-w-[90vw]">
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
