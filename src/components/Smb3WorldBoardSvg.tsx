/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LM_OVERWORLD_GRID_COLS,
  LM_OVERWORLD_GRID_ROWS,
  SmwBetaProgress,
  SmwBoardPalette,
  SmwMapDecoration,
  SmwMapNode,
  SmwPathSegment,
  isSmwNodeUnlocked,
} from '../game/smwWorldMap.ts';

interface Smb3WorldBoardSvgProps {
  boardPalette?: SmwBoardPalette;
  nodes: SmwMapNode[];
  paths: SmwPathSegment[];
  decorations?: SmwMapDecoration[];
  progress?: SmwBetaProgress;
  islandPlayable?: boolean;
  yellowSwitchUnlocked?: boolean;
  selectedPathIndex?: number | null;
  onSelectPath?: (index: number) => void;
  interactivePaths?: boolean;
  showCoordinateGrid?: boolean;
  selectedDecorId?: string | null;
  interactiveDecor?: boolean;
  onDecorPointerDown?: (e: React.PointerEvent<SVGGElement>, dec: SmwMapDecoration) => void;
}

const PALETTE_COLORS: Record<
  SmwBoardPalette,
  {
    oceanBg: string;
    boardBg: string;
    boardBorder: string;
    gridStroke: string;
    hillFill: string;
    hillShade: string;
  }
> = {
  grass: {
    oceanBg: '#1c4098',
    boardBg: '#98e070',
    boardBorder: '#f8d878',
    gridStroke: '#78c050',
    hillFill: '#28a038',
    hillShade: '#146820',
  },
  desert: {
    oceanBg: '#3c2458',
    boardBg: '#e8c478',
    boardBorder: '#d89038',
    gridStroke: '#cca458',
    hillFill: '#c87830',
    hillShade: '#884818',
  },
  ocean: {
    oceanBg: '#102868',
    boardBg: '#68b8f8',
    boardBorder: '#f8d878',
    gridStroke: '#4898d8',
    hillFill: '#309060',
    hillShade: '#185838',
  },
  haunted: {
    oceanBg: '#140c28',
    boardBg: '#483468',
    boardBorder: '#a878e0',
    gridStroke: '#382454',
    hillFill: '#2c1c44',
    hillShade: '#180c2c',
  },
  volcano: {
    oceanBg: '#200808',
    boardBg: '#78342c',
    boardBorder: '#f87838',
    gridStroke: '#5c241c',
    hillFill: '#4c201c',
    hillShade: '#280c0c',
  },
};

export function buildStraightPathSvgData(seg: SmwPathSegment): string {
  const pts = seg.waypoints && seg.waypoints.length >= 2 ? seg.waypoints : [seg.p0, seg.p1];
  return pts
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${Math.round(pt[0] * 10)} ${Math.round(pt[1] * 6)}`)
    .join(' ');
}

function renderDecoration(dec: SmwMapDecoration, palette: typeof PALETTE_COLORS['grass']) {
  const cx = dec.x * 10;
  const cy = dec.y * 6;
  const w = (dec.width ?? 14) * 10;
  const h = (dec.height ?? 16) * 6;

  switch (dec.kind) {
    case 'water':
      return (
        <g key={dec.id}>
          <rect
            x={cx - w / 2}
            y={cy - h / 2}
            width={w}
            height={h}
            fill="#2888e8"
            stroke="#103878"
            strokeWidth="4"
          />
          <rect
            x={cx - w / 2 + 8}
            y={cy - h / 2 + 8}
            width={Math.max(12, w - 16)}
            height={Math.max(8, h - 16)}
            fill="#48a8f8"
            fillOpacity="0.45"
          />
          <line
            x1={cx - w * 0.25}
            y1={cy - 8}
            x2={cx + w * 0.2}
            y2={cy - 8}
            stroke="#e0f2fe"
            strokeWidth="3"
          />
          <line
            x1={cx - w * 0.15}
            y1={cy + 14}
            x2={cx + w * 0.28}
            y2={cy + 14}
            stroke="#bae6fd"
            strokeWidth="3"
          />
        </g>
      );

    case 'bridge':
      return (
        <g key={dec.id}>
          <rect
            x={cx - w / 2}
            y={cy - 10}
            width={w}
            height={20}
            fill="#c87828"
            stroke="#281408"
            strokeWidth="3"
          />
          {[-0.3, -0.1, 0.1, 0.3].map(offset => (
            <line
              key={offset}
              x1={cx + w * offset}
              y1={cy - 10}
              x2={cx + w * offset}
              y2={cy + 10}
              stroke="#582808"
              strokeWidth="2.5"
            />
          ))}
        </g>
      );

    case 'hill':
      return (
        <g key={dec.id}>
          <path
            d={`M ${cx - 32} ${cy + 20} L ${cx - 18} ${cy - 18} L ${cx + 18} ${cy - 18} L ${cx + 32} ${cy + 20} Z`}
            fill={palette.hillFill}
            stroke="#102010"
            strokeWidth="3"
          />
          <rect x={cx - 10} y={cy - 8} width="5" height="9" fill="#081808" />
          <rect x={cx + 5} y={cy - 8} width="5" height="9" fill="#081808" />
          <rect x={cx - 16} y={cy - 14} width="6" height="4" fill="#a8f898" fillOpacity="0.6" />
        </g>
      );

    case 'trees':
      return (
        <g key={dec.id}>
          {[
            [-18, 4],
            [0, -6],
            [18, 6],
          ].map(([ox, oy], idx) => (
            <g key={idx}>
              <rect x={cx + ox - 3} y={cy + oy + 8} width="6" height="10" fill="#783810" stroke="#180c04" strokeWidth="1.5" />
              <rect x={cx + ox - 12} y={cy + oy - 10} width="24" height="20" rx="4" fill="#188828" stroke="#0c3810" strokeWidth="2.5" />
              <rect x={cx + ox - 7} y={cy + oy - 6} width="7" height="6" fill="#68d850" />
            </g>
          ))}
        </g>
      );

    case 'rock':
      return (
        <g key={dec.id}>
          <polygon
            points={`${cx - 28},${cy + 18} ${cx - 14},${cy - 18} ${cx + 14},${cy - 18} ${cx + 28},${cy + 18}`}
            fill="#887c74"
            stroke="#1c1917"
            strokeWidth="3"
          />
          <polygon
            points={`${cx - 12},${cy - 16} ${cx},${cy - 4} ${cx + 12},${cy - 16}`}
            fill="#e2e8f0"
          />
          <rect x={cx - 9} y={cy + 2} width="18" height="16" fill="#1c1917" />
        </g>
      );

    case 'haunted_tree':
      return (
        <g key={dec.id}>
          <rect x={cx - 6} y={cy - 4} width="12" height="24" fill="#2c1c44" stroke="#0f081c" strokeWidth="2" />
          <polygon
            points={`${cx - 24},${cy} ${cx},${cy - 26} ${cx + 24},${cy}`}
            fill="#3b2060"
            stroke="#0f081c"
            strokeWidth="2.5"
          />
          <rect x={cx - 8} y={cy - 12} width="5" height="5" fill="#fde047" />
          <rect x={cx + 3} y={cy - 12} width="5" height="5" fill="#fde047" />
        </g>
      );

    case 'castle_fort':
      return (
        <g key={dec.id}>
          <rect x={cx - 26} y={cy - 14} width="52" height="32" fill="#64748b" stroke="#0f172a" strokeWidth="3" />
          <rect x={cx - 28} y={cy - 22} width="12" height="10" fill="#475569" stroke="#0f172a" strokeWidth="2" />
          <rect x={cx - 6} y={cy - 26} width="12" height="14" fill="#475569" stroke="#0f172a" strokeWidth="2" />
          <rect x={cx + 16} y={cy - 22} width="12" height="10" fill="#475569" stroke="#0f172a" strokeWidth="2" />
          <rect x={cx - 8} y={cy + 2} width="16" height="16" fill="#0f172a" />
          <polygon points={`${cx},${cy - 26} ${cx},${cy - 42} ${cx + 16},${cy - 34}`} fill="#dc2626" />
        </g>
      );

    case 'cloud':
      return (
        <g key={dec.id} opacity="0.9">
          <rect x={cx - 24} y={cy - 8} width="48" height="18" rx="8" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" />
          <rect x={cx - 14} y={cy - 16} width="26" height="14" rx="6" fill="#ffffff" />
        </g>
      );

    case 'enemy_patrol':
      return (
        <g key={dec.id}>
          <rect x={cx - 14} y={cy - 12} width="28" height="24" rx="4" fill="#14532d" stroke="#052e16" strokeWidth="2.5" />
          <rect x={cx - 8} y={cy - 7} width="16" height="9" fill="#fef08a" />
          <rect x={cx - 5} y={cy - 4} width="3" height="4" fill="#052e16" />
          <rect x={cx + 2} y={cy - 4} width="3" height="4" fill="#052e16" />
          {dec.label && (
            <text
              x={cx}
              y={cy + 24}
              textAnchor="middle"
              fill="#0f172a"
              fontSize="11"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {dec.label}
            </text>
          )}
        </g>
      );
  }
}

export const Smb3WorldBoardSvg: React.FC<Smb3WorldBoardSvgProps> = ({
  boardPalette = 'grass',
  nodes,
  paths,
  decorations = [],
  progress,
  islandPlayable = true,
  selectedPathIndex = null,
  onSelectPath,
  interactivePaths = false,
  showCoordinateGrid = false,
  selectedDecorId = null,
  interactiveDecor = false,
  onDecorPointerDown,
}) => {
  const palette = PALETTE_COLORS[boardPalette] || PALETTE_COLORS.grass;

  return (
    <svg
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      className={`absolute inset-0 w-full h-full select-none ${
        interactivePaths || interactiveDecor ? '' : 'pointer-events-none'
      }`}
      aria-hidden={!interactivePaths && !interactiveDecor}
    >
      {/* SMB3 Ocean / Outer Frame */}
      <rect x="0" y="0" width="1000" height="600" fill={palette.oceanBg} />

      {/* SMB3 Outer Black + Pixel Gold Board Bezel */}
      <rect
        x="24"
        y="24"
        width="952"
        height="552"
        fill={palette.boardBg}
        stroke="#0a0a0e"
        strokeWidth="10"
      />
      <rect
        x="32"
        y="32"
        width="936"
        height="536"
        fill="none"
        stroke={palette.boardBorder}
        strokeWidth="4"
      />

      {/* Crisp SMB3 Map Tile Grid */}
      <g stroke={palette.gridStroke} strokeOpacity={showCoordinateGrid ? '0.65' : '0.45'} strokeWidth="1">
        {Array.from({ length: LM_OVERWORLD_GRID_COLS - 1 }, (_, i) => {
          const x = ((i + 1) * 1000) / LM_OVERWORLD_GRID_COLS;
          return <line key={`gx-${i}`} x1={x} y1={28} x2={x} y2={572} />;
        })}
        {Array.from({ length: LM_OVERWORLD_GRID_ROWS - 1 }, (_, i) => {
          const y = ((i + 1) * 600) / LM_OVERWORLD_GRID_ROWS;
          return <line key={`gy-${i}`} x1={28} y1={y} x2={972} y2={y} />;
        })}
      </g>

      {/* Optional Lunar Magic Coordinate Ruler Overlay */}
      {showCoordinateGrid && (
        <g pointerEvents="none" opacity="0.88">
          {Array.from({ length: 12 }, (_, i) => {
            const col = (i + 1) * 2;
            const x = (col * 1000) / LM_OVERWORLD_GRID_COLS;
            return (
              <text
                key={`lblx-${col}`}
                x={x}
                y={18}
                textAnchor="middle"
                fill="#fef08a"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {col.toString().padStart(2, '0')}
              </text>
            );
          })}
          {Array.from({ length: 9 }, (_, i) => {
            const row = (i + 1) * 2;
            const y = (row * 600) / LM_OVERWORLD_GRID_ROWS + 3;
            return (
              <text
                key={`lbly-${row}`}
                x={12}
                y={y}
                textAnchor="middle"
                fill="#fef08a"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {row.toString().padStart(2, '0')}
              </text>
            );
          })}
        </g>
      )}

      {/* SMB3 Terrain & Map Decorations (Camada 1) */}
      {decorations.map(dec => {
        const isSelDec = selectedDecorId === dec.id;
        const cx = dec.x * 10;
        const cy = dec.y * 6;
        const bw = (dec.width ?? 8) * 10;
        const bh = (dec.height ?? 8) * 6;
        return (
          <g
            key={dec.id}
            data-world-decor={dec.id}
            onPointerDown={e => {
              if (!interactiveDecor || !onDecorPointerDown) return;
              e.stopPropagation();
              onDecorPointerDown(e, dec);
            }}
            className={interactiveDecor ? 'cursor-grab active:cursor-grabbing' : undefined}
          >
            {renderDecoration(dec, palette)}
            {isSelDec && (
              <rect
                x={cx - bw / 2 - 4}
                y={cy - bh / 2 - 4}
                width={bw + 8}
                height={bh + 8}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="3"
                strokeDasharray="6 3"
              />
            )}
          </g>
        );
      })}

      {/* SMB3 Straight-Line Roads (Orthogonal / Straight Lines ONLY — no Bezier curves) */}
      {paths.map((seg, idx) => {
        const toNode = nodes.find(n => n.id === seg.toId);
        const pathUnlocked = !islandPlayable
          ? false
          : !progress
          ? true
          : toNode
          ? isSmwNodeUnlocked(toNode.id, progress, nodes)
          : false;
        const d = buildStraightPathSvgData(seg);
        const pts = seg.waypoints && seg.waypoints.length >= 2 ? seg.waypoints : [seg.p0, seg.p1];
        const isSelected = selectedPathIndex === idx;
        const isSecret = Boolean(seg.isSecretRoute || toNode?.unlocksAfterSecretNodeId);

        return (
          <g
            key={`${seg.fromId}-${seg.toId}-${idx}`}
            onClick={e => {
              if (!interactivePaths || !onSelectPath) return;
              e.stopPropagation();
              onSelectPath(idx);
            }}
            className={interactivePaths ? 'cursor-pointer' : undefined}
          >
            {/* Outer dark SMB3 road border */}
            <path
              d={d}
              fill="none"
              stroke={isSelected ? '#38bdf8' : '#101014'}
              strokeWidth={isSelected ? 18 : 14}
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            {/* Main straight road core */}
            <path
              d={d}
              fill="none"
              stroke={
                pathUnlocked
                  ? isSecret
                    ? '#f59e0b'
                    : '#f8d878'
                  : '#64748b'
              }
              strokeWidth="8"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            {/* Inner SMB3 dashed/tile road accent */}
            <path
              d={d}
              fill="none"
              stroke={
                pathUnlocked
                  ? isSecret
                    ? '#fef08a'
                    : '#b45309'
                  : '#334155'
              }
              strokeWidth="2.5"
              strokeDasharray={pathUnlocked ? '8 8' : '6 10'}
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            {/* Square SMB3 corner joint at orthogonal elbows */}
            {pts.slice(1, -1).map((corner, cIdx) => (
              <rect
                key={cIdx}
                x={Math.round(corner[0] * 10) - 6}
                y={Math.round(corner[1] * 6) - 6}
                width="12"
                height="12"
                fill={pathUnlocked ? '#f8d878' : '#64748b'}
                stroke="#101014"
                strokeWidth="2.5"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
};
