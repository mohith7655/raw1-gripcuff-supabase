/**
 * profileSummary.service
 *
 * Calls the `profile-summary` serverless function (which holds the OpenAI key
 * server-side) to generate the AI intro blurb. The owner generates it once; the
 * result is persisted to profiles.ai_summary so viewers just read it.
 *
 * NOTE: uses the same relative `/.netlify/functions/...` path as the Agora token
 * service. That resolves on web/PWA. For native builds, point it at an absolute
 * base URL.
 */

const SUMMARY_ENDPOINT = '/.netlify/functions/profile-summary';

export interface ProfileSummaryInput {
    name?: string | null;
    whatIDo?: string | null;
    city?: string | null;
    hobbies?: string[];
    lookingToMeet?: string | null;
    connectionGoals?: string[];
    bio?: string | null;
    streak?: number;
    workouts?: number;
    joinedRecently?: boolean;
}

export async function generateProfileSummary(profile: ProfileSummaryInput): Promise<string> {
    const res = await fetch(SUMMARY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Summary request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    try {
        const data = JSON.parse(text);
        return (data.summary ?? '').trim();
    } catch {
        throw new Error('Summary endpoint returned a non-JSON response.');
    }
}
