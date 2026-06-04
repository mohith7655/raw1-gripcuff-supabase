/**
 * Per-video workout cue tracks.
 *
 * Each video can have a timeline of coaching cues that the workout-mode timer
 * surfaces in real time ("what the instructor is doing right now"). A cue
 * segment starts at `atSec` (seconds into the workout) and stays active until
 * the next segment's `atSec`.
 *
 * Authoring: add an entry to WORKOUT_CUE_TRACKS keyed by the video's id (the
 * same id passed to the player as route param `videoId`). Keep segments sorted
 * by `atSec` ascending. Any field left out renders as "—".
 *
 * This is intentionally a code-side content map so tracks can be authored now;
 * it can later be backed by the DB without changing the player.
 */

export interface WorkoutCueSegment {
    /** Seconds into the workout when this segment begins. */
    atSec: number;
    /** Short phase/exercise label, e.g. "Set 1 — Squats" or "Rest". */
    label: string;
    /** Target reps for the segment (number, "12-15", or "—"). */
    reps?: string | number;
    /** Load the instructor is using, e.g. "20 kg", "Bodyweight", "—". */
    weight?: string;
    /** One-line coaching tip. */
    tip?: string;
}

export type WorkoutCueTrack = WorkoutCueSegment[];

export const WORKOUT_CUE_TRACKS: Record<string, WorkoutCueTrack> = {
    // ── Example (replace the key with a real video id and edit the timeline) ──
    // 'example-video-id': [
    //   { atSec: 0,   label: 'Warm-up',           reps: '—',     weight: 'Bodyweight', tip: 'Loosen up — light, controlled movement.' },
    //   { atSec: 30,  label: 'Set 1 — Squats',    reps: 12,      weight: '20 kg',      tip: 'Chest up, drive through the heels.' },
    //   { atSec: 75,  label: 'Rest',              reps: '—',     weight: '—',          tip: 'Breathe. Reset for the next set.' },
    //   { atSec: 90,  label: 'Set 2 — Squats',    reps: 10,      weight: '25 kg',      tip: 'Slightly heavier — keep the tempo.' },
    //   { atSec: 135, label: 'Cooldown',          reps: '—',     weight: '—',          tip: 'Slow it down and stretch it out.' },
    // ],
};

/** Look up a cue track for a video id, if one has been authored. */
export function getCueTrack(videoId?: string | null): WorkoutCueTrack | null {
    if (!videoId) return null;
    return WORKOUT_CUE_TRACKS[videoId] ?? null;
}

/**
 * Resolve the active cue (and seconds spent inside it) for a given elapsed time.
 * Returns null if the track is empty or the timeline hasn't started yet.
 */
export function resolveActiveCue(
    track: WorkoutCueTrack,
    elapsedSec: number,
): { cue: WorkoutCueSegment; segmentElapsed: number } | null {
    let active: WorkoutCueSegment | null = null;
    for (const seg of track) {
        if (seg.atSec <= elapsedSec) active = seg;
        else break;
    }
    if (!active) return null;
    return { cue: active, segmentElapsed: elapsedSec - active.atSec };
}
