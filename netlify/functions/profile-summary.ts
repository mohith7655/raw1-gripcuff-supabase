/**
 * netlify/functions/profile-summary.ts
 *
 * Generates a warm, third-person "intro blurb" for a user's social profile
 * using OpenAI. The OpenAI key stays server-side here and is NEVER shipped to
 * the client.
 *
 * POST /.netlify/functions/profile-summary
 * Body: { profile: { name, whatIDo, city, hobbies[], lookingToMeet,
 *                     connectionGoals[], bio, streak, workouts, joinedRecently } }
 * Returns: { summary: string }
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

export const handler = async (event: any): Promise<any> => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Use POST.' }) };
    }

    let profile: any;
    try {
        profile = JSON.parse(event.body ?? '{}').profile ?? {};
    } catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error('[profile-summary] Missing OPENAI_API_KEY');
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Server configuration error. Missing OPENAI_API_KEY.' }),
        };
    }

    // Build a compact, factual brief — the model must only use what we pass.
    const facts: string[] = [];
    if (profile.name) facts.push(`Name: ${profile.name}`);
    if (profile.whatIDo) facts.push(`Does: ${profile.whatIDo}`);
    if (profile.city) facts.push(`Based in: ${profile.city}`);
    if (Array.isArray(profile.hobbies) && profile.hobbies.length) facts.push(`Hobbies: ${profile.hobbies.join(', ')}`);
    if (profile.lookingToMeet) facts.push(`Looking to meet: ${profile.lookingToMeet}`);
    if (Array.isArray(profile.connectionGoals) && profile.connectionGoals.length) facts.push(`Connection goals: ${profile.connectionGoals.join(', ')}`);
    if (profile.bio) facts.push(`Their words: ${profile.bio}`);
    if (typeof profile.streak === 'number' && profile.streak > 0) facts.push(`Current workout streak: ${profile.streak} days`);
    if (typeof profile.workouts === 'number' && profile.workouts > 0) facts.push(`Total workouts: ${profile.workouts}`);
    if (profile.joinedRecently) facts.push('Recently started working out');

    if (facts.length === 0) {
        return { statusCode: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: '' }) };
    }

    const systemPrompt =
        'You write short, warm, third-person intro blurbs for members of a fitness + social ' +
        'community app. Goal: make the person feel approachable and interesting so others want ' +
        'to connect with them. Rules: 2-3 sentences, ~40-60 words, friendly and human (not salesy ' +
        'or corporate), highlight what makes them relatable and what they might connect with others ' +
        'over. Only use the facts provided — never invent details. No hashtags, no markdown, at most ' +
        'one tasteful emoji. Write in third person using their first name.';

    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                temperature: 0.8,
                max_tokens: 140,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Write the blurb from these facts:\n${facts.join('\n')}` },
                ],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[profile-summary] OpenAI error:', res.status, errText.slice(0, 300));
            return { statusCode: 502, headers: CORS_HEADERS, body: JSON.stringify({ error: 'AI request failed.' }) };
        }

        const data = await res.json();
        const summary = (data?.choices?.[0]?.message?.content ?? '').trim();
        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary }),
        };
    } catch (err: any) {
        console.error('[profile-summary] failed:', err?.message ?? err);
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'AI request failed.' }) };
    }
};
