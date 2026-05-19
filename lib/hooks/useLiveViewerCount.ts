import { useEffect, useState, useRef } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';

export type LiveViewer = {
  uid: string;
  displayName: string;
  joinedAt: Timestamp | null;
  lastSeen: Timestamp | null;
};

export type LiveViewerResult = {
  count: number;
  viewers: LiveViewer[];
};

// Viewer doc older than this is treated as stale (crashed / navigated away without cleanup)
const STALE_MS = 60_000;
// How often we write lastSeen while watching
const HEARTBEAT_MS = 30_000;

/**
 * Tracks live viewer presence using Firestore.
 *
 * Collection: liveViewers/{videoId}/viewers/{uid}
 * Fields: { uid, displayName, joinedAt, lastSeen }
 *
 * Count = number of docs whose lastSeen is within the last 60 s.
 * A 30-second heartbeat keeps the current user's doc fresh.
 * The doc is deleted on clean unmount.
 *
 * @param videoId     - Stream/video identifier. Pass null/undefined to skip entirely.
 * @param userId      - Firebase Auth UID (NOT Agora UID). Pass null to skip presence write but still listen.
 * @param displayName - Display name to store in the viewer doc.
 */
export function useLiveViewerCount(
  videoId: string | null | undefined,
  userId: string | null | undefined,
  displayName?: string | null,
): LiveViewerResult {
  const [result, setResult] = useState<LiveViewerResult>({ count: 0, viewers: [] });
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!videoId) return;

    const viewersCol = collection(db, 'liveViewers', videoId, 'viewers');

    // Real-time listener — filters out stale docs client-side
    const unsubscribe = onSnapshot(viewersCol, (snapshot) => {
      const now = Date.now();
      const active: LiveViewer[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as Omit<LiveViewer, 'uid'>;
        const lastSeen = data.lastSeen as Timestamp | null | undefined;

        if (lastSeen != null) {
          // Only include docs updated within the stale threshold
          if (now - (lastSeen.toMillis?.() ?? 0) <= STALE_MS) {
            active.push({ uid: docSnap.id, ...data });
          }
        } else {
          // lastSeen is null/undefined when serverTimestamp() hasn't resolved yet —
          // include the doc optimistically so count doesn't flicker to 0 on join.
          active.push({ uid: docSnap.id, ...data });
        }
      });

      setResult({ count: active.length, viewers: active });
    });

    if (!userId) return () => unsubscribe();

    const viewerRef = doc(db, 'liveViewers', videoId, 'viewers', userId);
    const name = displayName || 'Viewer';

    // Write / overwrite presence (overwrites any stale doc from a previous crash)
    setDoc(viewerRef, {
      uid: userId,
      displayName: name,
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    }).catch(() => {});

    // Keep lastSeen fresh so we don't get filtered as stale
    heartbeatRef.current = setInterval(() => {
      setDoc(viewerRef, { lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    }, HEARTBEAT_MS);

    return () => {
      unsubscribe();
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      deleteDoc(viewerRef).catch(() => {});
    };
  }, [videoId, userId, displayName]);

  return result;
}
