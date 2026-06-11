import { getGlobalEngagementBoosts } from './videoEngagement.service';
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
    MuscleGrowth: { label: 'Muscle Growth', emoji: '💪', color: '#4A5568' },
    Stretching: { label: 'Stretching', emoji: '🧘', color: '#7A8A8A' },
    AthleticPerformance: { label: 'Athletic Performance', emoji: '🏃', color: '#8B7355' },
    InjuryRehab: { label: 'Injury Rehab', emoji: '🩹', color: '#6B4226' },
};

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

// ── Convert program → UI-ready object ─────────────────────────────────────────
function toRecommended(
    prog: PreRecordedProgram,
    catKey: string,
    score: number,
    reason: string,
): RecommendedProgram {
    const meta = CAT_META[catKey] ?? { label: catKey, emoji: '🏋️', color: '#4A5568' };
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

// ── Main recommendation engine — no user data, returns empty sections ──────────
export async function generateRecommendations(uid: string): Promise<RecommendationSections> {
    return {
        forYou: [],
        becauseLiked: null,
        wantToTry: null,
        trendingInCategory: null,
        hasData: false,
    };
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
