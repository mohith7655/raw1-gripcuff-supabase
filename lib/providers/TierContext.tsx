/**
 * TierContext — on-demand, batched lookup of any user's access tier by uid.
 *
 * The tier (users.access_type) drives the breathing ring on profile pictures
 * across the app. Most list/feed/chat surfaces only have a uid, not the tier,
 * so this provider lazily fetches access_type for requested uids in small
 * batches and caches the result. Components use `useTier(uid)`.
 */
import React, {
  createContext, useCallback, useContext, useRef, useState, useEffect,
} from 'react';
import { supabase } from '../core/config/supabase';

type TierMap = Record<string, string | null>;

interface TierContextType {
  map: TierMap;
  ensure: (uid?: string | null) => void;
}

const TierContext = createContext<TierContextType>({ map: {}, ensure: () => {} });

/** Normalise raw access_type so the four canonical tiers resolve correctly. */
const normalize = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  if (raw === 'stripe') return 'subscription';
  return raw;
};

export function TierProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<TierMap>({});
  const mapRef = useRef<TierMap>(map);
  mapRef.current = map;

  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    const ids = Array.from(pending.current);
    pending.current.clear();
    if (ids.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, access_type')
        .in('id', ids);
      if (error) { console.warn('[TierContext] fetch error:', error.message); }

      setMap((prev) => {
        const next = { ...prev };
        // Mark every requested id as resolved (null = no tier) so we don't refetch.
        ids.forEach((id) => { if (!(id in next)) next[id] = null; });
        (data ?? []).forEach((r: any) => { next[r.id] = normalize(r.access_type); });
        return next;
      });
    } catch (e) {
      console.warn('[TierContext] fetch threw:', e);
    }
  }, []);

  const ensure = useCallback((uid?: string | null) => {
    if (!uid) return;
    if (uid in mapRef.current || pending.current.has(uid)) return;
    pending.current.add(uid);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 80);
  }, [flush]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <TierContext.Provider value={{ map, ensure }}>
      {children}
    </TierContext.Provider>
  );
}

/**
 * Resolve a user's access tier by uid. Returns null until loaded (or if the
 * user has no tier). Triggers a batched fetch on first request.
 */
export function useTier(uid?: string | null): string | null {
  const { map, ensure } = useContext(TierContext);
  useEffect(() => { ensure(uid); }, [uid, ensure]);
  return uid ? (map[uid] ?? null) : null;
}
