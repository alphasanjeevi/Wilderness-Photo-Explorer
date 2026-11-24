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
import { WeatherType, WorldHudTelemetry } from '../types/game';
import { Minimap } from './Minimap';

interface DrivingHudProps {
  telemetry: WorldHudTelemetry;
  discoveredCount: number;
  totalSpecies: number;
  muted: boolean;
  showTouchControls: boolean;
  onEnterPhotoMode: () => void;
  onOpenJournal: () => void;
  onPause: () => void;
  onToggleMute: () => void;
  onHonk: () => void;
  onSetWeather: (w: WeatherType) => void;
  onSetTimePreset: (t: number) => void;
  onVirtualInput: (throttle: number, steer: number) => void;
}

export const DrivingHud: React.FC<DrivingHudProps> = ({
  telemetry,
  discoveredCount,
  totalSpecies,
  muted,
  showTouchControls,
  onEnterPhotoMode,
  onOpenJournal,
  onPause,
  onToggleMute,
  onHonk,
  onSetWeather,
  onSetTimePreset,
  onVirtualInput,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  const handlePadPointer = (e: React.PointerEvent<HTMLDivElement>, active: boolean) => {
    if (!active || !padRef.current) {
      setKnobOffset({ x: 0, y: 0 });
      onVirtualInput(0, 0);
      return;
    }
    const rect = padRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    const dx = Math.max(-maxR, Math.min(maxR, e.clientX - cx));
    const dy = Math.max(-maxR, Math.min(maxR, e.clientY - cy));
    setKnobOffset({ x: dx, y: dy });
    onVirtualInput(-dy / maxR, -dx / maxR);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-5">
      {/* TOP BAR: Compact perimeter telemetry + rotatable minimap + quick actions */}
      <div className="flex items-start justify-between gap-3">
        {/* Top-left reserve status & rotatable minimap */}
        <div className="flex flex-col items-start gap-2.5">
          <div className="bg-[#182219]/90 border border-[#F4EFE6]/12 rounded-xl px-4 py-2.5 shadow-md">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#F4EFE6]">
              <span>{telemetry.habitatLabel}</span>
              <span className="text-[#F4EFE6]/40" aria-hidden="true">·</span>
              <span className="text-[#E5B869] tabular-nums">
                {discoveredCount}/{totalSpecies} Species
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-[#D8D2C5]/80">
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
          </div>

          <Minimap telemetry={telemetry} />
        </div>

        {/* Top-right action cluster */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenJournal}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#182219]/90 hover:bg-[#243226] border border-[#F4EFE6]/15 text-xs sm:text-sm font-medium text-[#F4EFE6] transition-colors cursor-pointer whitespace-nowrap"
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
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#182219]/90 hover:bg-[#243226] border border-[#F4EFE6]/15 text-[#F4EFE6] transition-colors cursor-pointer"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onPause}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#182219]/90 hover:bg-[#243226] border border-[#F4EFE6]/15 text-[#F4EFE6] transition-colors cursor-pointer"
            aria-label="Pause Menu"
            title="Pause (Esc)"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MOBILE / TOUCH VIRTUAL DRIVE PAD (Only rendered when touch controls enabled) */}
      {showTouchControls && (
        <div className="flex items-end justify-between px-1 pb-16 pointer-events-none">
          <div
            ref={padRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handlePadPointer(e, true);
            }}
            onPointerMove={(e) => {
              if (e.buttons > 0) handlePadPointer(e, true);
            }}
            onPointerUp={(e) => handlePadPointer(e, false)}
            onPointerCancel={(e) => handlePadPointer(e, false)}
            className="pointer-events-auto relative w-28 h-28 rounded-full bg-[#182219]/80 border-2 border-[#F4EFE6]/25 flex items-center justify-center touch-none"
          >
            <div
              className="w-11 h-11 rounded-full bg-[#D9822B] border border-[#F4EFE6]/50 shadow-md"
              style={{
                transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
              }}
            />
          </div>

          <button
            type="button"
            onClick={onEnterPhotoMode}
            className="pointer-events-auto inline-flex items-center gap-2 px-5 py-4 rounded-2xl bg-[#D9822B] text-[#182018] font-semibold text-sm shadow-lg"
          >
            <Camera className="w-5 h-5" />
            <span>Camera</span>
          </button>
        </div>
      )}

      {/* COLLAPSIBLE BOTTOM CONTROL DOCK (Centered, <=15% viewport height) */}
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
    </div>
  );
};
