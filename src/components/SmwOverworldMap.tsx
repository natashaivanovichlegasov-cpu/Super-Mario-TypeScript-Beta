/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Lock,
  Check,
  BookOpen,
  ArrowLeft,
  ArrowLeftRight,
  Castle,
  Ghost,
  Waves,
  Mountain,
  Trees,
  Crown,
  RotateCcw,
  Zap,
  Compass,
  AlertTriangle,
  Save,
  FolderOpen,
  Trash2,
  KeyRound,
  Upload,
  FileJson,
  Sparkles,
  Sun,
  Snowflake,
  Cloud,
  Flame,
} from 'lucide-react';
import {
  JOHANNNNES_CASTLE_1_BOSS_NAME,
  SMW_BETA_VERSION,
  SMW_INTRO_STORY,
  SMW_ISLAND2_UNAVAILABLE_MSG,
  SmwBetaProgress,
  SmwIslandId,
  SmwMapNode,
  SmwSaveSlotData,
  SmwWalkStep,
  SmwWorldIslandConfig,
  SmwWorldMapJson,
  evaluateSmwPathSegment,
  findSmwMapPath,
  getDefaultWorldMapJson,
  getLinkedParentWorld,
  getLinkedSubworld,
  getMainWorlds,
  getSubworlds,
  isSmwNodeCompletedAndLocked,
  isSmwNodeUnlocked,
  isSmwPortalNode,
  mergeSingleWorldIntoPack,
  parseSingleWorldJson,
  parseWorldMapJson,
  resolveSmwDirectionalStep,
} from '../game/smwWorldMap.ts';
import { Smb3WorldBoardSvg } from './Smb3WorldBoardSvg.tsx';
import { SpriteAtlas } from '../game/sprites.ts';
import { PlayerCharacter } from '../game/types.ts';
import { resolveTvRemoteAction } from '../game/smartTv.ts';

interface SmwOverworldMapProps {
  isOpen: boolean;
  progress: SmwBetaProgress;
  playerCharacter: PlayerCharacter;
  justClearedNodeId?: string | null;
  saveSlots?: (SmwSaveSlotData | null)[];
  castleSavePromptNodeTitle?: string | null;
  openLoadSignal?: number;
  worldMapConfig?: SmwWorldMapJson;
  isCustomWorldLoaded?: boolean;
  onLoadWorldMapJson?: (world: SmwWorldMapJson) => void;
  onResetWorldMapJson?: () => void;
  onSelectNode: (nodeId: string) => void;
  onSelectIsland?: (islandId: SmwIslandId, targetNodeId?: string) => void;
  onEnterStage: (nodeId: string) => void;
  onDismissStory: () => void;
  onResetProgress: () => void;
  onSaveToSlot?: (slotIndex: number) => void;
  onLoadFromSlot?: (slotIndex: number) => void;
  onDeleteSlot?: (slotIndex: number) => void;
  onDismissCastleSave?: () => void;
  onBackToMainMenu: () => void;
  isReturnToMenuLocked?: boolean;
}

interface PixelSpriteViewProps {
  sprite: HTMLCanvasElement | undefined;
  displayWidth: number;
  displayHeight: number;
  facing?: 'left' | 'right';
  className?: string;
}

const PixelSpriteView: React.FC<PixelSpriteViewProps> = ({
  sprite,
  displayWidth,
  displayHeight,
  facing = 'right',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sprite) return;
    if (canvas.width !== sprite.width) canvas.width = sprite.width;
    if (canvas.height !== sprite.height) canvas.height = sprite.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (facing === 'left') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(sprite, 0, 0);
    ctx.restore();
  }, [sprite, facing]);

  if (!sprite) return null;

  return (
    <canvas
      ref={canvasRef}
      width={sprite.width}
      height={sprite.height}
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        imageRendering: 'pixelated',
      }}
      className={className}
      aria-hidden="true"
    />
  );
};

interface MapWalkState {
  leadX: number;
  leadY: number;
  leadFacing: 'left' | 'right';
  companionX: number;
  companionY: number;
  companionFacing: 'left' | 'right';
  isWalking: boolean;
  walkFrame: number;
  bobOffsetPx: number;
  ambientTick: number;
}

function getNodePosById(nodeId: string, nodes: SmwMapNode[]): { x: number; y: number } {
  const node = nodes.find(n => n.id === nodeId) || nodes[0];
  return node ? { x: node.mapX, y: node.mapY } : { x: 20, y: 50 };
}

function sampleWalkSteps(
  steps: SmwWalkStep[],
  fallbackNodeId: string,
  nodes: SmwMapNode[],
  progressVal: number
): { x: number; y: number; dx: number; dy: number } {
  if (steps.length === 0) {
    const pos = getNodePosById(fallbackNodeId, nodes);
    return { x: pos.x, y: pos.y, dx: 1, dy: 0 };
  }
  const clamped = Math.max(0, Math.min(steps.length, progressVal));
  if (clamped >= steps.length) {
    const last = steps[steps.length - 1];
    const s = evaluateSmwPathSegment(last.seg, last.reverse ? 0 : 1);
    return {
      x: s.x,
      y: s.y,
      dx: last.reverse ? -s.dx : s.dx,
      dy: last.reverse ? -s.dy : s.dy,
    };
  }
  const idx = Math.min(steps.length - 1, Math.floor(clamped));
  const step = steps[idx];
  const localT = clamped - idx;
  const evalT = step.reverse ? 1 - localT : localT;
  const s = evaluateSmwPathSegment(step.seg, evalT);
  return {
    x: s.x,
    y: s.y,
    dx: step.reverse ? -s.dx : s.dx,
    dy: step.reverse ? -s.dy : s.dy,
  };
}

export const SmwOverworldMap: React.FC<SmwOverworldMapProps> = ({
  isOpen,
  progress,
  playerCharacter,
  justClearedNodeId = null,
  saveSlots = [null, null, null],
  castleSavePromptNodeTitle = null,
  openLoadSignal = 0,
  worldMapConfig,
  isCustomWorldLoaded = false,
  onLoadWorldMapJson,
  onResetWorldMapJson,
  onSelectNode,
  onSelectIsland,
  onEnterStage,
  onDismissStory,
  onResetProgress,
  onSaveToSlot,
  onLoadFromSlot,
  onDeleteSlot,
  onDismissCastleSave,
  onBackToMainMenu,
  isReturnToMenuLocked = false,
}) => {
  const [showStory, setShowStory] = useState<boolean>(!progress.storySeen);
  const [showSlotsModal, setShowSlotsModal] = useState<boolean>(false);
  const [slotsModalMode, setSlotsModalMode] = useState<'save' | 'load'>('load');
  const [switchLockedNotice, setSwitchLockedNotice] = useState<string>('');
  const [worldJsonNotice, setWorldJsonNotice] = useState<string>('');
  const worldFileInputRef = useRef<HTMLInputElement | null>(null);
  const [localIslandId, setLocalIslandId] = useState<SmwIslandId>(
    progress.selectedIslandId || 'wikiworld'
  );
  const [island2Notice, setIsland2Notice] = useState<string>('');
  const lastLoadSignalRef = useRef<number>(openLoadSignal);
  const atlas = useMemo(() => SpriteAtlas.get(), []);
  const defaultWorld = useMemo(() => getDefaultWorldMapJson(), []);
  const effectiveWorld = worldMapConfig ?? defaultWorld;
  const islandsList = effectiveWorld.islands;

  const blurActiveElement = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setShowSlotsModal(false);
      return;
    }
    if (castleSavePromptNodeTitle) {
      setSlotsModalMode('save');
      setShowSlotsModal(true);
    }
  }, [isOpen, castleSavePromptNodeTitle]);

  useEffect(() => {
    if (openLoadSignal > 0 && openLoadSignal !== lastLoadSignalRef.current) {
      lastLoadSignalRef.current = openLoadSignal;
      if (isOpen) {
        setShowStory(false);
        setSlotsModalMode('load');
        setShowSlotsModal(true);
      }
    }
  }, [isOpen, openLoadSignal]);

  const requestedIslandId = onSelectIsland
    ? progress.selectedIslandId || effectiveWorld.defaultIslandId
    : localIslandId;

  const activeIslandConfig: SmwWorldIslandConfig = useMemo(() => {
    return (
      islandsList.find(isl => isl.id === requestedIslandId) ||
      islandsList.find(isl => isl.id === effectiveWorld.defaultIslandId) ||
      islandsList[0]
    );
  }, [islandsList, requestedIslandId, effectiveWorld.defaultIslandId]);

  const activeIsland: SmwIslandId = activeIslandConfig.id;

  const switchIsland = (islandId: SmwIslandId, targetNodeId?: string) => {
    setIsland2Notice('');
    setSwitchLockedNotice('');
    if (onSelectIsland) {
      onSelectIsland(islandId, targetNodeId);
    } else {
      setLocalIslandId(islandId);
      const targetIsl = islandsList.find(i => i.id === islandId);
      const nextNodeId =
        targetNodeId && targetIsl?.nodes.some(n => n.id === targetNodeId)
          ? targetNodeId
          : targetIsl?.nodes[0]?.id;
      if (nextNodeId) onSelectNode(nextNodeId);
    }
  };

  const mainWorlds = useMemo(() => getMainWorlds(effectiveWorld), [effectiveWorld]);
  const subworlds = useMemo(() => getSubworlds(effectiveWorld), [effectiveWorld]);
  const linkedCounterpart = useMemo(() => {
    return activeIslandConfig.worldType === 'subworld'
      ? getLinkedParentWorld(effectiveWorld, activeIslandConfig.id)
      : getLinkedSubworld(effectiveWorld, activeIslandConfig.id);
  }, [effectiveWorld, activeIslandConfig]);

  const enterOrWarpNode = (node: SmwMapNode) => {
    if (isSmwPortalNode(node) && node.targetIslandId) {
      const targetIsl = islandsList.find(i => i.id === node.targetIslandId);
      if (targetIsl) {
        blurActiveElement();
        switchIsland(targetIsl.id, node.targetNodeId || targetIsl.nodes[0]?.id);
        setWorldJsonNotice(`Portal: ${targetIsl.name}`);
        setTimeout(() => setWorldJsonNotice(''), 2500);
        return;
      }
    }
    blurActiveElement();
    onEnterStage(node.id);
  };

  useEffect(() => {
    if (isOpen && !progress.storySeen && !(openLoadSignal > 0 && showSlotsModal)) {
      setShowStory(true);
    }
  }, [isOpen, progress.storySeen, openLoadSignal, showSlotsModal]);

  const activeNodes = activeIslandConfig.nodes;
  const activeSegments = activeIslandConfig.paths;
  const activeDecorations = activeIslandConfig.decorations || [];
  const activePlayable = activeIslandConfig.playable;
  const activeStory = activeIslandConfig.introStory || SMW_INTRO_STORY;

  const selectedNode: SmwMapNode = useMemo(() => {
    if (!activePlayable) {
      return activeNodes[0];
    }
    return (
      activeNodes.find(n => n.id === progress.selectedNodeId) ||
      activeNodes[0]
    );
  }, [activePlayable, activeNodes, progress.selectedNodeId]);

  const selectedUnlocked =
    !activePlayable ? false : isSmwNodeUnlocked(selectedNode.id, progress, activeNodes);
  const selectedCleared =
    !activePlayable ? false : progress.clearedNodeIds.includes(selectedNode.id);
  const selectedLockedCompleted =
    !activePlayable ? false : isSmwNodeCompletedAndLocked(selectedNode.id, progress);
  const finalNode = activeNodes.find(n => n.isCastle) || activeNodes[activeNodes.length - 1];
  const islandCompleted = Boolean(finalNode && progress.clearedNodeIds.includes(finalNode.id));
  const clearedCount = activeNodes.filter(n => progress.clearedNodeIds.includes(n.id)).length;
  const usedSlotsCount = saveSlots.filter(Boolean).length;

  const companionCharacter: PlayerCharacter =
    playerCharacter === 'wazzima' ? 'mario' : 'wazzima';

  // Continuous branching graph walking state across SMW_PATH_SEGMENTS (R1.16.UC.4)
  const walkStepsRef = useRef<SmwWalkStep[]>([]);
  const walkProgressRef = useRef<number>(0);
  const currentNodeIdRef = useRef<string>(selectedNode.id);
  const currentIslandRef = useRef<SmwIslandId>(activeIsland);
  const wasOpenRef = useRef<boolean>(false);
  const lastFacingRef = useRef<'left' | 'right'>('right');

  const [walkState, setWalkState] = useState<MapWalkState>(() => {
    const pos = getNodePosById(selectedNode.id, activeNodes);
    return {
      leadX: pos.x,
      leadY: pos.y,
      leadFacing: 'right',
      companionX: pos.x - 2.6,
      companionY: pos.y + 0.5,
      companionFacing: 'right',
      isWalking: false,
      walkFrame: 0,
      bobOffsetPx: 0,
      ambientTick: 0,
    };
  });

  // Sync target node when opening, changing island, or changing selection (supports mid-walk chaining)
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    const justOpened = !wasOpenRef.current;
    const islandChanged = currentIslandRef.current !== activeIsland;
    wasOpenRef.current = true;
    currentIslandRef.current = activeIsland;

    if (!activePlayable) {
      walkStepsRef.current = [];
      walkProgressRef.current = 0;
      currentNodeIdRef.current = activeNodes[0]?.id || selectedNode.id;
      return;
    }

    if (justOpened || islandChanged) {
      const clearedNode =
        justOpened && justClearedNodeId
          ? activeNodes.find(n => n.id === justClearedNodeId)
          : undefined;
      const startId = clearedNode ? clearedNode.id : selectedNode.id;
      walkStepsRef.current = findSmwMapPath(startId, selectedNode.id, activeSegments);
      walkProgressRef.current = 0;
      currentNodeIdRef.current = selectedNode.id;
      return;
    }

    if (currentNodeIdRef.current !== selectedNode.id) {
      const prevSteps = walkStepsRef.current;
      const prevProg = walkProgressRef.current;

      // If still walking along a segment, chain seamlessly from the active segment's origin or target
      if (prevSteps.length > 0 && prevProg < prevSteps.length - 0.01) {
        const idx = Math.min(prevSteps.length - 1, Math.floor(prevProg));
        const activeStep = prevSteps[idx];
        const localT = prevProg - idx;
        const stepFrom = activeStep.reverse ? activeStep.seg.toId : activeStep.seg.fromId;
        const stepTo = activeStep.reverse ? activeStep.seg.fromId : activeStep.seg.toId;

        if (selectedNode.id === stepFrom) {
          // Immediately reversed back along the same segment without snapping!
          walkStepsRef.current = [{ seg: activeStep.seg, reverse: !activeStep.reverse }];
          walkProgressRef.current = Math.max(0, Math.min(1, 1 - localT));
          currentNodeIdRef.current = selectedNode.id;
          return;
        }

        const chainedFromTo = findSmwMapPath(stepTo, selectedNode.id, activeSegments);
        const chainedSteps = [{ ...activeStep }, ...chainedFromTo];
        walkStepsRef.current = chainedSteps;
        walkProgressRef.current = localT;
        currentNodeIdRef.current = selectedNode.id;
        return;
      }

      const originId = currentNodeIdRef.current;
      walkStepsRef.current = findSmwMapPath(originId, selectedNode.id, activeSegments);
      walkProgressRef.current = 0;
      currentNodeIdRef.current = selectedNode.id;
    }
  }, [isOpen, activeIsland, activePlayable, activeNodes, activeSegments, selectedNode.id, justClearedNodeId]);

  // Smooth RAF loop for hero duo walking along straight SMB3 roads + biome creatures patrolling
  useEffect(() => {
    if (!isOpen) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastTime = performance.now();
    let lastRenderSync = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const steps = walkStepsRef.current;
      const totalSteps = steps.length;
      let current = walkProgressRef.current;
      let isWalking = false;

      if (prefersReducedMotion || totalSteps === 0) {
        current = totalSteps;
        walkProgressRef.current = current;
      } else if (current < totalSteps - 0.004) {
        isWalking = true;
        const speedSegmentsPerSec = 2.15;
        current = Math.min(totalSteps, current + speedSegmentsPerSec * dt);
        if (totalSteps - current <= 0.004) {
          current = totalSteps;
          isWalking = false;
        }
        walkProgressRef.current = current;
      } else {
        current = totalSteps;
        walkProgressRef.current = current;
      }

      const minIntervalMs = isWalking ? 16 : 90;
      if (now - lastRenderSync >= minIntervalMs) {
        lastRenderSync = now;
        const leadSample = sampleWalkSteps(
          steps,
          currentNodeIdRef.current,
          activeNodes,
          current
        );

        let leadFacing = lastFacingRef.current;
        if (isWalking && Math.abs(leadSample.dx) > 0.05) {
          leadFacing = leadSample.dx >= 0 ? 'right' : 'left';
          lastFacingRef.current = leadFacing;
        }

        let companionX: number;
        let companionY: number;
        let companionFacing: 'left' | 'right';

        if (isWalking && current > 0.04) {
          const trailProgress = Math.max(0, current - 0.16);
          const trailSample = sampleWalkSteps(
            steps,
            currentNodeIdRef.current,
            activeNodes,
            trailProgress
          );
          companionX = trailSample.x;
          companionY = trailSample.y;
          companionFacing =
            Math.abs(trailSample.dx) > 0.05 ? (trailSample.dx >= 0 ? 'right' : 'left') : leadFacing;
        } else {
          companionX = leadSample.x - 2.6;
          companionY = leadSample.y + 0.5;
          companionFacing = 'right';
          leadFacing = 'right';
          lastFacingRef.current = 'right';
        }

        const walkFrame = prefersReducedMotion
          ? 0
          : isWalking
          ? Math.floor(now / 95) % 3
          : Math.floor(now / 260) % 3;

        const bobOffsetPx = prefersReducedMotion
          ? 0
          : isWalking
          ? Math.abs(Math.sin(now / 65)) * 3.5
          : Math.abs(Math.sin(now / 240)) * 1.2;

        setWalkState({
          leadX: leadSample.x,
          leadY: leadSample.y,
          leadFacing,
          companionX,
          companionY,
          companionFacing,
          isWalking,
          walkFrame,
          bobOffsetPx,
          ambientTick: prefersReducedMotion ? 0 : now / 1000,
        });
      }

      if (!prefersReducedMotion || isWalking) {
        rafId = requestAnimationFrame(tick);
      }
    };

    tick(performance.now());
    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isOpen, activeIsland, activeNodes, selectedNode.id]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tv = resolveTvRemoteAction(
        { code: e.code, key: e.key, keyCode: e.keyCode },
        { smartTvMode: true, jumpWithUp: false }
      );

      if (showSlotsModal) {
        if (tv.isBack) {
          e.preventDefault();
          setShowSlotsModal(false);
          onDismissCastleSave?.();
          blurActiveElement();
        }
        return;
      }

      if (showStory) {
        if (tv.isConfirm || tv.isBack || tv.actions.includes('jump')) {
          e.preventDefault();
          setShowStory(false);
          onDismissStory();
        }
        return;
      }

      if (tv.isBack) {
        e.preventDefault();
        if (!isReturnToMenuLocked) {
          onBackToMainMenu();
        } else {
          setSwitchLockedNotice('Troca de modo bloqueada após iniciar o Modo World (permitido no Modo Desenvolvedor).');
        }
        return;
      }

      // Quick island switch via PageUp/PageDown
      if (e.code === 'PageDown' || e.code === 'BracketRight') {
        e.preventDefault();
        const currIdx = islandsList.findIndex(i => i.id === activeIsland);
        const nextIsl = islandsList[(currIdx + 1) % islandsList.length];
        if (nextIsl) switchIsland(nextIsl.id);
        return;
      }
      if (e.code === 'PageUp' || e.code === 'BracketLeft') {
        e.preventDefault();
        const currIdx = islandsList.findIndex(i => i.id === activeIsland);
        const prevIsl = islandsList[(currIdx - 1 + islandsList.length) % islandsList.length];
        if (prevIsl) switchIsland(prevIsl.id);
        return;
      }

      // Let focused top-bar buttons (História, Slots, Menu, Ilha 1/2, Zerar Ilha) work on OK/Enter
      if (
        target &&
        target.tagName === 'BUTTON' &&
        !target.dataset.smwNodeBtn &&
        (tv.isConfirm || tv.actions.includes('jump'))
      ) {
        e.preventDefault();
        target.click();
        return;
      }

      const dir =
        tv.actions.includes('right')
          ? 'right'
          : tv.actions.includes('left')
          ? 'left'
          : tv.actions.includes('up')
          ? 'up'
          : tv.actions.includes('down')
          ? 'down'
          : null;

      if (dir) {
        e.preventDefault();
        setSwitchLockedNotice('');
        if (!activePlayable) {
          setIsland2Notice(SMW_ISLAND2_UNAVAILABLE_MSG);
          return;
        }
        const nextRoadNode = resolveSmwDirectionalStep(
          selectedNode.id,
          dir,
          progress,
          activeIsland,
          { nodes: activeNodes, segments: activeSegments, playable: activePlayable }
        );
        if (nextRoadNode) {
          onSelectNode(nextRoadNode.id);
        }
      } else if (tv.isConfirm || tv.actions.includes('jump')) {
        e.preventDefault();
        if (!activePlayable) {
          setIsland2Notice(SMW_ISLAND2_UNAVAILABLE_MSG);
          return;
        }
        if (selectedLockedCompleted) {
          setSwitchLockedNotice('Palácio do Interruptor Amarelo já concluído!');
          return;
        }
        if (selectedUnlocked) {
          enterOrWarpNode(selectedNode);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    showStory,
    showSlotsModal,
    activeIsland,
    activePlayable,
    activeNodes,
    activeSegments,
    islandsList,
    selectedNode,
    selectedUnlocked,
    selectedLockedCompleted,
    progress,
    onSelectNode,
    onEnterStage,
    onDismissStory,
    onDismissCastleSave,
    onBackToMainMenu,
    isReturnToMenuLocked,
  ]);

  if (!isOpen) return null;

  const getNodeIcon = (node: SmwMapNode) => {
    if (isSmwPortalNode(node)) {
      return node.nodeKind === 'star_warp' ? (
        <Sparkles className="w-4 h-4 text-cyan-200 fill-cyan-300" />
      ) : (
        <Compass className="w-4 h-4 text-purple-100" />
      );
    }
    if (node.isSwitchPalace) {
      return <Zap className="w-4 h-4 text-yellow-200 fill-yellow-300" />;
    }
    switch (node.theme) {
      case 'overworld':
        return <Trees className="w-4 h-4 text-emerald-100" />;
      case 'underground':
        return <Mountain className="w-4 h-4 text-stone-100" />;
      case 'underwater':
        return <Waves className="w-4 h-4 text-cyan-100" />;
      case 'ghost_house':
        return <Ghost className="w-4 h-4 text-purple-100" />;
      case 'desert':
        return <Sun className="w-4 h-4 text-amber-200" />;
      case 'snow':
        return <Snowflake className="w-4 h-4 text-sky-100" />;
      case 'sky':
        return <Cloud className="w-4 h-4 text-white" />;
      case 'forest':
        return <Trees className="w-4 h-4 text-lime-200" />;
      case 'volcano':
        return <Flame className="w-4 h-4 text-orange-300" />;
      case 'castle':
        return <Castle className="w-4 h-4 text-amber-100" />;
    }
  };

  const leadSprite = atlas.getCharacterSprite(
    playerCharacter,
    'super',
    'castle_walk',
    walkState.walkFrame
  );
  const companionSprite = atlas.getCharacterSprite(
    companionCharacter,
    'super',
    'castle_walk',
    (walkState.walkFrame + 1) % 3
  );

  // Ambient biome patrolling creatures (Ilha 1)
  const t = walkState.ambientTick;
  const goombaPhase = Math.sin(t * 1.15);
  const goombaX = 13.5 + goombaPhase * 3.6;
  const goombaFacing: 'left' | 'right' = Math.cos(t * 1.15) >= 0 ? 'right' : 'left';
  const goombaSprite = Math.floor(t * 5) % 2 === 0 ? atlas.goombaWalk1 : atlas.goombaWalk2;

  const koopaPhase = Math.sin(t * 0.95 + 1.1);
  const koopaX = 32.5 + koopaPhase * 3.8;
  const koopaFacing: 'left' | 'right' = Math.cos(t * 0.95 + 1.1) >= 0 ? 'right' : 'left';
  const koopaSprite = Math.floor(t * 4.5) % 2 === 0 ? atlas.koopaWalk1 : atlas.koopaWalk2;

  const cheepPhase = Math.sin(t * 1.05 + 2.4);
  const cheepX = 50.5 + cheepPhase * 4.6;
  const cheepY = 74.5 + Math.sin(t * 2.5) * 1.1;
  const cheepFacing: 'left' | 'right' = Math.cos(t * 1.05 + 2.4) >= 0 ? 'right' : 'left';
  const cheepSprite = Math.floor(t * 5) % 2 === 0 ? atlas.cheepCheep1 : atlas.cheepCheep2;

  const dryBonesPhase = Math.sin(t * 0.85 + 0.6);
  const dryBonesX = 63.5 + dryBonesPhase * 3.2;
  const dryBonesFacing: 'left' | 'right' = Math.cos(t * 0.85 + 0.6) >= 0 ? 'right' : 'left';
  const dryBonesSprite = Math.floor(t * 4) % 2 === 0 ? atlas.dryBonesWalk1 : atlas.dryBonesWalk2;

  const booX = 74.5 + Math.cos(t * 0.9) * 2.0;
  const booY = 26.5 + Math.sin(t * 1.6) * 1.6;
  const booFacing: 'left' | 'right' = Math.sin(t * 0.9) <= 0 ? 'right' : 'left';
  const booSprite = Math.floor(t * 2) % 2 === 0 ? atlas.booChase : atlas.booShy;

  const bowserPhase = Math.sin(t * 0.75);
  const bowserX = 84.5 + bowserPhase * 3.5;
  const bowserFacing: 'left' | 'right' = Math.cos(t * 0.75) >= 0 ? 'right' : 'left';
  const bowserSprite = Math.floor(t * 3.5) % 2 === 0 ? atlas.bowser1 : atlas.bowser2;

  const handleUploadWorldJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Arquivo Mundo JSON muito grande (máximo 2 MB).');
      }
      const rawText = await file.text();
      const parsedJson = JSON.parse(rawText) as Record<string, unknown>;
      if (
        parsedJson &&
        typeof parsedJson === 'object' &&
        !Array.isArray(parsedJson.islands) &&
        Array.isArray(parsedJson.nodes)
      ) {
        const single = parseSingleWorldJson(parsedJson);
        const merged = mergeSingleWorldIntoPack(effectiveWorld, single);
        onLoadWorldMapJson?.(merged);
        switchIsland(single.id, single.nodes[0]?.id);
        setWorldJsonNotice(`Mapa "${single.name}" carregado via JSON!`);
      } else {
        const parsedWorld = parseWorldMapJson(parsedJson);
        onLoadWorldMapJson?.(parsedWorld);
        const targetIsland = parsedWorld.islands[0];
        if (targetIsland) {
          switchIsland(targetIsland.id, targetIsland.nodes[0]?.id);
        }
        setWorldJsonNotice(`Pacote "${targetIsland?.name || 'Personalizado'}" (${parsedWorld.islands.length} mapas) carregado via JSON!`);
      }
      setTimeout(() => setWorldJsonNotice(''), 3500);
    } catch (err) {
      setSwitchLockedNotice(
        err instanceof Error ? err.message : 'Arquivo JSON de mundo inválido.'
      );
    } finally {
      if (worldFileInputRef.current) {
        worldFileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between bg-slate-950 text-stone-100 overflow-hidden">
      {/* Top World Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-stone-950/95 border-b border-stone-800 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-amber-300 font-mono">
            <span className="font-bold">{SMW_BETA_VERSION}</span>
            <span aria-hidden="true">·</span>
            <span
              className={`font-semibold truncate ${
                !activePlayable ? 'text-purple-300' : 'text-emerald-300'
              }`}
            >
              {activeIslandConfig.name}
            </span>
            {activePlayable && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-stone-300">
                  {clearedCount}/{activeNodes.length} fases
                </span>
              </>
            )}
            {isCustomWorldLoaded && (
              <span className="px-1.5 py-0.5 rounded bg-sky-950 border border-sky-400/70 text-[9px] text-sky-200 font-bold">
                JSON ATIVO
              </span>
            )}
          </div>
          <h2 className="font-['Press_Start_2P',monospace] text-[10px] sm:text-xs text-white truncate mt-0.5">
            MAPA DO OVERWORLD · SMB3
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 7 Main Worlds + 7 Subworlds Selector Switcher */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-stone-900 border border-stone-700 p-0.5">
            {mainWorlds.map(isl => (
              <button
                key={isl.id}
                type="button"
                onClick={() => switchIsland(isl.id)}
                title={isl.name}
                className={`min-h-[28px] px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap transition ${
                  activeIsland === isl.id
                    ? isl.playable
                      ? 'bg-emerald-700 text-white shadow'
                      : 'bg-purple-700 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <span>M{isl.number}</span>
              </button>
            ))}
            {subworlds.length > 0 && (
              <span aria-hidden="true" className="w-px h-4 bg-stone-700 mx-0.5" />
            )}
            {subworlds.map(isl => (
              <button
                key={isl.id}
                type="button"
                onClick={() => switchIsland(isl.id)}
                title={isl.name}
                className={`min-h-[28px] px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 cursor-pointer whitespace-nowrap transition ${
                  activeIsland === isl.id
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-purple-300/75 hover:text-purple-100'
                }`}
              >
                <span>S{isl.number}</span>
              </button>
            ))}
          </div>

          {onLoadWorldMapJson && (
            <>
              <input
                ref={worldFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleUploadWorldJson}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => worldFileInputRef.current?.click()}
                title="Carregar arquivo World Map JSON (design SMB3 com caminhos retos)"
                className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-sky-950/90 hover:bg-sky-900 border border-sky-500/70 text-sky-200 text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
              >
                <Upload className="w-3.5 h-3.5 text-sky-300" />
                <span className="hidden sm:inline">Mundo JSON</span>
              </button>
            </>
          )}

          {isCustomWorldLoaded && onResetWorldMapJson && (
            <button
              type="button"
              onClick={() => {
                onResetWorldMapJson();
                setWorldJsonNotice('Mapa padrão do Modo World restaurado.');
                setTimeout(() => setWorldJsonNotice(''), 3000);
              }}
              title="Voltar para o world-map.json padrão do Modo World"
              className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-amber-500/50 text-amber-200 text-[10px] sm:text-xs font-medium flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 transition"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden md:inline">Mundo Padrão</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSlotsModalMode('load');
              setShowSlotsModal(true);
            }}
            title="Carregar Progresso Salvo nos Slots (salva ao passar dos castelos)"
            className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-amber-950/90 hover:bg-amber-900 border border-amber-500/70 text-amber-200 text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Carregar Progresso ({usedSlotsCount}/3)</span>
            <span className="sm:hidden">Carregar ({usedSlotsCount}/3)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowStory(true)}
            className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-amber-200 text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">História</span>
          </button>

          <button
            type="button"
            disabled={isReturnToMenuLocked}
            onClick={() => {
              if (isReturnToMenuLocked) return;
              onBackToMainMenu();
            }}
            title={
              isReturnToMenuLocked
                ? 'Menu inicial bloqueado após iniciar o Modo World (permitido no Modo Desenvolvedor)'
                : 'Voltar ao Menu Inicial'
            }
            className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-200 disabled:opacity-45 disabled:hover:bg-stone-900 disabled:cursor-not-allowed text-[10px] sm:text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
          >
            {isReturnToMenuLocked ? (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <ArrowLeft className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </div>

      {/* Super Mario Bros. 3 Board-Style Overworld Viewport with Straight-Line Roads */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#1c4098]">
        <Smb3WorldBoardSvg
          boardPalette={activeIslandConfig.boardPalette}
          nodes={activeNodes}
          paths={activeSegments}
          decorations={activeDecorations}
          progress={progress}
          islandPlayable={activePlayable}
          yellowSwitchUnlocked={progress.yellowSwitchUnlocked}
        />

        {/* Quick Linked World <-> Subworld Switch Link */}
        {linkedCounterpart && (
          <button
            type="button"
            onClick={() => switchIsland(linkedCounterpart.id)}
            className="hidden sm:flex items-center gap-1.5 absolute top-3 right-4 px-2.5 py-1 rounded bg-purple-950/90 hover:bg-purple-900 border-2 border-purple-400/80 text-[10px] font-mono text-purple-100 shadow cursor-pointer transition z-10"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>
              {activeIslandConfig.worldType === 'subworld'
                ? `Voltar ao Mundo ${linkedCounterpart.number}`
                : `Ir para Submundo ${linkedCounterpart.number}`}
            </span>
          </button>
        )}

        {/* SMB3 World Header Plaque */}
        <div className="absolute top-2.5 left-4 flex flex-wrap items-center gap-2 pointer-events-none z-10">
          <div className="px-2.5 py-1 rounded bg-stone-950/90 border-2 border-[#f8d878] shadow">
            <span className="font-['Press_Start_2P',monospace] text-[9px] sm:text-[10px] text-[#fde047]">
              {activeIslandConfig.worldType === 'subworld' ? 'SUBMUNDO' : 'WORLD'} {activeIslandConfig.number} · {activeIslandConfig.name.toUpperCase()}
            </span>
          </div>
          {activePlayable ? (
            <div
              className={`px-2 py-1 rounded border-2 text-[9px] sm:text-[10px] font-mono font-bold shadow ${
                progress.yellowSwitchUnlocked
                  ? 'bg-amber-950/95 border-yellow-400 text-yellow-200'
                  : 'bg-stone-950/90 border-stone-600 text-stone-400'
              }`}
            >
              {progress.yellowSwitchUnlocked
                ? 'Blocos [!] Amarelos: ATIVOS'
                : 'Blocos [!] Amarelos: Bloqueados'}
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded bg-amber-950/95 border-2 border-amber-400/90 text-[10px] font-mono font-bold text-amber-200 shadow">
              {SMW_ISLAND2_UNAVAILABLE_MSG}
            </div>
          )}
          {worldJsonNotice && (
            <div className="px-2.5 py-1 rounded bg-sky-950/95 border-2 border-sky-400 text-[10px] font-mono font-bold text-sky-200 shadow">
              {worldJsonNotice}
            </div>
          )}
        </div>

        {/* Ambient Patrolling Island Creatures on Default Ilha 1 */}
        {activeIsland === 'wikiworld' && !isCustomWorldLoaded && (
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" aria-hidden="true">
            <div style={{ left: `${goombaX}%`, top: '79%' }} className="absolute -translate-x-1/2 -translate-y-1/2">
              <div className="w-5 h-1.5 rounded-full bg-black/35 mx-auto translate-y-4" />
              <PixelSpriteView sprite={goombaSprite} displayWidth={20} displayHeight={20} facing={goombaFacing} />
            </div>
            <div style={{ left: `${koopaX}%`, top: '52.5%' }} className="absolute -translate-x-1/2 -translate-y-1/2">
              <div className="w-5 h-1.5 rounded-full bg-black/35 mx-auto translate-y-6" />
              <PixelSpriteView sprite={koopaSprite} displayWidth={20} displayHeight={28} facing={koopaFacing} />
            </div>
            <div style={{ left: `${cheepX}%`, top: `${cheepY}%` }} className="absolute -translate-x-1/2 -translate-y-1/2">
              <PixelSpriteView sprite={cheepSprite} displayWidth={20} displayHeight={20} facing={cheepFacing} />
            </div>
            <div style={{ left: `${dryBonesX}%`, top: '50.5%' }} className="absolute -translate-x-1/2 -translate-y-1/2">
              <div className="w-5 h-1.5 rounded-full bg-black/40 mx-auto translate-y-6" />
              <PixelSpriteView sprite={dryBonesSprite} displayWidth={20} displayHeight={28} facing={dryBonesFacing} />
            </div>
            <div style={{ left: `${booX}%`, top: `${booY}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 opacity-90">
              <PixelSpriteView sprite={booSprite} displayWidth={22} displayHeight={22} facing={booFacing} />
            </div>
            <div
              style={{ left: `${bowserX}%`, top: '67.5%' }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            >
              <span className="mb-0.5 px-1.5 py-0.5 rounded bg-red-950/90 border border-amber-400/70 text-[8px] font-bold text-amber-200 whitespace-nowrap shadow">
                {JOHANNNNES_CASTLE_1_BOSS_NAME}
              </span>
              <PixelSpriteView sprite={bowserSprite} displayWidth={30} displayHeight={30} facing={bowserFacing} />
              <div className="w-7 h-2 rounded-full bg-black/45 mx-auto -mt-1" />
            </div>
          </div>
        )}

        {/* SMB3 Square Stage Panels */}
        {activeNodes.map(node => {
          const isLockedIsland = !activePlayable;
          const unlocked = isLockedIsland ? false : isSmwNodeUnlocked(node.id, progress, activeNodes);
          const cleared = isLockedIsland ? false : progress.clearedNodeIds.includes(node.id);
          const secretCleared =
            !isLockedIsland && Boolean(progress.secretClearedNodeIds?.includes(node.id));
          const lockedCompleted = isLockedIsland
            ? false
            : isSmwNodeCompletedAndLocked(node.id, progress);
          const isSelected = isLockedIsland
            ? node.order === 0
            : selectedNode.id === node.id;

          return (
            <div
              key={node.id}
              style={{ left: `${node.mapX}%`, top: `${node.mapY}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10"
            >
              <button
                type="button"
                data-smw-node-btn="true"
                onClick={() => {
                  setSwitchLockedNotice('');
                  if (isLockedIsland) {
                    setIsland2Notice(SMW_ISLAND2_UNAVAILABLE_MSG);
                    return;
                  }
                  if (!unlocked) return;
                  if (isSelected) {
                    if (lockedCompleted) {
                      setSwitchLockedNotice('Palácio do Interruptor Amarelo já concluído!');
                      return;
                    }
                    enterOrWarpNode(node);
                  } else {
                    onSelectNode(node.id);
                  }
                }}
                onDoubleClick={() => {
                  if (isLockedIsland || !unlocked) return;
                  if (lockedCompleted) {
                    setSwitchLockedNotice('Palácio do Interruptor Amarelo já concluído!');
                    return;
                  }
                  enterOrWarpNode(node);
                }}
                disabled={!isLockedIsland && !unlocked}
                aria-label={`${node.title} (${
                  isLockedIsland
                    ? SMW_ISLAND2_UNAVAILABLE_MSG
                    : lockedCompleted
                    ? 'Concluído · Entrada bloqueada'
                    : cleared
                    ? 'Concluída'
                    : unlocked
                    ? 'Disponível'
                    : 'Bloqueada'
                })`}
                className={`relative min-w-[46px] min-h-[46px] px-2 py-1.5 rounded-sm border-[3px] flex items-center justify-center gap-1 transition-transform shadow-[3px_3px_0px_#09090b] ${
                  isLockedIsland
                    ? node.order === 0
                      ? 'bg-purple-900 border-amber-400 text-amber-200 cursor-not-allowed ring-4 ring-amber-400/40'
                      : 'bg-stone-900 border-stone-600 text-stone-500 cursor-not-allowed opacity-75'
                    : !unlocked
                    ? 'bg-stone-900 border-black text-stone-400 cursor-not-allowed opacity-85'
                    : isSelected
                    ? isSmwPortalNode(node)
                      ? 'bg-purple-600 border-cyan-300 text-white scale-110 ring-4 ring-cyan-300/75 cursor-pointer'
                      : node.isCastle
                      ? 'bg-red-700 border-white text-white scale-110 ring-4 ring-amber-300/75 cursor-pointer'
                      : node.isSwitchPalace
                      ? 'bg-yellow-400 border-black text-stone-950 scale-110 ring-4 ring-yellow-200/80 cursor-pointer'
                      : 'bg-amber-400 border-black text-stone-950 scale-110 ring-4 ring-white/75 cursor-pointer'
                    : cleared
                    ? node.isSwitchPalace
                      ? 'bg-yellow-500 hover:bg-yellow-400 border-black text-stone-950 hover:scale-105 cursor-pointer'
                      : 'bg-[#fef3c7] hover:bg-white border-black text-stone-950 hover:scale-105 cursor-pointer'
                    : isSmwPortalNode(node)
                    ? 'bg-purple-900 hover:bg-purple-800 border-cyan-400 text-cyan-100 hover:scale-105 cursor-pointer'
                    : node.isCastle
                    ? 'bg-red-900 hover:bg-red-800 border-black text-amber-200 hover:scale-105 cursor-pointer'
                    : node.isSwitchPalace
                    ? 'bg-yellow-700 hover:bg-yellow-600 border-black text-yellow-100 hover:scale-105 cursor-pointer'
                    : 'bg-[#f8d878] hover:bg-[#fef08a] border-black text-stone-950 hover:scale-105 cursor-pointer'
                }`}
              >
                {/* SMB3 Pixel Panel Corner Rivets */}
                <span aria-hidden="true" className="absolute top-0.5 left-0.5 w-1 h-1 bg-black/45" />
                <span aria-hidden="true" className="absolute top-0.5 right-0.5 w-1 h-1 bg-black/45" />
                <span aria-hidden="true" className="absolute bottom-0.5 left-0.5 w-1 h-1 bg-black/45" />
                <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 w-1 h-1 bg-black/45" />

                {unlocked ? (
                  node.isCastle || node.isSwitchPalace || isSmwPortalNode(node) ? (
                    getNodeIcon(node)
                  ) : (
                    <span className="font-['Press_Start_2P',monospace] text-[10px] leading-none tracking-tighter">
                      {node.code}
                    </span>
                  )
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                {cleared && (
                  <span className="w-4 h-4 rounded-sm bg-emerald-600 border border-black text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
                {secretCleared && (
                  <span
                    title="Saída secreta (Chave) concluída"
                    className="w-4 h-4 rounded-sm bg-amber-300 border border-black text-stone-950 flex items-center justify-center shrink-0"
                  >
                    <KeyRound className="w-2.5 h-2.5 stroke-[2.75]" />
                  </span>
                )}
              </button>

              {/* Node Title Tag below SMB3 square panel */}
              <span
                className={`mt-1 px-1.5 py-0.5 rounded-sm text-[9px] sm:text-[10px] font-bold whitespace-nowrap shadow-[2px_2px_0px_#000] ${
                  isSelected
                    ? 'bg-stone-950 text-amber-300 border border-amber-400'
                    : 'bg-stone-950/92 text-stone-100 border border-black'
                }`}
              >
                {node.title}
              </span>

              {/* Explicit Beta Placeholder Message directly on First Stage (2-1) of Island 2 */}
              {isLockedIsland && node.order === 0 && (
                <span className="mt-1 px-2 py-0.5 rounded bg-amber-950/95 border border-amber-400 text-[9px] sm:text-[10px] font-mono text-amber-200 whitespace-nowrap shadow-lg">
                  {node.betaPlaceholderMessage || SMW_ISLAND2_UNAVAILABLE_MSG}
                </span>
              )}
            </div>
          );
        })}

        {/* Animated Hero Duo (Lead Character + Companion Walking Along the Path) */}
        <div className="absolute inset-0 pointer-events-none select-none z-20" aria-hidden="true">
          <div
            style={{
              left: `${walkState.companionX}%`,
              top: `${walkState.companionY}%`,
              transform: `translate(-50%, calc(-100% - 18px - ${walkState.bobOffsetPx * 0.85}px))`,
            }}
            className="absolute flex flex-col items-center opacity-95"
          >
            <PixelSpriteView
              sprite={companionSprite}
              displayWidth={22}
              displayHeight={44}
              facing={walkState.companionFacing}
              className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.75)]"
            />
            <div className="w-4 h-1 rounded-full bg-black/45 -mt-0.5" />
          </div>

          <div
            style={{
              left: `${walkState.leadX}%`,
              top: `${walkState.leadY}%`,
              transform: `translate(-50%, calc(-100% - 18px - ${walkState.bobOffsetPx}px))`,
            }}
            className="absolute flex flex-col items-center"
          >
            <span className="text-[9px] font-bold leading-none text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] mb-0.5">
              ▼
            </span>
            <PixelSpriteView
              sprite={leadSprite}
              displayWidth={24}
              displayHeight={48}
              facing={walkState.leadFacing}
              className="drop-shadow-[0_3px_3px_rgba(0,0,0,0.85)]"
            />
            <div className="w-5 h-1.5 rounded-full bg-black/55 -mt-0.5" />
          </div>
        </div>

        {/* Unavailable Island Notice Banner (RW0.15.0.PW.4) */}
        {!activePlayable && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-lg px-3.5 py-2 rounded-lg bg-stone-950/92 border border-amber-400/80 text-center shadow-xl">
            <p className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Fase {activeNodes[0]?.code || '2-1'} · {SMW_ISLAND2_UNAVAILABLE_MSG}</span>
            </p>
            {island2Notice && (
              <p className="text-[10px] text-purple-200 mt-0.5">
                Explore a Ilha 1 (WikiWorldWeb) enquanto preparamos as novas fases de Chronus.
              </p>
            )}
          </div>
        )}

        {/* Switch Palace Completed Lock Toast (R1.16.O0.4) */}
        {switchLockedNotice && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-md px-3.5 py-2 rounded-lg bg-amber-950/95 border border-yellow-400 text-center shadow-xl">
            <p className="text-[11px] sm:text-xs font-bold text-yellow-200 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <span>{switchLockedNotice}</span>
            </p>
          </div>
        )}

        {/* Island Victory Celebration Toast */}
        {activePlayable && !switchLockedNotice && (islandCompleted || (finalNode && justClearedNodeId === finalNode.id)) && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-lg px-3.5 py-2 rounded-lg bg-stone-950/92 border border-amber-400/80 text-center shadow-xl">
            <p className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{finalNode?.title || 'Castelo'} conquistado! {activeIslandConfig.name} 100% salva!</span>
            </p>
            <p className="text-[10px] text-stone-300 mt-0.5">
              Salve nos Slots após o castelo ou explore outro mundo no mapa.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Selected Stage Bar */}
      <div className="px-3 sm:px-4 py-2.5 bg-stone-950 border-t border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-stone-400 font-mono">
            <span className="text-amber-300 font-bold">{selectedNode.code}</span>
            <span aria-hidden="true">·</span>
            <span>
              {!activePlayable
                ? 'Em breve'
                : selectedLockedCompleted
                ? 'Concluído (entrada encerrada)'
                : selectedCleared
                ? 'Concluída (rejogável)'
                : selectedUnlocked
                ? 'Disponível'
                : 'Bloqueada'}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-white truncate">
            {selectedNode.title}
          </p>
          <p className="text-[10px] sm:text-[11px] text-amber-200/90 truncate">
            {!activePlayable
              ? SMW_ISLAND2_UNAVAILABLE_MSG
              : selectedLockedCompleted
              ? 'Interruptor Amarelo já ativado! Não é possível jogar novamente este palácio.'
              : selectedNode.id === 'wiki-1-overworld' &&
                !progress.yellowSwitchUnlocked &&
                !progress.secretClearedNodeIds?.includes('wiki-1-overworld')
              ? `${selectedNode.subtitle} · Dica: procure o cano secreto com Chave e Fechadura para abrir o Palácio Amarelo!`
              : selectedNode.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activePlayable && clearedCount > 0 && (
            <button
              type="button"
              onClick={onResetProgress}
              title={`Reiniciar progresso de ${activeIslandConfig.name}`}
              className="min-h-[40px] px-3 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Zerar Ilha</span>
            </button>
          )}

          {!activePlayable ? (
            <button
              type="button"
              onClick={() => switchIsland(islandsList[0]?.id || 'wikiworld')}
              className="flex-1 sm:flex-initial min-h-[40px] px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-purple-400/60 text-amber-200 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{SMW_ISLAND2_UNAVAILABLE_MSG}</span>
            </button>
          ) : selectedLockedCompleted ? (
            <button
              type="button"
              disabled
              className="flex-1 sm:flex-initial min-h-[40px] px-4 sm:px-5 py-2 rounded-lg bg-stone-800 border border-yellow-500/40 text-yellow-300/80 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>PALÁCIO CONCLUÍDO</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!selectedUnlocked}
              onClick={() => enterOrWarpNode(selectedNode)}
              className={`flex-1 sm:flex-initial min-h-[40px] px-4 sm:px-5 py-2 rounded-lg text-white font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow flex items-center justify-center gap-2 cursor-pointer disabled:bg-stone-800 disabled:text-stone-500 disabled:cursor-not-allowed whitespace-nowrap shrink-0 transition ${
                isSmwPortalNode(selectedNode)
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isSmwPortalNode(selectedNode) ? (
                <>
                  <Compass className="w-3.5 h-3.5" />
                  <span>ENTRAR NO PORTAL</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>ENTRAR NA FASE</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Story Intro Modal Overlay (Beta V0.9) */}
      {showStory && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="smw-story-title"
          className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl bg-stone-900 border-2 border-amber-400 shadow-2xl p-4 sm:p-6 text-left">
            <div className="text-[11px] font-mono text-amber-300 mb-1">
              Modo World (SMB3) · {SMW_BETA_VERSION} · {activeIslandConfig.name}
            </div>
            <h3
              id="smw-story-title"
              className="font-['Press_Start_2P',monospace] text-xs sm:text-sm text-white mb-3 leading-relaxed"
            >
              HISTÓRIA DA AVENTURA
            </h3>

            <p className="text-xs sm:text-sm text-stone-100 leading-relaxed bg-stone-950/90 border border-stone-700 rounded-lg p-3.5 sm:p-4">
              {activeStory}
            </p>

            <div className="mt-3 text-[11px] text-stone-400 leading-snug">
              Fases de {activeIslandConfig.name}: {activeNodes.map(n => n.title).join(', ')}.
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowStory(false);
                  onDismissStory();
                }}
                className="min-h-[42px] px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-['Press_Start_2P',monospace] text-[10px] sm:text-xs font-bold shadow cursor-pointer whitespace-nowrap shrink-0 transition"
              >
                EXPLORAR ILHA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Castle Save & Load Progress Slots Modal (R1.16.X6.4 — No Auto-Save) */}
      {showSlotsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="smw-slots-title"
          className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-black/88 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-xl bg-stone-900 border-2 border-amber-400 shadow-2xl p-4 sm:p-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-stone-800">
              <div>
                <div className="text-[10px] font-mono text-amber-300">
                  {castleSavePromptNodeTitle && slotsModalMode === 'save'
                    ? `Castelo Concluído: ${castleSavePromptNodeTitle}`
                    : 'Modo World · Slots de Progresso Manual'}
                </div>
                <h3
                  id="smw-slots-title"
                  className="font-['Press_Start_2P',monospace] text-xs sm:text-sm text-white mt-1"
                >
                  {castleSavePromptNodeTitle && slotsModalMode === 'save'
                    ? 'SALVAR PROGRESSO?'
                    : 'CARREGAR PROGRESSO'}
                </h3>
              </div>
              {castleSavePromptNodeTitle && slotsModalMode === 'save' ? (
                <Save className="w-5 h-5 text-amber-400 shrink-0" />
              ) : (
                <FolderOpen className="w-5 h-5 text-amber-400 shrink-0" />
              )}
            </div>

            <p className="mt-2.5 text-[11px] text-stone-300 bg-stone-950/80 border border-stone-800 rounded-lg px-3 py-2">
              {castleSavePromptNodeTitle && slotsModalMode === 'save'
                ? 'Você passou pelo castelo! Escolha um Slot abaixo para salvar seu progresso atual (o salvamento automático está desativado).'
                : usedSlotsCount > 0
                ? 'Escolha um dos slots salvos para carregar seu progresso no Modo World (fases concluídas, vidas, pontuação e blocos [!]).'
                : 'Nenhum progresso salvo ainda. Conclua um castelo no Modo World para salvar em um dos slots manuais.'}
            </p>

            <div className="mt-3 space-y-2.5">
              {[0, 1, 2].map(slotIdx => {
                const slot = saveSlots[slotIdx] ?? null;
                const isSaveMode = Boolean(castleSavePromptNodeTitle && slotsModalMode === 'save');
                return (
                  <div
                    key={slotIdx}
                    className={`rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      slot
                        ? 'bg-stone-950/90 border-amber-500/50'
                        : 'bg-stone-950/50 border-stone-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-['Press_Start_2P',monospace] text-[10px] text-amber-300">
                          SLOT {slotIdx + 1}
                        </span>
                        {slot ? (
                          <span className="text-[10px] font-mono text-emerald-300">
                            {slot.clearedNodeIds.length}/{activeNodes.length} fases
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-stone-500">Vazio</span>
                        )}
                      </div>
                      {slot ? (
                        <div className="mt-1 text-[11px] text-stone-300 space-y-0.5">
                          <div className="truncate font-medium text-white">{slot.stageName}</div>
                          <div className="text-[10px] font-mono text-stone-400">
                            Vidas: {slot.lives} · Pontos: {slot.score.toLocaleString()} ·{' '}
                            {slot.yellowSwitchUnlocked ? 'Switch [!] ON' : 'Switch OFF'}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] text-stone-500">
                          Nenhum progresso gravado neste slot.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSaveMode && onSaveToSlot && (
                        <button
                          type="button"
                          onClick={() => {
                            onSaveToSlot(slotIdx);
                            onDismissCastleSave?.();
                            setShowSlotsModal(false);
                            blurActiveElement();
                          }}
                          className="min-h-[34px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{slot ? 'Sobrescrever' : 'Salvar Aqui'}</span>
                        </button>
                      )}
                      {slot && onLoadFromSlot && (
                        <button
                          type="button"
                          onClick={() => {
                            onLoadFromSlot(slotIdx);
                            onDismissCastleSave?.();
                            setShowStory(false);
                            setShowSlotsModal(false);
                            blurActiveElement();
                          }}
                          className={`min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
                            isSaveMode
                              ? 'bg-stone-800 hover:bg-amber-600 border border-amber-500/60 text-amber-200 hover:text-stone-950'
                              : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                          }`}
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Carregar</span>
                        </button>
                      )}
                      {slot && onDeleteSlot && (
                        <button
                          type="button"
                          onClick={() => onDeleteSlot(slotIdx)}
                          title={`Apagar Slot ${slotIdx + 1}`}
                          className="min-h-[34px] px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-red-900/80 border border-stone-700 text-stone-300 hover:text-red-200 text-xs cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {castleSavePromptNodeTitle && slotsModalMode === 'save' && usedSlotsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setSlotsModalMode('load')}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-amber-500/50 text-amber-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Ir para Carregar Progresso</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSlotsModal(false);
                  onDismissCastleSave?.();
                  blurActiveElement();
                }}
                className="ml-auto min-h-[38px] px-4 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-white text-xs font-medium cursor-pointer transition"
              >
                {castleSavePromptNodeTitle && slotsModalMode === 'save'
                  ? 'Continuar sem Salvar'
                  : 'Fechar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
