import { useState, useEffect, useCallback } from 'react';
import {
    generateRecommendations,
    RecommendationSections,
} from '../services/recommendation.service';

export function useRecommendations(uid: string | null | undefined) {
    const [sections, setSections] = useState<RecommendationSections | null>(null);
    const [loading, setLoading] = useState(false);

    const compute = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const result = await generateRecommendations(id);
            setSections(result);
        } catch (e) {
            console.warn('[Recommendations]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!uid) return;
        compute(uid);
    }, [uid, compute]);

    const refresh = useCallback(() => {
        if (uid) compute(uid);
    }, [uid, compute]);

    return { sections, loading, refresh };
}
