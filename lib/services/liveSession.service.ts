export interface LiveSession {
    id: string;
    hostUid: string;
    guestUid: string;
    hostName: string;
    guestName: string;
    hostAvatarUrl: string | null;
    guestAvatarUrl: string | null;
    videoId: string;
    videoTitle: string;
    isLive: boolean;
    liveStartedAt: Date | null;
}

export interface JoinRequest {
    id: string;
    sessionId: string;
    requesterId: string;
    requesterName: string;
    requesterAvatar: string | null;
    status: 'pending' | 'allowed' | 'denied';
    createdAt: Date;
}

export class LiveSessionService {
    static async markLive(sessionId: string): Promise<void> {}

    static async markEnded(sessionId: string): Promise<void> {}

    static subscribeLiveSessions(
        callback: (sessions: LiveSession[]) => void
    ): () => void {
        callback([]);
        return () => {};
    }

    static async requestToJoin(
        sessionId: string,
        requester: { uid: string; name: string; avatarUrl: string | null }
    ): Promise<string> {
        return '';
    }

    static async respondToJoinRequest(
        sessionId: string,
        requestId: string,
        response: 'allowed' | 'denied'
    ): Promise<void> {}

    static subscribeToJoinRequests(
        sessionId: string,
        callback: (requests: JoinRequest[]) => void
    ): () => void {
        callback([]);
        return () => {};
    }

    static subscribeMyJoinRequest(
        sessionId: string,
        requestId: string,
        callback: (status: string) => void
    ): () => void {
        return () => {};
    }
}
