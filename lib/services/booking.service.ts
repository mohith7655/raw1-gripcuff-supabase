import {
    doc,
    setDoc,
    collection,
    Timestamp,
    increment,
    updateDoc,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { Booking } from '../models';

export class BookingService {
    /**
     * Create a new booking document in the "bookings" collection.
     */
    static async createBooking(booking: Omit<Booking, 'id' | 'createdAt'>): Promise<string> {
        try {
            const bookingRef = doc(collection(db, 'bookings'));
            const bookingData = {
                ...booking,
                date: Timestamp.fromDate(booking.date),
                creditsUsed: 1,
                createdAt: Timestamp.now(),
            };
            await setDoc(bookingRef, bookingData);
            return bookingRef.id;
        } catch (error) {
            console.error('Failed to create booking:', error);
            throw error;
        }
    }

    /**
     * Decrement the user's credits by 1 in the "users" collection.
     */
    static async decrementCredits(userId: string): Promise<void> {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                credits: increment(-1),
                updatedAt: new Date(),
            });
        } catch (error) {
            console.error('Failed to decrement credits:', error);
            throw error;
        }
    }
}
