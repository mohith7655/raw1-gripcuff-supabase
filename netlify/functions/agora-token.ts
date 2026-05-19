/**
 * netlify/functions/agora-token.ts
 *
 * Serverless token generator for Agora RTC.
 * Called by the web client before every joinChannel().
 *
 * POST /.netlify/functions/agora-token
 * Body: { channelName: string, uid?: number }
 * Returns: { token: string }
 *
 * Required env vars (set in Netlify dashboard or .env.local):
 *   AGORA_APP_ID          – your Agora project App ID
 *   AGORA_APP_CERTIFICATE – your Agora project Primary Certificate
 */

import { RtcTokenBuilder, RtcRole } from 'agora-token';

const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event: any): Promise<any> => {
    /* ── CORS preflight — browsers send OPTIONS before every cross-origin POST ── */
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }

    /* ── Method guard ── */
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        };
    }

    /* ── Parse body ── */
    let channelName: string;
    let uid: number;

    try {
        const body = JSON.parse(event.body ?? '{}');
        channelName = body.channelName;
        uid = typeof body.uid === 'number' ? body.uid : 0;
    } catch {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid JSON body.' }),
        };
    }

    if (!channelName) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'channelName is required.' }),
        };
    }

    /* ── Credentials from environment — never hardcoded ── */
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    console.log('[agora-token] AGORA_APP_ID present:', !!appId);
    console.log('[agora-token] AGORA_APP_CERTIFICATE present:', !!appCertificate);

    if (!appId || !appCertificate) {
        const missing = [!appId && 'AGORA_APP_ID', !appCertificate && 'AGORA_APP_CERTIFICATE'].filter(Boolean);
        console.error('[agora-token] Missing env vars:', missing.join(', '));
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Server configuration error. Missing: ${missing.join(', ')}` }),
        };
    }

    /* ── Build token ── */
    let token: string;
    try {
        token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            uid,
            RtcRole.PUBLISHER,
            TOKEN_EXPIRY_SECONDS,
            TOKEN_EXPIRY_SECONDS,
        );
    } catch (err: any) {
        console.error('[agora-token] Token generation failed:', err?.message ?? err);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: `Token generation failed: ${err?.message ?? 'unknown error'}` }),
        };
    }

    return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    };
};
