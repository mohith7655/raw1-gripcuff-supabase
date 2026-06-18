/**
 * MiniPlayerContext — global "picture-in-picture" mini player state.
 *
 * When the user swipes the video player down, VideoPlayerScreen hands the video
 * off here (URL + current position + the params needed to re-open it full) and
 * pops itself off the stack. The <MiniPlayer /> overlay (rendered above the
 * navigator in App) then keeps the video playing in a small floating box at the
 * bottom-right, just like YouTube mobile. Tapping it re-opens the full player at
 * the saved position; the ✕ closes it.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface MiniPlayerPayload {
  videoUrl: string;
  title: string;
  positionMs: number;
  /** Route params used to re-open the full VideoPlayer screen on expand. */
  expandParams: Record<string, any>;
}

interface MiniPlayerCtx {
  mini: MiniPlayerPayload | null;
  openMini: (payload: MiniPlayerPayload) => void;
  closeMini: () => void;
}

const Ctx = createContext<MiniPlayerCtx>({
  mini: null,
  openMini: () => {},
  closeMini: () => {},
});

export const useMiniPlayer = () => useContext(Ctx);

export function MiniPlayerProvider({ children }: { children: React.ReactNode }) {
  const [mini, setMini] = useState<MiniPlayerPayload | null>(null);
  const openMini = useCallback((payload: MiniPlayerPayload) => setMini(payload), []);
  const closeMini = useCallback(() => setMini(null), []);
  const value = useMemo(() => ({ mini, openMini, closeMini }), [mini, openMini, closeMini]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
