// Firestore removed — all methods are no-ops / stubs.

const DISPLAY_STALE_MS = 60_000;

export interface WatcherDoc {
    userId: string;
    displayName: string;
    username: string;
    profilePhoto: string | null;
    gender: string | null;
    age: number | null;
    joinedAt: Date | null;
    lastActive: Date | null;
    lastSeen?: Date | null;
}

export interface ActiveWatcher extends WatcherDoc {
    uid: string;
}

export interface JoinProfile {
    displayName: string;
    username?: string | null;
    profilePhoto?: string | null;
    gender?: string | null;
    age?: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mostRecentActivityMs(data: WatcherDoc): number {
    const lastActiveMs = data.lastActive instanceof Date ? data.lastActive.getTime() : 0;
    const lastSeenMs   = data.lastSeen instanceof Date   ? data.lastSeen.getTime()   : 0;
    return Math.max(lastActiveMs, lastSeenMs);
}

export function isViewerActive(data: WatcherDoc): boolean {
    const ms = mostRecentActivityMs(data);
    if (ms === 0) return true;
    return Date.now() - ms <= DISPLAY_STALE_MS;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class WorkoutWatcherService {
    static async join(_videoId: string, _uid: string, _p: JoinProfile): Promise<void> {
        // Firestore removed — no-op
    }

    static async heartbeat(_videoId: string, _uid: string): Promise<void> {
        // Firestore removed — no-op
    }

    static async leave(_videoId: string, _uid: string): Promise<void> {
        // Firestore removed — no-op
    }

    static async purgeStaleViewers(_videoId: string): Promise<void> {
        // Firestore removed — no-op
    }

    static subscribe(
        _videoId: string,
        onChange: (watchers: ActiveWatcher[]) => void,
        _onError?: (err: Error) => void,
    ): () => void {
        // Firestore removed — immediately emit empty list
        onChange([]);
        return () => {};
    }
}
