import { getGlobalEngagementBoosts } from './videoEngagement.service';
import {
    PreRecordedProgram,
    ProgramCategoryKey,
    getAllPrograms,
    getProgramByVideoId,
    getProgramCategoryKey,
} from '../data/preRecordedPrograms';
import { BodyCondition } from '../models/User';

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

// ── Pain / injury avoidance ─────────────────────────────────────────────────
// We never recommend exercises or workouts that load a body part the user has
// flagged as painful or injured. Each figure body-part key maps to the muscle
// keywords that appear in a program's `focus` + exercise `muscleGroup` strings,
// and to the coarse exercise `bodyPart` tags used by the library videos.
const PART_TO_MUSCLE: Record<string, string[]> = {
    knee:       ['quad', 'hamstring', 'glute', 'leg', 'calf', 'squat', 'lunge'],
    quads:      ['quad', 'leg', 'squat', 'lunge'],
    calves:     ['calf', 'calves'],
    ankle:      ['calf', 'leg'],
    hip:        ['glute', 'hip', 'hamstring'],
    glutes:     ['glute', 'hamstring'],
    lower_back: ['back', 'spine', 'deadlift', 'hamstring'],
    upper_back: ['back', 'trap', 'spine'],
    back:       ['back', 'spine', 'trap'],
    neck:       ['neck', 'trap'],
    shoulders:  ['shoulder', 'delt'],
    chest:      ['chest'],
    abs:        ['core', 'oblique', 'abs'],
    elbow:      ['bicep', 'tricep', 'curl'],
    wrist:      ['forearm', 'wrist'],
    arms:       ['bicep', 'tricep', 'forearm', 'arm'],
};
const PART_TO_BODYPART: Record<string, string[]> = {
    knee: ['legs'], quads: ['legs'], calves: ['legs'], ankle: ['legs'], hip: ['legs'], glutes: ['legs'],
    lower_back: ['back'], upper_back: ['back'], back: ['back'], neck: ['back', 'shoulders'],
    shoulders: ['shoulders'], chest: ['chest'], abs: ['core'],
    elbow: ['biceps', 'triceps', 'arms'], wrist: ['biceps', 'triceps', 'arms'], arms: ['biceps', 'triceps', 'arms'],
};

// Body parts the user has flagged as pain or injury (tightness is fine — that's
// what stretching is for, so it does NOT block recommendations).
const avoidedParts = (conditions?: BodyCondition[] | null): string[] =>
    Array.from(new Set(
        (conditions ?? [])
            .filter((c) => c.type === 'pain' || c.type === 'injury')
            .map((c) => c.part.split('::')[0]),
    ));

const tokensFor = (parts: string[], map: Record<string, string[]>): string[] =>
    Array.from(new Set(parts.flatMap((p) => map[p] ?? [])));

/** True when a program loads a painful/injured area and should be hidden. */
function programHurts(prog: PreRecordedProgram, muscleTokens: string[]): boolean {
    if (muscleTokens.length === 0) return false;
    const hay = `${prog.focus} ${prog.exercises.map((e) => e.muscleGroup).join(' ')}`.toLowerCase();
    return muscleTokens.some((t) => hay.includes(t));
}

/** Drop programs that load a body part flagged as pain / injury. */
export function filterProgramsForPain<T extends PreRecordedProgram>(
    progs: T[],
    conditions?: BodyCondition[] | null,
): T[] {
    const tokens = tokensFor(avoidedParts(conditions), PART_TO_MUSCLE);
    if (tokens.length === 0) return progs;
    return progs.filter((p) => !programHurts(p, tokens));
}

/** Drop library exercise videos whose bodyPart is flagged as pain / injury. */
export function filterExercisesForPain<T extends { bodyPart?: string | null }>(
    videos: T[],
    conditions?: BodyCondition[] | null,
): T[] {
    const parts = tokensFor(avoidedParts(conditions), PART_TO_BODYPART);
    if (parts.length === 0) return videos;
    return videos.filter((v) => {
        const bp = (v.bodyPart ?? '').toLowerCase();
        // "Full Body" work inevitably loads the area — keep it out too when avoiding.
        if (bp.includes('full')) return false;
        return !parts.some((p) => bp.includes(p));
    });
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
// `conditions` (the user's body markers) lets us hide workouts that load a
// painful / injured area.
export function getSimilarPrograms(
    videoId: string,
    limit = 6,
    conditions?: BodyCondition[] | null,
): RecommendedProgram[] {
    const currentProg = getProgramByVideoId(videoId);
    if (!currentProg) return [];
    const catKey = getProgramCategoryKey(currentProg.id);
    if (!catKey) return [];

    const levelOrder: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2 };
    const currentLevel = levelOrder[currentProg.level] ?? 1;

    const candidates = getAllPrograms()
        .filter((p) => p.id !== currentProg.id && getProgramCategoryKey(p.id) === catKey);

    return filterProgramsForPain(candidates, conditions)
        .sort((a, b) => {
            const aDiff = Math.abs((levelOrder[a.level] ?? 1) - currentLevel);
            const bDiff = Math.abs((levelOrder[b.level] ?? 1) - currentLevel);
            return aDiff - bDiff;
        })
        .slice(0, limit)
        .map((p) => toRecommended(p, catKey, 0, 'Similar to this workout'));
}
