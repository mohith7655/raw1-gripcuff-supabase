export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
    id: string;
    fromUid: string;
    toUid: string;
    status: FriendRequestStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface Friend {
    id: string;       // "{uid1}_{uid2}" sorted alphabetically
    uids: string[];   // both user uids
    createdAt: Date;
}

export type RelationshipStatus =
    | 'none'
    | 'pending_sent'
    | 'pending_received'
    | 'friends';
