import React, { useRef, useState } from 'react';
import {
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Compass,
  Pause,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ScoutTarget, WeatherType, WorldHudTelemetry } from '../types/game';
import { Minimap } from './Minimap';

interface DrivingHudProps {
  telemetry: WorldHudTelemetry;
  discoveredCount: number;
  totalSpecies: number;
  muted: boolean;
  showTouchControls: boolean;
  scoutTarget?: ScoutTarget | null;
  onEnterPhotoMode: () => void;
  onOpenJournal: () => void;
  onPause: () => void;
  onToggleMute: () => void;
  onHonk: () => void;
  onSetWeather: (w: WeatherType) => void;
  onSetTimePreset: (t: number) => void;
  onVirtualInput: (throttle: number, steer: number) => void;
  onVirtualBrake: (active: boolean) => void;
}

export const DrivingHud: React.FC<DrivingHudProps> = ({
  telemetry,
  discoveredCount,
  totalSpecies,
  muted,
  showTouchControls,
  scoutTarget,
  onEnterPhotoMode,
  onOpenJournal,
  onPause,
  onToggleMute,
  onHonk,
  onSetWeather,
  onSetTimePreset,
  onVirtualInput,
  onVirtualBrake,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [mobileEnvOpen, setMobileEnvOpen] = useState(false);
  const [brakingActive, setBrakingActive] = useState(false);

  const padRef = useRef<HTMLDivElement | null>(null);
  const padPointerIdRef = useRef<number | null>(null);
  const brakePointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    if (!padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    const dx = Math.max(-maxR, Math.min(maxR, clientX - cx));
    const dy = Math.max(-maxR, Math.min(maxR, clientY - cy));
    setKnobOffset({ x: dx, y: dy });
    onVirtualInput(-dy / maxR, -dx / maxR);
  };

  const resetStick = () => {
    padPointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onVirtualInput(0, 0);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-5 pt-safe pb-safe">
      {/* TOP BAR: Compact perimeter telemetry + rotatable minimap + quick actions */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        {/* Top-left reserve status & rotatable minimap */}
        <div className="flex flex-col items-start gap-2">
          <div className="bg-[#182219]/90 border border-[#F4EFE6]/12 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-md min-w-[196px] sm:min-w-[232px]">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-[#F4EFE6]">
              <span>{telemetry.habitatLabel}</span>
              <span className="text-[#F4EFE6]/40" aria-hidden="true">·</span>
              <span className="text-[#E5B869] tabular-nums">
                {discoveredCount}/{totalSpecies} Species
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-[#D8D2C5]/80">
              <span>{telemetry.timeLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{telemetry.weather === 'rainy' ? 'Rain Showers' : 'Clear Sky'}</span>
              {telemetry.nearestCue && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#9FD896]">{telemetry.nearestCue}</span>
                </>
              )}
            </div>

            {/* Subtle Daylight Cycle Progress Bar */}
            <div
              className="mt-1.5 sm:mt-2 pt-1.5 border-t border-[#F4EFE6]/10"
              aria-label={`Daylight cycle: ${telemetry.timeLabel}`}
            >
              <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-[#101811]">
                <div
                  className="absolute inset-0 opacity-85"
                  style={{
                    background:
                      'linear-gradient(90deg, #88C5DF 0%, #DFDF9E 45%, #D9822B 76%, #88C5DF 100%)',
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 w-px bg-[#182219]/75"
                  style={{ left: '35%' }}
                />
                <div
                  className="absolute top-0 bottom-0 w-px bg-[#182219]/75"
                  style={{ left: '65%' }}
                />
              </div>
              <div className="relative h-1.5 -mt-1.5 pointer-events-none">
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-2.5 rounded-[2px] bg-[#F4EFE6] border border-[#182219] shadow-sm"
                  style={{
                    left: `${Math.max(2, Math.min(98, telemetry.timeNormalized * 100))}%`,
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-[#D8D2C5]/65">
                <span>Morning</span>
                <span>Noon</span>
                <span>Dusk</span>
              </div>
            </div>
          </div>

          <Minimap telemetry={telemetry} scoutTarget={scoutTarget} />
        </div>

        {/* Top-right action cluster */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenJournal}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 min-h-[44px] rounded-xl bg-[#182219]/90 hover:bg-[#243226] border border-[#F4EFE6]/15 text-xs sm:text-sm font-medium text-[#F4EFE6] transition-colors cursor-pointer whitespace-nowrap"
            title="Open Field Journal (J)"
          >
            <BookOpen className="w-4 h-4 text-[#E5B869]" />
            <span className="hidden sm:inline">Journal</span>
            <span className="font-mono tabular-nums text-xs text-[#E5B869]">
              {discoveredCount}/{totalSpecies}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#182219]/90 hover:bg-[#243226] border border-[#F4EFE6]/15 text-[#F4EFE6] transition-colors cursor-pointer"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onPause}
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#182219]/90 hover:bg-[#243226] border border-[#F4EFE6]/15 text-[#F4EFE6] transition-colors cursor-pointer"
            aria-label="Pause Menu"
            title="Pause (Esc)"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MOBILE / TOUCH VIRTUAL DRIVE PAD & RIGHT-THUMB ACTIONS */}
      {showTouchControls && (
        <div className="flex flex-col gap-2">
          {/* Optional expandable Sky & Weather strip on touch devices */}
          {mobileEnvOpen && (
            <div className="pointer-events-auto self-center bg-[#182219]/94 border border-[#F4EFE6]/15 rounded-2xl p-2 shadow-xl flex flex-wrap items-center justify-center gap-2">
              <div className="flex items-center bg-[#101811] rounded-lg p-0.5 border border-[#F4EFE6]/10">
                <button
                  type="button"
                  onClick={() => onSetWeather('clear')}
                  className={`inline-flex items-center gap-1 px-2.5 min-h-[36px] rounded-md text-xs font-medium cursor-pointer ${
                    telemetry.weather === 'clear'
                      ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                      : 'text-[#D8D2C5]/70'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetWeather('rainy')}
                  className={`inline-flex items-center gap-1 px-2.5 min-h-[36px] rounded-md text-xs font-medium cursor-pointer ${
                    telemetry.weather === 'rainy'
                      ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                      : 'text-[#D8D2C5]/70'
                  }`}
                >
                  <CloudRain className="w-3.5 h-3.5" />
                  <span>Rain</span>
                </button>
              </div>

              <div className="flex items-center bg-[#101811] rounded-lg p-0.5 border border-[#F4EFE6]/10">
                <button
                  type="button"
                  onClick={() => onSetTimePreset(0.2)}
                  className={`px-2.5 min-h-[36px] rounded-md text-xs font-medium cursor-pointer ${
                    telemetry.timeNormalized < 0.35
                      ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                      : 'text-[#D8D2C5]/70'
                  }`}
                >
                  Morning
                </button>
                <button
                  type="button"
                  onClick={() => onSetTimePreset(0.45)}
                  className={`px-2.5 min-h-[36px] rounded-md text-xs font-medium cursor-pointer ${
                    telemetry.timeNormalized >= 0.35 && telemetry.timeNormalized < 0.65
                      ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                      : 'text-[#D8D2C5]/70'
                  }`}
                >
                  Noon
                </button>
                <button
                  type="button"
                  onClick={() => onSetTimePreset(0.75)}
                  className={`px-2.5 min-h-[36px] rounded-md text-xs font-medium cursor-pointer ${
                    telemetry.timeNormalized >= 0.65
                      ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                      : 'text-[#D8D2C5]/70'
                  }`}
                >
                  Dusk
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end justify-between gap-2 pb-1">
            {/* Left Thumb: Multi-touch Analog Steering & Throttle Stick */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                ref={padRef}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  padPointerIdRef.current = e.pointerId;
                  updateStickFromPointer(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (padPointerIdRef.current === e.pointerId) {
                    e.stopPropagation();
                    updateStickFromPointer(e.clientX, e.clientY);
                  }
                }}
                onPointerUp={(e) => {
                  if (padPointerIdRef.current === e.pointerId) {
                    resetStick();
                  }
                }}
                onPointerCancel={(e) => {
                  if (padPointerIdRef.current === e.pointerId) {
                    resetStick();
                  }
                }}
                aria-label="Drive Steering Pad"
                className="pointer-events-auto relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#182219]/82 border-2 border-[#F4EFE6]/25 flex items-center justify-center touch-none shadow-lg"
              >
                <div className="absolute inset-3 rounded-full border border-[#F4EFE6]/10 pointer-events-none" />
                <div
                  className="w-12 h-12 rounded-full bg-[#D9822B] border-2 border-[#F4EFE6]/70 shadow-md pointer-events-none"
                  style={{
                    transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
                  }}
                />
              </div>
            </div>

            {/* Center Compact Speed & Sky Toggle */}
            <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#182219]/90 border border-[#F4EFE6]/15 shadow-md mb-1">
              <span className="font-mono tabular-nums text-sm font-semibold text-[#F4EFE6]">
                {telemetry.speedKmh} <span className="text-[10px] font-normal text-[#D8D2C5]/75">km/h</span>
              </span>
              <div className="h-3.5 w-px bg-[#F4EFE6]/15" />
              <button
                type="button"
                onClick={() => setMobileEnvOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#E5B869] min-h-[30px] px-1 cursor-pointer"
              >
                {telemetry.weather === 'rainy' ? (
                  <CloudRain className="w-3.5 h-3.5" />
                ) : (
                  <Sun className="w-3.5 h-3.5" />
                )}
                <span>Sky</span>
              </button>
            </div>

            {/* Right Thumb: Brake, Horn, and Camera Mode */}
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onHonk}
                  className="min-w-[46px] min-h-[46px] px-3 rounded-xl bg-[#253326]/92 active:bg-[#344735] border border-[#F4EFE6]/18 text-xs font-medium text-[#F4EFE6] shadow-md"
                >
                  Horn
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    brakePointerIdRef.current = e.pointerId;
                    setBrakingActive(true);
                    onVirtualBrake(true);
                  }}
                  onPointerUp={(e) => {
                    if (brakePointerIdRef.current === e.pointerId) {
                      brakePointerIdRef.current = null;
                      setBrakingActive(false);
                      onVirtualBrake(false);
                    }
                  }}
                  onPointerCancel={() => {
                    brakePointerIdRef.current = null;
                    setBrakingActive(false);
                    onVirtualBrake(false);
                  }}
                  className={`min-w-[64px] min-h-[46px] px-3 rounded-xl border text-xs font-semibold shadow-md touch-none ${
                    brakingActive
                      ? 'bg-[#C85A43] border-[#F4EFE6]/50 text-[#F4EFE6]'
                      : 'bg-[#182219]/92 border-[#F4EFE6]/20 text-[#F4EFE6]'
                  }`}
                >
                  Brake
                </button>
              </div>

              <button
                type="button"
                onClick={onEnterPhotoMode}
                className="inline-flex items-center justify-center gap-2 min-h-[54px] px-5 rounded-2xl bg-[#D9822B] active:scale-95 text-[#182018] font-semibold text-sm shadow-lg transition-transform"
              >
                <Camera className="w-5 h-5" />
                <span>Photo Mode</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DESKTOP COLLAPSIBLE BOTTOM CONTROL DOCK (Hidden when touch controls are active so thumbs have clean space) */}
      {!showTouchControls && (
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-[#182219]/90 border border-b-0 border-[#F4EFE6]/15 text-[11px] font-medium text-[#E4DDD0]/85 hover:text-[#F4EFE6] transition-colors cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>

          {!dockCollapsed && (
            <div className="pointer-events-auto w-full max-w-[820px] bg-[#182219]/92 border border-[#F4EFE6]/15 rounded-2xl px-4 py-2.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
              {/* Speedometer & Compass */}
              <div className="flex items-center gap-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono tabular-nums text-xl font-semibold text-[#F4EFE6]">
                    {telemetry.speedKmh}
                  </span>
                  <span className="text-xs text-[#D8D2C5]/75">km/h</span>
                </div>
                <div className="h-5 w-px bg-[#F4EFE6]/15" />
                <div className="flex items-center gap-1.5 text-xs text-[#E4DDD0]/90 font-mono tabular-nums">
                  <Compass className="w-3.5 h-3.5 text-[#E5B869]" />
                  <span>{telemetry.compassLabel}</span>
                </div>
              </div>

              {/* Weather & Time Staging Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#101811] rounded-lg p-0.5 border border-[#F4EFE6]/10">
                  <button
                    type="button"
                    onClick={() => onSetWeather('clear')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      telemetry.weather === 'clear'
                        ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                        : 'text-[#D8D2C5]/70 hover:text-[#F4EFE6]'
                    }`}
                    title="Clear Weather"
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetWeather('rainy')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      telemetry.weather === 'rainy'
                        ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                        : 'text-[#D8D2C5]/70 hover:text-[#F4EFE6]'
                    }`}
                    title="Gentle Rain"
                  >
                    <CloudRain className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Rain</span>
                  </button>
                </div>

                <div className="flex items-center bg-[#101811] rounded-lg p-0.5 border border-[#F4EFE6]/10">
                  <button
                    type="button"
                    onClick={() => onSetTimePreset(0.2)}
                    className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      telemetry.timeNormalized < 0.35
                        ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                        : 'text-[#D8D2C5]/70 hover:text-[#F4EFE6]'
                    }`}
                  >
                    Morning
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTimePreset(0.45)}
                    className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      telemetry.timeNormalized >= 0.35 && telemetry.timeNormalized < 0.65
                        ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                        : 'text-[#D8D2C5]/70 hover:text-[#F4EFE6]'
                    }`}
                  >
                    Noon
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetTimePreset(0.75)}
                    className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      telemetry.timeNormalized >= 0.65
                        ? 'bg-[#2C3E2E] text-[#F4EFE6]'
                        : 'text-[#D8D2C5]/70 hover:text-[#F4EFE6]'
                    }`}
                  >
                    <Sunset className="w-3.5 h-3.5" />
                    <span>Dusk</span>
                  </button>
                </div>
              </div>

              {/* Primary Actions: Horn & Camera Mode */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onHonk}
                  className="px-3 py-2 rounded-xl bg-[#253326] hover:bg-[#314232] border border-[#F4EFE6]/15 text-xs font-medium text-[#F4EFE6] transition-colors cursor-pointer whitespace-nowrap"
                  title="Honk Horn (H)"
                >
                  Horn (H)
                </button>
                <button
                  type="button"
                  onClick={onEnterPhotoMode}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D9822B] hover:bg-[#E48E38] text-[#171E17] font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
                  title="Enter Photo Mode (C)"
                >
                  <Camera className="w-4 h-4" />
                  <span>Photo Mode (C)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
