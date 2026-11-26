/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase.ts';
import {
  cloneLevelData,
  hasValidStageGoal,
  parseImportedLevelFile,
  sanitizeCustomLevelEntities,
} from './levels.ts';
import {
  BlockTile,
  CarryableKind,
  EnemyType,
  FloatingPlatformSpec,
  ItemContent,
  LevelData,
  TileType,
} from './types.ts';

export const COMMUNITY_LEVELS_COLLECTION = 'community_levels';
export const COMMUNITY_TITLE_MAX_LEN = 32;
export const COMMUNITY_DESC_MAX_LEN = 160;
export const COMMUNITY_AUTHOR_MAX_LEN = 50;
export const COMMUNITY_PHOTO_MAX_LEN = 300;
export const COMMUNITY_MAX_BLOCKS = 3600;
export const COMMUNITY_MAX_ENEMIES = 200;
export const COMMUNITY_MAX_COINS = 300;
export const COMMUNITY_MAX_WCOINS = 8;
export const COMMUNITY_MAX_PLATFORMS = 40;
export const COMMUNITY_MAX_CHECKPOINTS = 10;
export const COMMUNITY_MAX_WARPS = 24;
export const COMMUNITY_MAX_KEYHOLES = 12;
export const COMMUNITY_MAX_CARRYABLES = 20;
export const COMMUNITY_MAX_YOSHIS = 12;

const THEME_DEFAULT_BG: Record<LevelData['theme'], string> = {
  overworld: '#5c94fc',
  underground: '#000000',
  underwater: '#1044b0',
  castle: '#120808',
  ghost_house: '#140c24',
};

export interface CommunityLevelBlock {
  x: number;
  y: number;
  type: TileType;
  content: ItemContent;
  coinsLeft?: number;
  invisible?: boolean;
}

export interface CommunityLevelPayload {
  blocks: CommunityLevelBlock[];
  enemies: { type: EnemyType; x: number; y: number }[];
  coins: { x: number; y: number }[];
  wCoins: { x: number; y: number }[];
  floatingPlatforms: FloatingPlatformSpec[];
  checkpoints: { x: number; respawnPos: { x: number; y: number }; visible?: boolean }[];
  pipeWarps: {
    from: { x: number; y: number; width: number; height: number };
    toLevel: string;
    toPos: { x: number; y: number };
    type: 'down' | 'right' | 'left' | 'door';
    targetHex?: string;
    entryMode?: 'normal' | 'pipe';
    destPipeDir?: 'up' | 'down' | 'left' | 'right';
  }[];
  keyholes: { x: number; y: number }[];
  carryables: { kind: CarryableKind; x: number; y: number }[];
  yoshis: { x: number; y: number }[];
}

export interface CommunityLevelDocument {
  levelId: string;
  authorUid: string;
  authorName: string;
  authorPhotoUrl: string;
  title: string;
  description: string;
  theme: LevelData['theme'];
  width: number;
  height: number;
  bgColor: string;
  musicTrack: string;
  timeLimit: number;
  enemySpeedMultiplier: number;
  useBonusBackdrop: boolean;
  hexId: string;
  entryType: 'normal' | 'pipe';
  entryPipeDir: 'up' | 'down' | 'left' | 'right';
  marioStart: { x: number; y: number };
  flagX: number;
  castleX: number;
  dryFinishStartX: number;
  playsCount: number;
  clearsCount: number;
  published: boolean;
  levelPayload: CommunityLevelPayload;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CommunityLevelRecord {
  docId: string;
  authorUid: string;
  authorName: string;
  authorPhotoUrl: string;
  title: string;
  description: string;
  theme: LevelData['theme'];
  width: number;
  playsCount: number;
  clearsCount: number;
  createdAtMs: number;
  updatedAtMs: number;
  level: LevelData;
}

function clampNum(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  return 0;
}

export function generateCommunityLevelDocId(seedPrefix: string = 'lvl'): string {
  const cleanPrefix = seedPrefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'lvl';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${cleanPrefix}_${Date.now()}_${rand}`;
}

export function levelDataToFirestorePayload(level: LevelData): CommunityLevelPayload {
  const sanitized = sanitizeCustomLevelEntities(cloneLevelData(level)).level;
  const blocks: CommunityLevelBlock[] = [];

  for (let y = 0; y < sanitized.height && y < 15; y++) {
    const row = sanitized.tiles[y];
    if (!row) continue;
    for (let x = 0; x < sanitized.width && x < 240; x++) {
      const tile = row[x];
      if (!tile || tile.type === 'empty') continue;
      if (blocks.length >= COMMUNITY_MAX_BLOCKS) break;
      const block: CommunityLevelBlock = {
        x,
        y,
        type: tile.type,
        content: tile.content || 'none',
      };
      if (typeof tile.coinsLeft === 'number' && Number.isFinite(tile.coinsLeft) && tile.coinsLeft > 0) {
        block.coinsLeft = Math.floor(tile.coinsLeft);
      }
      if (tile.invisible === true) {
        block.invisible = true;
      }
      blocks.push(block);
    }
  }

  const enemies = (sanitized.enemies ?? []).slice(0, COMMUNITY_MAX_ENEMIES).map(e => ({
    type: e.type,
    x: Number(e.x.toFixed(2)),
    y: Number(e.y.toFixed(2)),
  }));

  const coins = (sanitized.coins ?? []).slice(0, COMMUNITY_MAX_COINS).map(c => ({
    x: Number(c.x.toFixed(2)),
    y: Number(c.y.toFixed(2)),
  }));

  const wCoins = (sanitized.wCoins ?? []).slice(0, COMMUNITY_MAX_WCOINS).map(w => ({
    x: Number(w.x.toFixed(2)),
    y: Number(w.y.toFixed(2)),
  }));

  const floatingPlatforms: FloatingPlatformSpec[] = (sanitized.floatingPlatforms ?? [])
    .slice(0, COMMUNITY_MAX_PLATFORMS)
    .map(fp => ({
      x: Number(fp.x.toFixed(2)),
      y: Number(fp.y.toFixed(2)),
      width: fp.width,
      height: fp.height ?? 10,
      axis: fp.axis,
      range: fp.range,
      speed: fp.speed,
      phase: fp.phase ?? 0,
    }));

  const checkpoints = (sanitized.checkpoints ?? []).slice(0, COMMUNITY_MAX_CHECKPOINTS).map(cp => ({
    x: Number(cp.x.toFixed(2)),
    respawnPos: {
      x: Number(cp.respawnPos.x.toFixed(2)),
      y: Number(cp.respawnPos.y.toFixed(2)),
    },
    visible: cp.visible !== false,
  }));

  const pipeWarps = (sanitized.pipeWarps ?? []).slice(0, COMMUNITY_MAX_WARPS).map(pw => {
    const warpType: 'down' | 'right' | 'left' | 'door' =
      pw.type === 'right' || pw.type === 'left' || pw.type === 'door' ? pw.type : 'down';
    const mapped: CommunityLevelPayload['pipeWarps'][number] = {
      from: {
        x: pw.from.x,
        y: pw.from.y,
        width: pw.from.width,
        height: pw.from.height,
      },
      toLevel: String(pw.toLevel || '').slice(0, 64),
      toPos: { x: pw.toPos.x, y: pw.toPos.y },
      type: warpType,
    };
    if (typeof pw.targetHex === 'string' && pw.targetHex.trim()) {
      mapped.targetHex = pw.targetHex.trim().slice(0, 8);
    }
    if (pw.entryMode === 'normal' || pw.entryMode === 'pipe') {
      mapped.entryMode = pw.entryMode;
    }
    if (
      pw.destPipeDir === 'up' ||
      pw.destPipeDir === 'down' ||
      pw.destPipeDir === 'left' ||
      pw.destPipeDir === 'right'
    ) {
      mapped.destPipeDir = pw.destPipeDir;
    }
    return mapped;
  });

  const keyholes = (sanitized.keyholes ?? []).slice(0, COMMUNITY_MAX_KEYHOLES).map(k => ({
    x: Number(k.x.toFixed(2)),
    y: Number(k.y.toFixed(2)),
  }));

  const carryables = (sanitized.carryables ?? []).slice(0, COMMUNITY_MAX_CARRYABLES).map(c => ({
    kind: c.kind,
    x: Number(c.x.toFixed(2)),
    y: Number(c.y.toFixed(2)),
  }));

  const yoshis = (sanitized.yoshis ?? []).slice(0, COMMUNITY_MAX_YOSHIS).map(y => ({
    x: Number(y.x.toFixed(2)),
    y: Number(y.y.toFixed(2)),
  }));

  return {
    blocks,
    enemies,
    coins,
    wCoins,
    floatingPlatforms,
    checkpoints,
    pipeWarps,
    keyholes,
    carryables,
    yoshis,
  };
}

export function buildCommunityLevelDocument(
  level: LevelData,
  author: { uid: string; displayName: string; photoUrl?: string },
  options: {
    levelId: string;
    description?: string;
    playsCount?: number;
    clearsCount?: number;
  }
): CommunityLevelDocument {
  const sanitized = sanitizeCustomLevelEntities(cloneLevelData(level)).level;
  const theme: LevelData['theme'] =
    sanitized.theme === 'underground' ||
    sanitized.theme === 'underwater' ||
    sanitized.theme === 'castle' ||
    sanitized.theme === 'ghost_house'
      ? sanitized.theme
      : 'overworld';

  const width = Math.floor(clampNum(sanitized.width, 20, 240, 100));
  const title = (sanitized.name || 'FASE DA COMUNIDADE')
    .trim()
    .slice(0, COMMUNITY_TITLE_MAX_LEN) || 'FASE DA COMUNIDADE';
  const description = (options.description || '')
    .trim()
    .slice(0, COMMUNITY_DESC_MAX_LEN);
  const authorName = (author.displayName || 'Jogador')
    .trim()
    .slice(0, COMMUNITY_AUTHOR_MAX_LEN) || 'Jogador';
  const authorPhotoUrl = (author.photoUrl || '').slice(0, COMMUNITY_PHOTO_MAX_LEN);
  const bgColor = (sanitized.bgColor || THEME_DEFAULT_BG[theme]).trim().slice(0, 24);
  const musicTrack = (sanitized.musicTrack || 'auto').trim().slice(0, 24);
  const timeLimit = Math.floor(clampNum(sanitized.timeLimit, 60, 999, 400));
  const enemySpeedMultiplier = Number(
    clampNum(sanitized.enemySpeedMultiplier ?? 1, 0.5, 3, 1).toFixed(2)
  );
  const hexId = (sanitized.hexId || '').trim().slice(0, 8);
  const entryType: 'normal' | 'pipe' = sanitized.entryType === 'pipe' ? 'pipe' : 'normal';
  const entryPipeDir: 'up' | 'down' | 'left' | 'right' =
    sanitized.entryPipeDir === 'down' ||
    sanitized.entryPipeDir === 'left' ||
    sanitized.entryPipeDir === 'right'
      ? sanitized.entryPipeDir
      : 'up';

  const marioStart = {
    x: clampNum(sanitized.marioStart?.x ?? 48, 0, 4000, 48),
    y: clampNum(sanitized.marioStart?.y ?? 192, 0, 240, 192),
  };
  const flagX = clampNum(sanitized.flagX ?? 999999, 0, 999999, 999999);
  const castleX = clampNum(sanitized.castleX ?? Math.max(64, (width - 6) * 16), 0, 999999, 999999);
  const dryFinishStartX =
    typeof sanitized.dryFinishStartX === 'number' && Number.isFinite(sanitized.dryFinishStartX)
      ? clampNum(sanitized.dryFinishStartX, 0, 4000, -1)
      : -1;

  return {
    levelId: options.levelId,
    authorUid: author.uid,
    authorName,
    authorPhotoUrl,
    title,
    description,
    theme,
    width,
    height: 15,
    bgColor,
    musicTrack,
    timeLimit,
    enemySpeedMultiplier,
    useBonusBackdrop: Boolean(sanitized.useBonusBackdrop),
    hexId,
    entryType,
    entryPipeDir,
    marioStart,
    flagX,
    castleX,
    dryFinishStartX,
    playsCount: Math.max(0, Math.floor(options.playsCount ?? 0)),
    clearsCount: Math.max(0, Math.floor(options.clearsCount ?? 0)),
    published: true,
    levelPayload: levelDataToFirestorePayload(sanitized),
  };
}

export function firestoreDocToCommunityLevel(
  docId: string,
  raw: Record<string, unknown>
): CommunityLevelRecord {
  const rawTheme = String(raw.theme || 'overworld') as LevelData['theme'];
  const theme: LevelData['theme'] =
    rawTheme === 'underground' ||
    rawTheme === 'underwater' ||
    rawTheme === 'castle' ||
    rawTheme === 'ghost_house'
      ? rawTheme
      : 'overworld';
  const width = Math.floor(clampNum(Number(raw.width || 100), 20, 240, 100));
  const height = 15;
  const tiles: (BlockTile | null)[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  );

  const payload = (raw.levelPayload && typeof raw.levelPayload === 'object'
    ? raw.levelPayload
    : {}) as Record<string, unknown>;

  if (Array.isArray(payload.blocks)) {
    for (const item of payload.blocks) {
      if (!item || typeof item !== 'object') continue;
      const b = item as Record<string, unknown>;
      const bx = Math.floor(Number(b.x));
      const by = Math.floor(Number(b.y));
      if (!Number.isFinite(bx) || !Number.isFinite(by)) continue;
      if (bx < 0 || bx >= width || by < 0 || by >= height) continue;
      const type = String(b.type || '') as TileType;
      if (!type || type === 'empty') continue;
      const tile: BlockTile = {
        type,
        content: (String(b.content || 'none') as ItemContent) || 'none',
        bumpOffset: 0,
        bumpVel: 0,
      };
      if (typeof b.coinsLeft === 'number' && Number.isFinite(b.coinsLeft) && b.coinsLeft > 0) {
        tile.coinsLeft = Math.floor(b.coinsLeft);
      }
      if (b.invisible === true) {
        tile.invisible = true;
      }
      tiles[by][bx] = tile;
    }
  }

  const rawStart =
    raw.marioStart && typeof raw.marioStart === 'object'
      ? (raw.marioStart as Record<string, unknown>)
      : {};
  const title = String(raw.title || 'FASE COMUNIDADE').slice(0, COMMUNITY_TITLE_MAX_LEN);
  const authorName = String(raw.authorName || 'Jogador').slice(0, COMMUNITY_AUTHOR_MAX_LEN);
  const musicTrackRaw = String(raw.musicTrack || 'auto');
  const dryFinishStartX =
    typeof raw.dryFinishStartX === 'number' && raw.dryFinishStartX >= 0
      ? raw.dryFinishStartX
      : undefined;

  const baseLevel: LevelData = {
    id: `cloud-${docId}`,
    name: title,
    theme,
    width,
    height,
    tiles,
    enemies: Array.isArray(payload.enemies)
      ? (payload.enemies as LevelData['enemies']).map(e => ({
          type: e.type,
          x: Number(e.x),
          y: Number(e.y),
        }))
      : [],
    coins: Array.isArray(payload.coins)
      ? (payload.coins as LevelData['coins']).map(c => ({
          x: Number(c.x),
          y: Number(c.y),
        }))
      : [],
    wCoins: Array.isArray(payload.wCoins)
      ? (payload.wCoins as { x: number; y: number }[]).map(w => ({
          x: Number(w.x),
          y: Number(w.y),
        }))
      : undefined,
    floatingPlatforms: Array.isArray(payload.floatingPlatforms)
      ? (payload.floatingPlatforms as FloatingPlatformSpec[]).map(fp => ({ ...fp }))
      : undefined,
    checkpoints: Array.isArray(payload.checkpoints)
      ? (payload.checkpoints as NonNullable<LevelData['checkpoints']>).map(cp => ({
          x: Number(cp.x),
          respawnPos: { x: Number(cp.respawnPos.x), y: Number(cp.respawnPos.y) },
          visible: cp.visible !== false,
        }))
      : undefined,
    pipeWarps: Array.isArray(payload.pipeWarps)
      ? (payload.pipeWarps as Record<string, unknown>[]).map(rawPw => {
          const fromObj = (rawPw.from && typeof rawPw.from === 'object' ? rawPw.from : {}) as Record<string, unknown>;
          const toPosObj = (rawPw.toPos && typeof rawPw.toPos === 'object' ? rawPw.toPos : {}) as Record<string, unknown>;
          const rawType = rawPw.type;
          const warpType: 'down' | 'right' | 'left' | 'door' =
            rawType === 'right' || rawType === 'left' || rawType === 'door' ? rawType : 'down';
          const rawToLevel = String(rawPw.toLevel || '');
          const entry: NonNullable<LevelData['pipeWarps']>[number] = {
            from: {
              x: Number(fromObj.x ?? 0),
              y: Number(fromObj.y ?? 0),
              width: Number(fromObj.width ?? 16),
              height: Number(fromObj.height ?? 16),
            },
            toLevel: rawToLevel === String(raw.levelId) ? `cloud-${docId}` : rawToLevel,
            toPos: {
              x: Number(toPosObj.x ?? 0),
              y: Number(toPosObj.y ?? 0),
            },
            type: warpType,
          };
          if (typeof rawPw.targetHex === 'string' && rawPw.targetHex.trim()) {
            entry.targetHex = rawPw.targetHex.trim();
          }
          if (rawPw.entryMode === 'normal' || rawPw.entryMode === 'pipe') {
            entry.entryMode = rawPw.entryMode;
          }
          if (
            rawPw.destPipeDir === 'up' ||
            rawPw.destPipeDir === 'down' ||
            rawPw.destPipeDir === 'left' ||
            rawPw.destPipeDir === 'right'
          ) {
            entry.destPipeDir = rawPw.destPipeDir;
          }
          return entry;
        })
      : undefined,
    keyholes: Array.isArray(payload.keyholes)
      ? (payload.keyholes as { x: number; y: number }[]).map(k => ({
          x: Number(k.x),
          y: Number(k.y),
        }))
      : undefined,
    carryables: Array.isArray(payload.carryables)
      ? (payload.carryables as NonNullable<LevelData['carryables']>).map(c => ({
          kind: c.kind,
          x: Number(c.x),
          y: Number(c.y),
        }))
      : undefined,
    yoshis: Array.isArray(payload.yoshis)
      ? (payload.yoshis as { x: number; y: number }[]).map(y => ({
          x: Number(y.x),
          y: Number(y.y),
        }))
      : undefined,
    marioStart: {
      x: clampNum(Number(rawStart.x ?? 48), 0, (width - 2) * 16, 48),
      y: clampNum(Number(rawStart.y ?? 192), 0, (height - 2) * 16, 192),
    },
    flagX: clampNum(Number(raw.flagX ?? 999999), 0, 999999, 999999),
    castleX: clampNum(Number(raw.castleX ?? Math.max(64, (width - 6) * 16)), 0, 999999, Math.max(64, (width - 6) * 16)),
    dryFinishStartX,
    bgColor: String(raw.bgColor || THEME_DEFAULT_BG[theme]),
    musicTrack:
      musicTrackRaw !== 'auto'
        ? (musicTrackRaw as LevelData['musicTrack'])
        : undefined,
    timeLimit: Math.floor(clampNum(Number(raw.timeLimit ?? 400), 60, 999, 400)),
    enemySpeedMultiplier: clampNum(Number(raw.enemySpeedMultiplier ?? 1), 0.5, 3, 1),
    useBonusBackdrop: Boolean(raw.useBonusBackdrop),
    hexId: typeof raw.hexId === 'string' && raw.hexId.trim() ? raw.hexId.trim() : undefined,
    entryType: raw.entryType === 'pipe' ? 'pipe' : 'normal',
    entryPipeDir:
      raw.entryPipeDir === 'down' || raw.entryPipeDir === 'left' || raw.entryPipeDir === 'right'
        ? raw.entryPipeDir
        : 'up',
    biomeLabel: `COMUNIDADE · ${authorName.toUpperCase().slice(0, 14)}`,
    isCustom: true,
  };

  const sanitized = sanitizeCustomLevelEntities(baseLevel).level;
  return {
    docId,
    authorUid: String(raw.authorUid || ''),
    authorName,
    authorPhotoUrl: String(raw.authorPhotoUrl || ''),
    title,
    description: String(raw.description || '').slice(0, COMMUNITY_DESC_MAX_LEN),
    theme,
    width,
    playsCount: Math.max(0, Math.floor(Number(raw.playsCount ?? 0))),
    clearsCount: Math.max(0, Math.floor(Number(raw.clearsCount ?? 0))),
    createdAtMs: timestampToMs(raw.createdAt),
    updatedAtMs: timestampToMs(raw.updatedAt),
    level: sanitized,
  };
}

export async function uploadLevelToFirebase(
  level: LevelData,
  options?: { description?: string; titleOverride?: string }
): Promise<CommunityLevelRecord> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Faça login com sua conta Google antes de enviar fases para a nuvem.');
  }

  const preparedInput = cloneLevelData(level);
  if (options?.titleOverride && options.titleOverride.trim()) {
    preparedInput.name = options.titleOverride.trim().toUpperCase().slice(0, COMMUNITY_TITLE_MAX_LEN);
  }
  const sanitized = sanitizeCustomLevelEntities(preparedInput).level;
  if (!hasValidStageGoal(sanitized)) {
    throw new Error(
      'A fase precisa de um objetivo de fim (Bandeira, Castelo/Machado, Fechadura ou Saída) antes de ser publicada na nuvem.'
    );
  }

  const levelId = generateCommunityLevelDocId('lvl');
  const docPath = `${COMMUNITY_LEVELS_COLLECTION}/${levelId}`;
  const payload = buildCommunityLevelDocument(
    sanitized,
    {
      uid: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Jogador',
      photoUrl: user.photoURL || '',
    },
    {
      levelId,
      description: options?.description || '',
      playsCount: 0,
      clearsCount: 0,
    }
  );

  try {
    await setDoc(doc(db, COMMUNITY_LEVELS_COLLECTION, levelId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const now = Date.now();
    return firestoreDocToCommunityLevel(levelId, {
      ...payload,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function uploadJsonLevelToFirebase(
  rawJson: string,
  options?: { description?: string; titleOverride?: string }
): Promise<{ record: CommunityLevelRecord; parsedLevel: LevelData }> {
  const parsedLevel = parseImportedLevelFile(rawJson);
  const record = await uploadLevelToFirebase(parsedLevel, options);
  return { record, parsedLevel };
}

export async function fetchPublishedCommunityLevels(maxResults: number = 40): Promise<CommunityLevelRecord[]> {
  try {
    const q = query(
      collection(db, COMMUNITY_LEVELS_COLLECTION),
      where('published', '==', true),
      limit(maxResults)
    );
    const snap = await getDocs(q);
    const records = snap.docs.map(d =>
      firestoreDocToCommunityLevel(d.id, d.data() as Record<string, unknown>)
    );
    records.sort((a, b) => b.createdAtMs - a.createdAtMs || b.updatedAtMs - a.updatedAtMs);
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COMMUNITY_LEVELS_COLLECTION);
  }
}

export function subscribePublishedCommunityLevels(
  onLevels: (levels: CommunityLevelRecord[]) => void,
  onError?: (err: Error) => void,
  maxResults: number = 40
): () => void {
  const q = query(
    collection(db, COMMUNITY_LEVELS_COLLECTION),
    where('published', '==', true),
    limit(maxResults)
  );
  return onSnapshot(
    q,
    snapshot => {
      const records = snapshot.docs.map(d =>
        firestoreDocToCommunityLevel(d.id, d.data() as Record<string, unknown>)
      );
      records.sort((a, b) => b.createdAtMs - a.createdAtMs || b.updatedAtMs - a.updatedAtMs);
      onLevels(records);
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.LIST, COMMUNITY_LEVELS_COLLECTION);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function deleteCommunityLevel(docId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Faça login com sua conta Google para excluir suas fases.');
  }
  const path = `${COMMUNITY_LEVELS_COLLECTION}/${docId}`;
  try {
    await deleteDoc(doc(db, COMMUNITY_LEVELS_COLLECTION, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function recordCommunityLevelPlay(docId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.emailVerified === false) return;
  const path = `${COMMUNITY_LEVELS_COLLECTION}/${docId}`;
  try {
    await updateDoc(doc(db, COMMUNITY_LEVELS_COLLECTION, docId), {
      playsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Falha ao registrar jogada na fase da comunidade:', path, error);
  }
}

export async function recordCommunityLevelClear(docId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.emailVerified === false) return;
  const path = `${COMMUNITY_LEVELS_COLLECTION}/${docId}`;
  try {
    await updateDoc(doc(db, COMMUNITY_LEVELS_COLLECTION, docId), {
      clearsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Falha ao registrar conclusão da fase da comunidade:', path, error);
  }
}
