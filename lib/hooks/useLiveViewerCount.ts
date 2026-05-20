import { useEffect, useState } from 'react';

export type LiveViewer = {
  uid: string;
  displayName: string;
  joinedAt: Date | null;
  lastSeen: Date | null;
};

export type LiveViewerResult = {
  count: number;
  viewers: LiveViewer[];
};

/**
 * Tracks live viewer presence.
 * Returns count and list of active viewers.
 */
export function useLiveViewerCount(
  videoId: string | null | undefined,
  userId: string | null | undefined,
  displayName?: string | null,
): LiveViewerResult {
  return { count: 0, viewers: [] };
}
