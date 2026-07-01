/**
 * netlify/functions/body-insights.ts
 *
 * OpenAI-powered "what's going on with your body" insight + recommendations,
 * derived from the user's metrics, injuries and goals (the same data the My Body
 * 3D model is built from). The OpenAI key stays server-side here and is NEVER
 * shipped to the client — mirrors netlify/functions/profile-summary.ts.
 *
 * POST /.netlify/functions/body-insights
 * Body: { input: { gender, age, heightCm, weightKg, conditions[], goals[] } }
 * Returns: { insight: string, recommendations: { title, reason, category }[] }
 *
 * Required env var (Netlify dashboard → Environment variables, or .env for
 * `netlify dev`):
 *   OPENAI_API_KEY – your OpenAI secret key (sk-...)
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_MODEL = 'gpt-4o-mini';
const VALID_CATS = ['muscle_growth', 'stretching', 'injury_rehab', 'athletic', 'gripcuff'];

const bmiOf = (h?: number | null, w?: number | null) =>
    h && w ? +(w / Math.pow(h / 100, 2)).toFixed(1) : null;

function describe(i: any): string {
    const bmi = bmiOf(i.heightCm, i.weightKg);
    const conds = (i.conditions ?? []).length
        ? (i.conditions ?? []).map((c: any) => `${c.type} at ${c.part}${c.side && c.side !== 'both' ? ` (${c.side})` : ''}`).join(', ')
        : 'none reported';
    const goals = (i.goals ?? []).length
        ? (i.goals ?? []).map((g: any) => {
            if (g.type === 'weight_loss') return `lose ${g.kg ?? 0}kg`;
            const parts = (g.muscles ?? g.areas ?? []).join(', ');
            return `${String(g.type).replace('_', ' ')}${parts ? ` (${parts})` : ''}`;
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

export const handler = async (event: any): Promise<any> => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Use POST.' }) };
    }

    let input: any;
    try {
        input = JSON.parse(event.body ?? '{}').input ?? {};
    } catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
    }

    // Need at least height + weight to say anything meaningful.
    if (!input.heightCm || !input.weightKg) {
        return { statusCode: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ insight: '', recommendations: [] }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('[body-insights] Missing OPENAI_API_KEY');
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Server configuration error. Missing OPENAI_API_KEY.' }),
        };
    }

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
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                temperature: 0.6,
                max_tokens: 700,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: 'You output only valid JSON. You are a fitness & physio coach.' },
                    { role: 'user', content: prompt },
                ],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[body-insights] OpenAI error:', res.status, errText.slice(0, 300));
            return { statusCode: 502, headers: CORS_HEADERS, body: JSON.stringify({ error: 'AI request failed.' }) };
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) {
            return { statusCode: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ insight: '', recommendations: [] }) };
        }

        const match = content.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match ? match[0] : content);

        const insight = typeof parsed.insight === 'string' ? parsed.insight.trim() : '';
        const recommendations = Array.isArray(parsed.recommendations)
            ? parsed.recommendations
                .map((r: any) => ({
                    title: String(r?.title ?? '').trim(),
                    reason: String(r?.reason ?? '').trim(),
                    category: VALID_CATS.includes(r?.category) ? r.category : 'muscle_growth',
                }))
                .filter((r: any) => r.title)
                .slice(0, 4)
            : [];

        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ insight, recommendations }),
        };
    } catch (err: any) {
        console.error('[body-insights] failed:', err?.message ?? err);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'AI request failed.' }) };
    }
};
