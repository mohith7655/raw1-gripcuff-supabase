import { Booking } from '../models';

export class BookingService {
    /**
     * Create a new booking document.
     */
    static async createBooking(booking: Omit<Booking, 'id' | 'createdAt'>): Promise<string> {
        return '';
    }

    /**
     * Decrement the user's credits by 1.
     */
    static async decrementCredits(userId: string): Promise<void> {}
}
