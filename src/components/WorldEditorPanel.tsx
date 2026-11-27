/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Castle,
  Code2,
  Compass,
  Eraser,
  FileDown,
  GitBranch,
  Globe,
  Grid,
  Layers,
  MapPin,
  MousePointer,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Trees,
  Undo2,
  Upload,
} from 'lucide-react';
import { LevelData, SmwSwitchColor } from '../game/types.ts';
import {
  HEX_LEVEL_LIST,
  LM_OVERWORLD_GRID_COLS,
  LM_OVERWORLD_GRID_ROWS,
  SmwBoardPalette,
  SmwMapDecoration,
  SmwMapDecorationKind,
  SmwMapNode,
  SmwNodeKind,
  SmwPathSegment,
  SmwWorldIslandConfig,
  SmwWorldMapJson,
  SmwWorldType,
  WORLD_STAGE_JSON_REGISTRY,
  buildOrthogonalWaypoints,
  getLinkedParentWorld,
  getLinkedSubworld,
  getMainWorlds,
  getSubworlds,
  gridCoordToPercent,
  isSmwPortalNode,
  mergeSingleWorldIntoPack,
  parseSingleWorldJson,
  parseWorldMapJson,
  percentToGridCoord,
  serializeSingleWorldToJson,
  serializeWorldMapToJson,
} from '../game/smwWorldMap.ts';
import { Smb3WorldBoardSvg } from './Smb3WorldBoardSvg.tsx';

export type WorldEditorTool =
  | 'select'
  | 'add_stage'
  | 'add_castle'
  | 'add_palace'
  | 'add_portal'
  | 'add_star_warp'
  | 'connect_hv'
  | 'connect_vh'
  | 'connect_direct'
  | 'decor'
  | 'erase';

export type LunarMagicEditMode = 'levels' | 'terrain' | 'paths' | 'json';

interface WorldEditorPanelProps {
  worldDraft: SmwWorldMapJson;
  customLevels: LevelData[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onChangeWorldDraft: (updater: (draft: SmwWorldMapJson) => void, recordUndo?: boolean) => void;
  onResetDefault: () => void;
  onApplyWorld: (openWorldMode: boolean) => void;
  onEditStageByHex?: (stageRef: string) => void;
  notify: (msg: string) => void;
  notifyError: (msg: string) => void;
}

const DECOR_OPTIONS: { kind: SmwMapDecorationKind; label: string }[] = [
  { kind: 'hill', label: 'Colina SMB3' },
  { kind: 'trees', label: 'Bosque' },
  { kind: 'water', label: 'Lago' },
  { kind: 'bridge', label: 'Ponte' },
  { kind: 'rock', label: 'Rochedo' },
  { kind: 'haunted_tree', label: 'Árvore Sombria' },
  { kind: 'castle_fort', label: 'Torre/Forte' },
  { kind: 'cloud', label: 'Nuvem' },
  { kind: 'enemy_patrol', label: 'Patrulha' },
];

const PALETTE_OPTIONS: { id: SmwBoardPalette; label: string }[] = [
  { id: 'grass', label: 'Planície (SMB3 Mundo 1)' },
  { id: 'desert', label: 'Deserto (SMB3 Mundo 2)' },
  { id: 'ocean', label: 'Oceano (SMB3 Mundo 3)' },
  { id: 'snow', label: 'Neve / Gelo (SMB3 Mundo 6)' },
  { id: 'sky', label: 'Céu / Nuvens (SMB3 Mundo 5)' },
  { id: 'forest', label: 'Floresta (Bosque Verde)' },
  { id: 'haunted', label: 'Sombrio (Fantasmas)' },
  { id: 'volcano', label: 'Vulcão / Castelo (Mundo 8)' },
];

function snapFreePct(v: number): number {
  return Math.max(4, Math.min(96, Math.round(v * 2) / 2));
}

function inferPathRouteMode(seg: SmwPathSegment): 'hv' | 'vh' | 'direct' {
  const pts = seg.waypoints;
  if (pts && pts.length === 3) {
    const [p0, p1] = pts;
    if (Math.abs(p0[1] - p1[1]) < 0.5 && Math.abs(p0[0] - p1[0]) >= 0.5) return 'hv';
    if (Math.abs(p0[0] - p1[0]) < 0.5 && Math.abs(p0[1] - p1[1]) >= 0.5) return 'vh';
  }
  return 'direct';
}

function makeStraightPathSegment(
  fromNode: SmwMapNode,
  toNode: SmwMapNode,
  mode: 'hv' | 'vh' | 'direct',
  isSecretRoute?: boolean,
  eventId?: number
): SmwPathSegment {
  const p0: [number, number] = [fromNode.mapX, fromNode.mapY];
  const p1: [number, number] = [toNode.mapX, toNode.mapY];
  const waypoints = buildOrthogonalWaypoints(p0, p1, mode);
  const c1 = waypoints[Math.min(1, waypoints.length - 1)] || p0;
  const c2 = waypoints[Math.max(0, waypoints.length - 2)] || p1;
  return {
    fromId: fromNode.id,
    toId: toNode.id,
    fromOrder: fromNode.order,
    toOrder: toNode.order,
    p0,
    c1,
    c2,
    p1,
    waypoints,
    lineStyle: mode === 'direct' ? 'straight' : 'orthogonal',
    ...(isSecretRoute ? { isSecretRoute: true } : {}),
    ...(typeof eventId === 'number' ? { eventId } : {}),
  };
}

function syncIslandPathsForNode(isl: SmwWorldIslandConfig, nodeId: string) {
  isl.paths.forEach((seg, idx) => {
    if (seg.fromId !== nodeId && seg.toId !== nodeId) return;
    const fromNode = isl.nodes.find(n => n.id === seg.fromId);
    const toNode = isl.nodes.find(n => n.id === seg.toId);
    if (!fromNode || !toNode) return;
    const mode = inferPathRouteMode(seg);
    isl.paths[idx] = makeStraightPathSegment(
      fromNode,
      toNode,
      mode,
      seg.isSecretRoute,
      seg.eventId
    );
  });
}

export const WorldEditorPanel: React.FC<WorldEditorPanelProps> = ({
  worldDraft,
  customLevels,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onChangeWorldDraft,
  onResetDefault,
  onApplyWorld,
  onEditStageByHex,
  notify,
  notifyError,
}) => {
  const [selectedIslandId, setSelectedIslandId] = useState<string>(
    worldDraft.defaultIslandId || worldDraft.islands[0]?.id || 'wikiworld'
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    worldDraft.islands[0]?.nodes[0]?.id ?? null
  );
  const [selectedPathIdx, setSelectedPathIdx] = useState<number | null>(null);
  const [selectedDecorId, setSelectedDecorId] = useState<string | null>(null);
  const [lmMode, setLmMode] = useState<LunarMagicEditMode>('levels');
  const [worldTool, setWorldTool] = useState<WorldEditorTool>('select');
  const [connectFromNodeId, setConnectFromNodeId] = useState<string | null>(null);
  const [decorKind, setDecorKind] = useState<SmwMapDecorationKind>('trees');
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [draggingDecorId, setDraggingDecorId] = useState<string | null>(null);
  const [gridSnap, setGridSnap] = useState<boolean>(true);
  const [showCoordGrid, setShowCoordGrid] = useState<boolean>(true);
  const [hoverCoords, setHoverCoords] = useState<{
    x: number;
    y: number;
    gridX: number;
    gridY: number;
  } | null>(null);
  const [jsonScope, setJsonScope] = useState<'single' | 'pack'>('single');
  const [jsonDraftText, setJsonDraftText] = useState<string>('');
  const worldFileRef = useRef<HTMLInputElement | null>(null);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const dragUndoArmedRef = useRef(false);

  const activeIsland: SmwWorldIslandConfig = useMemo(() => {
    return worldDraft.islands.find(i => i.id === selectedIslandId) || worldDraft.islands[0];
  }, [worldDraft, selectedIslandId]);

  const mainWorlds = useMemo(() => getMainWorlds(worldDraft), [worldDraft]);
  const subworlds = useMemo(() => getSubworlds(worldDraft), [worldDraft]);

  const linkedCounterpart = useMemo(() => {
    if (!activeIsland) return null;
    return activeIsland.worldType === 'subworld'
      ? getLinkedParentWorld(worldDraft, activeIsland.id)
      : getLinkedSubworld(worldDraft, activeIsland.id);
  }, [worldDraft, activeIsland]);

  const selectedNode: SmwMapNode | null = useMemo(() => {
    if (!activeIsland || !selectedNodeId) return null;
    return activeIsland.nodes.find(n => n.id === selectedNodeId) || null;
  }, [activeIsland, selectedNodeId]);

  const selectedDecor: SmwMapDecoration | null = useMemo(() => {
    if (!activeIsland || !selectedDecorId) return null;
    return (activeIsland.decorations ?? []).find(d => d.id === selectedDecorId) || null;
  }, [activeIsland, selectedDecorId]);

  const selectedPath: SmwPathSegment | null = useMemo(() => {
    if (!activeIsland || selectedPathIdx === null) return null;
    return activeIsland.paths[selectedPathIdx] || null;
  }, [activeIsland, selectedPathIdx]);

  const switchEditingIsland = (islandId: string) => {
    setSelectedIslandId(islandId);
    const found = worldDraft.islands.find(i => i.id === islandId);
    setSelectedNodeId(found?.nodes[0]?.id ?? null);
    setSelectedPathIdx(null);
    setSelectedDecorId(null);
    setConnectFromNodeId(null);
    if (lmMode === 'json' && found) {
      setJsonDraftText(
        jsonScope === 'single'
          ? serializeSingleWorldToJson(found)
          : serializeWorldMapToJson(worldDraft)
      );
    }
  };

  const handleOpenJsonMode = (scope: 'single' | 'pack' = jsonScope) => {
    setJsonScope(scope);
    setLmMode('json');
    if (activeIsland) {
      setJsonDraftText(
        scope === 'single'
          ? serializeSingleWorldToJson(activeIsland)
          : serializeWorldMapToJson(worldDraft)
      );
    }
  };

  const toBoardCoords = (
    clientX: number,
    clientY: number
  ): { x: number; y: number; gridX: number; gridY: number } | null => {
    const el = boardContainerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const rawX = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
    const rawY = Math.max(4, Math.min(96, ((clientY - rect.top) / rect.height) * 100));
    const cols = activeIsland?.overworldGrid?.cols || LM_OVERWORLD_GRID_COLS;
    const rows = activeIsland?.overworldGrid?.rows || LM_OVERWORLD_GRID_ROWS;
    const grid = percentToGridCoord(rawX, rawY, cols, rows);
    if (gridSnap) {
      const snapped = gridCoordToPercent(grid.gridX, grid.gridY, cols, rows);
      return { x: snapped.mapX, y: snapped.mapY, gridX: grid.gridX, gridY: grid.gridY };
    }
    return { x: snapFreePct(rawX), y: snapFreePct(rawY), gridX: grid.gridX, gridY: grid.gridY };
  };

  const handleSelectLmLayer = (mode: LunarMagicEditMode) => {
    if (mode === 'json') {
      handleOpenJsonMode(jsonScope);
      return;
    }
    setLmMode(mode);
    setConnectFromNodeId(null);
    if (mode === 'terrain') {
      if (worldTool !== 'decor' && worldTool !== 'select' && worldTool !== 'erase') {
        setWorldTool('decor');
      }
    } else if (mode === 'paths') {
      if (worldTool !== 'connect_hv' && worldTool !== 'connect_vh' && worldTool !== 'connect_direct' && worldTool !== 'erase') {
        setWorldTool('connect_hv');
      }
    } else if (mode === 'levels') {
      if (worldTool === 'decor' || worldTool.startsWith('connect_')) {
        setWorldTool('select');
      }
    }
  };

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-world-node]') ||
      target.closest('[data-world-path]') ||
      target.closest('[data-world-decor]')
    ) {
      return;
    }
    const coords = toBoardCoords(e.clientX, e.clientY);
    if (!coords || !activeIsland) return;

    if (
      worldTool === 'add_stage' ||
      worldTool === 'add_castle' ||
      worldTool === 'add_palace' ||
      worldTool === 'add_portal' ||
      worldTool === 'add_star_warp'
    ) {
      const idx = activeIsland.nodes.length + 1;
      const newId = `${activeIsland.id}-node-${Date.now().toString(36).slice(-4)}-${idx}`;
      const isCastle = worldTool === 'add_castle';
      const isPalace = worldTool === 'add_palace';
      const isPortal = worldTool === 'add_portal' || worldTool === 'add_star_warp';
      const nodeKind: SmwNodeKind = isCastle
        ? 'castle'
        : isPalace
        ? 'switch_palace'
        : worldTool === 'add_star_warp'
        ? 'star_warp'
        : worldTool === 'add_portal'
        ? 'subworld_portal'
        : 'stage';
      const prefix = activeIsland.worldType === 'subworld' ? `S${activeIsland.number}` : `${activeIsland.number}`;
      const code = isCastle
        ? `${prefix}-C`
        : isPalace
        ? 'PA'
        : isPortal
        ? activeIsland.worldType === 'subworld'
          ? `M${activeIsland.number}`
          : `S${activeIsland.number}`
        : `${prefix}-${idx}`;
      const prevNode = selectedNode || activeIsland.nodes[activeIsland.nodes.length - 1];
      const defaultPortalTarget = isPortal
        ? linkedCounterpart?.id || worldDraft.islands[0]?.id
        : undefined;
      const newNode: SmwMapNode = {
        id: newId,
        order: idx,
        code: code.slice(0, 6),
        title: isCastle
          ? `Castelo ${idx}`
          : isPalace
          ? `Palácio ${idx}`
          : isPortal
          ? activeIsland.worldType === 'subworld'
            ? `Voltar ao Mundo ${activeIsland.number}`
            : `Portal Submundo ${activeIsland.number}`
          : `Fase ${idx}`,
        subtitle: isPortal
          ? 'Portal de transição Mundo ↔ Submundo'
          : 'Personalizada no Editor do Mundo',
        theme: isCastle ? 'castle' : 'overworld',
        nodeKind,
        ...(isPortal
          ? {
              targetIslandId: defaultPortalTarget,
              targetNodeId: linkedCounterpart?.nodes[0]?.id,
            }
          : {
              stageKey: isCastle
                ? 'wiki-5-castelo'
                : isPalace
                ? 'wiki-switch-yellow'
                : 'wiki-1-overworld',
            }),
        mapX: coords.x,
        mapY: coords.y,
        gridX: coords.gridX,
        gridY: coords.gridY,
        isCastle: isCastle || undefined,
        isSwitchPalace: isPalace || undefined,
        switchColor: isPalace ? 'yellow' : undefined,
        unlocksAfterNodeId: prevNode?.id,
      };
      onChangeWorldDraft(draft => {
        const isl = draft.islands.find(i => i.id === activeIsland.id);
        if (!isl) return;
        isl.nodes.push(newNode);
        if (prevNode) {
          isl.paths.push(makeStraightPathSegment(prevNode, newNode, 'hv'));
        }
      }, true);
      setSelectedNodeId(newId);
      setSelectedDecorId(null);
      setSelectedPathIdx(null);
      notify(`Nó "${newNode.code}" em (${coords.x}%, ${coords.y}%) · Grid (${coords.gridX}, ${coords.gridY})!`);
      return;
    }

    if (worldTool === 'decor') {
      const decorId = `dec-${Date.now().toString(36).slice(-5)}`;
      onChangeWorldDraft(draft => {
        const isl = draft.islands.find(i => i.id === activeIsland.id);
        if (!isl) return;
        if (!isl.decorations) isl.decorations = [];
        isl.decorations.push({
          id: decorId,
          kind: decorKind,
          x: coords.x,
          y: coords.y,
          gridX: coords.gridX,
          gridY: coords.gridY,
        });
      }, true);
      setSelectedDecorId(decorId);
      setSelectedNodeId(null);
      notify(`Cenário "${decorKind}" adicionado em Grid (${coords.gridX}, ${coords.gridY})!`);
      return;
    }

    if (worldTool === 'erase') {
      const decList = activeIsland.decorations ?? [];
      let nearestIdx = -1;
      let nearestDist = 9;
      decList.forEach((dec, idx) => {
        const d = Math.hypot(dec.x - coords.x, dec.y - coords.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = idx;
        }
      });
      if (nearestIdx >= 0) {
        onChangeWorldDraft(draft => {
          const isl = draft.islands.find(i => i.id === activeIsland.id);
          if (!isl || !isl.decorations) return;
          isl.decorations.splice(nearestIdx, 1);
        }, true);
        setSelectedDecorId(null);
        notify('Decoração removida!');
      }
      return;
    }

    setSelectedPathIdx(null);
    setSelectedDecorId(null);
    setConnectFromNodeId(null);
  };

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const coords = toBoardCoords(e.clientX, e.clientY);
    if (coords) setHoverCoords(coords);

    if (!activeIsland || !coords) return;

    if (draggingNodeId) {
      const shouldPushUndo = dragUndoArmedRef.current;
      dragUndoArmedRef.current = false;
      onChangeWorldDraft(draft => {
        const isl = draft.islands.find(i => i.id === activeIsland.id);
        if (!isl) return;
        const node = isl.nodes.find(n => n.id === draggingNodeId);
        if (!node) return;
        node.mapX = coords.x;
        node.mapY = coords.y;
        node.gridX = coords.gridX;
        node.gridY = coords.gridY;
        syncIslandPathsForNode(isl, draggingNodeId);
      }, shouldPushUndo);
      return;
    }

    if (draggingDecorId) {
      const shouldPushUndo = dragUndoArmedRef.current;
      dragUndoArmedRef.current = false;
      onChangeWorldDraft(draft => {
        const isl = draft.islands.find(i => i.id === activeIsland.id);
        const dec = isl?.decorations?.find(d => d.id === draggingDecorId);
        if (!dec) return;
        dec.x = coords.x;
        dec.y = coords.y;
        dec.gridX = coords.gridX;
        dec.gridY = coords.gridY;
      }, shouldPushUndo);
    }
  };

  const handleBoardPointerUp = () => {
    setDraggingNodeId(null);
    setDraggingDecorId(null);
    dragUndoArmedRef.current = false;
  };

  const handleNodePointerDown = (e: React.PointerEvent, node: SmwMapNode) => {
    e.stopPropagation();
    if (!activeIsland) return;

    if (worldTool === 'erase') {
      if (activeIsland.nodes.length <= 1) {
        notifyError('O mapa precisa ter pelo menos 1 nó.');
        return;
      }
      onChangeWorldDraft(draft => {
        const isl = draft.islands.find(i => i.id === activeIsland.id);
        if (!isl) return;
        isl.nodes = isl.nodes.filter(n => n.id !== node.id);
        isl.paths = isl.paths.filter(p => p.fromId !== node.id && p.toId !== node.id);
      }, true);
      if (selectedNodeId === node.id) {
        setSelectedNodeId(activeIsland.nodes.find(n => n.id !== node.id)?.id ?? null);
      }
      notify(`Nó "${node.code}" removido!`);
      return;
    }

    if (worldTool === 'connect_hv' || worldTool === 'connect_vh' || worldTool === 'connect_direct') {
      if (!connectFromNodeId) {
        setConnectFromNodeId(node.id);
        setSelectedNodeId(node.id);
        notify(`Origem selecionada (${node.code}). Clique no nó de destino.`);
        return;
      }
      if (connectFromNodeId === node.id) {
        setConnectFromNodeId(null);
        return;
      }
      const fromNode = activeIsland.nodes.find(n => n.id === connectFromNodeId);
      if (!fromNode) {
        setConnectFromNodeId(null);
        return;
      }
      const mode = worldTool === 'connect_hv' ? 'hv' : worldTool === 'connect_vh' ? 'vh' : 'direct';
      onChangeWorldDraft(draft => {
        const isl = draft.islands.find(i => i.id === activeIsland.id);
        if (!isl) return;
        const alreadyIdx = isl.paths.findIndex(
          p =>
            (p.fromId === fromNode.id && p.toId === node.id) ||
            (p.fromId === node.id && p.toId === fromNode.id)
        );
        const seg = makeStraightPathSegment(fromNode, node, mode);
        if (alreadyIdx >= 0) {
          isl.paths[alreadyIdx] = {
            ...seg,
            isSecretRoute: isl.paths[alreadyIdx].isSecretRoute,
            eventId: isl.paths[alreadyIdx].eventId,
          };
        } else {
          isl.paths.push(seg);
        }
        const targetRef = isl.nodes.find(n => n.id === node.id);
        if (targetRef && !targetRef.unlocksAfterNodeId && !targetRef.unlocksAfterSecretNodeId) {
          targetRef.unlocksAfterNodeId = fromNode.id;
        }
      }, true);
      setConnectFromNodeId(null);
      setSelectedNodeId(node.id);
      notify(`Caminho reto (${mode.toUpperCase()}) conectado: ${fromNode.code} → ${node.code}`);
      return;
    }

    setSelectedNodeId(node.id);
    setSelectedDecorId(null);
    setSelectedPathIdx(null);
    dragUndoArmedRef.current = true;
    setDraggingNodeId(node.id);
  };

  const handleDecorPointerDown = (e: React.PointerEvent<SVGGElement>, dec: SmwMapDecoration) => {
    e.stopPropagation();
    if (!activeIsland) return;
    if (worldTool === 'erase') {
      onChangeWorldDraft(draft => {
        const isl = draft.islands.find(i => i.id === activeIsland.id);
        if (!isl?.decorations) return;
        isl.decorations = isl.decorations.filter(d => d.id !== dec.id);
      }, true);
      if (selectedDecorId === dec.id) setSelectedDecorId(null);
      notify('Cenário removido!');
      return;
    }
    setSelectedDecorId(dec.id);
    setSelectedNodeId(null);
    setSelectedPathIdx(null);
    dragUndoArmedRef.current = true;
    setDraggingDecorId(dec.id);
  };

  const handleExportWorldJson = () => {
    const json = serializeWorldMapToJson(worldDraft);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'world-map.smb-world.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify(`Pacote JSON completo exportado (${worldDraft.islands.length} mapas)!`);
  };

  const handleExportSingleIslandJson = () => {
    if (!activeIsland) return;
    const json = serializeSingleWorldToJson(activeIsland);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const prefix = activeIsland.worldType === 'subworld' ? 'subworld' : 'world';
    a.download = `${prefix}-${activeIsland.number}.smb-world.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify(`JSON individual "${activeIsland.name}" exportado!`);
  };

  const handleImportWorldJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsedRaw = JSON.parse(raw) as Record<string, unknown>;
      if (
        parsedRaw &&
        typeof parsedRaw === 'object' &&
        !Array.isArray(parsedRaw.islands) &&
        Array.isArray(parsedRaw.nodes)
      ) {
        const single = parseSingleWorldJson(parsedRaw);
        onChangeWorldDraft(draft => {
          const merged = mergeSingleWorldIntoPack(draft, single);
          draft.islands = merged.islands;
        }, true);
        setSelectedIslandId(single.id);
        setSelectedNodeId(single.nodes[0]?.id ?? null);
        setSelectedPathIdx(null);
        notify(`Mapa JSON "${single.name}" mesclado ao pacote de mundos!`);
      } else {
        const parsed = parseWorldMapJson(parsedRaw);
        onChangeWorldDraft(draft => {
          draft.format = parsed.format;
          draft.version = parsed.version;
          draft.design = 'smb3';
          draft.defaultIslandId = parsed.defaultIslandId;
          draft.islands = parsed.islands;
        }, true);
        const firstIsland = parsed.islands[0];
        if (firstIsland) {
          setSelectedIslandId(firstIsland.id);
          setSelectedNodeId(firstIsland.nodes[0]?.id ?? null);
        }
        setSelectedPathIdx(null);
        notify(`Pacote JSON carregado (${parsed.islands.length} mapas)!`);
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Arquivo JSON de mundo inválido.');
    } finally {
      if (worldFileRef.current) worldFileRef.current.value = '';
    }
  };

  const handleApplyLiveJson = () => {
    try {
      const rawObj = JSON.parse(jsonDraftText) as Record<string, unknown>;
      if (jsonScope === 'single' && !Array.isArray(rawObj.islands)) {
        const parsedSingle = parseSingleWorldJson(rawObj);
        onChangeWorldDraft(draft => {
          const merged = mergeSingleWorldIntoPack(draft, parsedSingle);
          draft.islands = merged.islands;
        }, true);
        setSelectedIslandId(parsedSingle.id);
        setSelectedNodeId(parsedSingle.nodes[0]?.id ?? null);
        notify(`Coordenadas JSON de "${parsedSingle.name}" aplicadas!`);
      } else {
        const parsedPack = parseWorldMapJson(rawObj);
        onChangeWorldDraft(draft => {
          draft.format = parsedPack.format;
          draft.version = parsedPack.version;
          draft.design = 'smb3';
          draft.defaultIslandId = parsedPack.defaultIslandId;
          draft.islands = parsedPack.islands;
        }, true);
        const match = parsedPack.islands.find(i => i.id === selectedIslandId) || parsedPack.islands[0];
        if (match) {
          setSelectedIslandId(match.id);
          setSelectedNodeId(match.nodes[0]?.id ?? null);
        }
        notify(`JSON completo (${parsedPack.islands.length} mapas) aplicado!`);
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'JSON inválido ao aplicar coordenadas.');
    }
  };

  const handleAddWorldMap = (worldType: SmwWorldType) => {
    const existingCount =
      worldType === 'subworld' ? subworlds.length : mainWorlds.length;
    const nextNum = existingCount + 1;
    const prefix = worldType === 'subworld' ? 'subworld' : 'world';
    const newId = `${prefix}-${nextNum}-${Date.now().toString(36).slice(-3)}`;
    const firstNodeId = `${newId}-1-inicio`;
    const bossNodeId = `${newId}-2-castelo`;
    const firstNode: SmwMapNode = {
      id: firstNodeId,
      order: 0,
      code: worldType === 'subworld' ? `S${nextNum}-1` : `${nextNum}-1`,
      title: worldType === 'subworld' ? `Entrada Submundo ${nextNum}` : `Entrada Mundo ${nextNum}`,
      subtitle: 'Fase 1',
      theme: worldType === 'subworld' ? 'underground' : 'overworld',
      nodeKind: 'stage',
      stageKey: worldType === 'subworld' ? 'hex:0201' : 'wiki-1-overworld',
      mapX: 20,
      mapY: 50,
      gridX: 5,
      gridY: 10,
    };
    const bossNode: SmwMapNode = {
      id: bossNodeId,
      order: 1,
      code: worldType === 'subworld' ? `S${nextNum}-C` : `${nextNum}-C`,
      title: `Castelo ${nextNum}`,
      subtitle: 'Fortaleza Final',
      theme: 'castle',
      nodeKind: 'castle',
      isCastle: true,
      stageKey: 'wiki-5-castelo',
      mapX: 80,
      mapY: 50,
      gridX: 20,
      gridY: 10,
      unlocksAfterNodeId: firstNodeId,
    };
    const newIsland: SmwWorldIslandConfig = {
      id: newId,
      number: nextNum,
      worldType,
      ...(worldType === 'subworld' ? { parentWorldId: activeIsland?.id || 'wikiworld' } : {}),
      overworldGrid: { cols: LM_OVERWORLD_GRID_COLS, rows: LM_OVERWORLD_GRID_ROWS },
      name: worldType === 'subworld' ? `Submundo ${nextNum}` : `Mundo ${nextNum}`,
      subtitle: `${worldType === 'subworld' ? 'Submundo' : 'Mundo'} Editável (SMB3)`,
      playable: true,
      boardPalette: worldType === 'subworld' ? 'haunted' : 'desert',
      introStory: `Bem-vindo ao ${worldType === 'subworld' ? 'Submundo' : 'Mundo'} ${nextNum}!`,
      decorations: [
        { id: `${newId}-dec-1`, kind: 'hill', x: 24, y: 25, gridX: 6, gridY: 5 },
        { id: `${newId}-dec-2`, kind: 'trees', x: 64, y: 75, gridX: 16, gridY: 15 },
        { id: `${newId}-dec-3`, kind: 'castle_fort', x: 80, y: 25, gridX: 20, gridY: 5 },
      ],
      nodes: [firstNode, bossNode],
      paths: [makeStraightPathSegment(firstNode, bossNode, 'hv')],
    };
    onChangeWorldDraft(draft => {
      draft.islands.push(newIsland);
    }, true);
    setSelectedIslandId(newId);
    setSelectedNodeId(firstNodeId);
    setSelectedPathIdx(null);
    notify(`${newIsland.name} criado!`);
  };

  if (!activeIsland) return null;

  return (
    <div data-world-editor="smb3" className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
      {/* Top World Editor Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-950/90 border border-amber-500/40 rounded-lg p-2 shrink-0 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-1.5">
          <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[10px] font-['Press_Start_2P',monospace] text-emerald-300">
            LUNAR MAGIC WORLD
          </span>
          <select
            aria-label="Selecionar Mundo ou Submundo"
            value={activeIsland.id}
            onChange={e => switchEditingIsland(e.target.value)}
            className="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-amber-300 font-bold max-w-[260px]"
          >
            <optgroup label={`Mundos Principais (${mainWorlds.length})`}>
              {mainWorlds.map(isl => (
                <option key={isl.id} value={isl.id}>
                  M{isl.number}: {isl.name} ({isl.nodes.length} nós)
                </option>
              ))}
            </optgroup>
            {subworlds.length > 0 && (
              <optgroup label={`Submundos (${subworlds.length})`}>
                {subworlds.map(isl => (
                  <option key={isl.id} value={isl.id}>
                    S{isl.number}: {isl.name} ({isl.nodes.length} nós)
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {linkedCounterpart && (
            <button
              type="button"
              onClick={() => switchEditingIsland(linkedCounterpart.id)}
              className="px-2 py-1 rounded bg-purple-950/90 hover:bg-purple-900 border border-purple-500/60 text-purple-200 flex items-center gap-1 cursor-pointer"
              title={`Ir para ${linkedCounterpart.name}`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>
                {activeIsland.worldType === 'subworld'
                  ? `Ir p/ Mundo ${linkedCounterpart.number}`
                  : `Ir p/ Submundo ${linkedCounterpart.number}`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleAddWorldMap('main')}
            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Mundo</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddWorldMap('subworld')}
            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-purple-700/70 text-purple-300 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Submundo</span>
          </button>
          {worldDraft.islands.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const remaining = worldDraft.islands.filter(i => i.id !== activeIsland.id);
                onChangeWorldDraft(draft => {
                  draft.islands = draft.islands.filter(i => i.id !== activeIsland.id);
                  if (draft.defaultIslandId === activeIsland.id) {
                    draft.defaultIslandId = draft.islands[0]?.id || 'wikiworld';
                  }
                }, true);
                setSelectedIslandId(remaining[0].id);
                setSelectedNodeId(remaining[0].nodes[0]?.id ?? null);
                notify('Mapa removido do pacote JSON.');
              }}
              className="p-1.5 rounded bg-stone-800 hover:bg-red-950 border border-stone-700 text-red-400 cursor-pointer"
              title="Excluir mapa selecionado"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-40 border border-stone-700 text-amber-300 cursor-pointer"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-40 border border-stone-700 text-sky-300 cursor-pointer"
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => worldFileRef.current?.click()}
            className="px-2 py-1 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-200 flex items-center gap-1 cursor-pointer"
            title="Importar JSON individual de Mundo/Submundo ou Pacote completo"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar JSON</span>
          </button>
          <button
            type="button"
            onClick={handleExportSingleIslandJson}
            className="px-2 py-1 rounded bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/60 text-indigo-200 flex items-center gap-1 cursor-pointer"
            title="Exportar somente este Mundo ou Submundo em JSON"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>JSON Mapa</span>
          </button>
          <button
            type="button"
            onClick={handleExportWorldJson}
            className="px-2 py-1 rounded bg-sky-950/90 hover:bg-sky-900 border border-sky-500/60 text-sky-200 flex items-center gap-1 cursor-pointer"
            title="Exportar pacote completo (7 Mundos + 7 Submundos) em JSON"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exportar Mundo JSON</span>
          </button>
          <button
            type="button"
            onClick={onResetDefault}
            className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Padrão</span>
          </button>
          <button
            type="button"
            onClick={() => onApplyWorld(false)}
            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold cursor-pointer"
          >
            Aplicar no Modo World
          </button>
          <button
            type="button"
            onClick={() => onApplyWorld(true)}
            className="px-2.5 py-1 rounded bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 hover:to-green-300 text-stone-950 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-stone-950" />
            <span>Aplicar &amp; Jogar Mundo</span>
          </button>
          <input
            ref={worldFileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportWorldJson}
            className="hidden"
          />
        </div>
      </div>

      {/* Lunar Magic Editing Layer Mode Selector + Grid Snap Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-950/85 border border-stone-800 rounded-lg px-2.5 py-1.5 shrink-0 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-amber-300 font-bold mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Modo Lunar Magic:</span>
          </span>
          {(
            [
              { id: 'levels', label: 'Camada Níveis & Portais', icon: MapPin },
              { id: 'terrain', label: 'Camada 1 · Terreno & Cenário', icon: Trees },
              { id: 'paths', label: 'Camada 2 · Rotas & Eventos', icon: GitBranch },
              { id: 'json', label: 'Editor JSON Coordenadas', icon: Code2 },
            ] as const
          ).map(m => {
            const Icon = m.icon;
            const active = lmMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectLmLayer(m.id)}
                className={`px-2 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                  active
                    ? 'bg-sky-600/30 border-sky-400 text-sky-100 font-bold'
                    : 'bg-stone-900 hover:bg-stone-800 border-stone-700 text-stone-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showCoordGrid}
              onChange={e => setShowCoordGrid(e.target.checked)}
              className="accent-amber-400"
            />
            <Grid className="w-3.5 h-3.5 text-amber-300" />
            <span>Grade LM (25×20)</span>
          </label>
          <label className="flex items-center gap-1 text-stone-300 cursor-pointer">
            <input
              type="checkbox"
              checked={gridSnap}
              onChange={e => setGridSnap(e.target.checked)}
              className="accent-emerald-400"
            />
            <span>Snap Coordenadas</span>
          </label>
          {hoverCoords && (
            <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-700 text-amber-200 tabular-nums">
              X:{hoverCoords.x}% Y:{hoverCoords.y}% · Grid ({hoverCoords.gridX},{hoverCoords.gridY})
            </span>
          )}
        </div>
      </div>

      {/* Sub-Tools Row (shown for canvas editing modes) */}
      {lmMode !== 'json' && (
        <div className="flex flex-wrap items-center gap-1.5 bg-stone-950/75 border border-stone-800 rounded-lg px-2.5 py-1.5 shrink-0 text-[11px] font-mono">
          {(
            [
              { id: 'select', label: 'Mover / Selecionar', icon: MousePointer },
              { id: 'add_stage', label: '+ Fase', icon: MapPin },
              { id: 'add_castle', label: '+ Castelo', icon: Castle },
              { id: 'add_palace', label: '+ Palácio', icon: Sparkles },
              { id: 'add_portal', label: '+ Portal Submundo', icon: Compass },
              { id: 'add_star_warp', label: '+ Star Warp', icon: Sparkles },
              { id: 'connect_hv', label: 'Rota Reta H→V', icon: GitBranch },
              { id: 'connect_vh', label: 'Rota Reta V→H', icon: GitBranch },
              { id: 'connect_direct', label: 'Linha Direta', icon: GitBranch },
              { id: 'decor', label: '+ Cenário SMB3', icon: Trees },
              { id: 'erase', label: 'Apagar', icon: Eraser },
            ] as const
          ).map(t => {
            const Icon = t.icon;
            const active = worldTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setWorldTool(t.id);
                  setConnectFromNodeId(null);
                  if (t.id === 'decor') setLmMode('terrain');
                }}
                className={`px-2 py-1 rounded border flex items-center gap-1 cursor-pointer ${
                  active
                    ? t.id === 'erase'
                      ? 'bg-red-950 border-red-400 text-red-200'
                      : 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}

          {worldTool === 'decor' && (
            <select
              aria-label="Tipo de decoração SMB3"
              value={decorKind}
              onChange={e => setDecorKind(e.target.value as SmwMapDecorationKind)}
              className="bg-stone-900 border border-emerald-500/50 rounded px-2 py-1 text-emerald-200 ml-auto"
            >
              {DECOR_OPTIONS.map(d => (
                <option key={d.kind} value={d.kind}>
                  {d.label}
                </option>
              ))}
            </select>
          )}

          {connectFromNodeId && (
            <span className="ml-auto px-2 py-0.5 rounded bg-amber-950 border border-amber-400/60 text-amber-200">
              Origem: {connectFromNodeId} — clique no destino
            </span>
          )}
        </div>
      )}

      {/* Main Content Area: Live JSON Editor OR Interactive Map + Property Inspector */}
      {lmMode === 'json' ? (
        <div className="flex-1 min-h-0 flex flex-col gap-2 bg-stone-950/90 border border-sky-500/40 rounded-lg p-3 overflow-hidden text-xs font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-['Press_Start_2P',monospace] text-[10px] text-sky-300">
                JSON DE COORDENADAS (LUNAR MAGIC)
              </span>
              <button
                type="button"
                onClick={() => handleOpenJsonMode('single')}
                className={`px-2 py-1 rounded border cursor-pointer ${
                  jsonScope === 'single'
                    ? 'bg-sky-700 border-sky-400 text-white font-bold'
                    : 'bg-stone-900 border-stone-700 text-stone-300'
                }`}
              >
                Mapa Atual ({activeIsland.name})
              </button>
              <button
                type="button"
                onClick={() => handleOpenJsonMode('pack')}
                className={`px-2 py-1 rounded border cursor-pointer ${
                  jsonScope === 'pack'
                    ? 'bg-sky-700 border-sky-400 text-white font-bold'
                    : 'bg-stone-900 border-stone-700 text-stone-300'
                }`}
              >
                Pacote Completo ({worldDraft.islands.length} mapas)
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyLiveJson}
                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
              >
                Aplicar JSON Editado
              </button>
              <button
                type="button"
                onClick={() => setLmMode('levels')}
                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 cursor-pointer"
              >
                Voltar ao Mapa
              </button>
            </div>
          </div>
          <p className="text-[11px] text-stone-400 shrink-0">
            Edite diretamente <code className="text-amber-300">mapX</code>/<code className="text-amber-300">mapY</code> (4–96%) ou <code className="text-sky-300">gridX</code>/<code className="text-sky-300">gridY</code> (1–24 / 1–19), portais <code className="text-purple-300">targetIslandId</code>, rotas retas e decorações.
          </p>
          <textarea
            aria-label="JSON editável de coordenadas do mundo"
            value={jsonDraftText}
            onChange={e => setJsonDraftText(e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-[220px] w-full bg-stone-900 border border-stone-700 rounded p-2.5 text-[11px] leading-relaxed text-emerald-200 font-mono focus:outline-none focus:border-sky-400 resize-none"
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-hidden">
          {/* Left/Main Interactive SMB3 Map Board */}
          <div className="lg:col-span-8 flex flex-col gap-2 min-h-[260px] overflow-hidden">
            <div
              ref={boardContainerRef}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              onPointerUp={handleBoardPointerUp}
              onPointerLeave={() => {
                handleBoardPointerUp();
                setHoverCoords(null);
              }}
              className="relative flex-1 min-h-[250px] rounded-lg border-4 border-[#f8d838] shadow-xl overflow-hidden select-none touch-none cursor-crosshair"
            >
              <Smb3WorldBoardSvg
                boardPalette={activeIsland.boardPalette || 'grass'}
                nodes={activeIsland.nodes}
                paths={activeIsland.paths}
                decorations={activeIsland.decorations || []}
                islandPlayable={activeIsland.playable}
                selectedPathIndex={selectedPathIdx}
                showCoordinateGrid={showCoordGrid}
                selectedDecorId={selectedDecorId}
                interactiveDecor={lmMode === 'terrain' || worldTool === 'decor' || worldTool === 'erase' || worldTool === 'select'}
                onDecorPointerDown={handleDecorPointerDown}
                interactivePaths
                onSelectPath={idx => {
                  if (worldTool === 'erase') {
                    onChangeWorldDraft(draft => {
                      const isl = draft.islands.find(i => i.id === activeIsland.id);
                      if (!isl) return;
                      isl.paths.splice(idx, 1);
                    }, true);
                    setSelectedPathIdx(null);
                    notify('Caminho removido!');
                  } else {
                    setSelectedPathIdx(idx);
                    setSelectedNodeId(null);
                    setSelectedDecorId(null);
                  }
                }}
              />

              {/* Draggable/Editable SMB3 Stage & Portal Nodes */}
              {activeIsland.nodes.map(node => {
                const isSelected = node.id === selectedNodeId;
                const isConnectSrc = node.id === connectFromNodeId;
                const portal = isSmwPortalNode(node);
                return (
                  <button
                    key={node.id}
                    data-world-node={node.id}
                    type="button"
                    onPointerDown={e => handleNodePointerDown(e, node)}
                    style={{ left: `${node.mapX}%`, top: `${node.mapY}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-10 ${
                      isSelected ? 'z-20' : ''
                    } ${lmMode === 'terrain' ? 'opacity-65' : ''}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-sm border-[3px] flex items-center justify-center font-['Press_Start_2P',monospace] text-[8px] shadow-md transition ${
                        isConnectSrc
                          ? 'bg-emerald-500 border-white text-black ring-4 ring-emerald-300/70'
                          : isSelected
                          ? 'bg-amber-400 border-white text-black ring-4 ring-amber-300/60 scale-110'
                          : portal
                          ? 'bg-purple-700 border-cyan-300 text-cyan-100'
                          : node.isCastle
                          ? 'bg-red-700 border-black text-amber-200'
                          : node.isSwitchPalace
                          ? 'bg-yellow-400 border-black text-stone-950'
                          : 'bg-[#f8b850] border-black text-stone-950'
                      }`}
                    >
                      {node.code}
                    </div>
                    <span className="mt-0.5 px-1.5 py-0.5 rounded-sm bg-black/85 border border-stone-600 text-[9px] font-mono text-white whitespace-nowrap">
                      {node.title}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] font-mono text-stone-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span>
                Modo {lmMode === 'terrain' ? 'Camada 1 (Terreno)' : lmMode === 'paths' ? 'Camada 2 (Rotas Retas)' : 'Níveis & Portais'} • Arraste nós ou decorações
              </span>
              <span>
                {activeIsland.nodes.length} nós • {activeIsland.paths.length} linhas retas •{' '}
                {(activeIsland.decorations ?? []).length} decorações
              </span>
            </div>
          </div>

          {/* Right Property Inspector (Island + Node + Decor + Path) */}
          <div className="lg:col-span-4 bg-stone-950/90 border border-stone-800 rounded-lg p-3 overflow-y-auto space-y-3 text-xs font-mono">
            {/* Island Config */}
            <div className="space-y-1.5 pb-2.5 border-b border-stone-800">
              <div className="flex items-center justify-between">
                <span className="font-['Press_Start_2P',monospace] text-[9px] text-amber-300">
                  {activeIsland.worldType === 'subworld'
                    ? `SUBMUNDO ${activeIsland.number}`
                    : `MUNDO ${activeIsland.number}`}
                </span>
                <span className="text-[10px] text-stone-400">id: {activeIsland.id}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="space-y-0.5">
                  <span className="text-[10px] text-stone-400">Nome:</span>
                  <input
                    type="text"
                    value={activeIsland.name}
                    onChange={e =>
                      onChangeWorldDraft(draft => {
                        const isl = draft.islands.find(i => i.id === activeIsland.id);
                        if (isl) isl.name = e.target.value;
                      }, true)
                    }
                    className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-white"
                  />
                </label>
                <label className="space-y-0.5">
                  <span className="text-[10px] text-stone-400">Paleta SMB3:</span>
                  <select
                    value={activeIsland.boardPalette || 'grass'}
                    onChange={e =>
                      onChangeWorldDraft(draft => {
                        const isl = draft.islands.find(i => i.id === activeIsland.id);
                        if (isl) isl.boardPalette = e.target.value as SmwBoardPalette;
                      }, true)
                    }
                    className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-emerald-200"
                  >
                    {PALETTE_OPTIONS.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="space-y-0.5">
                  <span className="text-[10px] text-stone-400">Tipo de Mapa:</span>
                  <select
                    value={activeIsland.worldType || 'main'}
                    onChange={e =>
                      onChangeWorldDraft(draft => {
                        const isl = draft.islands.find(i => i.id === activeIsland.id);
                        if (isl) isl.worldType = e.target.value as SmwWorldType;
                      }, true)
                    }
                    className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-purple-200"
                  >
                    <option value="main">Mundo Principal</option>
                    <option value="subworld">Submundo</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-stone-300 cursor-pointer pt-4">
                  <input
                    type="checkbox"
                    checked={activeIsland.playable}
                    onChange={e =>
                      onChangeWorldDraft(draft => {
                        const isl = draft.islands.find(i => i.id === activeIsland.id);
                        if (isl) isl.playable = e.target.checked;
                      }, true)
                    }
                    className="accent-emerald-400"
                  />
                  <span>Jogável</span>
                </label>
              </div>
            </div>

            {/* Selected Node Config */}
            {selectedNode ? (
              <div className="space-y-2 pb-2.5 border-b border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-['Press_Start_2P',monospace] text-[9px] text-sky-300">
                    NÓ: {selectedNode.code}
                  </span>
                  <span className="text-[10px] text-amber-200 tabular-nums">
                    ({selectedNode.mapX}%, {selectedNode.mapY}%) · G({selectedNode.gridX ?? Math.round(selectedNode.mapX / 4)},{selectedNode.gridY ?? Math.round(selectedNode.mapY / 5)})
                  </span>
                </div>

                {/* Direct Coordinate Inputs (Lunar Magic Coordinate Editing) */}
                <div className="grid grid-cols-4 gap-1">
                  <label className="space-y-0.5">
                    <span className="text-[9px] text-stone-400">X (%):</span>
                    <input
                      type="number"
                      min={4}
                      max={96}
                      step={1}
                      value={selectedNode.mapX}
                      onChange={e => {
                        const val = Number(e.target.value);
                        if (!Number.isFinite(val)) return;
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (!isl || !nd) return;
                          nd.mapX = Math.max(4, Math.min(96, val));
                          nd.gridX = percentToGridCoord(nd.mapX, nd.mapY).gridX;
                          syncIslandPathsForNode(isl, nd.id);
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1 py-0.5 text-amber-200 tabular-nums"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[9px] text-stone-400">Y (%):</span>
                    <input
                      type="number"
                      min={4}
                      max={96}
                      step={1}
                      value={selectedNode.mapY}
                      onChange={e => {
                        const val = Number(e.target.value);
                        if (!Number.isFinite(val)) return;
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (!isl || !nd) return;
                          nd.mapY = Math.max(4, Math.min(96, val));
                          nd.gridY = percentToGridCoord(nd.mapX, nd.mapY).gridY;
                          syncIslandPathsForNode(isl, nd.id);
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1 py-0.5 text-amber-200 tabular-nums"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[9px] text-sky-400">Grid X:</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={selectedNode.gridX ?? percentToGridCoord(selectedNode.mapX, selectedNode.mapY).gridX}
                      onChange={e => {
                        const gx = Math.max(1, Math.min(24, Math.round(Number(e.target.value) || 1)));
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (!isl || !nd) return;
                          nd.gridX = gx;
                          const gy = nd.gridY ?? percentToGridCoord(nd.mapX, nd.mapY).gridY;
                          nd.mapX = gridCoordToPercent(gx, gy).mapX;
                          syncIslandPathsForNode(isl, nd.id);
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-sky-700/60 rounded px-1 py-0.5 text-sky-200 tabular-nums"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[9px] text-sky-400">Grid Y:</span>
                    <input
                      type="number"
                      min={1}
                      max={19}
                      value={selectedNode.gridY ?? percentToGridCoord(selectedNode.mapX, selectedNode.mapY).gridY}
                      onChange={e => {
                        const gy = Math.max(1, Math.min(19, Math.round(Number(e.target.value) || 1)));
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (!isl || !nd) return;
                          nd.gridY = gy;
                          const gx = nd.gridX ?? percentToGridCoord(nd.mapX, nd.mapY).gridX;
                          nd.mapY = gridCoordToPercent(gx, gy).mapY;
                          syncIslandPathsForNode(isl, nd.id);
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-sky-700/60 rounded px-1 py-0.5 text-sky-200 tabular-nums"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-stone-400">Código:</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={selectedNode.code}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (nd) nd.code = e.target.value.toUpperCase();
                        }, true)
                      }
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-amber-300 uppercase"
                    />
                  </label>
                  <label className="col-span-2 space-y-0.5">
                    <span className="text-[10px] text-stone-400">Título:</span>
                    <input
                      type="text"
                      value={selectedNode.title}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (nd) nd.title = e.target.value;
                        }, true)
                      }
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-white"
                    />
                  </label>
                </div>

                {isSmwPortalNode(selectedNode) ? (
                  <label className="block space-y-0.5">
                    <span className="text-[10px] text-purple-300">Destino do Portal (Mundo / Submundo):</span>
                    <select
                      value={selectedNode.targetIslandId || ''}
                      onChange={e => {
                        const targetId = e.target.value;
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          const targetIsl = draft.islands.find(i => i.id === targetId);
                          if (nd) {
                            nd.targetIslandId = targetId || undefined;
                            nd.targetNodeId = targetIsl?.nodes[0]?.id;
                          }
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-purple-500/60 rounded px-2 py-1 text-purple-200"
                    >
                      <option value="">Selecionar destino...</option>
                      {worldDraft.islands
                        .filter(i => i.id !== activeIsland.id)
                        .map(i => (
                          <option key={i.id} value={i.id}>
                            {i.worldType === 'subworld' ? `Submundo ${i.number}` : `Mundo ${i.number}`}: {i.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block space-y-0.5">
                      <span className="text-[10px] text-stone-400">Fase Vinculada (Stage / Hex / Editor):</span>
                      <select
                        value={selectedNode.stageKey || selectedNode.id}
                        onChange={e => {
                          const val = e.target.value;
                          onChangeWorldDraft(draft => {
                            const isl = draft.islands.find(i => i.id === activeIsland.id);
                            const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                            if (nd) {
                              nd.stageKey = val;
                              if (val.startsWith('hex:')) {
                                nd.hexId = val.slice(4);
                              } else if (val.startsWith('theme:')) {
                                const themeVal = val.slice(6) as LevelData['theme'];
                                nd.theme = themeVal;
                                const matchBiome = HEX_LEVEL_LIST.find(h => h.key === val);
                                if (matchBiome) nd.hexId = matchBiome.hexId;
                              }
                            }
                          }, true);
                        }}
                        className="w-full bg-stone-900 border border-sky-500/50 rounded px-2 py-1 text-sky-200"
                      >
                        <optgroup label="Biomas Novos do Modo World (R1.24.AE.8)">
                          <option value="theme:desert">[0115] Deserto Dourado (Areia & Arenito)</option>
                          <option value="theme:snow">[0116] Geleira Alva (Neve & Gelo)</option>
                          <option value="theme:sky">[0117] Nuvens Nota (Céu & Bloco Musical)</option>
                          <option value="theme:forest">[0118] Bosque Verde (Grama, Terra & Madeira)</option>
                          <option value="theme:volcano">[0119] Cratera Vulcão (Rocha & Lava)</option>
                        </optgroup>
                        <optgroup label="Fases Originais do Modo World (JSON)">
                          {WORLD_STAGE_JSON_REGISTRY.map(entry => (
                            <option key={entry.key} value={entry.key}>
                              [{entry.hexId}] {entry.label}
                            </option>
                          ))}
                          <option value="smw-wiki-1-secret">Caverna Secreta da Chave</option>
                        </optgroup>
                        {customLevels.length > 0 && (
                          <optgroup label="Minhas Fases do Editor">
                            {customLevels.map(lvl => (
                              <option key={lvl.id} value={`custom:${lvl.id}`}>
                                [Editor{lvl.hexId ? ` · HEX ${lvl.hexId}` : ''}] {lvl.name} ({lvl.theme})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Mapas Hexadecimais Core (0105..0119, 00D0+)">
                          {HEX_LEVEL_LIST.filter(item => !item.isExampleMap).map(item => (
                            <option key={item.hexId} value={`hex:${item.hexId}`}>
                              [{item.hexId}] {item.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Mapas Exemplo Hex (0200–02FE)">
                          {HEX_LEVEL_LIST.filter(item => Boolean(item.isExampleMap)).map(item => (
                            <option key={item.hexId} value={`hex:${item.hexId}`}>
                              [{item.hexId}] {item.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Fases Clássicas">
                          <option value="world-1-1">Mundo 1-1</option>
                          <option value="world-1-2">Mundo 1-2 (Caverna)</option>
                          <option value="world-2-2">Mundo 2-2 (Água)</option>
                          <option value="world-ghost">Mansão Fantasma</option>
                          <option value="world-1-4">Mundo 1-4 (Castelo)</option>
                          <option value="secret-vault">Cofre Secreto</option>
                        </optgroup>
                      </select>
                    </label>

                    <div className="flex items-center gap-1 bg-stone-900/90 border border-purple-500/40 rounded px-1.5 py-1">
                      <span className="text-[10px] text-purple-300 font-bold shrink-0">HEX SMB3:</span>
                      <input
                        type="text"
                        maxLength={6}
                        value={
                          selectedNode.hexId ||
                          (selectedNode.stageKey?.startsWith('hex:') ? selectedNode.stageKey.slice(4) : '')
                        }
                        onChange={e => {
                          const raw = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
                          onChangeWorldDraft(draft => {
                            const isl = draft.islands.find(i => i.id === activeIsland.id);
                            const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                            if (!nd) return;
                            nd.hexId = raw || undefined;
                            if (raw.length >= 2) {
                              const padded = raw.padStart(4, '0');
                              nd.stageKey = `hex:${padded}`;
                            }
                          }, true);
                        }}
                        placeholder="0105"
                        className="w-14 bg-stone-950 border border-stone-700 rounded px-1 py-0.5 text-amber-300 uppercase font-mono text-[10px]"
                      />
                      {onEditStageByHex && (
                        <button
                          type="button"
                          onClick={() =>
                            onEditStageByHex(
                              selectedNode.hexId
                                ? `hex:${selectedNode.hexId.padStart(4, '0')}`
                                : selectedNode.stageKey || selectedNode.id
                            )
                          }
                          className="ml-auto px-1.5 py-0.5 rounded bg-purple-900/80 hover:bg-purple-800 border border-purple-400/50 text-purple-100 text-[10px] cursor-pointer"
                        >
                          Editar Fase
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-stone-400">Tipo do Nó:</span>
                    <select
                      value={
                        selectedNode.nodeKind ||
                        (selectedNode.isCastle
                          ? 'castle'
                          : selectedNode.isSwitchPalace
                          ? 'switch_palace'
                          : 'stage')
                      }
                      onChange={e => {
                        const k = e.target.value as SmwNodeKind;
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (!nd) return;
                          nd.nodeKind = k;
                          nd.isCastle = k === 'castle' ? true : undefined;
                          nd.isSwitchPalace = k === 'switch_palace' ? true : undefined;
                          if (k === 'switch_palace' && !nd.switchColor) {
                            nd.switchColor = 'yellow';
                          }
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-stone-200"
                    >
                      <option value="stage">Fase Padrão</option>
                      <option value="castle">Castelo</option>
                      <option value="switch_palace">Palácio Botão</option>
                      <option value="subworld_portal">Portal Submundo</option>
                      <option value="star_warp">Star Warp</option>
                      <option value="pipe">Cano / Atalho</option>
                      <option value="toad_house">Casa Bônus</option>
                    </select>
                  </label>

                  <label className="space-y-0.5">
                    <span className="text-[10px] text-stone-400">Tema Visual:</span>
                    <select
                      value={selectedNode.theme}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (nd) nd.theme = e.target.value as LevelData['theme'];
                        }, true)
                      }
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-stone-200"
                    >
                      <option value="overworld">Overworld</option>
                      <option value="underground">Caverna</option>
                      <option value="underwater">Água</option>
                      <option value="ghost_house">Mansão Fantasma</option>
                      <option value="desert">Deserto</option>
                      <option value="snow">Neve / Gelo</option>
                      <option value="sky">Céu / Nuvens</option>
                      <option value="forest">Floresta</option>
                      <option value="volcano">Vulcão</option>
                      <option value="castle">Castelo</option>
                    </select>
                  </label>
                </div>

                {selectedNode.isSwitchPalace && (
                  <label className="block space-y-0.5">
                    <span className="text-[10px] text-stone-400">Cor do Botão do Palácio:</span>
                    <select
                      value={selectedNode.switchColor || 'yellow'}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (nd) nd.switchColor = e.target.value as SmwSwitchColor;
                        }, true)
                      }
                      className="w-full bg-stone-900 border border-yellow-500/50 rounded px-1.5 py-1 text-yellow-200"
                    >
                      <option value="yellow">Amarelo</option>
                      <option value="green">Verde</option>
                      <option value="red">Vermelho</option>
                      <option value="pink">Rosa</option>
                      <option value="blue">Azul</option>
                    </select>
                  </label>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-stone-400">Abre após (Normal):</span>
                    <select
                      value={selectedNode.unlocksAfterNodeId || ''}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (nd) nd.unlocksAfterNodeId = e.target.value || undefined;
                        }, true)
                      }
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-stone-200"
                    >
                      <option value="">Início aberto</option>
                      {activeIsland.nodes
                        .filter(n => n.id !== selectedNode.id)
                        .map(n => (
                          <option key={n.id} value={n.id}>
                            {n.code} - {n.title}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="space-y-0.5">
                    <span className="text-[10px] text-stone-400">Rota Chave (Secreta):</span>
                    <select
                      value={selectedNode.unlocksAfterSecretNodeId || ''}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const nd = isl?.nodes.find(n => n.id === selectedNode.id);
                          if (nd) nd.unlocksAfterSecretNodeId = e.target.value || undefined;
                        }, true)
                      }
                      className="w-full bg-stone-900 border border-amber-500/40 rounded px-1.5 py-1 text-amber-200"
                    >
                      <option value="">Nenhuma</option>
                      {activeIsland.nodes
                        .filter(n => n.id !== selectedNode.id)
                        .map(n => (
                          <option key={n.id} value={n.id}>
                            Chave em {n.code}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : selectedDecor ? (
              <div className="space-y-2 pb-2.5 border-b border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="font-['Press_Start_2P',monospace] text-[9px] text-emerald-300">
                    CAMADA 1 · CENÁRIO
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeWorldDraft(draft => {
                        const isl = draft.islands.find(i => i.id === activeIsland.id);
                        if (!isl?.decorations) return;
                        isl.decorations = isl.decorations.filter(d => d.id !== selectedDecor.id);
                      }, true);
                      setSelectedDecorId(null);
                    }}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-stone-400">Tipo:</span>
                    <select
                      value={selectedDecor.kind}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const dec = isl?.decorations?.find(d => d.id === selectedDecor.id);
                          if (dec) dec.kind = e.target.value as SmwMapDecorationKind;
                        }, true)
                      }
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-emerald-200"
                    >
                      {DECOR_OPTIONS.map(d => (
                        <option key={d.kind} value={d.kind}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[10px] text-stone-400">Rótulo (opcional):</span>
                    <input
                      type="text"
                      maxLength={24}
                      value={selectedDecor.label || ''}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const dec = isl?.decorations?.find(d => d.id === selectedDecor.id);
                          if (dec) dec.label = e.target.value || undefined;
                        }, true)
                      }
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-white"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <label className="space-y-0.5">
                    <span className="text-[9px] text-stone-400">X (%):</span>
                    <input
                      type="number"
                      min={4}
                      max={96}
                      value={selectedDecor.x}
                      onChange={e => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const dec = isl?.decorations?.find(d => d.id === selectedDecor.id);
                          if (dec) {
                            dec.x = Math.max(4, Math.min(96, v));
                            dec.gridX = percentToGridCoord(dec.x, dec.y).gridX;
                          }
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1 py-0.5 text-amber-200 tabular-nums"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[9px] text-stone-400">Y (%):</span>
                    <input
                      type="number"
                      min={4}
                      max={96}
                      value={selectedDecor.y}
                      onChange={e => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const dec = isl?.decorations?.find(d => d.id === selectedDecor.id);
                          if (dec) {
                            dec.y = Math.max(4, Math.min(96, v));
                            dec.gridY = percentToGridCoord(dec.x, dec.y).gridY;
                          }
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1 py-0.5 text-amber-200 tabular-nums"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[9px] text-stone-400">Largura:</span>
                    <input
                      type="number"
                      min={6}
                      max={48}
                      value={selectedDecor.width ?? 12}
                      onChange={e => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const dec = isl?.decorations?.find(d => d.id === selectedDecor.id);
                          if (dec) dec.width = Math.max(6, Math.min(48, v));
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1 py-0.5 text-stone-200 tabular-nums"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="text-[9px] text-stone-400">Altura:</span>
                    <input
                      type="number"
                      min={4}
                      max={40}
                      value={selectedDecor.height ?? 12}
                      onChange={e => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const dec = isl?.decorations?.find(d => d.id === selectedDecor.id);
                          if (dec) dec.height = Math.max(4, Math.min(40, v));
                        }, true);
                      }}
                      className="w-full bg-stone-900 border border-stone-700 rounded px-1 py-0.5 text-stone-200 tabular-nums"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="text-stone-400 text-[11px] pb-2 border-b border-stone-800">
                Clique em um nó, portal ou decoração no mapa para editar suas coordenadas e propriedades estilo Lunar Magic.
              </div>
            )}

            {/* Selected Straight Path Inspector */}
            {selectedPath && selectedPathIdx !== null && (
              <div className="space-y-1.5 bg-stone-900/80 border border-amber-500/40 rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300">
                    LINHA RETA #{selectedPathIdx + 1}: {selectedPath.fromId} → {selectedPath.toId}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeWorldDraft(draft => {
                        const isl = draft.islands.find(i => i.id === activeIsland.id);
                        isl?.paths.splice(selectedPathIdx, 1);
                      }, true);
                      setSelectedPathIdx(null);
                    }}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 items-center">
                  <label className="space-y-0.5">
                    <span className="text-[9px] text-stone-400">Evento LM (#ID):</span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={selectedPath.eventId ?? 0}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const seg = isl?.paths[selectedPathIdx];
                          if (seg) seg.eventId = Math.max(0, Math.min(255, Math.floor(Number(e.target.value) || 0)));
                        }, true)
                      }
                      className="w-full bg-stone-950 border border-stone-700 rounded px-1.5 py-0.5 text-sky-200 tabular-nums"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-stone-200 cursor-pointer pt-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedPath.isSecretRoute)}
                      onChange={e =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const seg = isl?.paths[selectedPathIdx];
                          if (seg) seg.isSecretRoute = e.target.checked || undefined;
                        }, true)
                      }
                      className="accent-amber-400"
                    />
                    <span>Rota Chave</span>
                  </label>
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  {(['hv', 'vh', 'direct'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        onChangeWorldDraft(draft => {
                          const isl = draft.islands.find(i => i.id === activeIsland.id);
                          const seg = isl?.paths[selectedPathIdx];
                          if (!isl || !seg) return;
                          const fn = isl.nodes.find(n => n.id === seg.fromId);
                          const tn = isl.nodes.find(n => n.id === seg.toId);
                          if (fn && tn) {
                            isl.paths[selectedPathIdx] = makeStraightPathSegment(
                              fn,
                              tn,
                              mode,
                              seg.isSecretRoute,
                              seg.eventId
                            );
                          }
                        }, true)
                      }
                      className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 border border-stone-700 text-[10px] text-sky-200 uppercase cursor-pointer"
                    >
                      {mode === 'hv' ? 'Reta H→V' : mode === 'vh' ? 'Reta V→H' : 'Direta'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
