export interface Booking {
    id?: string;
    userId: string;
    coach: string;
    date: Date;
    timeSlot: string;
    sessionType: 'Online' | 'In-Person';
    notes: string;
    creditsUsed: number;
    createdAt: Date;
}
