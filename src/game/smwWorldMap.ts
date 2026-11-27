/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelData, SmwSwitchColor } from './types.ts';
import {
  cloneLevelData,
  createSecretVault,
  createWorld1_1,
  createWorld1_2,
  createWorld1_4,
  createWorld2_2,
  createWorldGhostHouse,
  createWorldDesertStage,
  createWorldSnowStage,
  createWorldSkyStage,
  createWorldForestStage,
  createWorldVolcanoStage,
  normalizeHexLevelCode,
  parseWorldStageFromJson,
  type WorldStageJsonDefaults,
} from './levels.ts';
import defaultWorldMapJson from './worldLevels/world-map.json';
import world1Json from './worldLevels/worlds/world-1.json';
import world2Json from './worldLevels/worlds/world-2.json';
import world3Json from './worldLevels/worlds/world-3.json';
import world4Json from './worldLevels/worlds/world-4.json';
import world5Json from './worldLevels/worlds/world-5.json';
import world6Json from './worldLevels/worlds/world-6.json';
import world7Json from './worldLevels/worlds/world-7.json';
import subworld1Json from './worldLevels/worlds/subworld-1.json';
import subworld2Json from './worldLevels/worlds/subworld-2.json';
import subworld3Json from './worldLevels/worlds/subworld-3.json';
import subworld4Json from './worldLevels/worlds/subworld-4.json';
import subworld5Json from './worldLevels/worlds/subworld-5.json';
import subworld6Json from './worldLevels/worlds/subworld-6.json';
import subworld7Json from './worldLevels/worlds/subworld-7.json';
import wiki1OverworldJson from './worldLevels/wiki-1-overworld.json';
import smwWiki1SecretJson from './worldLevels/smw-wiki-1-secret.json';
import wiki2CavernaJson from './worldLevels/wiki-2-caverna.json';
import wiki3AguaJson from './worldLevels/wiki-3-agua.json';
import wiki4MansaoJson from './worldLevels/wiki-4-mansao.json';
import wiki5CasteloJson from './worldLevels/wiki-5-castelo.json';
import wikiSwitchYellowJson from './worldLevels/wiki-switch-yellow.json';
import wikiSwitchGreenJson from './worldLevels/wiki-switch-green.json';
import wikiSwitchRedJson from './worldLevels/wiki-switch-red.json';
import wikiSwitchPinkJson from './worldLevels/wiki-switch-pink.json';
import wikiSwitchBlueJson from './worldLevels/wiki-switch-blue.json';
import worldHexMapsJson from './worldLevels/world-hex-maps.json';
import hex00D2Json from './worldLevels/00D2.json';

export const SMW_BETA_VERSION = 'Beta V0.9';
export const SMW_WORLD_ISLAND_NAME = 'Ilha WikiWorldWeb';

export const SMW_INTRO_STORY =
  'Olá, seja bem vindo ao mundo fantastico de WazzimaGiygg. Parece que desta vez o problema também é o caluniador, de nome Chronus, junto com Bowser. Vamos explorar os mundos para poder salvar a princesa femboy';

export type SmwIslandId = 'wikiworld' | 'island2' | string;
export type SmwWorldType = 'main' | 'subworld';

export const LM_OVERWORLD_GRID_COLS = 25;
export const LM_OVERWORLD_GRID_ROWS = 20;

export const SMW_ISLAND2_UNAVAILABLE_MSG = '(Versão Beta) ainda não disponível para jogar';

export type SmwBoardPalette =
  | 'grass'
  | 'desert'
  | 'ocean'
  | 'haunted'
  | 'volcano'
  | 'snow'
  | 'sky'
  | 'forest';

export type SmwMapDecorationKind =
  | 'hill'
  | 'trees'
  | 'water'
  | 'bridge'
  | 'rock'
  | 'haunted_tree'
  | 'castle_fort'
  | 'cloud'
  | 'enemy_patrol';

export interface SmwMapDecoration {
  id: string;
  kind: SmwMapDecorationKind;
  x: number;
  y: number;
  gridX?: number;
  gridY?: number;
  width?: number;
  height?: number;
  label?: string;
}

export interface SmwIslandInfo {
  id: SmwIslandId;
  number: number;
  worldType?: SmwWorldType;
  parentWorldId?: string;
  subworldId?: string;
  overworldGrid?: { cols: number; rows: number };
  name: string;
  subtitle: string;
  playable: boolean;
  boardPalette?: SmwBoardPalette;
  introStory?: string;
}

export const JOHANNNNES_CASTLE_1_BOSS_NAME = 'Lorde Ignis Koopa';

export type SmwNodeKind =
  | 'stage'
  | 'castle'
  | 'switch_palace'
  | 'pipe'
  | 'toad_house'
  | 'subworld_portal'
  | 'star_warp';

export interface SmwMapNode {
  id: string;
  order: number;
  code: string;
  title: string;
  subtitle: string;
  bossName?: string;
  theme: LevelData['theme'];
  nodeKind?: SmwNodeKind;
  stageKey?: string;
  hexId?: string;
  mapX: number;
  mapY: number;
  gridX?: number;
  gridY?: number;
  targetIslandId?: string;
  targetNodeId?: string;
  eventId?: number;
  isCastle?: boolean;
  isSwitchPalace?: boolean;
  switchColor?: SmwSwitchColor;
  unlocksAfterNodeId?: string;
  unlocksAfterSecretNodeId?: string;
  betaPlaceholderMessage?: string;
}

export interface SmwDevSwitchPalaceInfo {
  id: string;
  code: string;
  color: SmwSwitchColor;
  title: string;
  rewardLabel: string;
}

export const SMW_DEV_ONLY_SWITCH_PALACES: SmwDevSwitchPalaceInfo[] = [
  {
    id: 'wiki-switch-green',
    code: 'PV',
    color: 'green',
    title: 'Palácio Interruptor Verde',
    rewardLabel: 'Bloco [!] Verde · Pena (Cape)',
  },
  {
    id: 'wiki-switch-red',
    code: 'PR',
    color: 'red',
    title: 'Palácio Interruptor Vermelho',
    rewardLabel: 'Bloco [!] Vermelho · Flor de Fogo',
  },
  {
    id: 'wiki-switch-pink',
    code: 'PP',
    color: 'pink',
    title: 'Palácio Interruptor Rosa',
    rewardLabel: 'Bloco [!] Rosa · Laço Femboy',
  },
  {
    id: 'wiki-switch-blue',
    code: 'PB',
    color: 'blue',
    title: 'Palácio Interruptor Azul',
    rewardLabel: 'Bloco [!] Azul · Tanooki',
  },
];

export interface SmwPathSegment {
  fromId: string;
  toId: string;
  fromOrder: number;
  toOrder: number;
  p0: [number, number];
  c1: [number, number];
  c2: [number, number];
  p1: [number, number];
  waypoints?: [number, number][];
  lineStyle?: 'straight' | 'orthogonal';
  isSecretRoute?: boolean;
  eventId?: number;
}

export interface SmwWorldIslandConfig extends SmwIslandInfo {
  nodes: SmwMapNode[];
  paths: SmwPathSegment[];
  decorations?: SmwMapDecoration[];
}

export interface SmwWorldMapJson {
  format: 'smb-world-map';
  version: 1;
  design: 'smb3';
  defaultIslandId: string;
  islands: SmwWorldIslandConfig[];
}

export interface WorldFileEntry {
  id: string;
  number: number;
  worldType: SmwWorldType;
  filename: string;
  rawJson: unknown;
}

export const WORLD_JSON_FILES_REGISTRY: readonly WorldFileEntry[] = [
  { id: 'wikiworld', number: 1, worldType: 'main', filename: 'worlds/world-1.json', rawJson: world1Json },
  { id: 'island2', number: 2, worldType: 'main', filename: 'worlds/world-2.json', rawJson: world2Json },
  { id: 'world-3', number: 3, worldType: 'main', filename: 'worlds/world-3.json', rawJson: world3Json },
  { id: 'world-4', number: 4, worldType: 'main', filename: 'worlds/world-4.json', rawJson: world4Json },
  { id: 'world-5', number: 5, worldType: 'main', filename: 'worlds/world-5.json', rawJson: world5Json },
  { id: 'world-6', number: 6, worldType: 'main', filename: 'worlds/world-6.json', rawJson: world6Json },
  { id: 'world-7', number: 7, worldType: 'main', filename: 'worlds/world-7.json', rawJson: world7Json },
  { id: 'subworld-1', number: 1, worldType: 'subworld', filename: 'worlds/subworld-1.json', rawJson: subworld1Json },
  { id: 'subworld-2', number: 2, worldType: 'subworld', filename: 'worlds/subworld-2.json', rawJson: subworld2Json },
  { id: 'subworld-3', number: 3, worldType: 'subworld', filename: 'worlds/subworld-3.json', rawJson: subworld3Json },
  { id: 'subworld-4', number: 4, worldType: 'subworld', filename: 'worlds/subworld-4.json', rawJson: subworld4Json },
  { id: 'subworld-5', number: 5, worldType: 'subworld', filename: 'worlds/subworld-5.json', rawJson: subworld5Json },
  { id: 'subworld-6', number: 6, worldType: 'subworld', filename: 'worlds/subworld-6.json', rawJson: subworld6Json },
  { id: 'subworld-7', number: 7, worldType: 'subworld', filename: 'worlds/subworld-7.json', rawJson: subworld7Json },
];

const VALID_BOARD_PALETTES = new Set<SmwBoardPalette>([
  'grass',
  'desert',
  'ocean',
  'haunted',
  'volcano',
  'snow',
  'sky',
  'forest',
]);

const VALID_DECOR_KINDS = new Set<SmwMapDecorationKind>([
  'hill',
  'trees',
  'water',
  'bridge',
  'rock',
  'haunted_tree',
  'castle_fort',
  'cloud',
  'enemy_patrol',
]);

const VALID_NODE_THEMES = new Set<LevelData['theme']>([
  'overworld',
  'underground',
  'castle',
  'underwater',
  'ghost_house',
  'desert',
  'snow',
  'sky',
  'forest',
  'volcano',
]);

function clampPercent(val: unknown, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(4, Math.min(96, Math.round(val * 10) / 10));
}

export function gridCoordToPercent(
  gridX: number,
  gridY: number,
  cols: number = LM_OVERWORLD_GRID_COLS,
  rows: number = LM_OVERWORLD_GRID_ROWS
): { mapX: number; mapY: number } {
  const stepX = 100 / Math.max(10, cols);
  const stepY = 100 / Math.max(10, rows);
  return {
    mapX: clampPercent(gridX * stepX, 50),
    mapY: clampPercent(gridY * stepY, 50),
  };
}

export function percentToGridCoord(
  mapX: number,
  mapY: number,
  cols: number = LM_OVERWORLD_GRID_COLS,
  rows: number = LM_OVERWORLD_GRID_ROWS
): { gridX: number; gridY: number } {
  const stepX = 100 / Math.max(10, cols);
  const stepY = 100 / Math.max(10, rows);
  return {
    gridX: Math.max(1, Math.min(cols - 1, Math.round(mapX / stepX))),
    gridY: Math.max(1, Math.min(rows - 1, Math.round(mapY / stepY))),
  };
}

export function isSmwPortalNode(node: Pick<SmwMapNode, 'nodeKind' | 'targetIslandId'>): boolean {
  return (
    node.nodeKind === 'subworld_portal' ||
    node.nodeKind === 'star_warp' ||
    Boolean(node.targetIslandId)
  );
}

function normalizePoint(raw: unknown, fallback: [number, number]): [number, number] {
  if (!Array.isArray(raw) || raw.length < 2) return [fallback[0], fallback[1]];
  return [clampPercent(raw[0], fallback[0]), clampPercent(raw[1], fallback[1])];
}

export function buildOrthogonalWaypoints(
  from: [number, number],
  to: [number, number],
  mode: 'hv' | 'vh' | 'direct' = 'hv'
): [number, number][] {
  const [x0, y0] = from;
  const [x1, y1] = to;
  if (mode === 'direct' || Math.abs(x0 - x1) < 0.5 || Math.abs(y0 - y1) < 0.5) {
    return [
      [x0, y0],
      [x1, y1],
    ];
  }
  if (mode === 'vh') {
    return [
      [x0, y0],
      [x0, y1],
      [x1, y1],
    ];
  }
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
  ];
}

function parseSingleIslandObject(
  rawIsland: unknown,
  idx: number
): SmwWorldIslandConfig {
  if (!rawIsland || typeof rawIsland !== 'object') {
    throw new Error(`Ilha #${idx + 1} inválida no JSON do Mundo.`);
  }
  const isl = rawIsland as Record<string, unknown>;
  const id =
    typeof isl.id === 'string' && isl.id.trim()
      ? isl.id.trim()
      : idx === 0
      ? 'wikiworld'
      : `island-${idx + 1}`;
  const number =
    typeof isl.number === 'number' && Number.isFinite(isl.number)
      ? Math.max(1, Math.floor(isl.number))
      : idx + 1;
  const worldType: SmwWorldType =
    isl.worldType === 'subworld' || id.startsWith('subworld') ? 'subworld' : 'main';
  const parentWorldId =
    typeof isl.parentWorldId === 'string' && isl.parentWorldId.trim()
      ? isl.parentWorldId.trim()
      : undefined;
  const subworldId =
    typeof isl.subworldId === 'string' && isl.subworldId.trim()
      ? isl.subworldId.trim()
      : undefined;
  const rawGrid =
    isl.overworldGrid && typeof isl.overworldGrid === 'object'
      ? (isl.overworldGrid as Record<string, unknown>)
      : null;
  const cols =
    rawGrid && typeof rawGrid.cols === 'number' && Number.isFinite(rawGrid.cols)
      ? Math.max(10, Math.min(50, Math.round(rawGrid.cols)))
      : LM_OVERWORLD_GRID_COLS;
  const rows =
    rawGrid && typeof rawGrid.rows === 'number' && Number.isFinite(rawGrid.rows)
      ? Math.max(10, Math.min(40, Math.round(rawGrid.rows)))
      : LM_OVERWORLD_GRID_ROWS;

  const name =
    typeof isl.name === 'string' && isl.name.trim()
      ? isl.name.trim()
      : worldType === 'subworld'
      ? `Submundo ${number}`
      : `Mundo ${number}`;
  const subtitle =
    typeof isl.subtitle === 'string'
      ? isl.subtitle.trim()
      : `${worldType === 'subworld' ? 'Submundo' : 'Mundo'} ${number} · Modo World SMB3`;
  const playable = typeof isl.playable === 'boolean' ? isl.playable : true;
  const boardPalette: SmwBoardPalette = VALID_BOARD_PALETTES.has(
    isl.boardPalette as SmwBoardPalette
  )
    ? (isl.boardPalette as SmwBoardPalette)
    : 'grass';
  const introStory =
    typeof isl.introStory === 'string' && isl.introStory.trim()
      ? isl.introStory.trim()
      : SMW_INTRO_STORY;

  if (!Array.isArray(isl.nodes) || isl.nodes.length === 0) {
    throw new Error(`O mapa "${name}" deve possuir ao menos 1 nó.`);
  }

  const nodes: SmwMapNode[] = isl.nodes.map((rawNode, nIdx) => {
    const n = (rawNode && typeof rawNode === 'object' ? rawNode : {}) as Record<string, unknown>;
    const nodeId =
      typeof n.id === 'string' && n.id.trim()
        ? n.id.trim()
        : `${id}-node-${nIdx + 1}`;
    const rawTheme = String(n.theme || 'overworld') as LevelData['theme'];
    const theme: LevelData['theme'] = VALID_NODE_THEMES.has(rawTheme) ? rawTheme : 'overworld';
    const isCastle = Boolean(n.isCastle || n.nodeKind === 'castle' || (theme === 'castle' && n.nodeKind !== 'stage' && n.nodeKind !== 'subworld_portal' && n.nodeKind !== 'star_warp'));
    const isSwitchPalace = Boolean(n.isSwitchPalace || n.nodeKind === 'switch_palace');
    const rawSwitchColor = String(n.switchColor || '') as SmwSwitchColor;
    const switchColor: SmwSwitchColor | undefined =
      rawSwitchColor === 'yellow' ||
      rawSwitchColor === 'green' ||
      rawSwitchColor === 'red' ||
      rawSwitchColor === 'pink' ||
      rawSwitchColor === 'blue'
        ? rawSwitchColor
        : isSwitchPalace
        ? 'yellow'
        : undefined;

    const hasExplicitMapX = typeof n.mapX === 'number' && Number.isFinite(n.mapX);
    const hasExplicitMapY = typeof n.mapY === 'number' && Number.isFinite(n.mapY);
    const hasExplicitGridX = typeof n.gridX === 'number' && Number.isFinite(n.gridX);
    const hasExplicitGridY = typeof n.gridY === 'number' && Number.isFinite(n.gridY);
    const fromGrid = gridCoordToPercent(
      hasExplicitGridX ? (n.gridX as number) : 4 + ((nIdx * 4) % 18),
      hasExplicitGridY ? (n.gridY as number) : nIdx % 2 === 0 ? 12 : 8,
      cols,
      rows
    );
    const mapX = hasExplicitMapX ? clampPercent(n.mapX, fromGrid.mapX) : fromGrid.mapX;
    const mapY = hasExplicitMapY ? clampPercent(n.mapY, fromGrid.mapY) : fromGrid.mapY;
    const computedGrid = percentToGridCoord(mapX, mapY, cols, rows);
    const gridX = hasExplicitGridX
      ? Math.max(1, Math.min(cols - 1, Math.round(n.gridX as number)))
      : computedGrid.gridX;
    const gridY = hasExplicitGridY
      ? Math.max(1, Math.min(rows - 1, Math.round(n.gridY as number)))
      : computedGrid.gridY;

    const parsedKind: SmwNodeKind =
      n.nodeKind === 'stage' ||
      n.nodeKind === 'castle' ||
      n.nodeKind === 'switch_palace' ||
      n.nodeKind === 'pipe' ||
      n.nodeKind === 'toad_house' ||
      n.nodeKind === 'subworld_portal' ||
      n.nodeKind === 'star_warp'
        ? n.nodeKind
        : isCastle
        ? 'castle'
        : isSwitchPalace
        ? 'switch_palace'
        : 'stage';

    return {
      id: nodeId,
      order:
        typeof n.order === 'number' && Number.isFinite(n.order)
          ? Math.max(0, Math.floor(n.order))
          : nIdx,
      code:
        typeof n.code === 'string' && n.code.trim()
          ? n.code.trim().toUpperCase().slice(0, 6)
          : `W-${nIdx + 1}`,
      title:
        typeof n.title === 'string' && n.title.trim()
          ? n.title.trim()
          : `Fase ${nIdx + 1}`,
      subtitle: typeof n.subtitle === 'string' ? n.subtitle.trim() : '',
      ...(typeof n.bossName === 'string' && n.bossName.trim()
        ? { bossName: n.bossName.trim() }
        : {}),
      theme,
      nodeKind: parsedKind,
      ...(typeof n.stageKey === 'string' && n.stageKey.trim()
        ? { stageKey: n.stageKey.trim() }
        : {}),
      ...(typeof n.hexId === 'string' && n.hexId.trim()
        ? { hexId: normalizeHexLevelCode(n.hexId) || n.hexId.trim().toUpperCase() }
        : {}),
      mapX,
      mapY,
      gridX,
      gridY,
      ...(typeof n.targetIslandId === 'string' && n.targetIslandId.trim()
        ? { targetIslandId: n.targetIslandId.trim() }
        : {}),
      ...(typeof n.targetNodeId === 'string' && n.targetNodeId.trim()
        ? { targetNodeId: n.targetNodeId.trim() }
        : {}),
      ...(typeof n.eventId === 'number' && Number.isFinite(n.eventId)
        ? { eventId: Math.max(0, Math.min(255, Math.floor(n.eventId))) }
        : {}),
      ...(isCastle ? { isCastle: true } : {}),
      ...(isSwitchPalace ? { isSwitchPalace: true } : {}),
      ...(switchColor ? { switchColor } : {}),
      ...(typeof n.unlocksAfterNodeId === 'string' && n.unlocksAfterNodeId.trim()
        ? { unlocksAfterNodeId: n.unlocksAfterNodeId.trim() }
        : {}),
      ...(typeof n.unlocksAfterSecretNodeId === 'string' && n.unlocksAfterSecretNodeId.trim()
        ? { unlocksAfterSecretNodeId: n.unlocksAfterSecretNodeId.trim() }
        : {}),
      ...(typeof n.betaPlaceholderMessage === 'string' && n.betaPlaceholderMessage.trim()
        ? { betaPlaceholderMessage: n.betaPlaceholderMessage.trim() }
        : {}),
    };
  });

  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const rawPaths = Array.isArray(isl.paths) ? isl.paths : [];
  const paths: SmwPathSegment[] = rawPaths
    .map((rawSeg): SmwPathSegment | null => {
      if (!rawSeg || typeof rawSeg !== 'object') return null;
      const s = rawSeg as Record<string, unknown>;
      const fromId = typeof s.fromId === 'string' ? s.fromId.trim() : '';
      const toId = typeof s.toId === 'string' ? s.toId.trim() : '';
      const fromNode = nodeById.get(fromId);
      const toNode = nodeById.get(toId);
      if (!fromNode || !toNode || fromId === toId) return null;

      const p0: [number, number] = [fromNode.mapX, fromNode.mapY];
      const p1: [number, number] = [toNode.mapX, toNode.mapY];
      let waypoints: [number, number][];
      if (Array.isArray(s.waypoints) && s.waypoints.length >= 2) {
        waypoints = s.waypoints.map((pt, wIdx) =>
          normalizePoint(
            pt,
            wIdx === 0 ? p0 : wIdx === (s.waypoints as unknown[]).length - 1 ? p1 : p0
          )
        );
        waypoints[0] = p0;
        waypoints[waypoints.length - 1] = p1;
      } else {
        waypoints = buildOrthogonalWaypoints(p0, p1, 'hv');
      }
      const midPt = waypoints[Math.min(1, waypoints.length - 1)];
      const c1 = normalizePoint(s.c1, midPt);
      const c2 = normalizePoint(s.c2, waypoints[Math.max(0, waypoints.length - 2)]);
      const lineStyle: 'straight' | 'orthogonal' =
        s.lineStyle === 'straight' ? 'straight' : 'orthogonal';

      return {
        fromId,
        toId,
        fromOrder:
          typeof s.fromOrder === 'number' && Number.isFinite(s.fromOrder)
            ? s.fromOrder
            : fromNode.order,
        toOrder:
          typeof s.toOrder === 'number' && Number.isFinite(s.toOrder)
            ? s.toOrder
            : toNode.order,
        p0,
        c1,
        c2,
        p1,
        waypoints,
        lineStyle,
        ...(s.isSecretRoute === true || Boolean(toNode.unlocksAfterSecretNodeId === fromId)
          ? { isSecretRoute: true }
          : {}),
        ...(typeof s.eventId === 'number' && Number.isFinite(s.eventId)
          ? { eventId: Math.max(0, Math.min(255, Math.floor(s.eventId))) }
          : {}),
      };
    })
    .filter((x): x is SmwPathSegment => Boolean(x));

  const decorations: SmwMapDecoration[] = Array.isArray(isl.decorations)
    ? isl.decorations
        .map((rawDec, dIdx): SmwMapDecoration | null => {
          if (!rawDec || typeof rawDec !== 'object') return null;
          const d = rawDec as Record<string, unknown>;
          const kind = String(d.kind || '') as SmwMapDecorationKind;
          if (!VALID_DECOR_KINDS.has(kind)) return null;
          const hasGridX = typeof d.gridX === 'number' && Number.isFinite(d.gridX);
          const hasGridY = typeof d.gridY === 'number' && Number.isFinite(d.gridY);
          const fromGrid = gridCoordToPercent(
            hasGridX ? (d.gridX as number) : 12,
            hasGridY ? (d.gridY as number) : 10,
            cols,
            rows
          );
          const x =
            typeof d.x === 'number' && Number.isFinite(d.x)
              ? clampPercent(d.x, fromGrid.mapX)
              : fromGrid.mapX;
          const y =
            typeof d.y === 'number' && Number.isFinite(d.y)
              ? clampPercent(d.y, fromGrid.mapY)
              : fromGrid.mapY;
          const cGrid = percentToGridCoord(x, y, cols, rows);
          return {
            id:
              typeof d.id === 'string' && d.id.trim()
                ? d.id.trim()
                : `${id}-dec-${dIdx + 1}`,
            kind,
            x,
            y,
            gridX: hasGridX ? Math.round(d.gridX as number) : cGrid.gridX,
            gridY: hasGridY ? Math.round(d.gridY as number) : cGrid.gridY,
            ...(typeof d.width === 'number' && Number.isFinite(d.width)
              ? { width: Math.max(6, Math.min(48, d.width)) }
              : {}),
            ...(typeof d.height === 'number' && Number.isFinite(d.height)
              ? { height: Math.max(4, Math.min(40, d.height)) }
              : {}),
            ...(typeof d.label === 'string' && d.label.trim()
              ? { label: d.label.trim().slice(0, 24) }
              : {}),
          };
        })
        .filter((x): x is SmwMapDecoration => Boolean(x))
    : [];

  return {
    id,
    number,
    worldType,
    ...(parentWorldId ? { parentWorldId } : {}),
    ...(subworldId ? { subworldId } : {}),
    overworldGrid: { cols, rows },
    name,
    subtitle,
    playable,
    boardPalette,
    introStory,
    nodes,
    paths,
    decorations,
  };
}

export function parseSingleWorldJson(rawInput: string | unknown): SmwWorldIslandConfig {
  let parsed: unknown = rawInput;
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch {
      throw new Error('Arquivo JSON do Mundo inválido ou corrompido.');
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Estrutura do JSON do Mundo inválida.');
  }
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.islands)) {
    if (obj.islands.length === 0) {
      throw new Error('JSON do Mundo precisa conter ao menos 1 ilha em "islands".');
    }
    return parseSingleIslandObject(obj.islands[0], 0);
  }
  if (obj.island && typeof obj.island === 'object') {
    return parseSingleIslandObject(obj.island, 0);
  }
  return parseSingleIslandObject(obj, 0);
}

export function parseWorldMapJson(rawInput: string | unknown): SmwWorldMapJson {
  let parsed: unknown = rawInput;
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch {
      throw new Error('Arquivo JSON do Mundo inválido ou corrompido.');
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Estrutura raiz do JSON do Mundo inválida.');
  }
  const root = parsed as Record<string, unknown>;
  const rawIslands: unknown[] | null = Array.isArray(root.islands)
    ? root.islands
    : Array.isArray(root.nodes)
    ? [root]
    : null;
  if (!rawIslands || rawIslands.length === 0) {
    throw new Error('JSON do Mundo precisa conter "islands" ou uma definição de mapa com "nodes".');
  }

  const islands: SmwWorldIslandConfig[] = rawIslands.map((rawIsland, idx) =>
    parseSingleIslandObject(rawIsland, idx)
  );

  const requestedDefault =
    typeof root.defaultIslandId === 'string' &&
    islands.some(isl => isl.id === root.defaultIslandId)
      ? root.defaultIslandId
      : islands[0].id;

  return {
    format: 'smb-world-map',
    version: 1,
    design: 'smb3',
    defaultIslandId: requestedDefault,
    islands,
  };
}

export function cloneWorldMapJson(world: SmwWorldMapJson): SmwWorldMapJson {
  return parseWorldMapJson(world);
}

export function serializeWorldMapToJson(world: SmwWorldMapJson): string {
  return JSON.stringify(parseWorldMapJson(world), null, 2);
}

export function serializeSingleWorldToJson(island: SmwWorldIslandConfig): string {
  const normalized = parseSingleIslandObject(island, 0);
  return JSON.stringify(
    {
      format: 'smb-world-single',
      version: 1,
      design: 'smb3',
      ...normalized,
    },
    null,
    2
  );
}

export function mergeSingleWorldIntoPack(
  pack: SmwWorldMapJson,
  singleIsland: SmwWorldIslandConfig
): SmwWorldMapJson {
  const cloned = cloneWorldMapJson(pack);
  const normalized = parseSingleIslandObject(singleIsland, 0);
  const existingIdx = cloned.islands.findIndex(i => i.id === normalized.id);
  if (existingIdx >= 0) {
    cloned.islands[existingIdx] = normalized;
  } else {
    cloned.islands.push(normalized);
  }
  return cloned;
}

export function getMainWorlds(world: SmwWorldMapJson): SmwWorldIslandConfig[] {
  return world.islands.filter(isl => isl.worldType !== 'subworld');
}

export function getSubworlds(world: SmwWorldMapJson): SmwWorldIslandConfig[] {
  return world.islands.filter(isl => isl.worldType === 'subworld');
}

export function getLinkedSubworld(
  world: SmwWorldMapJson,
  mainWorldId: string
): SmwWorldIslandConfig | null {
  const main = world.islands.find(i => i.id === mainWorldId);
  if (main?.subworldId) {
    const found = world.islands.find(i => i.id === main.subworldId);
    if (found) return found;
  }
  return world.islands.find(i => i.worldType === 'subworld' && i.parentWorldId === mainWorldId) || null;
}

export function getLinkedParentWorld(
  world: SmwWorldMapJson,
  subworldId: string
): SmwWorldIslandConfig | null {
  const sub = world.islands.find(i => i.id === subworldId);
  if (sub?.parentWorldId) {
    const found = world.islands.find(i => i.id === sub.parentWorldId);
    if (found) return found;
  }
  return world.islands.find(i => i.worldType !== 'subworld' && i.subworldId === subworldId) || null;
}

const ASSEMBLED_DEFAULT_FROM_WORLD_FILES: SmwWorldMapJson = parseWorldMapJson({
  format: 'smb-world-map',
  version: 1,
  design: 'smb3',
  defaultIslandId: 'wikiworld',
  islands:
    WORLD_JSON_FILES_REGISTRY.length > 0
      ? WORLD_JSON_FILES_REGISTRY.map(entry => entry.rawJson)
      : (defaultWorldMapJson as { islands: unknown[] }).islands,
});

const DEFAULT_PARSED_WORLD_MAP: SmwWorldMapJson =
  ASSEMBLED_DEFAULT_FROM_WORLD_FILES.islands.length >= 14
    ? ASSEMBLED_DEFAULT_FROM_WORLD_MAP_FALLBACK(ASSEMBLED_DEFAULT_FROM_WORLD_FILES)
    : parseWorldMapJson(defaultWorldMapJson);

function ASSEMBLED_DEFAULT_FROM_WORLD_MAP_FALLBACK(w: SmwWorldMapJson): SmwWorldMapJson {
  return w;
}

export function getDefaultWorldMapJson(): SmwWorldMapJson {
  return cloneWorldMapJson(DEFAULT_PARSED_WORLD_MAP);
}

const DEFAULT_WIKIWORLD_ISLAND =
  DEFAULT_PARSED_WORLD_MAP.islands.find(i => i.id === 'wikiworld') ||
  DEFAULT_PARSED_WORLD_MAP.islands[0];

const DEFAULT_ISLAND2 =
  DEFAULT_PARSED_WORLD_MAP.islands.find(i => i.id === 'island2') ||
  DEFAULT_PARSED_WORLD_MAP.islands[1];

export const SMW_ISLANDS: SmwIslandInfo[] = DEFAULT_PARSED_WORLD_MAP.islands.map(isl => ({
  id: isl.id,
  number: isl.number,
  worldType: isl.worldType,
  parentWorldId: isl.parentWorldId,
  subworldId: isl.subworldId,
  overworldGrid: isl.overworldGrid,
  name: isl.name,
  subtitle: isl.subtitle,
  playable: isl.playable,
  boardPalette: isl.boardPalette,
  introStory: isl.introStory,
}));

export const SMW_WIKIWORLD_NODES: SmwMapNode[] = DEFAULT_WIKIWORLD_ISLAND.nodes;
export const SMW_PATH_SEGMENTS: SmwPathSegment[] = DEFAULT_WIKIWORLD_ISLAND.paths;
export const SMW_ISLAND2_NODES: SmwMapNode[] = DEFAULT_ISLAND2 ? DEFAULT_ISLAND2.nodes : [];
export const SMW_ISLAND2_PATH_SEGMENTS: SmwPathSegment[] = DEFAULT_ISLAND2
  ? DEFAULT_ISLAND2.paths
  : [];

/**
 * Evaluates position & tangent along a straight-line SMB3 path segment (orthogonal waypoints or linear p0->p1).
 */
export function evaluateSmwPathSegment(
  seg: SmwPathSegment,
  t: number
): { x: number; y: number; dx: number; dy: number } {
  const clampedT = Math.max(0, Math.min(1, t));
  const pts: [number, number][] =
    seg.waypoints && seg.waypoints.length >= 2 ? seg.waypoints : [seg.p0, seg.p1];

  const legLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    legLengths.push(len);
    totalLen += len;
  }

  if (totalLen <= 0.0001) {
    return { x: pts[0][0], y: pts[0][1], dx: 0, dy: 0 };
  }

  let targetDist = clampedT * totalLen;
  for (let i = 0; i < legLengths.length; i++) {
    const len = legLengths[i];
    const a = pts[i];
    const b = pts[i + 1];
    if (targetDist <= len || i === legLengths.length - 1) {
      const localT = len > 0.0001 ? Math.max(0, Math.min(1, targetDist / len)) : 0;
      return {
        x: a[0] + (b[0] - a[0]) * localT,
        y: a[1] + (b[1] - a[1]) * localT,
        dx: b[0] - a[0],
        dy: b[1] - a[1],
      };
    }
    targetDist -= len;
  }

  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  return { x: last[0], y: last[1], dx: last[0] - prev[0], dy: last[1] - prev[1] };
}

export interface SmwWalkStep {
  seg: SmwPathSegment;
  reverse: boolean;
}

export function findSmwMapPath(
  fromNodeId: string,
  toNodeId: string,
  segments: SmwPathSegment[] = SMW_PATH_SEGMENTS
): SmwWalkStep[] {
  if (fromNodeId === toNodeId) return [];

  const queue: { nodeId: string; steps: SmwWalkStep[] }[] = [{ nodeId: fromNodeId, steps: [] }];
  const visited = new Set<string>([fromNodeId]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const seg of segments) {
      let nextId: string | null = null;
      let reverse = false;
      if (seg.fromId === curr.nodeId) {
        nextId = seg.toId;
        reverse = false;
      } else if (seg.toId === curr.nodeId) {
        nextId = seg.fromId;
        reverse = true;
      }
      if (!nextId || visited.has(nextId)) continue;
      const nextSteps = [...curr.steps, { seg, reverse }];
      if (nextId === toNodeId) return nextSteps;
      visited.add(nextId);
      queue.push({ nodeId: nextId, steps: nextSteps });
    }
  }

  return [];
}

/**
 * Resolves graph-connected neighbor movement along the World Map straight roads so the player
 * can walk both forward and backward through every unlocked stage (R1.16.UC.4).
 */
export function resolveSmwDirectionalStep(
  fromNodeId: string,
  direction: 'up' | 'down' | 'left' | 'right',
  progress: SmwBetaProgress,
  islandId: SmwIslandId = 'wikiworld',
  overrideConfig?: { nodes: SmwMapNode[]; segments: SmwPathSegment[]; playable?: boolean }
): SmwMapNode | null {
  const defaultIsland =
    DEFAULT_PARSED_WORLD_MAP.islands.find(i => i.id === islandId) || DEFAULT_WIKIWORLD_ISLAND;
  const nodes = overrideConfig?.nodes ?? defaultIsland.nodes;
  const segments = overrideConfig?.segments ?? defaultIsland.paths;
  const islandPlayable = overrideConfig?.playable ?? defaultIsland.playable;
  const current = nodes.find(n => n.id === fromNodeId);
  if (!current) return null;

  const ux = direction === 'right' ? 1 : direction === 'left' ? -1 : 0;
  const uy = direction === 'down' ? 1 : direction === 'up' ? -1 : 0;

  // 1. Collect road-connected neighbors that are unlocked
  const neighborIds = new Set<string>();
  for (const seg of segments) {
    if (seg.fromId === fromNodeId) neighborIds.add(seg.toId);
    else if (seg.toId === fromNodeId) neighborIds.add(seg.fromId);
  }

  let bestNeighbor: SmwMapNode | null = null;
  let bestScore = -Infinity;

  for (const nid of neighborIds) {
    const cand = nodes.find(n => n.id === nid);
    if (!cand) continue;
    const isAccessible = !islandPlayable
      ? cand.order === 0
      : isSmwNodeUnlocked(cand.id, progress, nodes);
    if (!isAccessible) continue;

    const dx = cand.mapX - current.mapX;
    const dy = cand.mapY - current.mapY;
    const len = Math.hypot(dx, dy) || 1;
    const dot = (dx / len) * ux + (dy / len) * uy;
    if (dot > 0.12 && dot > bestScore) {
      bestScore = dot;
      bestNeighbor = cand;
    }
  }

  return bestNeighbor;
}

export const OVERWORLD_FIRST_STAGE_HEX = '0105';

export interface WorldStageJsonEntry {
  key: string;
  hexId: string;
  filename: string;
  label: string;
  rawJson: unknown;
  defaults: WorldStageJsonDefaults;
}

export const WORLD_STAGE_JSON_REGISTRY: readonly WorldStageJsonEntry[] = [
  {
    key: 'wiki-1-overworld',
    hexId: '0105',
    filename: 'wiki-1-overworld.json',
    label: "World W-1 (Yoshi's Island)",
    rawJson: wiki1OverworldJson,
    defaults: {
      id: 'smw-wiki-1',
      name: 'W-1',
      hexId: '0105',
      biomeLabel: "WIKIWORLDWEB · YOSHI'S ISLAND (W-1)",
      smwNodeId: 'wiki-1-overworld',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'smw-wiki-1-secret',
    hexId: '00C5',
    filename: 'smw-wiki-1-secret.json',
    label: 'World W-1 Subsolo (Caverna Chave)',
    rawJson: smwWiki1SecretJson,
    defaults: {
      id: 'smw-wiki-1-secret',
      name: 'W-1 SUBSOLO',
      hexId: '00C5',
      biomeLabel: 'WIKIWORLDWEB · SUBSOLO SECRETO',
      smwNodeId: 'wiki-1-overworld',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-2-caverna',
    hexId: '0106',
    filename: 'wiki-2-caverna.json',
    label: 'World W-2 (Caverna)',
    rawJson: wiki2CavernaJson,
    defaults: {
      id: 'smw-wiki-2',
      name: 'W-2',
      hexId: '0106',
      biomeLabel: 'WIKIWORLDWEB · CAVERNA',
      smwNodeId: 'wiki-2-caverna',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-3-agua',
    hexId: '0107',
    filename: 'wiki-3-agua.json',
    label: 'World W-3 (Água)',
    rawJson: wiki3AguaJson,
    defaults: {
      id: 'smw-wiki-3',
      name: 'W-3',
      hexId: '0107',
      biomeLabel: 'WIKIWORLDWEB · ÁGUA',
      smwNodeId: 'wiki-3-agua',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-4-mansao',
    hexId: '0108',
    filename: 'wiki-4-mansao.json',
    label: 'World W-4 (Mansão Fantasma)',
    rawJson: wiki4MansaoJson,
    defaults: {
      id: 'smw-wiki-4',
      name: 'W-4',
      hexId: '0108',
      biomeLabel: 'WIKIWORLDWEB · MANSÃO FANTASMA',
      smwNodeId: 'wiki-4-mansao',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-5-castelo',
    hexId: '0109',
    filename: 'wiki-5-castelo.json',
    label: 'World W-5 (Castelo)',
    rawJson: wiki5CasteloJson,
    defaults: {
      id: 'smw-wiki-5',
      name: 'W-5',
      hexId: '0109',
      biomeLabel: 'CASTELO DE JOHANNNNES89',
      smwNodeId: 'wiki-5-castelo',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
      bossName: JOHANNNNES_CASTLE_1_BOSS_NAME,
    },
  },
  {
    key: 'wiki-switch-yellow',
    hexId: '0110',
    filename: 'wiki-switch-yellow.json',
    label: 'World PA (Palácio Amarelo)',
    rawJson: wikiSwitchYellowJson,
    defaults: {
      id: 'smw-wiki-switch-yellow',
      name: 'PA',
      hexId: '0110',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO AMARELO',
      smwNodeId: 'wiki-switch-yellow',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-switch-green',
    hexId: '0111',
    filename: 'wiki-switch-green.json',
    label: 'World PV (Palácio Verde)',
    rawJson: wikiSwitchGreenJson,
    defaults: {
      id: 'smw-wiki-switch-green',
      name: 'PV',
      hexId: '0111',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO VERDE',
      smwNodeId: 'wiki-switch-green',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-switch-red',
    hexId: '0112',
    filename: 'wiki-switch-red.json',
    label: 'World PR (Palácio Vermelho)',
    rawJson: wikiSwitchRedJson,
    defaults: {
      id: 'smw-wiki-switch-red',
      name: 'PR',
      hexId: '0112',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO VERMELHO',
      smwNodeId: 'wiki-switch-red',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-switch-pink',
    hexId: '0113',
    filename: 'wiki-switch-pink.json',
    label: 'World PP (Palácio Rosa)',
    rawJson: wikiSwitchPinkJson,
    defaults: {
      id: 'smw-wiki-switch-pink',
      name: 'PP',
      hexId: '0113',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO ROSA',
      smwNodeId: 'wiki-switch-pink',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
  {
    key: 'wiki-switch-blue',
    hexId: '0114',
    filename: 'wiki-switch-blue.json',
    label: 'World PB (Palácio Azul)',
    rawJson: wikiSwitchBlueJson,
    defaults: {
      id: 'smw-wiki-switch-blue',
      name: 'PB',
      hexId: '0114',
      biomeLabel: 'WIKIWORLDWEB · PALÁCIO AZUL',
      smwNodeId: 'wiki-switch-blue',
      smwWorldName: SMW_WORLD_ISLAND_NAME,
      isFinalCastle: false,
    },
  },
];

export interface HexLevelCatalogItem {
  hexId: string;
  key: string;
  label: string;
  sourceFile: string;
  isEmbeddedMultiMap: boolean;
  isExampleMap?: boolean;
  loadLevel: () => LevelData;
}

const STANDALONE_HEX_JSON_MAP = new Map<string, { filename: string; rawJson: unknown }>();
STANDALONE_HEX_JSON_MAP.set('00D2', { filename: '00D2.json', rawJson: hex00D2Json });

// Em ambientes Vite (browser) usa import.meta.glob literal para empacotar todos os <HEX>.json;
// em Node/tsx (testes), faz fallback para leitura direta da pasta worldLevels/.
let loadedViaViteGlob = false;
try {
  const modules = import.meta.glob('./worldLevels/*.json', { eager: true }) as Record<
    string,
    { default?: unknown } | unknown
  >;
  if (modules && typeof modules === 'object') {
    loadedViaViteGlob = true;
    for (const [modPath, modExports] of Object.entries(modules)) {
      const filename = modPath.split('/').pop() || '';
      const stem = filename.replace(/\.json$/i, '');
      if (!/^[0-9a-fA-F]{1,4}$/.test(stem)) continue;
      const hexCode = normalizeHexLevelCode(stem);
      if (!hexCode) continue;
      const payload =
        modExports && typeof modExports === 'object' && 'default' in modExports
          ? (modExports as { default: unknown }).default
          : modExports;
      STANDALONE_HEX_JSON_MAP.set(hexCode, { filename, rawJson: payload });
    }
  }
} catch {
  // Node / tsx não transforma import.meta.glob — segue para fallback via fs abaixo
}

if (!loadedViaViteGlob && typeof process !== 'undefined') {
  try {
    const proc = process as unknown as {
      cwd?: () => string;
      getBuiltinModule?: (name: string) => unknown;
    };
    const fsMod = proc.getBuiltinModule?.('fs') as
      | {
          existsSync?: (p: string) => boolean;
          readdirSync?: (p: string) => string[];
          readFileSync?: (p: string, enc: string) => string;
        }
      | undefined;
    const pathMod = proc.getBuiltinModule?.('path') as
      | {
          resolve?: (...parts: string[]) => string;
          join?: (...parts: string[]) => string;
          dirname?: (p: string) => string;
        }
      | undefined;
    const urlMod = proc.getBuiltinModule?.('url') as
      | { fileURLToPath?: (u: string) => string }
      | undefined;
    if (
      fsMod?.existsSync &&
      fsMod?.readdirSync &&
      fsMod?.readFileSync &&
      pathMod?.join &&
      pathMod?.resolve
    ) {
      let worldDir = pathMod.resolve(proc.cwd?.() || '.', 'src/game/worldLevels');
      if (import.meta.url && urlMod?.fileURLToPath && pathMod.dirname) {
        const localDir = pathMod.join(pathMod.dirname(urlMod.fileURLToPath(import.meta.url)), 'worldLevels');
        if (fsMod.existsSync(localDir)) {
          worldDir = localDir;
        }
      }
      if (fsMod.existsSync(worldDir)) {
        for (const filename of fsMod.readdirSync(worldDir)) {
          const stem = filename.replace(/\.json$/i, '');
          if (!/^[0-9a-fA-F]{1,4}$/.test(stem)) continue;
          const hexCode = normalizeHexLevelCode(stem);
          if (!hexCode || STANDALONE_HEX_JSON_MAP.has(hexCode)) continue;
          const rawStr = fsMod.readFileSync(pathMod.join(worldDir, filename), 'utf8');
          STANDALONE_HEX_JSON_MAP.set(hexCode, { filename, rawJson: JSON.parse(rawStr) });
        }
      }
    }
  } catch {
    // Fallback seguro caso o ambiente restrinja acesso ao sistema de arquivos
  }
}

interface HexCatalogManifestEntry {
  hexId?: string;
  key?: string;
  file?: string;
  label?: string;
}

const HEX_CATALOG_BY_CODE = new Map<string, HexLevelCatalogItem>();

for (const entry of WORLD_STAGE_JSON_REGISTRY) {
  HEX_CATALOG_BY_CODE.set(entry.hexId, {
    hexId: entry.hexId,
    key: entry.key,
    label: entry.label,
    sourceFile: entry.filename,
    isEmbeddedMultiMap: false,
    isExampleMap: false,
    loadLevel: () => parseWorldStageFromJson(entry.rawJson, entry.defaults),
  });
}

const BIOME_HEX_STAGES: {
  hexId: string;
  key: string;
  label: string;
  loadLevel: () => LevelData;
}[] = [
  { hexId: '0115', key: 'theme:desert', label: 'Bioma Deserto (Dunas & Arenito)', loadLevel: createWorldDesertStage },
  { hexId: '0116', key: 'theme:snow', label: 'Bioma Neve (Geleira & Blocos de Gelo)', loadLevel: createWorldSnowStage },
  { hexId: '0117', key: 'theme:sky', label: 'Bioma Céu (Nuvens & Blocos Musicais)', loadLevel: createWorldSkyStage },
  { hexId: '0118', key: 'theme:forest', label: 'Bioma Floresta (Grama, Terra & Madeira)', loadLevel: createWorldForestStage },
  { hexId: '0119', key: 'theme:volcano', label: 'Bioma Vulcão (Rocha Vulcânica & Lava)', loadLevel: createWorldVolcanoStage },
];

for (const biome of BIOME_HEX_STAGES) {
  if (!HEX_CATALOG_BY_CODE.has(biome.hexId)) {
    HEX_CATALOG_BY_CODE.set(biome.hexId, {
      hexId: biome.hexId,
      key: biome.key,
      label: biome.label,
      sourceFile: 'levels.ts',
      isEmbeddedMultiMap: false,
      isExampleMap: false,
      loadLevel: biome.loadLevel,
    });
  }
}

const hexManifestEntries: HexCatalogManifestEntry[] = Array.isArray(
  (worldHexMapsJson as { entries?: unknown }).entries
)
  ? ((worldHexMapsJson as { entries: HexCatalogManifestEntry[] }).entries)
  : [];

const embeddedMapsRecord: Record<string, unknown> =
  worldHexMapsJson &&
  typeof worldHexMapsJson === 'object' &&
  'maps' in worldHexMapsJson &&
  (worldHexMapsJson as { maps?: unknown }).maps &&
  typeof (worldHexMapsJson as { maps?: unknown }).maps === 'object'
    ? ((worldHexMapsJson as { maps: Record<string, unknown> }).maps)
    : {};

for (const [rawCode, rawMapJson] of Object.entries(embeddedMapsRecord)) {
  const hexCode = normalizeHexLevelCode(rawCode);
  if (!hexCode) continue;
  const manifestMeta = hexManifestEntries.find(
    e => normalizeHexLevelCode(e.hexId) === hexCode
  );
  const rawLevelObj =
    rawMapJson && typeof rawMapJson === 'object' && 'level' in rawMapJson
      ? ((rawMapJson as { level?: Record<string, unknown> }).level ?? {})
      : (rawMapJson as Record<string, unknown>);
  const stageName =
    typeof rawLevelObj.name === 'string' && rawLevelObj.name.trim()
      ? rawLevelObj.name.trim().toUpperCase().slice(0, 16)
      : `HEX ${hexCode}`;
  const label = manifestMeta?.label || `Hex ${hexCode} · ${stageName}`;
  HEX_CATALOG_BY_CODE.set(hexCode, {
    hexId: hexCode,
    key: manifestMeta?.key || `hex-${hexCode}`,
    label,
    sourceFile: 'world-hex-maps.json',
    isEmbeddedMultiMap: true,
    isExampleMap: false,
    loadLevel: () =>
      parseWorldStageFromJson(rawMapJson, {
        id: `hex-${hexCode}`,
        name: stageName,
        hexId: hexCode,
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        biomeLabel: `HEX ${hexCode} · ${stageName}`,
      }),
  });
}

const sortedStandaloneEntries = Array.from(STANDALONE_HEX_JSON_MAP.entries()).sort(([a], [b]) =>
  a.localeCompare(b)
);

for (const [hexCode, standalone] of sortedStandaloneEntries) {
  const manifestMeta = hexManifestEntries.find(
    e => normalizeHexLevelCode(e.hexId) === hexCode
  );
  const rawLevelObj =
    standalone.rawJson && typeof standalone.rawJson === 'object' && 'level' in standalone.rawJson
      ? ((standalone.rawJson as { level?: Record<string, unknown> }).level ?? {})
      : (standalone.rawJson as Record<string, unknown>);
  const stageName =
    typeof rawLevelObj.name === 'string' && rawLevelObj.name.trim()
      ? rawLevelObj.name.trim().toUpperCase().slice(0, 16)
      : `HEX ${hexCode}`;
  const label = manifestMeta?.label || `Hex ${hexCode} · ${stageName} (${standalone.filename})`;
  const hexNum = parseInt(hexCode, 16);
  const isExampleMap = Number.isFinite(hexNum) && hexNum >= 0x0200 && hexNum <= 0x02fe;
  HEX_CATALOG_BY_CODE.set(hexCode, {
    hexId: hexCode,
    key: manifestMeta?.key || `hex-${hexCode}`,
    label,
    sourceFile: standalone.filename,
    isEmbeddedMultiMap: false,
    isExampleMap,
    loadLevel: () =>
      parseWorldStageFromJson(standalone.rawJson, {
        id: `hex-${hexCode}`,
        name: stageName,
        hexId: hexCode,
        smwWorldName: SMW_WORLD_ISLAND_NAME,
        biomeLabel: `HEX ${hexCode} · ${stageName}`,
      }),
  });
}

export const HEX_LEVEL_LIST: readonly HexLevelCatalogItem[] = Array.from(
  HEX_CATALOG_BY_CODE.values()
);

export interface HexLevelLookupInfo {
  valid: boolean;
  normalizedHex: string | null;
  label: string;
  sourceFile: string;
  isEmbeddedMultiMap: boolean;
  redirectedToOverworld: boolean;
}

export interface HexLevelResolveResult extends HexLevelLookupInfo {
  level: LevelData;
}

export function inspectHexLevelTarget(rawHex: string | null | undefined): HexLevelLookupInfo {
  const normalized = normalizeHexLevelCode(rawHex);
  if (normalized && HEX_CATALOG_BY_CODE.has(normalized)) {
    const item = HEX_CATALOG_BY_CODE.get(normalized)!;
    return {
      valid: true,
      normalizedHex: normalized,
      label: item.label,
      sourceFile: item.sourceFile,
      isEmbeddedMultiMap: item.isEmbeddedMultiMap,
      redirectedToOverworld: false,
    };
  }
  return {
    valid: false,
    normalizedHex: normalized,
    label: "Fallback: World W-1 (Yoshi's Island · 0105)",
    sourceFile: 'wiki-1-overworld.json',
    isEmbeddedMultiMap: false,
    redirectedToOverworld: true,
  };
}

export function resolveHexLevelTarget(rawHex: string | null | undefined): HexLevelResolveResult {
  const info = inspectHexLevelTarget(rawHex);
  if (info.valid && info.normalizedHex && HEX_CATALOG_BY_CODE.has(info.normalizedHex)) {
    return {
      ...info,
      level: HEX_CATALOG_BY_CODE.get(info.normalizedHex)!.loadLevel(),
    };
  }
  return {
    ...info,
    level: loadWorldStageByKey('wiki-1-overworld'),
  };
}

const WORLD_STAGE_BY_KEY = new Map<string, WorldStageJsonEntry>(
  WORLD_STAGE_JSON_REGISTRY.map(entry => [entry.key, entry])
);

function loadWorldStageByKey(key: string): LevelData {
  const entry = WORLD_STAGE_BY_KEY.get(key) || WORLD_STAGE_BY_KEY.get('wiki-1-overworld')!;
  return parseWorldStageFromJson(entry.rawJson, entry.defaults);
}

export function getWorldStageFilename(
  level: Pick<LevelData, 'id' | 'hexId' | 'smwNodeId' | 'pipeWarps'>
): string | null {
  const normalizedHex = normalizeHexLevelCode(level.hexId);
  if (normalizedHex && HEX_CATALOG_BY_CODE.has(normalizedHex)) {
    return HEX_CATALOG_BY_CODE.get(normalizedHex)!.sourceFile;
  }
  if (
    level.id === 'smw-wiki-1-secret' ||
    (level.smwNodeId === 'wiki-1-overworld' &&
      (level.pipeWarps || []).some(pw => pw.toLevel === 'wiki-1-overworld'))
  ) {
    return 'smw-wiki-1-secret.json';
  }
  if (level.smwNodeId && WORLD_STAGE_BY_KEY.has(level.smwNodeId)) {
    return WORLD_STAGE_BY_KEY.get(level.smwNodeId)!.filename;
  }
  return null;
}

export function createYellowSwitchPalaceStage(): LevelData {
  return loadWorldStageByKey('wiki-switch-yellow');
}

export function createColoredSwitchPalaceStage(color: Exclude<SmwSwitchColor, 'yellow'>): LevelData {
  return loadWorldStageByKey(`wiki-switch-${color}`);
}

export function createGreenSwitchPalaceStage(): LevelData {
  return createColoredSwitchPalaceStage('green');
}

export function createRedSwitchPalaceStage(): LevelData {
  return createColoredSwitchPalaceStage('red');
}

export function createPinkSwitchPalaceStage(): LevelData {
  return createColoredSwitchPalaceStage('pink');
}

export function createBlueSwitchPalaceStage(): LevelData {
  return createColoredSwitchPalaceStage('blue');
}

export function createSmwWiki1SecretRoom(): LevelData {
  return loadWorldStageByKey('smw-wiki-1-secret');
}

export function createSmwWiki1OverworldStage(): LevelData {
  return loadWorldStageByKey('wiki-1-overworld');
}

export function createSmwWikiWorldStage(nodeId: string): LevelData {
  if (WORLD_STAGE_BY_KEY.has(nodeId) && nodeId !== 'smw-wiki-1-secret') {
    return loadWorldStageByKey(nodeId);
  }
  return createSmwWiki1OverworldStage();
}

/**
 * Resolves the playable LevelData for any World Map node (from built-in world-map.json
 * or a custom World JSON created/edited in the World Editor).
 */
export function resolveWorldStageForNode(
  node: SmwMapNode,
  customLevels: LevelData[] = [],
  worldName: string = SMW_WORLD_ISLAND_NAME
): LevelData {
  const ref = (node.stageKey || '').trim();
  let stage: LevelData | null = null;
  let matchedCustomName: string | null = null;

  if (ref) {
    const customId = ref.startsWith('custom:') ? ref.slice('custom:'.length) : ref;
    const customMatch = customLevels.find(l => l.id === customId);
    if (customMatch) {
      stage = cloneLevelData(customMatch);
      matchedCustomName = customMatch.name;
    } else if (ref.startsWith('hex:')) {
      const normHex = normalizeHexLevelCode(ref.slice(4));
      const customByHex = normHex
        ? customLevels.find(l => normalizeHexLevelCode(l.hexId) === normHex)
        : undefined;
      if (customByHex) {
        stage = cloneLevelData(customByHex);
        matchedCustomName = customByHex.name;
      } else {
        stage = resolveHexLevelTarget(ref.slice(4)).level;
      }
    } else if (WORLD_STAGE_BY_KEY.has(ref)) {
      stage = loadWorldStageByKey(ref);
    } else if (ref === 'theme:desert') {
      stage = createWorldDesertStage();
    } else if (ref === 'theme:snow') {
      stage = createWorldSnowStage();
    } else if (ref === 'theme:sky') {
      stage = createWorldSkyStage();
    } else if (ref === 'theme:forest') {
      stage = createWorldForestStage();
    } else if (ref === 'theme:volcano') {
      stage = createWorldVolcanoStage();
    } else if (ref === 'secret-vault') {
      stage = createSecretVault();
    } else if (ref === 'world-1-1') {
      stage = createWorld1_1();
    } else if (ref === 'world-1-2') {
      stage = createWorld1_2();
    } else if (ref === 'world-2-2') {
      stage = createWorld2_2();
    } else if (ref === 'world-ghost') {
      stage = createWorldGhostHouse();
    } else if (ref === 'world-1-4') {
      stage = createWorld1_4();
    }
  }

  if (!stage && node.hexId) {
    const normHex = normalizeHexLevelCode(node.hexId);
    if (normHex) {
      const customByHex = customLevels.find(l => normalizeHexLevelCode(l.hexId) === normHex);
      if (customByHex) {
        stage = cloneLevelData(customByHex);
        matchedCustomName = customByHex.name;
      } else if (HEX_CATALOG_BY_CODE.has(normHex)) {
        stage = HEX_CATALOG_BY_CODE.get(normHex)!.loadLevel();
      }
    }
  }

  if (!stage) {
    if (WORLD_STAGE_BY_KEY.has(node.id)) {
      stage = loadWorldStageByKey(node.id);
    } else if (node.isSwitchPalace && node.switchColor) {
      stage = loadWorldStageByKey(`wiki-switch-${node.switchColor}`);
    } else if (node.theme === 'underground') {
      stage = createWorld1_2();
    } else if (node.theme === 'underwater') {
      stage = createWorld2_2();
    } else if (node.theme === 'ghost_house') {
      stage = createWorldGhostHouse();
    } else if (node.theme === 'desert') {
      stage = createWorldDesertStage();
    } else if (node.theme === 'snow') {
      stage = createWorldSnowStage();
    } else if (node.theme === 'sky') {
      stage = createWorldSkyStage();
    } else if (node.theme === 'forest') {
      stage = createWorldForestStage();
    } else if (node.theme === 'volcano') {
      stage = createWorldVolcanoStage();
    } else if (node.theme === 'castle' || node.isCastle) {
      stage = createWorld1_4();
    } else {
      stage = createSmwWiki1OverworldStage();
    }
  }

  return {
    ...stage,
    name: (matchedCustomName || node.code || stage.name).toUpperCase().slice(0, 16),
    biomeLabel: node.title ? `${worldName.toUpperCase()} · ${node.title.toUpperCase()}` : stage.biomeLabel,
    smwNodeId: node.id,
    smwWorldName: worldName,
    bossName: node.bossName ?? stage.bossName,
    isCustom: false,
  };
}

export interface SmwBetaProgress {
  clearedNodeIds: string[];
  secretClearedNodeIds?: string[];
  selectedNodeId: string;
  selectedIslandId?: SmwIslandId;
  storySeen: boolean;
  yellowSwitchUnlocked: boolean;
  greenSwitchUnlocked?: boolean;
  redSwitchUnlocked?: boolean;
  pinkSwitchUnlocked?: boolean;
  blueSwitchUnlocked?: boolean;
  goalPointsWallet?: number;
}

const SMW_LEGACY_AUTOSAVE_KEY = 'smb_smw_beta_v09_progress';
export const SMW_SAVE_SLOTS_COUNT = 3;
export const SMW_SAVE_SLOTS_STORAGE_KEY = 'smb_smw_save_slots_v1';

export interface SmwSaveSlotData {
  slotIndex: number;
  savedAt: number;
  stageName: string;
  clearedNodeIds: string[];
  secretClearedNodeIds?: string[];
  selectedNodeId: string;
  selectedIslandId: SmwIslandId;
  yellowSwitchUnlocked: boolean;
  greenSwitchUnlocked?: boolean;
  redSwitchUnlocked?: boolean;
  pinkSwitchUnlocked?: boolean;
  blueSwitchUnlocked?: boolean;
  goalPointsWallet: number;
  lives: number;
  score: number;
}

export function createFreshSmwProgress(): SmwBetaProgress {
  return {
    clearedNodeIds: [],
    secretClearedNodeIds: [],
    selectedNodeId: 'wiki-1-overworld',
    selectedIslandId: 'wikiworld',
    storySeen: false,
    yellowSwitchUnlocked: false,
    greenSwitchUnlocked: false,
    redSwitchUnlocked: false,
    pinkSwitchUnlocked: false,
    blueSwitchUnlocked: false,
    goalPointsWallet: 0,
  };
}

/**
 * R1.16.X6.4: Salvamento automático desativado no Super Mario World.
 * O progresso inicial sempre começa limpo até o jogador carregar um Slot salvo.
 */
export function loadSmwBetaProgress(): SmwBetaProgress {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SMW_LEGACY_AUTOSAVE_KEY);
    }
  } catch {
    // Ignore storage access errors in headless/sandbox environments
  }
  return createFreshSmwProgress();
}

/**
 * R1.16.X6.4: Salvamento automático proibido; mantido apenas como no-op seguro.
 * Use saveSmwToSlot(...) explicitamente ao concluir um castelo.
 */
export function saveSmwBetaProgress(_progress: SmwBetaProgress): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SMW_LEGACY_AUTOSAVE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

function getAllBuiltInNodeIds(): Set<string> {
  const ids = new Set<string>();
  for (const isl of DEFAULT_PARSED_WORLD_MAP.islands) {
    for (const n of isl.nodes) ids.add(n.id);
  }
  for (const p of SMW_DEV_ONLY_SWITCH_PALACES) ids.add(p.id);
  return ids;
}

function getAllBuiltInIslandIds(): Set<string> {
  return new Set(DEFAULT_PARSED_WORLD_MAP.islands.map(i => i.id));
}

function sanitizeSaveSlot(raw: unknown, expectedIndex: number): SmwSaveSlotData | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<SmwSaveSlotData>;
  const validAllIds = getAllBuiltInNodeIds();
  const validIslandIds = getAllBuiltInIslandIds();
  const clearedNodeIds = Array.isArray(obj.clearedNodeIds)
    ? obj.clearedNodeIds.filter((id): id is string => typeof id === 'string' && (validAllIds.has(id) || id.length > 0))
    : [];
  const secretClearedNodeIds = Array.isArray(obj.secretClearedNodeIds)
    ? obj.secretClearedNodeIds.filter((id): id is string => typeof id === 'string' && (validAllIds.has(id) || id.length > 0))
    : [];
  const selectedNodeId =
    typeof obj.selectedNodeId === 'string' && obj.selectedNodeId.trim()
      ? obj.selectedNodeId.trim()
      : 'wiki-1-overworld';
  const selectedIslandId: SmwIslandId =
    typeof obj.selectedIslandId === 'string' &&
    (validIslandIds.has(obj.selectedIslandId) || obj.selectedIslandId.trim().length > 0)
      ? obj.selectedIslandId.trim()
      : 'wikiworld';
  const wallet =
    typeof obj.goalPointsWallet === 'number' && Number.isFinite(obj.goalPointsWallet)
      ? Math.max(0, Math.min(99, Math.floor(obj.goalPointsWallet)))
      : 0;
  const lives =
    typeof obj.lives === 'number' && Number.isFinite(obj.lives)
      ? Math.max(1, Math.min(99, Math.floor(obj.lives)))
      : 3;
  const score =
    typeof obj.score === 'number' && Number.isFinite(obj.score)
      ? Math.max(0, Math.floor(obj.score))
      : 0;

  return {
    slotIndex: expectedIndex,
    savedAt: typeof obj.savedAt === 'number' && Number.isFinite(obj.savedAt) ? obj.savedAt : Date.now(),
    stageName:
      typeof obj.stageName === 'string' && obj.stageName.trim().length > 0
        ? obj.stageName.trim()
        : 'Castelo Concluído',
    clearedNodeIds,
    secretClearedNodeIds,
    selectedNodeId,
    selectedIslandId,
    yellowSwitchUnlocked: Boolean(
      obj.yellowSwitchUnlocked || clearedNodeIds.includes('wiki-switch-yellow')
    ),
    greenSwitchUnlocked: Boolean(
      obj.greenSwitchUnlocked || clearedNodeIds.includes('wiki-switch-green')
    ),
    redSwitchUnlocked: Boolean(
      obj.redSwitchUnlocked || clearedNodeIds.includes('wiki-switch-red')
    ),
    pinkSwitchUnlocked: Boolean(
      obj.pinkSwitchUnlocked || clearedNodeIds.includes('wiki-switch-pink')
    ),
    blueSwitchUnlocked: Boolean(
      obj.blueSwitchUnlocked || clearedNodeIds.includes('wiki-switch-blue')
    ),
    goalPointsWallet: wallet,
    lives,
    score,
  };
}

export function loadSmwSaveSlots(storage?: Pick<Storage, 'getItem'>): (SmwSaveSlotData | null)[] {
  const empty: (SmwSaveSlotData | null)[] = Array.from({ length: SMW_SAVE_SLOTS_COUNT }, () => null);
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (!store) return empty;
    const raw = store.getItem(SMW_SAVE_SLOTS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return empty;
    return empty.map((_, idx) => sanitizeSaveSlot(parsed[idx], idx));
  } catch {
    return empty;
  }
}

export function saveSmwToSlot(
  slotIndex: number,
  progress: SmwBetaProgress,
  meta: { stageName?: string; lives?: number; score?: number } = {},
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): (SmwSaveSlotData | null)[] {
  const idx = Math.floor(slotIndex);
  const current = loadSmwSaveSlots(storage);
  if (idx < 0 || idx >= SMW_SAVE_SLOTS_COUNT) return current;

  const clearedNodeIds = progress.clearedNodeIds.filter(id => typeof id === 'string' && id.length > 0);
  const secretClearedNodeIds = (progress.secretClearedNodeIds ?? []).filter(
    id => typeof id === 'string' && id.length > 0
  );
  const selectedNodeId =
    typeof progress.selectedNodeId === 'string' && progress.selectedNodeId.trim()
      ? progress.selectedNodeId
      : 'wiki-1-overworld';

  const nextSlot: SmwSaveSlotData = {
    slotIndex: idx,
    savedAt: Date.now(),
    stageName: meta.stageName?.trim() || 'Castelo de Johannnnes89',
    clearedNodeIds,
    secretClearedNodeIds,
    selectedNodeId,
    selectedIslandId: progress.selectedIslandId || 'wikiworld',
    yellowSwitchUnlocked: Boolean(
      progress.yellowSwitchUnlocked || clearedNodeIds.includes('wiki-switch-yellow')
    ),
    greenSwitchUnlocked: Boolean(
      progress.greenSwitchUnlocked || clearedNodeIds.includes('wiki-switch-green')
    ),
    redSwitchUnlocked: Boolean(
      progress.redSwitchUnlocked || clearedNodeIds.includes('wiki-switch-red')
    ),
    pinkSwitchUnlocked: Boolean(
      progress.pinkSwitchUnlocked || clearedNodeIds.includes('wiki-switch-pink')
    ),
    blueSwitchUnlocked: Boolean(
      progress.blueSwitchUnlocked || clearedNodeIds.includes('wiki-switch-blue')
    ),
    goalPointsWallet: Math.max(0, Math.min(99, Math.floor(progress.goalPointsWallet ?? 0))),
    lives: Math.max(1, Math.min(99, Math.floor(meta.lives ?? 3))),
    score: Math.max(0, Math.floor(meta.score ?? 0)),
  };

  current[idx] = nextSlot;
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (store) {
      store.setItem(SMW_SAVE_SLOTS_STORAGE_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore quota errors
  }
  return current;
}

export function deleteSmwSlot(
  slotIndex: number,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): (SmwSaveSlotData | null)[] {
  const idx = Math.floor(slotIndex);
  const current = loadSmwSaveSlots(storage);
  if (idx < 0 || idx >= SMW_SAVE_SLOTS_COUNT) return current;
  current[idx] = null;
  try {
    const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (store) {
      store.setItem(SMW_SAVE_SLOTS_STORAGE_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore storage errors
  }
  return current;
}

export function applySmwSlotToProgress(slot: SmwSaveSlotData): SmwBetaProgress {
  return {
    clearedNodeIds: [...slot.clearedNodeIds],
    secretClearedNodeIds: [...(slot.secretClearedNodeIds ?? [])],
    selectedNodeId: slot.selectedNodeId,
    selectedIslandId: slot.selectedIslandId,
    storySeen: true,
    yellowSwitchUnlocked: Boolean(
      slot.yellowSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-yellow')
    ),
    greenSwitchUnlocked: Boolean(
      slot.greenSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-green')
    ),
    redSwitchUnlocked: Boolean(
      slot.redSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-red')
    ),
    pinkSwitchUnlocked: Boolean(
      slot.pinkSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-pink')
    ),
    blueSwitchUnlocked: Boolean(
      slot.blueSwitchUnlocked || slot.clearedNodeIds.includes('wiki-switch-blue')
    ),
    goalPointsWallet: Math.max(0, Math.min(99, Math.floor(slot.goalPointsWallet ?? 0))),
  };
}

export function isSmwNodeUnlocked(
  nodeIdOrOrder: string | number,
  progress: SmwBetaProgress,
  nodes: SmwMapNode[] = SMW_WIKIWORLD_NODES
): boolean {
  const node =
    typeof nodeIdOrOrder === 'string'
      ? nodes.find(n => n.id === nodeIdOrOrder)
      : nodes.find(n => n.order === nodeIdOrOrder) || nodes[nodeIdOrOrder];
  if (!node) return false;
  if (node.order === 0) return true;
  if (node.unlocksAfterSecretNodeId) {
    return Boolean(
      progress.secretClearedNodeIds?.includes(node.unlocksAfterSecretNodeId) ||
        progress.clearedNodeIds.includes(node.id) ||
        (node.id === 'wiki-switch-yellow' && progress.yellowSwitchUnlocked)
    );
  }
  if (!node.unlocksAfterNodeId) return true;
  return progress.clearedNodeIds.includes(node.unlocksAfterNodeId);
}

/**
 * R1.25.21X.9: Qualquer fase passada no Modo World abre o caminho para a próxima fase
 * da rota principal, enquanto chaves/fechaduras (secretExit) abrem rotas alternativas
 * mantendo as configurações originais de cada nó.
 */
export function applySmwStageCompletion(
  prev: SmwBetaProgress,
  nodeId: string,
  meta?: { secretExit?: boolean },
  nodes: SmwMapNode[] = SMW_WIKIWORLD_NODES
): SmwBetaProgress {
  const currNode = nodes.find(n => n.id === nodeId);
  const isDevOnlyPalace = SMW_DEV_ONLY_SWITCH_PALACES.some(p => p.id === nodeId);
  const secretBranchChild = nodes.find(n => n.unlocksAfterSecretNodeId === nodeId);
  const isSecretBranchOnlyExit = Boolean(meta?.secretExit && secretBranchChild);

  const prevSecret = prev.secretClearedNodeIds ?? [];
  const nextSecret =
    meta?.secretExit && !prevSecret.includes(nodeId)
      ? [...prevSecret, nodeId]
      : prevSecret;
  const nextCleared = isSecretBranchOnlyExit
    ? prev.clearedNodeIds
    : prev.clearedNodeIds.includes(nodeId)
    ? prev.clearedNodeIds
    : [...prev.clearedNodeIds, nodeId];

  const fallbackFirstId = nodes[0]?.id || 'wiki-1-overworld';
  const nextNode =
    nodeId === 'wiki-switch-yellow'
      ? nextCleared.includes('wiki-1-overworld')
        ? nodes.find(n => n.id === 'wiki-2-caverna') ??
          nodes.find(n => n.unlocksAfterNodeId === 'wiki-1-overworld' && !isSmwPortalNode(n))
        : nodes.find(n => n.id === 'wiki-1-overworld') ?? nodes[0]
      : nodes.find(
          n => n.unlocksAfterNodeId === nodeId && !isSmwPortalNode(n) && !n.isSwitchPalace
        ) ??
        nodes.find(n => n.unlocksAfterNodeId === nodeId) ??
        (currNode
          ? nodes.find(
              n =>
                n.order === currNode.order + 1 &&
                !n.unlocksAfterSecretNodeId &&
                !isSmwPortalNode(n)
            )
          : undefined);

  const secretChildCompleted = Boolean(
    secretBranchChild &&
      (nextCleared.includes(secretBranchChild.id) ||
        (secretBranchChild.id === 'wiki-switch-yellow' && prev.yellowSwitchUnlocked))
  );

  const nextSelected = isDevOnlyPalace
    ? nodes.some(n => n.id === prev.selectedNodeId)
      ? prev.selectedNodeId
      : fallbackFirstId
    : isSecretBranchOnlyExit && secretBranchChild
    ? !secretChildCompleted
      ? secretBranchChild.id
      : nodeId
    : nextNode && !nextCleared.includes(nextNode.id)
    ? nextNode.id
    : nodeId;

  return {
    ...prev,
    clearedNodeIds: nextCleared,
    secretClearedNodeIds: nextSecret,
    selectedNodeId: nextSelected,
    yellowSwitchUnlocked:
      prev.yellowSwitchUnlocked ||
      nodeId === 'wiki-switch-yellow' ||
      Boolean(currNode?.isSwitchPalace && currNode.switchColor === 'yellow'),
    greenSwitchUnlocked:
      Boolean(prev.greenSwitchUnlocked) ||
      nodeId === 'wiki-switch-green' ||
      Boolean(currNode?.isSwitchPalace && currNode.switchColor === 'green'),
    redSwitchUnlocked:
      Boolean(prev.redSwitchUnlocked) ||
      nodeId === 'wiki-switch-red' ||
      Boolean(currNode?.isSwitchPalace && currNode.switchColor === 'red'),
    pinkSwitchUnlocked:
      Boolean(prev.pinkSwitchUnlocked) ||
      nodeId === 'wiki-switch-pink' ||
      Boolean(currNode?.isSwitchPalace && currNode.switchColor === 'pink'),
    blueSwitchUnlocked:
      Boolean(prev.blueSwitchUnlocked) ||
      nodeId === 'wiki-switch-blue' ||
      Boolean(currNode?.isSwitchPalace && currNode.switchColor === 'blue'),
  };
}

/**
 * R1.16.O0.4: Impede que o jogador jogue novamente o Palácio Interruptor Amarelo
 * após ele já ter sido concluído.
 */
export function isSmwNodeCompletedAndLocked(
  nodeId: string,
  progress: SmwBetaProgress
): boolean {
  if (nodeId === 'wiki-switch-yellow') {
    return Boolean(
      progress.yellowSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-yellow')
    );
  }
  if (nodeId === 'wiki-switch-green') {
    return Boolean(
      progress.greenSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-green')
    );
  }
  if (nodeId === 'wiki-switch-red') {
    return Boolean(
      progress.redSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-red')
    );
  }
  if (nodeId === 'wiki-switch-pink') {
    return Boolean(
      progress.pinkSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-pink')
    );
  }
  if (nodeId === 'wiki-switch-blue') {
    return Boolean(
      progress.blueSwitchUnlocked || progress.clearedNodeIds.includes('wiki-switch-blue')
    );
  }
  return false;
}

export function canEnterSmwNode(
  nodeId: string,
  progress: SmwBetaProgress,
  nodes: SmwMapNode[] = SMW_WIKIWORLD_NODES
): boolean {
  return isSmwNodeUnlocked(nodeId, progress, nodes) && !isSmwNodeCompletedAndLocked(nodeId, progress);
}

/**
 * Checks whether a World Map stage node has already been cleared (via normal exit,
 * secret keyhole exit, or switch palace completion).
 */
export function isSmwNodeCleared(
  nodeId: string | null | undefined,
  progress: Pick<
    SmwBetaProgress,
    | 'clearedNodeIds'
    | 'secretClearedNodeIds'
    | 'yellowSwitchUnlocked'
    | 'greenSwitchUnlocked'
    | 'redSwitchUnlocked'
    | 'pinkSwitchUnlocked'
    | 'blueSwitchUnlocked'
  >
): boolean {
  if (!nodeId) return false;
  if (progress.clearedNodeIds.includes(nodeId)) return true;
  if (progress.secretClearedNodeIds?.includes(nodeId)) return true;
  return isSmwNodeCompletedAndLocked(nodeId, progress as SmwBetaProgress);
}

/**
 * In SMW World Mode, pressing SELECT while paused allows exiting back to the
 * Overworld Map ONLY when the current stage has already been beaten.
 */
export function canExitSmwStageWithSelect(params: {
  isSmwModeActive: boolean;
  activeNodeId: string | null | undefined;
  progress: Pick<
    SmwBetaProgress,
    | 'clearedNodeIds'
    | 'secretClearedNodeIds'
    | 'yellowSwitchUnlocked'
    | 'greenSwitchUnlocked'
    | 'redSwitchUnlocked'
    | 'pinkSwitchUnlocked'
    | 'blueSwitchUnlocked'
  >;
}): boolean {
  if (!params.isSmwModeActive) return false;
  return isSmwNodeCleared(params.activeNodeId, params.progress);
}



