import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { useAuth } from './AuthContext';

export type FavoriteVideo = {
    id: string;
    title: string;
    duration: number | string;
    category?: string;
    difficulty?: string;
    videoUrl?: string;
    isCompleted?: boolean;
    thumbnail?: string;
    type?: string;
    addedAt?: any;
};

// { id, pinnedAt } ordered most-recently-pinned first
type PinnedEntry = { id: string; pinnedAt: number };

interface FavoritesContextType {
    favorites: FavoriteVideo[];
    favoriteIds: Set<string>;
    pinnedIds: string[];           // ordered: most recent pin first
    isFavorite: (id: string) => boolean;
    isPinned: (id: string) => boolean;
    toggleFavorite: (video: FavoriteVideo) => Promise<void>;
    pinFavorite: (id: string) => void;   // toggles pin on/off
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
    const { firebaseUid } = useAuth();
    const [favorites, setFavorites] = useState<FavoriteVideo[]>([]);
    // Array of { id, pinnedAt } — most recently pinned first
    const [pinnedEntries, setPinnedEntries] = useState<PinnedEntry[]>([]);

    const storageKey = firebaseUid ? `pinnedFavs_${firebaseUid}` : null;

    // Derived set of IDs for O(1) lookups — stable reference when contents are the same
    const favoriteIds = useMemo(
        () => new Set(favorites.map((v) => v.id)),
        [favorites],
    );

    const pinnedIds = useMemo(
        () => pinnedEntries.map((e) => e.id),
        [pinnedEntries],
    );

    // Load pinned list from AsyncStorage when user changes
    useEffect(() => {
        if (!storageKey) { setPinnedEntries([]); return; }
        AsyncStorage.getItem(storageKey)
            .then((val) => {
                if (val) setPinnedEntries(JSON.parse(val));
            })
            .catch(() => {});
    }, [storageKey]);

    const savePinned = useCallback((entries: PinnedEntry[]) => {
        if (!storageKey) return;
        AsyncStorage.setItem(storageKey, JSON.stringify(entries)).catch(() => {});
    }, [storageKey]);

    const pinFavorite = useCallback((id: string) => {
        setPinnedEntries((prev) => {
            const alreadyPinned = prev.some((e) => e.id === id);
            const next = alreadyPinned
                ? prev.filter((e) => e.id !== id)                       // unpin
                : [{ id, pinnedAt: Date.now() }, ...prev];              // pin — prepend so it's first
            savePinned(next);
            return next;
        });
    }, [savePinned]);

    // Real-time Firestore listener — single source of truth
    useEffect(() => {
        if (!firebaseUid) {
            setFavorites([]);
            return;
        }

        const colRef = collection(db, 'users', firebaseUid, 'favourites');
        const unsubscribe = onSnapshot(
            colRef,
            (snapshot) => {
                const normalizeCategory = (category?: string) => {
                    if (!category) return category;
                    const map: Record<string, string> = {
                        'Muscle Growth': 'MuscleGrowth',
                        'Athletic Performance': 'AthleticPerformance',
                        'Injury Rehab': 'InjuryRehab',
                    };
                    return map[category] ?? category;
                };

                const items: FavoriteVideo[] = snapshot.docs.map((d) => ({
                    ...d.data(),
                    id: String(d.id),
                    category: normalizeCategory((d.data() as any).category),
                } as FavoriteVideo));
                setFavorites(items);
            },
            (error) => {
                console.warn('Favourites listener error:', error);
            },
        );

        return () => unsubscribe();
    }, [firebaseUid]);

    const isFavorite = useCallback(
        (id: string) => favoriteIds.has(id),
        [favoriteIds],
    );

    const isPinned = useCallback(
        (id: string) => pinnedEntries.some((e) => e.id === id),
        [pinnedEntries],
    );

    const toggleFavorite = useCallback(
        async (video: FavoriteVideo) => {
            if (!firebaseUid) {
                Alert.alert('Login required', 'Please log in to save favourites.');
                return;
            }

            const uid = firebaseUid;
            const docRef = doc(db, 'users', uid, 'favourites', video.id);
            const alreadyFav = favoriteIds.has(video.id);

            try {
                if (alreadyFav) {
                    await deleteDoc(docRef);
                    // Remove from pinned if it was pinned
                    setPinnedEntries((prev) => {
                        const next = prev.filter((e) => e.id !== video.id);
                        savePinned(next);
                        return next;
                    });
                } else {
                    await setDoc(docRef, {
                        id: video.id,
                        title: video.title,
                        duration: video.duration ?? '',
                        category: video.category ?? null,
                        difficulty: video.difficulty ?? null,
                        videoUrl: video.videoUrl ?? null,
                        thumbnail: video.thumbnail ?? null,
                        type: video.type ?? 'video',
                        addedAt: serverTimestamp(),
                    });
                }
            } catch (error: any) {
                console.warn('Favourite toggle failed:', error);
                Alert.alert('Error', 'Could not update favourite. Please try again.');
            }
        },
        [firebaseUid, favoriteIds, savePinned],
    );

    // Pinned items first (ordered most-recently-pinned), then the rest
    const sortedFavorites = useMemo(() => {
        if (pinnedEntries.length === 0) return favorites;
        const pinnedSet = new Set(pinnedEntries.map((e) => e.id));
        const pinned = pinnedEntries
            .map((e) => favorites.find((v) => v.id === e.id))
            .filter(Boolean) as FavoriteVideo[];
        const unpinned = favorites.filter((v) => !pinnedSet.has(v.id));
        return [...pinned, ...unpinned];
    }, [favorites, pinnedEntries]);

    // Memoize context value so consumers only re-render when data actually changes
    const contextValue = useMemo<FavoritesContextType>(
        () => ({ favorites: sortedFavorites, favoriteIds, pinnedIds, isFavorite, isPinned, toggleFavorite, pinFavorite }),
        [sortedFavorites, favoriteIds, pinnedIds, isFavorite, isPinned, toggleFavorite, pinFavorite],
    );

    return (
        <FavoritesContext.Provider value={contextValue}>
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites() {
    const context = useContext(FavoritesContext);
    if (!context) throw new Error('useFavorites must be used within FavoritesProvider');
    return context;
}
