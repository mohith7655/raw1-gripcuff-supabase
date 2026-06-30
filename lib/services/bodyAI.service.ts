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
 * Results are cached in localStorage keyed by a hash of the inputs, so we only
 * spend a token when the body data actually changes.
 */
import { OPENAI_API_KEY, OPENAI_API_BASE } from '../core/config/api_keys';
import { BodyCondition, GoalEntry } from '../models/User';

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
const VALID_CATS: RecoCategory[] = ['muscle_growth', 'stretching', 'injury_rehab', 'athletic', 'gripcuff'];

const bmiOf = (h?: number | null, w?: number | null) =>
  h && w ? +(w / Math.pow(h / 100, 2)).toFixed(1) : null;

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

function describe(i: BodyAIInput): string {
  const bmi = bmiOf(i.heightCm, i.weightKg);
  const conds = (i.conditions ?? []).length
    ? (i.conditions ?? []).map((c) => `${c.type} at ${c.part}${c.side && c.side !== 'both' ? ` (${c.side})` : ''}`).join(', ')
    : 'none reported';
  const goals = (i.goals ?? []).length
    ? (i.goals ?? []).map((g) => {
        if (g.type === 'weight_loss') return `lose ${g.kg ?? 0}kg`;
        const parts = (g.muscles ?? g.areas ?? []).join(', ');
        return `${g.type.replace('_', ' ')}${parts ? ` (${parts})` : ''}`;
      }).join('; ')
    : 'none set';
  return [
    `Gender: ${i.gender || 'unspecified'}`,
    `Age: ${i.age ?? 'unknown'}`,
    `Height: ${i.heightCm ?? 'unknown'} cm`,
    `Weight: ${i.weightKg ?? 'unknown'} kg`,
    `BMI: ${bmi ?? 'unknown'}`,
    `Injuries / tightness: ${conds}`,
    `Goals: ${goals}`,
  ].join('\n');
}

/**
 * Returns the body insight + recommendations, served from cache when the inputs
 * are unchanged. Returns null when the API key is missing or the call fails (the
 * UI should hide the section gracefully).
 */
export async function getBodyInsights(input: BodyAIInput, opts?: { force?: boolean }): Promise<BodyInsights | null> {
  // Need at least height + weight to say anything meaningful.
  if (!input.heightCm || !input.weightKg) return null;

  const key = inputKey(input);
  if (!opts?.force) {
    const cached = readCache(key);
    if (cached) return cached;
  }
  if (!OPENAI_API_KEY) return null;

  const prompt = `You are a supportive, knowledgeable fitness & physiotherapy coach.
Here is a user's body profile:
${describe(input)}

Return STRICT JSON (no markdown, no code fences) with this exact shape:
{
  "insight": "2-3 warm, plain-language sentences on what's going on with this body right now — call out BMI/weight context, how their injuries/tightness affect training, and whether their goals fit their current state. Be encouraging, not alarming. No medical diagnosis.",
  "recommendations": [
    { "title": "a specific EXERCISE or movement focus (e.g. 'Core Stability Exercises', 'Hip Mobility Drills') — NOT a full workout program or plan", "reason": "one sentence why, tied to their goals/injuries", "category": "one of: muscle_growth | stretching | injury_rehab | athletic | gripcuff" }
  ]
}
Give 3-4 recommendations. Recommend individual EXERCISES / movement focuses only — never multi-week programs or plans. If they reported injuries/tightness, at least one MUST be injury_rehab or stretching exercises for the affected area. Map grip/forearm/wrist focus to "gripcuff".`;

  try {
    const res = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You output only valid JSON. You are a fitness & physio coach.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const match = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : content);

    const insight = typeof parsed.insight === 'string' ? parsed.insight.trim() : '';
    const recommendations: BodyRecommendation[] = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
          .map((r: any) => ({
            title: String(r?.title ?? '').trim(),
            reason: String(r?.reason ?? '').trim(),
            category: (VALID_CATS.includes(r?.category) ? r.category : 'muscle_growth') as RecoCategory,
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
