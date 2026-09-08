"use client";
import { useEffect, useState } from 'react';
import type { WorkspaceGraph } from '@/lib/character/workspace/model';
export function useCharacterSupplyGraph(characterId: string) {
  const [graph, setGraph] = useState<WorkspaceGraph | null>(null);
  useEffect(() => {
    if (!characterId) return;
    let alive = true;
    const refresh = async () => {
      try { const response = await fetch(`/api/characters/${characterId}/workspace`, { cache:'no-store' }); if (!response.ok) return; const value = await response.json(); if (alive) setGraph(value); } catch { /* Keep last verified projection while offline. */ }
    };
    void refresh(); window.addEventListener('sw:workspace-changed', refresh);
    return () => { alive = false; window.removeEventListener('sw:workspace-changed', refresh); };
  },[characterId]);
  return graph?.characterId === characterId ? graph : null;
}
