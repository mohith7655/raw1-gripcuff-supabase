// Workout/tutorial videos can be served from public Supabase Storage buckets.

export const PREMADE_WORKOUT_VIDEO_URL =
    'https://dyjfzuzrjgwjmhojhmjj.supabase.co/storage/v1/object/public/Test-videos/Exercise%20Tutorial%20-%20Squat.mp4';

export const EXERCISE_SQUAT_VIDEO_URL =
    'https://dyjfzuzrjgwjmhojhmjj.supabase.co/storage/v1/object/public/Test-videos/Exercise%20Tutorial%20-%20Squat.mp4';

export const SIGNUP_LOGIN_BG_VIDEO_URL =
    'https://dyjfzuzrjgwjmhojhmjj.supabase.co/storage/v1/object/public/Test-videos/Exercise%20Tutorial%20-%20Squat.mp4';

export const WELCOME_BG_VIDEO_URL =
    'https://dyjfzuzrjgwjmhojhmjj.supabase.co/storage/v1/object/public/Test-videos/Exercise%20Tutorial%20-%20Squat.mp4';

export function getWorkoutVideoUrl(type: 'premade' | 'exercise' | 'signup_login' | 'welcome'): string {
    switch (type) {
        case 'premade':      return PREMADE_WORKOUT_VIDEO_URL;
        case 'exercise':     return EXERCISE_SQUAT_VIDEO_URL;
        case 'signup_login': return SIGNUP_LOGIN_BG_VIDEO_URL;
        case 'welcome':      return WELCOME_BG_VIDEO_URL;
        default:             return '';
    }
}
