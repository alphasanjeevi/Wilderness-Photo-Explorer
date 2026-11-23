import React, { useState } from 'react';
import { BookOpen, Home, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { GameSettings } from '../types/game';

interface PauseModalProps {
  settings: GameSettings;
  discoveredCount: number;
  totalSpecies: number;
  onResume: () => void;
  onOpenJournal: () => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onReturnToCamp: () => void;
  onReturnToTitle: () => void;
  onResetSave: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  settings,
  discoveredCount,
  totalSpecies,
  onResume,
  onOpenJournal,
  onUpdateSettings,
  onReturnToCamp,
  onReturnToTitle,
  onResetSave,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed inset-0 z-30 bg-[#121912]/75 flex items-center justify-center p-4">
      <div
        className="w-full max-w-md bg-[#1D281E] text-[#F4EFE6] rounded-2xl border border-[#F4EFE6]/15 shadow-2xl p-6"
        role="dialog"
        aria-label="Expedition Paused"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Expedition Paused</h2>
            <p className="text-xs text-[#D8D2C5]/80 mt-0.5 tabular-nums">
              Field Journal: {discoveredCount} / {totalSpecies} Species Discovered
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="w-9 h-9 rounded-xl bg-[#29382B] hover:bg-[#344636] flex items-center justify-center cursor-pointer"
            aria-label="Resume"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Resume & Journal Buttons */}
        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#D9822B] hover:bg-[#E28F3A] text-[#181E17] font-semibold text-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Resume Exploration</span>
          </button>

          <button
            type="button"
            onClick={onOpenJournal}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#273629] hover:bg-[#314434] border border-[#F4EFE6]/12 text-sm font-medium transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#E5B869]" />
            <span>Open Field Journal</span>
          </button>
        </div>

        {/* Settings */}
        <div className="mt-6 pt-5 border-t border-[#F4EFE6]/12 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#E4DDD0]">Nature & Camera Audio</span>
            <button
              type="button"
              onClick={() => onUpdateSettings({ muted: !settings.muted })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#273629] hover:bg-[#314434] text-xs font-medium cursor-pointer"
            >
              {settings.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{settings.muted ? 'Muted' : 'Enabled'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#E4DDD0]">On-Screen Touch Pad</span>
            <button
              type="button"
              onClick={() => onUpdateSettings({ showTouchControls: !settings.showTouchControls })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                settings.showTouchControls
                  ? 'bg-[#4A7C59] text-[#F4EFE6]'
                  : 'bg-[#273629] text-[#D8D2C5]'
              }`}
            >
              {settings.showTouchControls ? 'Shown' : 'Hidden'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#E4DDD0]">Daylight Progression</span>
            <button
              type="button"
              onClick={() => onUpdateSettings({ autoTimeCycle: !settings.autoTimeCycle })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                settings.autoTimeCycle
                  ? 'bg-[#4A7C59] text-[#F4EFE6]'
                  : 'bg-[#273629] text-[#D8D2C5]'
              }`}
            >
              {settings.autoTimeCycle ? 'Natural Cycle' : 'Paused'}
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-[#D8D2C5] mb-1.5">
              <span>Camera Aim Sensitivity</span>
              <span className="font-mono tabular-nums">{settings.cameraSensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={settings.cameraSensitivity}
              onChange={(e) =>
                onUpdateSettings({ cameraSensitivity: parseFloat(e.target.value) })
              }
              className="w-full accent-[#D9822B] cursor-pointer"
            />
          </div>
        </div>

        {/* Navigation & Reset */}
        <div className="mt-6 pt-5 border-t border-[#F4EFE6]/12 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              onReturnToCamp();
              onResume();
            }}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#243226] hover:bg-[#2E4030] text-xs font-medium cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Return to Camp</span>
          </button>

          <button
            type="button"
            onClick={onReturnToTitle}
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#243226] hover:bg-[#2E4030] text-xs font-medium cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Title Screen</span>
          </button>
        </div>

        <div className="mt-3 text-center">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="text-xs text-[#D8D2C5]/60 hover:text-[#E88C7D] transition-colors cursor-pointer"
            >
              Reset Saved Journal Progress
            </button>
          ) : (
            <div className="flex items-center justify-center gap-3 text-xs">
              <span className="text-[#E88C7D]">Clear all photos & entries?</span>
              <button
                type="button"
                onClick={() => {
                  onResetSave();
                  setConfirmReset(false);
                }}
                className="font-semibold text-[#E88C7D] underline cursor-pointer"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-[#D8D2C5] underline cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
