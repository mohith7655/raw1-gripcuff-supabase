export type StrangerInviteStatus =
    | 'pending'
    | 'accepted'
    | 'declined'
    | 'expired'
    | 'cancelled';

export interface StrangerInvite {
    inviteId: string;
    inviterId: string;
    inviterUsername: string;
    inviterPhoto: string | null;
    inviterAge: number | null;
    inviterGender: string | null;
    targetUserId: string;
    workoutId: string;
    workoutTitle: string;
    workoutThumbnail: string | null;
    status: StrangerInviteStatus;
    createdAt: Date;
    expiresAt: Date;
    channelName: string;
    sessionId: string | null;
}

const INVITE_TIMEOUT_MS = 10_000; // 10 seconds

export class StrangerInviteService {
    static async createInvite(params: {
        inviterId: string;
        targetUserId: string;
        workoutId: string;
        workoutTitle: string;
        workoutThumbnail?: string | null;
    }): Promise<string> {
        return '';
    }

    static async acceptInvite(inviteId: string, acceptorUid: string): Promise<void> {}

    static async declineInvite(inviteId: string, declinerUid: string): Promise<void> {}

    static async cancelInvite(inviteId: string, cancellerUid: string): Promise<void> {}

    static async expireInvite(inviteId: string): Promise<void> {}

    static async getInvite(inviteId: string): Promise<StrangerInvite | null> {
        return null;
    }
}
