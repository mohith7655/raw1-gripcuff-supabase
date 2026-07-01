/**
 * bodyAI.service — OpenAI-powered "what's going on with your body" insight +
 * personalized recommendations, derived from the user's metrics, injuries and
 * goals (the same data the My Body 3D model is built from).
 *
 * One gpt-4o-mini call returns BOTH:
 *   • insight — a short, friendly read on the user's current body state.
 *   • recommendations — what to focus on next, each mapped to a library category
 *     so the UI can deep-link (muscle_growth / stretching / injury_rehab /
 *     athletic / gripcuff).
 *
 * The OpenAI key stays server-side: this talks to the `body-insights` Netlify
 * function (which holds OPENAI_API_KEY), NEVER OpenAI directly — same pattern as
 * profileSummary.service. Results are cached in localStorage keyed by a hash of
 * the inputs, so we only spend a token when the body data actually changes.
 */
import { BodyCondition, GoalEntry } from '../models/User';

// Absolute base URL (the deployed Netlify site) so it works from the local Expo
// dev server and native too — a relative `/.netlify/...` path only resolves when
// served by Netlify itself.
const APP_WEB_BASE_URL = (process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://raw1-supabase.netlify.app').replace(/\/+$/, '');
const INSIGHTS_ENDPOINT = `${APP_WEB_BASE_URL}/.netlify/functions/body-insights`;

export type RecoCategory =
  | 'muscle_growth'
  | 'stretching'
  | 'injury_rehab'
  | 'athletic'
  | 'gripcuff';

export interface BodyRecommendation {
  title: string;
  reason: string;
  category: RecoCategory;
}

export interface BodyInsights {
  insight: string;
  recommendations: BodyRecommendation[];
}

export interface BodyAIInput {
  gender?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  conditions?: BodyCondition[] | null;
  goals?: GoalEntry[] | null;
}

const CACHE_PREFIX = 'body_ai_v1_';

// Stable, compact key for the inputs that actually affect the result.
function inputKey(i: BodyAIInput): string {
  const norm = {
    g: i.gender ?? '',
    a: i.age ?? 0,
    h: i.heightCm ?? 0,
    w: i.weightKg ?? 0,
    c: (i.conditions ?? []).map((c) => `${c.type}:${c.part}:${c.side ?? 'both'}`).sort(),
    go: (i.goals ?? []).map((g) => `${g.type}:${(g.muscles ?? g.areas ?? []).join('|')}:${g.kg ?? ''}`).sort(),
  };
  // djb2 hash → short string
  const s = JSON.stringify(norm);
  let h = 5381;
  for (let k = 0; k < s.length; k++) h = ((h << 5) + h + s.charCodeAt(k)) | 0;
  return CACHE_PREFIX + (h >>> 0).toString(36);
}

// ── Recalibration signal ───────────────────────────────────────────────────
// Bumped whenever the user's body data (metrics / injuries / goals) is saved so
// every mounted useBodyInsights re-runs and the AI recommendations recalibrate
// against the new 3D-model state instead of serving a stale cached result.
let insightsVersion = 0;
const versionListeners = new Set<() => void>();

/** Current recalibration version — include in effect deps to react to saves. */
export function getBodyInsightsVersion(): number {
  return insightsVersion;
}

/** Subscribe to recalibration bumps. Returns an unsubscribe fn. */
export function subscribeBodyInsights(cb: () => void): () => void {
  versionListeners.add(cb);
  return () => versionListeners.delete(cb);
}

/**
 * Clear cached insights and notify subscribers. Call after body data is saved
 * (metrics, injuries, or goals) so the AI recommendations are recomputed fresh.
 */
export function invalidateBodyInsights(): void {
  insightsVersion += 1;
  if (typeof localStorage !== 'undefined') {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
  versionListeners.forEach((cb) => {
    try { cb(); } catch {}
  });
}

function readCache(key: string): BodyInsights | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as BodyInsights) : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, val: BodyInsights) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/**
 * Returns the body insight + recommendations, served from cache when the inputs
 * are unchanged. The OpenAI call happens server-side in the `body-insights`
 * Netlify function. Returns null when the call fails or there's nothing to say
 * (the UI should hide the section gracefully).
 */
export async function getBodyInsights(input: BodyAIInput, opts?: { force?: boolean }): Promise<BodyInsights | null> {
  // Need at least height + weight to say anything meaningful.
  if (!input.heightCm || !input.weightKg) return null;

  const key = inputKey(input);
  if (!opts?.force) {
    const cached = readCache(key);
    if (cached) return cached;
  }

  try {
    const res = await fetch(INSIGHTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    if (!res.ok) return null;
    const parsed = await res.json();

    const insight = typeof parsed?.insight === 'string' ? parsed.insight.trim() : '';
    const recommendations: BodyRecommendation[] = Array.isArray(parsed?.recommendations)
      ? parsed.recommendations
          .map((r: any) => ({
            title: String(r?.title ?? '').trim(),
            reason: String(r?.reason ?? '').trim(),
            category: r?.category as RecoCategory,
          }))
          .filter((r: BodyRecommendation) => r.title)
          .slice(0, 4)
      : [];

    if (!insight && recommendations.length === 0) return null;
    const out: BodyInsights = { insight, recommendations };
    writeCache(key, out);
    return out;
  } catch (err) {
    console.warn('[bodyAI] insight generation failed', err);
    return null;
  }
}
