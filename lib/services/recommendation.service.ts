import { collection, getDocs } from 'firebase/firestore';
import { getGlobalEngagementBoosts } from './videoEngagement.service';
import { db } from '../core/config/firebase';
import {
    PreRecordedProgram,
    ProgramCategoryKey,
    getAllPrograms,
    getProgramByVideoId,
    getProgramCategoryKey,
} from '../data/preRecordedPrograms';

// ── Scoring weights ────────────────────────────────────────────────────────────
const W = {
    FAVORITE: 15,
    WANT_TO_TRY: 20,
    LIKED: 10,
    COMPLETED: 12,
    WATCHED: 3,
    DISLIKED: -25,
};

// ── Category display metadata ──────────────────────────────────────────────────
export const CAT_META: Record<string, { label: string; emoji: string; color: string }> = {
    MuscleGrowth: { label: 'Muscle Growth', emoji: '💪', color: '#0f2a45' },
    Stretching: { label: 'Stretching', emoji: '🧘', color: '#0f2a1a' },
    AthleticPerformance: { label: 'Athletic Performance', emoji: '🏃', color: '#1e0f2e' },
    InjuryRehab: { label: 'Injury Rehab', emoji: '🩹', color: '#2a1010' },
};

// Normalize "Muscle Growth" → "MuscleGrowth" etc.
function normCat(raw?: string | null): string | null {
    if (!raw) return null;
    return raw.replace(/\s+/g, '');
}

// ── Internal types ─────────────────────────────────────────────────────────────
interface UserProfile {
    catScores: Record<string, number>;
    diffScores: Record<string, number>;
    watchedProgramIds: Set<string>;
    dislikedProgramIds: Set<string>;
    tryProgramIds: Set<string>;
    topCategory: ProgramCategoryKey | null;
    topDifficulty: string | null;
    totalInteractions: number;
}

// ── Public types ───────────────────────────────────────────────────────────────
export interface RecommendedProgram {
    programId: string;
    categoryKey: string;
    categoryLabel: string;
    categoryEmoji: string;
    categoryColor: string;
    title: string;
    coachName: string;
    level: string;
    focus: string;
    firstVideoId: string;
    firstVideoUrl: string;
    totalVideos: number;
    score: number;
    reason: string;
}

export interface RecommendationSections {
    forYou: RecommendedProgram[];
    becauseLiked: { label: string; items: RecommendedProgram[] } | null;
    wantToTry: RecommendedProgram[] | null;
    trendingInCategory: { label: string; items: RecommendedProgram[] } | null;
    hasData: boolean;
}

// ── Build user preference profile ─────────────────────────────────────────────
async function buildUserProfile(uid: string): Promise<UserProfile> {
    const [intSnap, favsSnap, trySnap, histSnap, analyticsSnap] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'videoInteractions')),
        getDocs(collection(db, 'users', uid, 'favourites')),
        getDocs(collection(db, 'users', uid, 'tryList')),
        getDocs(collection(db, 'users', uid, 'watchHistory')),
        getDocs(collection(db, 'users', uid, 'videoAnalytics')),
    ]);

    const catScores: Record<string, number> = {};
    const diffScores: Record<string, number> = {};
    const watchedProgramIds = new Set<string>();
    const dislikedProgramIds = new Set<string>();
    const tryProgramIds = new Set<string>();
    let totalInteractions = 0;

    const addCat = (cat: string | null | undefined, delta: number) => {
        if (!cat) return;
        catScores[cat] = (catScores[cat] ?? 0) + delta;
    };
    const addDiff = (diff: string | null | undefined, delta: number) => {
        if (!diff) return;
        diffScores[diff] = (diffScores[diff] ?? 0) + delta;
    };

    // videoInteractions: likes / dislikes / tryIntent
    intSnap.docs.forEach((d) => {
        const data = d.data();
        const prog = getProgramByVideoId(d.id);
        const catKey = prog ? getProgramCategoryKey(prog.id) : null;
        if (data.liked) {
            addCat(catKey, W.LIKED);
            addDiff(prog?.level, W.LIKED);
            totalInteractions++;
        }
        if (data.disliked) {
            addCat(catKey, W.DISLIKED);
            if (prog) dislikedProgramIds.add(prog.id);
            totalInteractions++;
        }
        if (data.tryIntent && prog) {
            tryProgramIds.add(prog.id);
        }
    });

    // favourites (strong signal, category stored as normalized key)
    favsSnap.docs.forEach((d) => {
        const data = d.data();
        const cat = normCat(data.category) ?? data.category;
        addCat(cat, W.FAVORITE);
        addDiff(data.difficulty, W.FAVORITE);
        totalInteractions++;
    });

    // tryList (high intent)
    trySnap.docs.forEach((d) => {
        const data = d.data();
        const prog = getProgramByVideoId(d.id);
        const catKey = prog ? getProgramCategoryKey(prog.id) : normCat(data.category);
        addCat(catKey, W.WANT_TO_TRY);
        addDiff(data.difficulty, W.WANT_TO_TRY);
        if (prog) tryProgramIds.add(prog.id);
        totalInteractions++;
    });

    // watchHistory (weak positive signal)
    histSnap.docs.forEach((d) => {
        const data = d.data();
        const prog = getProgramByVideoId(d.id);
        const catKey = prog ? getProgramCategoryKey(prog.id) : normCat(data.category);
        addCat(catKey, W.WATCHED);
        if (prog) watchedProgramIds.add(prog.id);
    });

    // videoAnalytics (completions boost the category)
    analyticsSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.completed) {
            const prog = getProgramByVideoId(d.id);
            const catKey = prog ? getProgramCategoryKey(prog.id) : null;
            addCat(catKey, W.COMPLETED);
            addDiff(prog?.level, W.COMPLETED);
            if (prog) watchedProgramIds.add(prog.id);
        }
    });

    const topCategory =
        (Object.entries(catScores).sort((a, b) => b[1] - a[1])[0]?.[0] as ProgramCategoryKey) ??
        null;
    const topDifficulty =
        Object.entries(diffScores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
        catScores,
        diffScores,
        watchedProgramIds,
        dislikedProgramIds,
        tryProgramIds,
        topCategory,
        topDifficulty,
        totalInteractions,
    };
}

// ── Convert program → UI-ready object ─────────────────────────────────────────
function toRecommended(
    prog: PreRecordedProgram,
    catKey: string,
    score: number,
    reason: string,
): RecommendedProgram {
    const meta = CAT_META[catKey] ?? { label: catKey, emoji: '🏋️', color: '#1a2a3a' };
    return {
        programId: prog.id,
        categoryKey: catKey,
        categoryLabel: meta.label,
        categoryEmoji: meta.emoji,
        categoryColor: meta.color,
        title: prog.title,
        coachName: prog.coachName,
        level: prog.level,
        focus: prog.focus,
        firstVideoId: prog.videos[0].id,
        firstVideoUrl: prog.videos[0].videoUrl,
        totalVideos: prog.videos.length,
        score,
        reason,
    };
}

// ── Main recommendation engine ─────────────────────────────────────────────────
export async function generateRecommendations(uid: string): Promise<RecommendationSections> {
    const profile = await buildUserProfile(uid);

    if (profile.totalInteractions < 1) {
        return {
            forYou: [],
            becauseLiked: null,
            wantToTry: null,
            trendingInCategory: null,
            hasData: false,
        };
    }

    const allPrograms = getAllPrograms();

    // Fetch global engagement boosts (capped at +15 per program, non-fatal)
    const globalBoosts = await getGlobalEngagementBoosts(
        allPrograms.map((p) => p.videos[0].id),
    ).catch(() => ({} as Record<string, number>));

    // Score every program
    const scored = allPrograms
        .map((prog) => {
            const catKey = getProgramCategoryKey(prog.id);
            if (!catKey) return null;
            const catScore = profile.catScores[catKey] ?? 0;
            const diffScore = profile.diffScores[prog.level] ?? 0;
            const tryBoost = profile.tryProgramIds.has(prog.id) ? 10 : 0;
            const watchedPenalty = profile.watchedProgramIds.has(prog.id) ? -40 : 0;
            const dislikedPenalty = profile.dislikedProgramIds.has(prog.id) ? -100 : 0;
            const popularityBoost = globalBoosts[prog.videos[0].id] ?? 0;
            const score = catScore + diffScore * 0.5 + tryBoost + watchedPenalty + dislikedPenalty + popularityBoost;
            return { prog, catKey, score };
        })
        .filter(
            (x): x is { prog: PreRecordedProgram; catKey: string; score: number } => x !== null,
        )
        .sort((a, b) => b.score - a.score);

    // 🔥 Recommended For You
    const forYou = scored
        .filter((s) => s.score > 0 && !profile.watchedProgramIds.has(s.prog.id))
        .slice(0, 8)
        .map((s) => toRecommended(s.prog, s.catKey, s.score, 'Recommended for you'));

    // 💪 Because You Liked [Top Category]
    let becauseLiked: RecommendationSections['becauseLiked'] = null;
    if (profile.topCategory) {
        const label = CAT_META[profile.topCategory]?.label ?? profile.topCategory;
        const items = scored
            .filter(
                (s) =>
                    s.catKey === profile.topCategory &&
                    !profile.dislikedProgramIds.has(s.prog.id),
            )
            .slice(0, 6)
            .map((s) => toRecommended(s.prog, s.catKey, s.score, `Because you liked ${label}`));
        if (items.length > 0) becauseLiked = { label, items };
    }

    // ⚡ Based On What You Want To Try
    let wantToTry: RecommendationSections['wantToTry'] = null;
    if (profile.tryProgramIds.size > 0) {
        const tryCategories = new Set<string>();
        profile.tryProgramIds.forEach((pId) => {
            const catKey = getProgramCategoryKey(pId);
            if (catKey) tryCategories.add(catKey);
        });
        const items = scored
            .filter(
                (s) =>
                    tryCategories.has(s.catKey) && !profile.tryProgramIds.has(s.prog.id),
            )
            .slice(0, 6)
            .map((s) =>
                toRecommended(s.prog, s.catKey, s.score, 'Based on what you want to try'),
            );
        if (items.length > 0) wantToTry = items;
    }

    // 📈 Popular In [Top Category] — ordered Beginner → Advanced
    let trendingInCategory: RecommendationSections['trendingInCategory'] = null;
    if (profile.topCategory) {
        const catKey = profile.topCategory;
        const label = CAT_META[catKey]?.label ?? catKey;
        const levelOrder: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };
        const items = allPrograms
            .filter(
                (p) =>
                    getProgramCategoryKey(p.id) === catKey &&
                    !profile.watchedProgramIds.has(p.id),
            )
            .sort((a, b) => (levelOrder[a.level] ?? 1) - (levelOrder[b.level] ?? 1))
            .slice(0, 6)
            .map((p) => toRecommended(p, catKey, 0, `Popular in ${label}`));
        if (items.length > 0) trendingInCategory = { label: `Popular in ${label}`, items };
    }

    return { forYou, becauseLiked, wantToTry, trendingInCategory, hasData: true };
}

// ── Similar programs for a given video (sync, uses in-memory data) ─────────────
export function getSimilarPrograms(videoId: string, limit = 6): RecommendedProgram[] {
    const currentProg = getProgramByVideoId(videoId);
    if (!currentProg) return [];
    const catKey = getProgramCategoryKey(currentProg.id);
    if (!catKey) return [];

    const levelOrder: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };
    const currentLevel = levelOrder[currentProg.level] ?? 1;

    return getAllPrograms()
        .filter((p) => p.id !== currentProg.id && getProgramCategoryKey(p.id) === catKey)
        .sort((a, b) => {
            const aDiff = Math.abs((levelOrder[a.level] ?? 1) - currentLevel);
            const bDiff = Math.abs((levelOrder[b.level] ?? 1) - currentLevel);
            return aDiff - bDiff;
        })
        .slice(0, limit)
        .map((p) => toRecommended(p, catKey, 0, 'Similar to this workout'));
}
