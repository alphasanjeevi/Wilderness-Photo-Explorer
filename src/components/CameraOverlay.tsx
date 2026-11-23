import React, { useState } from 'react';
import { BookOpen, Camera, Grid, Minus, Plus, X } from 'lucide-react';
import { CapturedPhoto, FocusTargetInfo, WorldHudTelemetry } from '../types/game';

interface CaptureBanner {
  photo: CapturedPhoto;
  speciesName: string | null;
  isNewSpecies: boolean;
  unlockedBehavior: boolean;
}

interface CameraOverlayProps {
  telemetry: WorldHudTelemetry;
  focus: FocusTargetInfo | null;
  shutterFlash: boolean;
  lastCaptureBanner: CaptureBanner | null;
  onExitPhotoMode: () => void;
  onShutter: () => void;
  onSetZoom: (zoom: number) => void;
  onOpenJournal: () => void;
  onTouchAimDelta: (dx: number, dy: number) => void;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  telemetry,
  focus,
  shutterFlash,
  lastCaptureBanner,
  onExitPhotoMode,
  onShutter,
  onSetZoom,
  onOpenJournal,
  onTouchAimDelta,
}) => {
  const [showGrid, setShowGrid] = useState(true);
  const [dragLast, setDragLast] = useState<{ x: number; y: number } | null>(null);

  const focusLocked = Boolean(focus?.locked);
  const focusProgress = focus?.focusProgress ?? 0;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
      {/* Shutter white flash */}
      {shutterFlash && (
        <div className="fixed inset-0 bg-white/75 pointer-events-none z-30 transition-opacity duration-150" />
      )}

      {/* Subtle rule-of-thirds viewfinder grid */}
      {showGrid && (
        <div className="fixed inset-8 sm:inset-14 pointer-events-none border border-[#F4EFE6]/20 rounded-lg">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-[#F4EFE6]/12" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-[#F4EFE6]/12" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-[#F4EFE6]/12" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-[#F4EFE6]/12" />
        </div>
      )}

      {/* Touch / pointer aim region (covers background without blocking buttons) */}
      <div
        className="fixed inset-0 pointer-events-auto z-0"
        onPointerDown={(e) => {
          setDragLast({ x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          if (dragLast && e.buttons > 0) {
            const dx = e.clientX - dragLast.x;
            const dy = e.clientY - dragLast.y;
            onTouchAimDelta(dx, dy);
            setDragLast({ x: e.clientX, y: e.clientY });
          }
        }}
        onPointerUp={() => setDragLast(null)}
        onPointerCancel={() => setDragLast(null)}
      />

      {/* TOP BAR: (D) Exit Camera button top-left, Grid/Journal top-right */}
      <div className="relative z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExitPhotoMode}
            className="pointer-events-auto inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#182219]/90 hover:bg-[#243226] border border-[#F4EFE6]/20 text-xs sm:text-sm font-medium text-[#F4EFE6] transition-colors cursor-pointer"
            title="Exit Photo Mode (C or Esc)"
          >
            <X className="w-4 h-4" />
            <span>Exit Camera</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#182219]/85 border border-[#F4EFE6]/12 text-xs text-[#E4DDD0]">
            <span>{telemetry.habitatLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{telemetry.timeLabel}</span>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
              showGrid
                ? 'bg-[#28392A]/92 border-[#E5B869]/50 text-[#F4EFE6]'
                : 'bg-[#182219]/88 border-[#F4EFE6]/15 text-[#D8D2C5]/80'
            }`}
            title="Toggle Viewfinder Grid"
          >
            <Grid className="w-4 h-4" />
            <span className="hidden sm:inline">Grid</span>
          </button>

          <button
            type="button"
            onClick={onOpenJournal}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#182219]/90 hover:bg-[#243226] border border-[#F4EFE6]/20 text-xs font-medium text-[#F4EFE6] transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#E5B869]" />
            <span className="hidden sm:inline">Journal</span>
          </button>
        </div>
      </div>

      {/* CENTER FOCUS RETICLE (C) & RIGHT ZOOM SLIDER (B) */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        {/* Central Focus Indicator */}
        <div className="flex flex-col items-center pointer-events-none">
          <div
            className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
              focusLocked
                ? 'border-[#54B86E]'
                : focus
                  ? 'border-[#E5B869]'
                  : 'border-[#F4EFE6]/55'
            }`}
          >
            {/* Inner focus ring scales inward smoothly as focus locks */}
            <div
              className={`w-14 h-14 rounded-full border transition-transform duration-100 ${
                focusLocked
                  ? 'border-[#54B86E] scale-90'
                  : focus
                    ? 'border-[#E5B869]/80 scale-100'
                    : 'border-[#F4EFE6]/35 scale-110'
              }`}
              style={{
                transform: focus ? `scale(${1.2 - focusProgress * 0.3})` : undefined,
              }}
            />
            <div
              className={`absolute w-1.5 h-1.5 rounded-full ${
                focusLocked ? 'bg-[#54B86E]' : 'bg-[#F4EFE6]/80'
              }`}
            />
          </div>

          {/* Species Focus Readout */}
          <div className="mt-3 min-h-[28px] text-center">
            {focus ? (
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium shadow-md ${
                  focusLocked
                    ? 'bg-[#1F4429]/95 border border-[#54B86E]/60 text-[#E7F8EB]'
                    : 'bg-[#182219]/90 border border-[#E5B869]/50 text-[#F4EFE6]'
                }`}
              >
                <span>{focusLocked ? 'Focused' : 'Focusing'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold">{focus.species.commonName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-xs opacity-85">{focus.distance}m</span>
              </div>
            ) : (
              <div className="px-3 py-1 rounded-lg bg-[#182219]/75 text-xs text-[#E4DDD0]/85">
                Aim at wildlife to lock focus · Scroll or slider to zoom
              </div>
            )}
          </div>
        </div>

        {/* Right Vertical Zoom Slider (B) */}
        <div className="pointer-events-auto absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-[#182219]/90 border border-[#F4EFE6]/15 rounded-2xl px-2.5 py-3 shadow-lg">
          <button
            type="button"
            onClick={() => onSetZoom(telemetry.zoom + 0.5)}
            className="w-8 h-8 rounded-lg bg-[#253326] hover:bg-[#314232] flex items-center justify-center text-[#F4EFE6] cursor-pointer"
            aria-label="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="h-32 sm:h-40 flex items-center justify-center py-1">
            <input
              type="range"
              min={1}
              max={5}
              step={0.1}
              value={telemetry.zoom}
              onChange={(e) => onSetZoom( parseFloat(e.target.value) )}
              aria-label="Camera Zoom"
              className="w-28 sm:w-36 accent-[#D9822B] cursor-pointer"
              style={{ transform: 'rotate(-90deg)' }}
            />
          </div>

          <button
            type="button"
            onClick={() => onSetZoom(telemetry.zoom - 0.5)}
            className="w-8 h-8 rounded-lg bg-[#253326] hover:bg-[#314232] flex items-center justify-center text-[#F4EFE6] cursor-pointer"
            aria-label="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>

          <span className="font-mono tabular-nums text-xs font-medium text-[#E5B869]">
            {telemetry.zoom.toFixed(1)}x
          </span>
        </div>

        {/* Polaroid Capture Toast */}
        {lastCaptureBanner && (
          <div className="pointer-events-auto absolute left-0 bottom-2 sm:bottom-4 bg-[#F4EFE6] text-[#1D261E] rounded-xl p-2.5 shadow-2xl border border-[#2B3A2C]/20 flex items-center gap-3 max-w-xs">
            <img
              src={lastCaptureBanner.photo.dataUrl}
              alt={lastCaptureBanner.speciesName ?? 'Scenic wilderness snapshot'}
              className="w-20 h-15 object-cover rounded-lg border border-[#2B3A2C]/15 shrink-0"
            />
            <div className="min-w-0 pr-1">
              <div className="text-xs font-semibold text-[#C86E24]">
                {lastCaptureBanner.isNewSpecies
                  ? 'New Species Discovered!'
                  : lastCaptureBanner.unlockedBehavior
                    ? 'Behavior Notes Unlocked'
                    : lastCaptureBanner.speciesName
                      ? 'Photo Saved to Journal'
                      : 'Scenic Photo Saved'}
              </div>
              <div className="text-sm font-display font-semibold truncate text-[#1D261E]">
                {lastCaptureBanner.speciesName ?? 'Tropical Reserve View'}
              </div>
              <div className="text-[11px] text-[#556156]">
                {lastCaptureBanner.photo.qualityLabel}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BAR: (A) Large Touch-Friendly Shutter Button */}
      <div className="relative z-10 flex items-center justify-center pb-1">
        <div className="pointer-events-auto flex items-center gap-4">
          <button
            type="button"
            onClick={onShutter}
            className={`group relative w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 flex items-center justify-center shadow-xl transition-transform active:scale-95 cursor-pointer ${
              focusLocked
                ? 'bg-[#54B86E] border-[#F4EFE6] text-[#102416]'
                : 'bg-[#F4EFE6] border-[#D9822B] text-[#1D261E]'
            }`}
            aria-label="Take Photo (Space or F)"
            title="Capture Photo (Space / F)"
          >
            <Camera className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};
