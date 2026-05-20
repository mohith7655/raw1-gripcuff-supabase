import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

type PinnedEntry = { id: string; pinnedAt: number };

interface FavoritesContextType {
    favorites: FavoriteVideo[];
    favoriteIds: Set<string>;
    pinnedIds: string[];
    isFavorite: (id: string) => boolean;
    isPinned: (id: string) => boolean;
    toggleFavorite: (video: FavoriteVideo) => Promise<void>;
    pinFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
    const { supabaseUserId } = useAuth();
    const [favorites, setFavorites] = useState<FavoriteVideo[]>([]);
    const [pinnedEntries, setPinnedEntries] = useState<PinnedEntry[]>([]);

    const storageKey = supabaseUserId ? `pinnedFavs_${supabaseUserId}` : null;

    const favoriteIds = useMemo(
        () => new Set(favorites.map((v) => v.id)),
        [favorites],
    );

    const pinnedIds = useMemo(
        () => pinnedEntries.map((e) => e.id),
        [pinnedEntries],
    );

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
                ? prev.filter((e) => e.id !== id)
                : [{ id, pinnedAt: Date.now() }, ...prev];
            savePinned(next);
            return next;
        });
    }, [savePinned]);

    useEffect(() => {
        if (!supabaseUserId) {
            setFavorites([]);
        }
    }, [supabaseUserId]);

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
            if (!supabaseUserId) {
                Alert.alert('Login required', 'Please log in to save favourites.');
                return;
            }

            const alreadyFav = favoriteIds.has(video.id);

            if (alreadyFav) {
                setFavorites(prev => prev.filter(v => v.id !== video.id));
                setPinnedEntries((prev) => {
                    const next = prev.filter((e) => e.id !== video.id);
                    savePinned(next);
                    return next;
                });
            } else {
                setFavorites(prev => [...prev, { ...video, addedAt: new Date() }]);
            }
        },
        [supabaseUserId, favoriteIds, savePinned],
    );

    const sortedFavorites = useMemo(() => {
        if (pinnedEntries.length === 0) return favorites;
        const pinnedSet = new Set(pinnedEntries.map((e) => e.id));
        const pinned = pinnedEntries
            .map((e) => favorites.find((v) => v.id === e.id))
            .filter(Boolean) as FavoriteVideo[];
        const unpinned = favorites.filter((v) => !pinnedSet.has(v.id));
        return [...pinned, ...unpinned];
    }, [favorites, pinnedEntries]);

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
