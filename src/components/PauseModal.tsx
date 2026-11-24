import React, { useState } from 'react';
import {
  BookOpen,
  Crosshair,
  Home,
  LogIn,
  Play,
  RotateCcw,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { CrazyGamesUserProfile, GameSettings } from '../types/game';

interface PauseModalProps {
  settings: GameSettings;
  discoveredCount: number;
  totalSpecies: number;
  user: CrazyGamesUserProfile | null;
  userAccountAvailable: boolean;
  canScoutMore: boolean;
  scoutActive: boolean;
  rewardedAdAvailable: boolean;
  scoutCooldownSec: number;
  onResume: () => void;
  onOpenJournal: () => void;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onReturnToCamp: () => void;
  onReturnToTitle: () => void;
  onResetSave: () => void;
  onSignIn: () => void;
  onRequestScoutBeacon: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  settings,
  discoveredCount,
  totalSpecies,
  user,
  userAccountAvailable,
  canScoutMore,
  scoutActive,
  rewardedAdAvailable,
  scoutCooldownSec,
  onResume,
  onOpenJournal,
  onUpdateSettings,
  onReturnToCamp,
  onReturnToTitle,
  onResetSave,
  onSignIn,
  onRequestScoutBeacon,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const scoutDisabled = !canScoutMore || scoutActive || (!rewardedAdAvailable && scoutCooldownSec > 0);

  return (
    <div className="fixed inset-0 z-30 bg-[#121912]/75 flex items-center justify-center p-3 sm:p-4">
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#1D281E] text-[#F4EFE6] rounded-2xl border border-[#F4EFE6]/15 shadow-2xl p-5 sm:p-6"
        role="dialog"
        aria-label="Expedition Paused"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Expedition Paused</h2>
            <p className="text-xs text-[#D8D2C5]/80 mt-0.5 tabular-nums">
              Field Journal: {discoveredCount} / {totalSpecies} Species Discovered
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="w-11 h-11 rounded-xl bg-[#29382B] hover:bg-[#344636] flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Resume"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explorer Account Row */}
        <div className="mt-4 pt-3.5 border-t border-[#F4EFE6]/10 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {user?.profilePictureUrl ? (
              <img
                src={user.profilePictureUrl}
                alt={user.username}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-full object-cover shrink-0"
              />
            ) : (
              <User className="w-4 h-4 text-[#E5B869] shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-medium text-[#F4EFE6] truncate">
                {user ? user.username : 'Guest Explorer'}
              </div>
              <div className="text-[11px] text-[#D8D2C5]/70">
                {user ? 'Journal synced to CrazyGames profile' : 'Saved locally in browser'}
              </div>
            </div>
          </div>

          {!user && userAccountAvailable && (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg bg-[#273629] hover:bg-[#314434] border border-[#E5B869]/35 text-[#E5B869] font-medium shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* Primary Resume, Journal & Scout Beacon Buttons */}
        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[46px] py-2.5 px-4 rounded-xl bg-[#D9822B] hover:bg-[#E28F3A] text-[#181E17] font-semibold text-sm transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Resume Exploration</span>
          </button>

          <button
            type="button"
            onClick={onOpenJournal}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#273629] hover:bg-[#314434] border border-[#F4EFE6]/12 text-sm font-medium transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-[#E5B869]" />
            <span>Open Field Journal</span>
          </button>

          {canScoutMore && (
            <button
              type="button"
              disabled={scoutDisabled}
              onClick={onRequestScoutBeacon}
              className={`w-full inline-flex items-center justify-center gap-2 min-h-[44px] py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${
                scoutDisabled
                  ? 'bg-[#212D23] border-[#F4EFE6]/10 text-[#D8D2C5]/55 cursor-not-allowed'
                  : 'bg-[#273629] hover:bg-[#314434] border-[#E5B869]/35 text-[#E5B869] cursor-pointer'
              }`}
              title={
                rewardedAdAvailable
                  ? 'Watch a short ad to reveal the nearest undiscovered species on your minimap'
                  : 'Send a free field pulse to locate the nearest undiscovered species on your minimap'
              }
            >
              <Crosshair className="w-4 h-4" />
              <span className="tabular-nums">
                {scoutActive
                  ? 'Scout Beacon Active on Minimap'
                  : rewardedAdAvailable
                    ? 'Locate Nearest Species (Watch Ad)'
                    : scoutCooldownSec > 0
                      ? `Scout Pulse Cooling Down (${scoutCooldownSec}s)`
                      : 'Locate Nearest Species (Scout Pulse)'}
              </span>
            </button>
          )}
        </div>

        {/* Settings */}
        <div className="mt-5 pt-4 border-t border-[#F4EFE6]/12 space-y-3.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#E4DDD0]">Nature & Camera Audio</span>
            <button
              type="button"
              onClick={() => onUpdateSettings({ muted: !settings.muted })}
              className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg bg-[#273629] hover:bg-[#314434] text-xs font-medium cursor-pointer"
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
              className={`px-3 min-h-[38px] rounded-lg text-xs font-medium cursor-pointer ${
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
              className={`px-3 min-h-[38px] rounded-lg text-xs font-medium cursor-pointer ${
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
        <div className="mt-5 pt-4 border-t border-[#F4EFE6]/12 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              onReturnToCamp();
              onResume();
            }}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] py-2 px-3 rounded-xl bg-[#243226] hover:bg-[#2E4030] text-xs font-medium cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Return to Camp</span>
          </button>

          <button
            type="button"
            onClick={onReturnToTitle}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] py-2 px-3 rounded-xl bg-[#243226] hover:bg-[#2E4030] text-xs font-medium cursor-pointer"
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
              className="text-xs text-[#D8D2C5]/60 hover:text-[#E88C7D] transition-colors cursor-pointer py-1"
            >
              Reset Saved Journal Progress
            </button>
          ) : (
            <div className="flex items-center justify-center gap-3 text-xs py-1">
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
