/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Cloud,
  CloudUpload,
  FileDown,
  Globe,
  Hammer,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  UserCheck,
  X,
} from 'lucide-react';
import { signInWithGoogle, signOutGoogle, subscribeAuth } from '../firebase.ts';
import {
  COMMUNITY_DESC_MAX_LEN,
  COMMUNITY_TITLE_MAX_LEN,
  CommunityLevelRecord,
  deleteCommunityLevel,
  fetchPublishedCommunityLevels,
  subscribePublishedCommunityLevels,
  uploadJsonLevelToFirebase,
} from '../game/communityLevels.ts';
import { getExportLevelFilename, serializeLevelToFileJson } from '../game/levels.ts';
import { LevelData } from '../game/types.ts';

interface CommunityLevelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayCommunityLevel: (record: CommunityLevelRecord) => void;
  onOpenLevelEditor?: (initialLevel?: LevelData) => void;
  isEditorLocked?: boolean;
}

const THEME_BADGE: Record<
  LevelData['theme'],
  { label: string; bg: string; border: string; text: string }
> = {
  overworld: {
    label: 'Overworld',
    bg: 'bg-sky-950/90',
    border: 'border-sky-500/60',
    text: 'text-sky-300',
  },
  underground: {
    label: 'Caverna',
    bg: 'bg-stone-900',
    border: 'border-cyan-500/60',
    text: 'text-cyan-300',
  },
  underwater: {
    label: 'Água',
    bg: 'bg-blue-950/90',
    border: 'border-blue-400/60',
    text: 'text-blue-200',
  },
  ghost_house: {
    label: 'Mansão',
    bg: 'bg-purple-950/90',
    border: 'border-purple-400/60',
    text: 'text-purple-200',
  },
  castle: {
    label: 'Castelo',
    bg: 'bg-red-950/90',
    border: 'border-red-500/60',
    text: 'text-red-300',
  },
};

export const CommunityLevelsModal: React.FC<CommunityLevelsModalProps> = ({
  isOpen,
  onClose,
  onPlayCommunityLevel,
  onOpenLevelEditor,
  isEditorLocked = false,
}) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [levels, setLevels] = useState<CommunityLevelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [themeFilter, setThemeFilter] = useState<'all' | LevelData['theme']>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [uploadingJson, setUploadingJson] = useState(false);
  const [jsonDescInput, setJsonDescInput] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = subscribeAuth(user => setAuthUser(user));
    return unsub;
  }, []);

  const refreshLevels = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchPublishedCommunityLevels(50);
      setLevels(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível carregar as fases da nuvem.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setErrorMsg(null);
    const unsub = subscribePublishedCommunityLevels(
      list => {
        setLevels(list);
        setLoading(false);
      },
      err => {
        setErrorMsg(err.message || 'Erro ao sincronizar fases da comunidade.');
        setLoading(false);
      },
      50
    );
    return () => {
      unsub();
    };
  }, [isOpen]);

  const filteredLevels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return levels.filter(item => {
      if (onlyMine && authUser && item.authorUid !== authUser.uid) return false;
      if (themeFilter !== 'all' && item.theme !== themeFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.authorName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [levels, onlyMine, authUser, themeFilter, searchQuery]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoggingIn(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      setStatusMsg('Login Google conectado! Você já pode publicar fases JSON na nuvem.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao entrar com o Google.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogle();
    setOnlyMine(false);
    setStatusMsg('Você saiu da sua conta Google.');
  };

  const handleUploadJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingJson(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      if (!authUser) {
        throw new Error('Faça login com o Google antes de enviar fases JSON para o Firebase.');
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Arquivo JSON muito grande (máximo 2 MB).');
      }
      const rawText = await file.text();
      const { record } = await uploadJsonLevelToFirebase(rawText, {
        description: jsonDescInput.trim().slice(0, COMMUNITY_DESC_MAX_LEN),
      });
      setJsonDescInput('');
      setStatusMsg(`Fase "${record.title}" publicada na nuvem Firebase com sucesso!`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao publicar arquivo JSON na nuvem.');
    } finally {
      setUploadingJson(false);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  };

  const handleDownloadJson = (record: CommunityLevelRecord) => {
    const json = serializeLevelToFileJson(record.level);
    const filename = getExportLevelFilename(record.title);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMsg(`JSON baixado: ${filename}`);
  };

  const handleConfirmDelete = async (docId: string) => {
    setDeletingId(docId);
    setErrorMsg(null);
    try {
      await deleteCommunityLevel(docId);
      setPendingDeleteId(null);
      setStatusMsg('Fase removida da nuvem.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao excluir fase.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-5xl max-h-[92dvh] bg-stone-950 border-2 border-indigo-400/70 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-stone-100">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-indigo-950 via-stone-900 to-sky-950 border-b border-indigo-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <h2 className="font-['Press_Start_2P',monospace] text-xs sm:text-sm text-amber-300 leading-tight">
                MODO COMUNIDADE (NUVEM)
              </h2>
              <p className="text-[11px] text-sky-200/80 font-mono">
                Jogue fases criadas no Editor por outros jogadores ou envie seu JSON para o Firebase
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {authUser ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-stone-900/90 border border-emerald-500/50 text-xs font-mono">
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || 'Google'}
                    className="w-5 h-5 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                )}
                <span className="text-emerald-200 max-w-[120px] truncate">
                  {authUser.displayName || authUser.email?.split('@')[0]}
                </span>
                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  title="Sair da conta Google"
                  className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-red-300 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={loggingIn}
                onClick={handleGoogleSignIn}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-900 font-mono text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-600" />
                <span>{loggingIn ? 'Conectando...' : 'Entrar com Google'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
              aria-label="Fechar Modo Comunidade"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cloud Upload + Filter Bar */}
        <div className="px-4 py-2.5 bg-stone-900/90 border-b border-stone-800 flex flex-col gap-2 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value.slice(0, COMMUNITY_TITLE_MAX_LEN))}
                  placeholder="Buscar fase ou autor..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs font-mono text-stone-100 focus:border-sky-400 outline-none"
                />
              </div>

              <select
                value={themeFilter}
                onChange={e => setThemeFilter(e.target.value as 'all' | LevelData['theme'])}
                className="px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-xs font-mono text-amber-200"
              >
                <option value="all">Todos os Biomas</option>
                <option value="overworld">Overworld</option>
                <option value="underground">Caverna</option>
                <option value="underwater">Água</option>
                <option value="ghost_house">Mansão Fantasma</option>
                <option value="castle">Castelo</option>
              </select>

              {authUser && (
                <button
                  type="button"
                  onClick={() => setOnlyMine(prev => !prev)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono cursor-pointer transition ${
                    onlyMine
                      ? 'bg-emerald-900/90 border-emerald-400 text-emerald-100'
                      : 'bg-stone-950 border-stone-700 text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  Minhas Fases
                </button>
              )}

              <button
                type="button"
                onClick={refreshLevels}
                disabled={loading}
                title="Atualizar lista da nuvem"
                className="p-1.5 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-700 text-stone-300 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Direct JSON Cloud Upload + Editor */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={jsonDescInput}
                onChange={e => setJsonDescInput(e.target.value.slice(0, COMMUNITY_DESC_MAX_LEN))}
                placeholder="Nota opcional para envio JSON..."
                className="w-44 px-2 py-1.5 rounded-lg bg-stone-950 border border-stone-700 text-[11px] font-mono text-stone-200 hidden md:block"
              />
              <button
                type="button"
                disabled={uploadingJson}
                onClick={() => {
                  if (!authUser) {
                    handleGoogleSignIn();
                    return;
                  }
                  jsonInputRef.current?.click();
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 border border-indigo-400/70 text-white font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <CloudUpload className="w-3.5 h-3.5 text-amber-300" />
                <span>
                  {uploadingJson
                    ? 'Enviando...'
                    : authUser
                    ? 'Enviar JSON p/ Nuvem'
                    : 'Login Google p/ Enviar JSON'}
                </span>
              </button>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleUploadJsonFile}
                className="hidden"
              />

              {onOpenLevelEditor && !isEditorLocked && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLevelEditor();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-sky-900/90 hover:bg-sky-800 border border-sky-400/60 text-sky-100 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Hammer className="w-3.5 h-3.5 text-sky-300" />
                  <span>Criar no Editor</span>
                </button>
              )}
            </div>
          </div>

          {(errorMsg || statusMsg) && (
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${
                errorMsg
                  ? 'bg-red-950/80 border-red-500/60 text-red-200'
                  : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
              }`}
            >
              {errorMsg || statusMsg}
            </div>
          )}
        </div>

        {/* Levels Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && levels.length === 0 ? (
            <div className="py-16 text-center font-mono text-sm text-stone-400 flex flex-col items-center gap-2">
              <Cloud className="w-8 h-8 text-sky-400 animate-pulse" />
              <span>Carregando fases da nuvem Firebase...</span>
            </div>
          ) : filteredLevels.length === 0 ? (
            <div className="py-14 text-center font-mono text-xs sm:text-sm text-stone-400 flex flex-col items-center gap-3">
              <Sparkles className="w-8 h-8 text-amber-400" />
              <p>
                {levels.length === 0
                  ? 'Nenhuma fase publicada na nuvem ainda. Seja o primeiro a publicar uma fase do Editor ou JSON!'
                  : 'Nenhuma fase encontrada com os filtros atuais.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredLevels.map(record => {
                const badge = THEME_BADGE[record.theme];
                const isMine = Boolean(authUser && authUser.uid === record.authorUid);
                const confirmingDelete = pendingDeleteId === record.docId;

                return (
                  <div
                    key={record.docId}
                    className="rounded-xl bg-stone-900/95 border border-stone-700 hover:border-amber-400/70 p-3 flex flex-col justify-between gap-3 transition shadow-lg"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-['Press_Start_2P',monospace] text-[11px] text-amber-300 truncate">
                            {record.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-stone-300">
                            {record.authorPhotoUrl ? (
                              <img
                                src={record.authorPhotoUrl}
                                alt={record.authorName}
                                className="w-4 h-4 rounded-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                            <span className="truncate">{record.authorName}</span>
                            {isMine && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-[9px]">
                                SUA
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-mono shrink-0 ${badge.bg} ${badge.border} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {record.description && (
                        <p className="text-[11px] font-mono text-stone-400 line-clamp-2">
                          {record.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-stone-400">
                        <span>{record.width}×15</span>
                        {record.level.hexId && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-purple-200">
                            HEX {record.level.hexId}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-sky-300">
                          <Play className="w-3 h-3" /> {record.playsCount}
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Trophy className="w-3 h-3" /> {record.clearsCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-stone-800">
                      <button
                        type="button"
                        onClick={() => onPlayCommunityLevel(record)}
                        className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-['Press_Start_2P',monospace] text-[9px] flex items-center justify-center gap-1.5 cursor-pointer shadow"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>JOGAR</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadJson(record)}
                        title="Baixar arquivo .smb.json desta fase"
                        className="px-2 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-sky-200 font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>JSON</span>
                      </button>

                      {onOpenLevelEditor && !isEditorLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenLevelEditor(record.level);
                          }}
                          title="Abrir cópia no Editor de Fases"
                          className="px-2 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-600 text-amber-200 font-mono text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Hammer className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isMine && !confirmingDelete && (
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(record.docId)}
                          title="Excluir sua fase da nuvem"
                          className="px-2 py-2 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-500/50 text-red-200 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isMine && confirmingDelete && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={deletingId === record.docId}
                            onClick={() => handleConfirmDelete(record.docId)}
                            className="px-2 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-mono text-[10px] font-bold cursor-pointer"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="px-2 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-[10px] cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
