import React from 'react';
import { SpeciesDefinition } from '../types/game';

interface Props {
  species: SpeciesDefinition;
  unlocked: boolean;
  className?: string;
}

function hexFromInt(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

export const SpeciesIllustration: React.FC<Props> = ({ species, unlocked, className = '' }) => {
  const primary = unlocked ? hexFromInt(species.colors.primary) : '#B7B2A6';
  const secondary = unlocked ? hexFromInt(species.colors.secondary) : '#D2CEC4';
  const accent = unlocked ? hexFromInt(species.colors.accent) : '#9E998E';

  return (
    <svg
      viewBox="0 0 120 90"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect width="120" height="90" rx="8" fill={unlocked ? '#EAE3D3' : '#E3DDD0'} />
      <circle cx="60" cy="46" r="28" fill={secondary} opacity={unlocked ? 0.35 : 0.25} />
      {species.category === 'bird' ? (
        <g transform="translate(26, 18)">
          <path d="M18 36 C18 20, 34 14, 48 22 C54 25, 62 24, 68 28 C61 32, 54 33, 50 38 C46 48, 30 52, 16 48 L6 56 L12 42 Z" fill={primary} />
          <path d="M52 24 L69 27 L54 32 Z" fill={accent} />
          <circle cx="47" cy="24" r="2.2" fill="#1A1A1A" />
        </g>
      ) : species.category === 'insect' ? (
        <g transform="translate(24, 16)">
          <ellipse cx="36" cy="30" rx="5" ry="18" fill={accent} />
          <path d="M32 24 C14 10, 6 24, 14 36 C20 44, 30 38, 32 32 Z" fill={primary} />
          <path d="M40 24 C58 10, 66 24, 58 36 C52 44, 42 38, 40 32 Z" fill={primary} />
          <circle cx="22" cy="28" r="4" fill={secondary} opacity="0.8" />
          <circle cx="50" cy="28" r="4" fill={secondary} opacity="0.8" />
        </g>
      ) : (
        <g transform="translate(22, 20)">
          <path d="M16 34 C16 22, 32 18, 48 20 L60 14 L64 20 L70 24 L64 30 L56 32 L54 48 L46 48 L46 36 L28 36 L26 48 L18 48 Z" fill={primary} />
          <path d="M16 28 C8 24, 6 16, 12 14 C16 14, 18 22, 18 28 Z" fill={secondary} />
          <circle cx="60" cy="21" r="2" fill="#1A1A1A" />
        </g>
      )}
    </svg>
  );
};
