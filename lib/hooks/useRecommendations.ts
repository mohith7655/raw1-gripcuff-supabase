import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../core/config/firebase';
import {
    generateRecommendations,
    RecommendationSections,
} from '../services/recommendation.service';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function useRecommendations(uid: string | null | undefined) {
    const [sections, setSections] = useState<RecommendationSections | null>(null);
    const [loading, setLoading] = useState(false);

    const compute = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const result = await generateRecommendations(id);
            setSections(result);
            // Cache result to avoid re-running 5 parallel Firestore reads every mount
            setDoc(
                doc(db, 'users', id, 'recommendationCache', 'home'),
                { ...result, generatedAt: serverTimestamp() },
                { merge: false },
            ).catch(() => {});
        } catch (e) {
            console.warn('[Recommendations]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!uid) return;
        // Try cache first — avoids 5 parallel reads on every HomeScreen mount
        getDoc(doc(db, 'users', uid, 'recommendationCache', 'home'))
            .then((snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const age = Date.now() - (data.generatedAt?.toMillis?.() ?? 0);
                    if (age < CACHE_TTL_MS) {
                        setSections(data as RecommendationSections);
                        return;
                    }
                }
                compute(uid);
            })
            .catch(() => compute(uid));
    }, [uid, compute]);

    const refresh = useCallback(() => {
        if (uid) compute(uid);
    }, [uid, compute]);

    return { sections, loading, refresh };
}
