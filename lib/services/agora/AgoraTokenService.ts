/**
 * AgoraTokenService
 *
 * Fetches a short-lived RTC token from the Netlify edge function.
 * Works for both "App ID + Token" projects and "App ID only" projects:
 *   - Token mode:  returns the minted token string
 *   - App ID only: the endpoint returns 500 (missing AGORA_APP_CERTIFICATE),
 *                  we catch it and return '' so the caller joins with empty token
 *
 * Never throws. Always returns a string.
 */

const TOKEN_ENDPOINT = '/.netlify/functions/agora-token';

export async function fetchAgoraToken(
    channelName: string,
    uid: number
): Promise<string> {
    try {
        const res = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName, uid }),
        });

        const text = await res.text();

        if (!res.ok) {
            console.warn(
                `[AgoraToken] endpoint returned ${res.status} for channel "${channelName}" — joining with empty token`
            );
            return '';
        }

        let data: { token?: string };
        try {
            data = JSON.parse(text);
        } catch {
            console.warn(
                `[AgoraToken] endpoint returned non-JSON for channel "${channelName}" — joining with empty token`
            );
            return '';
        }

        if (!data.token) {
            console.warn(`[AgoraToken] response missing token field — joining with empty token`);
            return '';
        }

        console.log(`[AgoraToken] fetched for channel "${channelName}" (uid ${uid})`);
        return data.token;

    } catch (err: any) {
        console.warn(
            `[AgoraToken] fetch failed for channel "${channelName}": ${err?.message ?? err} — joining with empty token`
        );
        return '';
    }
}
