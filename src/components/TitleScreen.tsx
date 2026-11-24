import React from 'react';
import { BookOpen, Compass, LogIn, User, Volume2, VolumeX } from 'lucide-react';
import { CrazyGamesUserProfile } from '../types/game';

interface TitleScreenProps {
  discoveredCount: number;
  totalSpecies: number;
  muted: boolean;
  user: CrazyGamesUserProfile | null;
  userAccountAvailable: boolean;
  isTouchDevice: boolean;
  onStart: () => void;
  onOpenJournal: () => void;
  onToggleMute: () => void;
  onSignIn: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  discoveredCount,
  totalSpecies,
  muted,
  user,
  userAccountAvailable,
  isTouchDevice,
  onStart,
  onOpenJournal,
  onToggleMute,
  onSignIn,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-5 sm:p-6 md:p-12 pt-safe pb-safe">
      {/* Subtle directional gradient scrim on left side only so right/center 3D world breathes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(95deg, rgba(20, 29, 21, 0.84) 0%, rgba(20, 29, 21, 0.48) 45%, rgba(20, 29, 21, 0.08) 100%)',
        }}
      />

      {/* Top row: quiet reserve header + player profile + mute toggle */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs tracking-wide text-[#E6DFD1]/85 font-medium">
          Tropical Forest Reserve · Field Expedition
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {user ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 min-h-[40px] rounded-lg bg-[#1C271D]/90 border border-[#F4EFE6]/15 text-xs text-[#F4EFE6]">
              {user.profilePictureUrl ? (
                <img
                  src={user.profilePictureUrl}
                  alt={user.username}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <User className="w-3.5 h-3.5 text-[#E5B869]" />
              )}
              <span className="font-medium max-w-[130px] truncate">{user.username}</span>
            </div>
          ) : userAccountAvailable ? (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-[#1C271D]/90 hover:bg-[#273629] border border-[#E5B869]/35 text-xs font-medium text-[#E5B869] transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Sync</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg bg-[#1C271D]/90 border border-[#F4EFE6]/15 text-xs font-medium text-[#F4EFE6] hover:bg-[#273629] transition-colors cursor-pointer"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{muted ? 'Audio Off' : 'Audio On'}</span>
          </button>
        </div>
      </div>

      {/* Main Title Lockup over calm left negative space */}
      <div className="relative z-10 max-w-xl my-auto">
        <div className="mb-4 sm:mb-5 inline-block">
          {/* Bespoke inline SVG botanical + viewfinder emblem */}
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            className="w-12 h-12 sm:w-16 sm:h-16"
            aria-hidden="true"
          >
            <rect
              x="4"
              y="4"
              width="56"
              height="56"
              rx="14"
              fill="#233124"
              stroke="#E5B869"
              strokeWidth="1.5"
            />
            <path
              d="M16 22 V16 H22 M42 16 H48 V22 M16 42 V48 H22 M42 48 H48 V42"
              stroke="#F4EFE6"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="32" cy="32" r="10" stroke="#E5B869" strokeWidth="2" />
            <path
              d="M32 24 C36 27, 38 32, 32 39 C26 32, 28 27, 32 24 Z"
              fill="#72A86D"
            />
          </svg>
        </div>

        <h1
          className="font-display text-3xl sm:text-5xl md:text-6xl font-semibold text-[#F6F1E7] leading-[1.06] tracking-tight"
          style={{ textWrap: 'balance' }}
        >
          Wilderness Photo Explorer
        </h1>

        <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-[#E4DDD0]/90 leading-relaxed max-w-md">
          Drive the forest trails at your own pace, listen for wildlife, and photograph{' '}
          <span className="tabular-nums font-medium text-[#F4EFE6]">{totalSpecies}</span> native
          species for your field journal.
        </p>

        <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 pointer-events-auto">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2.5 px-6 sm:px-7 min-h-[48px] rounded-xl bg-[#D9822B] hover:bg-[#E28F3A] active:scale-[0.99] text-[#1A1D16] font-semibold text-sm sm:text-base shadow-lg transition-all cursor-pointer whitespace-nowrap"
          >
            <Compass className="w-5 h-5" />
            <span>Start Expedition</span>
          </button>

          <button
            type="button"
            onClick={onOpenJournal}
            className="inline-flex items-center gap-2.5 px-5 min-h-[48px] rounded-xl bg-[#223024]/92 hover:bg-[#2C3E2E] border border-[#F4EFE6]/20 text-[#F4EFE6] font-medium text-sm sm:text-base transition-colors cursor-pointer whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4 text-[#E5B869]" />
            <span>Field Journal</span>
            <span className="text-[#E5B869] tabular-nums text-sm">
              ({discoveredCount}/{totalSpecies})
            </span>
          </button>
        </div>
      </div>

      {/* Single flat control-hint line */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 sm:gap-4 text-[11px] sm:text-xs text-[#E4DDD0]/80 font-mono">
        <span>
          {isTouchDevice
            ? 'Thumb Stick Drive · Swipe Look · Camera Photo · Pinch Zoom'
            : 'WASD Drive · C Camera · Mouse Aim · Scroll Zoom · J Journal · Esc Pause'}
        </span>
        <span className="tabular-nums">
          Journal Progress: {discoveredCount} / {totalSpecies} Species
        </span>
      </div>
    </div>
  );
};
