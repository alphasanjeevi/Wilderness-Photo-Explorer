import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Compass, Navigation } from 'lucide-react';
import {
  getRiverSamples,
  getRoadSamples,
  MAP_POIS,
  PLAYABLE_RADIUS,
} from '../game/terrain';
import { WorldHudTelemetry } from '../types/game';

interface MinimapProps {
  telemetry: WorldHudTelemetry;
}

const SIZE = 140;
const CENTER = SIZE / 2;
const CLIP_R = 59;
const MAP_RANGE_METERS = 105; // Local radar radius around player
const SCALE = CLIP_R / MAP_RANGE_METERS;

export const Minimap: React.FC<MinimapProps> = ({ telemetry }) => {
  const [headingUp, setHeadingUp] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const roadSamples = useMemo(() => getRoadSamples(), []);
  const riverSamples = useMemo(() => getRiverSamples(), []);

  // Project world (wx, wz) relative to player jeep into minimap unrotated north-up SVG coords
  const projectRel = (wx: number, wz: number) => {
    const dx = wx - telemetry.jeepX;
    const dz = wz - telemetry.jeepZ;
    // Facing +Z = North (up = -svgY), East = -X (right = +svgX)
    return {
      x: CENTER - dx * SCALE,
      y: CENTER - dz * SCALE,
    };
  };

  // Heading-Up rotates the map counter-clockwise by headingDeg so jeep forward always points UP
  const mapRotDeg = headingUp ? -telemetry.headingDeg : 0;
  const jeepArrowDeg = headingUp ? 0 : telemetry.headingDeg;

  const roadPath = useMemo(() => {
    if (roadSamples.length === 0) return '';
    return (
      roadSamples
        .map((pt, i) => {
          const p = projectRel(pt.x, pt.z);
          return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        })
        .join(' ') + ' Z'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadSamples, telemetry.jeepX, telemetry.jeepZ]);

  const riverPath = useMemo(() => {
    if (riverSamples.length === 0) return '';
    return riverSamples
      .map((pt, i) => {
        const p = projectRel(pt.x, pt.z);
        return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riverSamples, telemetry.jeepX, telemetry.jeepZ]);

  const valleyCenter = projectRel(0, 0);
  const valleyRadiusPx = PLAYABLE_RADIUS * SCALE;

  // Cardinal markers around bezel
  const cardinals = [
    { label: 'N', angleDeg: 0, color: '#E5B869' },
    { label: 'E', angleDeg: 90, color: '#D8D2C5' },
    { label: 'S', angleDeg: 180, color: '#D8D2C5' },
    { label: 'W', angleDeg: 270, color: '#D8D2C5' },
  ];

  const poiColor = (kind: string) => {
    switch (kind) {
      case 'camp':
        return '#E5B869';
      case 'meadow':
        return '#89C973';
      case 'bridge':
        return '#D4A373';
      case 'waterfall':
        return '#67C6D4';
      case 'ruins':
        return '#C9C2B2';
      case 'canopy':
        return '#5BAE6F';
      default:
        return '#F4EFE6';
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#182219]/90 hover:bg-[#243226] border border-[#F4EFE6]/15 text-xs font-medium text-[#F4EFE6] shadow-md transition-colors cursor-pointer"
      >
        <Compass className="w-3.5 h-3.5 text-[#E5B869]" />
        <span>Show Map</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-75" />
      </button>
    );
  }

  return (
    <div className="pointer-events-auto inline-flex flex-col items-start gap-1.5">
      <div className="relative bg-[#182219]/92 border border-[#F4EFE6]/16 rounded-2xl p-2 shadow-xl">
        {/* Map SVG */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-[116px] h-[116px] sm:w-[138px] sm:h-[138px] block"
          aria-label="Reserve Minimap"
        >
          <defs>
            <clipPath id="minimap-clip">
              <circle cx={CENTER} cy={CENTER} r={CLIP_R} />
            </clipPath>
          </defs>

          {/* Radar base disc */}
          <circle cx={CENTER} cy={CENTER} r={CLIP_R} fill="#213023" />

          {/* Subtle range rings */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CLIP_R * 0.5}
            fill="none"
            stroke="#F4EFE6"
            strokeOpacity="0.08"
            strokeDasharray="2 3"
          />

          {/* Rotatable World Layer */}
          <g clipPath="url(#minimap-clip)">
            <g transform={`rotate(${mapRotDeg.toFixed(1)} ${CENTER} ${CENTER})`}>
              {/* Valley Playable Boundary */}
              <circle
                cx={valleyCenter.x}
                cy={valleyCenter.y}
                r={valleyRadiusPx}
                fill="#293B2B"
                stroke="#6C8466"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />

              {/* River Ribbon */}
              <path
                d={riverPath}
                fill="none"
                stroke="#439FA6"
                strokeWidth="5.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.88"
              />

              {/* Looped Dirt Road */}
              <path
                d={roadPath}
                fill="none"
                stroke="#BFA072"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />

              {/* Nearby Wildlife Activity Blips */}
              {telemetry.nearbyWildlife.map((blip, idx) => {
                const p = projectRel(blip.x, blip.z);
                const c =
                  blip.category === 'bird'
                    ? '#F2C94C'
                    : blip.category === 'insect'
                      ? '#7CC6FE'
                      : '#9CE08D';
                return (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r="2.1"
                    fill={c}
                    opacity="0.85"
                  />
                );
              })}

              {/* Points of Interest (clamped to radar edge if distant so you can navigate!) */}
              {MAP_POIS.map((poi) => {
                const raw = projectRel(poi.x, poi.z);
                const rx = raw.x - CENTER;
                const ry = raw.y - CENTER;
                const distPx = Math.hypot(rx, ry);
                const maxRim = CLIP_R - 8;
                const clamped = distPx > maxRim;
                const px = clamped ? CENTER + (rx / distPx) * maxRim : raw.x;
                const py = clamped ? CENTER + (ry / distPx) * maxRim : raw.y;
                const col = poiColor(poi.kind);

                return (
                  <g key={poi.id} transform={`translate(${px.toFixed(1)}, ${py.toFixed(1)})`}>
                    <g transform={`rotate(${(-mapRotDeg).toFixed(1)})`}>
                      <circle
                        r={clamped ? 2.8 : 3.6}
                        fill={col}
                        stroke="#151E16"
                        strokeWidth="1"
                        opacity={clamped ? 0.78 : 1}
                      />
                      {!clamped && (
                        <text
                          y="-6"
                          textAnchor="middle"
                          fontSize="7.2"
                          fontWeight="600"
                          fill="#F4EFE6"
                          stroke="#151E16"
                          strokeWidth="2"
                          paintOrder="stroke"
                        >
                          {poi.shortLabel}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          </g>

          {/* Outer Bezel Ring */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CLIP_R}
            fill="none"
            stroke="#F4EFE6"
            strokeOpacity="0.22"
            strokeWidth="1.2"
          />

          {/* Rotating Cardinal Letters on Bezel */}
          {cardinals.map((c) => {
            const rad = ((c.angleDeg + mapRotDeg - 90) * Math.PI) / 180;
            const tx = CENTER + Math.cos(rad) * (CLIP_R + 6.5);
            const ty = CENTER + Math.sin(rad) * (CLIP_R + 6.5);
            return (
              <text
                key={c.label}
                x={tx}
                y={ty + 2.6}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="700"
                fill={c.color}
              >
                {c.label}
              </text>
            );
          })}

          {/* Centered Player Jeep Arrow + Forward Sight Cone */}
          <g transform={`translate(${CENTER}, ${CENTER}) rotate(${jeepArrowDeg.toFixed(1)})`}>
            <path
              d="M0,-2 L-9,-18 A20,20 0 0,1 9,-18 Z"
              fill="#D9822B"
              opacity="0.22"
            />
            <path
              d="M0,-6.5 L4.5,5 L0,2.5 L-4.5,5 Z"
              fill="#D9822B"
              stroke="#F4EFE6"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </g>
        </svg>

        {/* Bottom bar of minimap: Mode toggle (Rotatable vs North-Up) + Minimize */}
        <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-[#D8D2C5]/85 px-0.5">
          <button
            type="button"
            onClick={() => setHeadingUp((h) => !h)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#253326] hover:bg-[#314432] text-[#F4EFE6] transition-colors cursor-pointer"
            title="Toggle between Rotating (Heading-Up) and North-Up map"
          >
            <Navigation className="w-2.5 h-2.5 text-[#E5B869]" />
            <span>{headingUp ? 'Rotate' : 'North-Up'}</span>
          </button>

          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="p-0.5 rounded hover:bg-[#253326] text-[#D8D2C5]/75 hover:text-[#F4EFE6] cursor-pointer"
            aria-label="Hide Minimap"
            title="Hide Minimap"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
