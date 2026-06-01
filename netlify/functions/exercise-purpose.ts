// Netlify env vars required:
// ANTHROPIC_API_KEY = sk-ant-...

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event: any): Promise<any> => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    let title: string, equipment: string;
    try {
        const body = JSON.parse(event.body ?? '{}');
        title = body.title ?? '';
        equipment = body.equipment ?? '';
    } catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    if (!title) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'title is required' }) };
    }

    const userPrompt = `Exercise: ${title}. Equipment needed: ${equipment || 'none'}. Explain the purpose of this exercise in 1-2 sentences focusing on how it benefits or shapes the body. Then list exactly 3 specific physical benefits. Return as JSON: { "summary": string, "benefits": [string, string, string] }`;

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 300,
                system: 'You are a fitness expert. Return only valid JSON, no markdown, no extra text.',
                messages: [{ role: 'user', content: userPrompt }],
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            return { statusCode: 502, headers: CORS_HEADERS, body: JSON.stringify({ error: err }) };
        }

        const data = await res.json();
        const text = data.content?.[0]?.text ?? '{}';
        const parsed = JSON.parse(text);

        return {
            statusCode: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed),
        };
    } catch (e: any) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e?.message ?? 'Unknown error' }) };
    }
};
