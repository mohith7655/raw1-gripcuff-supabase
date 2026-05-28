import { Handler } from '@netlify/functions';
import fetch from 'node-fetch';

const GOOGLE_API_BASE = 'https://maps.googleapis.com/maps/api';

export const handler: Handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    try {
        // Strip the function prefix so the path is e.g. /place/autocomplete/json
        const apiPath = (event.path || '')
            .replace(/^\/.netlify\/functions\/google-places/, '')
            .replace(/^\/api\/maps/, '');

        const params = new URLSearchParams(
            (event.queryStringParameters as Record<string, string>) ?? {}
        );

        const googleUrl = `${GOOGLE_API_BASE}${apiPath}?${params.toString()}`;

        const response = await fetch(googleUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });

        const data = await response.json();

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(data),
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};
