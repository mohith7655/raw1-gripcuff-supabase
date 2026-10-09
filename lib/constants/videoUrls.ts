// Workout/tutorial videos are served from public Supabase Storage buckets.
// The project URL comes from env (not hardcoded) — Netlify's secret scanner
// fails the deploy if an env var's value appears in repo source.

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

const publicVideoUrl = (bucket: string, path: string) =>
    `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(path)}`;

const SQUAT_TUTORIAL_URL = publicVideoUrl('Test-videos', 'Exercise Tutorial - Squat.mp4');

export const PREMADE_WORKOUT_VIDEO_URL = SQUAT_TUTORIAL_URL;

export const EXERCISE_SQUAT_VIDEO_URL = SQUAT_TUTORIAL_URL;

export const SIGNUP_LOGIN_BG_VIDEO_URL = SQUAT_TUTORIAL_URL;

export const WELCOME_BG_VIDEO_URL = SQUAT_TUTORIAL_URL;

export function getWorkoutVideoUrl(type: 'premade' | 'exercise' | 'signup_login' | 'welcome'): string {
    switch (type) {
        case 'premade':      return PREMADE_WORKOUT_VIDEO_URL;
        case 'exercise':     return EXERCISE_SQUAT_VIDEO_URL;
        case 'signup_login': return SIGNUP_LOGIN_BG_VIDEO_URL;
        case 'welcome':      return WELCOME_BG_VIDEO_URL;
        default:             return '';
    }
}
