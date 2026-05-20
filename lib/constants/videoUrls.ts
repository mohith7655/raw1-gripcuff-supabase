// All workout/tutorial videos are served from Firebase Storage.
// Do NOT use Supabase Storage for video playback — it lacks the headers
// (content-type: video/mp4, accept-ranges: bytes) required for streaming.

export const PREMADE_WORKOUT_VIDEO_URL =
    'https://firebasestorage.googleapis.com/v0/b/wazy-6c4a9.firebasestorage.app/o/Gripcuff%201%20st%20video.mp4?alt=media&token=e4f9796e-5898-4756-9e10-914c228f34d3';

export const EXERCISE_SQUAT_VIDEO_URL =
    'https://firebasestorage.googleapis.com/v0/b/wazy-6c4a9.firebasestorage.app/o/Exercise%20Tutorial%20-%20Squat.mp4?alt=media&token=48cf44d1-0a5f-4ff5-b1d4-62e19c46dfc6';

export const SIGNUP_LOGIN_BG_VIDEO_URL =
    'https://firebasestorage.googleapis.com/v0/b/wazy-6c4a9.firebasestorage.app/o/Gripcuff-signup-login.mp4?alt=media&token=1d4cf5d8-1d5b-4071-a9fd-ba325fa9ec2e';

export const WELCOME_BG_VIDEO_URL =
    'https://firebasestorage.googleapis.com/v0/b/wazy-6c4a9.firebasestorage.app/o/Raw1-intro-app.mp4?alt=media&token=bc49d4aa-214e-4422-963b-f6d077d0d89c';

export function getWorkoutVideoUrl(type: 'premade' | 'exercise' | 'signup_login' | 'welcome'): string {
    switch (type) {
        case 'premade':      return PREMADE_WORKOUT_VIDEO_URL;
        case 'exercise':     return EXERCISE_SQUAT_VIDEO_URL;
        case 'signup_login': return SIGNUP_LOGIN_BG_VIDEO_URL;
        case 'welcome':      return WELCOME_BG_VIDEO_URL;
        default:             return '';
    }
}
