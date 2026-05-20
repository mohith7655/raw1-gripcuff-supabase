export type ProgramCategoryKey = 'MuscleGrowth' | 'Stretching' | 'AthleticPerformance' | 'InjuryRehab';

export type ProgramVideo = {
    id: string;
    title: string;
    duration: number; // seconds
    category: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    bodyPart: string;
    videoUrl: string;
};

export type ProgramExercise = {
    name: string;
    sets?: string;
    reps?: string;
    duration?: string; // for timed exercises e.g. "45 sec"
    muscleGroup: string;
};

export type PreRecordedProgram = {
    id: string;
    title: string;
    coachName: string;
    durationWeeks: number;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
    focus: string;
    description: string;
    videos: ProgramVideo[];
    exercises: ProgramExercise[];
};

import { getWorkoutVideoUrl } from '../constants/videoUrls';

export const PREMADE_WORKOUT_VIDEO_URL = getWorkoutVideoUrl('premade');

// Each week has 3 workout sessions. days = weeks * 3
function makeDayVideos(
    programId: string,
    category: string,
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced',
    weeks: number,
    baseDurations: number[], // seconds, cycled
): Omit<ProgramVideo, 'videoUrl'>[] {
    const count = weeks * 3;
    return Array.from({ length: count }, (_, i) => ({
        id: `${programId}_d${i + 1}`,
        title: `Day ${i + 1}`,
        duration: baseDurations[i % baseDurations.length],
        category,
        difficulty,
        bodyPart: 'Full Body',
    }));
}

const withUrl = (v: Omit<ProgramVideo, 'videoUrl'>): ProgramVideo => ({
    ...v,
    videoUrl: PREMADE_WORKOUT_VIDEO_URL,
});

const PROGRAMS_RAW: Record<ProgramCategoryKey, PreRecordedProgram[]> = {
    MuscleGrowth: [
        {
            id: 'mg-lean-bulk',
            title: 'Lean Bulk Foundation',
            coachName: 'Coach Tyler Brooks',
            durationWeeks: 2,
            level: 'Beginner',
            focus: 'Full body hypertrophy',
            description: 'Build clean volume with simple progressive sets.',
            videos: makeDayVideos('mg-lean-bulk', 'Muscle Growth', 'Beginner', 2, [960, 1080, 900, 840, 1020, 960]).map(withUrl),
            exercises: [
                { name: 'Barbell Back Squat', sets: '3', reps: '10', muscleGroup: 'Quads, Glutes' },
                { name: 'Flat Bench Press', sets: '3', reps: '10', muscleGroup: 'Chest, Triceps' },
                { name: 'Barbell Row', sets: '3', reps: '10', muscleGroup: 'Back, Biceps' },
                { name: 'Overhead Press', sets: '3', reps: '8', muscleGroup: 'Shoulders' },
                { name: 'Romanian Deadlift', sets: '3', reps: '12', muscleGroup: 'Hamstrings, Glutes' },
                { name: 'Dumbbell Curl', sets: '2', reps: '12', muscleGroup: 'Biceps' },
            ],
        },
        {
            id: 'mg-push-pull-size',
            title: 'Push Pull Size Series',
            coachName: 'Coach Brandon Hayes',
            durationWeeks: 4,
            level: 'Intermediate',
            focus: 'Chest, back, arms',
            description: 'A focused split for adding size and repeatable strength.',
            videos: makeDayVideos('mg-push-pull-size', 'Muscle Growth', 'Intermediate', 4, [1200, 1260, 900, 780, 1080, 960]).map(withUrl),
            exercises: [
                { name: 'Incline Barbell Press', sets: '4', reps: '8', muscleGroup: 'Chest' },
                { name: 'Cable Fly', sets: '3', reps: '12', muscleGroup: 'Chest' },
                { name: 'Weighted Pull-Up', sets: '4', reps: '6', muscleGroup: 'Back, Biceps' },
                { name: 'Seated Cable Row', sets: '3', reps: '10', muscleGroup: 'Back' },
                { name: 'EZ Bar Curl', sets: '3', reps: '12', muscleGroup: 'Biceps' },
                { name: 'Tricep Pushdown', sets: '3', reps: '12', muscleGroup: 'Triceps' },
                { name: 'Lateral Raise', sets: '3', reps: '15', muscleGroup: 'Shoulders' },
            ],
        },
        {
            id: 'mg-lower-body-mass',
            title: 'Lower Body Mass Block',
            coachName: 'Coach Rachel Morgan',
            durationWeeks: 3,
            level: 'Advanced',
            focus: 'Quads, glutes, hamstrings',
            description: 'Higher-volume lower body training for experienced lifters.',
            videos: makeDayVideos('mg-lower-body-mass', 'Muscle Growth', 'Advanced', 3, [1320, 1140, 1080, 960, 1200, 1080]).map(withUrl),
            exercises: [
                { name: 'Back Squat', sets: '5', reps: '5', muscleGroup: 'Quads, Glutes' },
                { name: 'Leg Press', sets: '4', reps: '12', muscleGroup: 'Quads' },
                { name: 'Walking Lunge', sets: '3', reps: '16', muscleGroup: 'Quads, Glutes' },
                { name: 'Romanian Deadlift', sets: '4', reps: '10', muscleGroup: 'Hamstrings' },
                { name: 'Leg Curl', sets: '3', reps: '12', muscleGroup: 'Hamstrings' },
                { name: 'Standing Calf Raise', sets: '4', reps: '15', muscleGroup: 'Calves' },
            ],
        },
        {
            id: 'mg-shoulder-core',
            title: 'Shoulder & Core Power',
            coachName: 'Coach James Williams',
            durationWeeks: 2,
            level: 'Intermediate',
            focus: 'Shoulders and core',
            description: 'Overhead strength meets core stability – build shoulders that last.',
            videos: makeDayVideos('mg-shoulder-core', 'Muscle Growth', 'Intermediate', 2, [900, 960, 840, 780, 1020, 900]).map(withUrl),
            exercises: [
                { name: 'Seated Dumbbell Press', sets: '4', reps: '10', muscleGroup: 'Shoulders' },
                { name: 'Arnold Press', sets: '3', reps: '10', muscleGroup: 'Shoulders' },
                { name: 'Face Pull', sets: '3', reps: '15', muscleGroup: 'Rear Delt, Traps' },
                { name: 'Plank', sets: '3', duration: '45 sec', muscleGroup: 'Core' },
                { name: 'Cable Woodchop', sets: '3', reps: '12', muscleGroup: 'Core, Obliques' },
                { name: 'Hanging Leg Raise', sets: '3', reps: '10', muscleGroup: 'Core' },
            ],
        },
        {
            id: 'mg-arm-block',
            title: 'Arm Specialization Block',
            coachName: 'Coach Austin Reed',
            durationWeeks: 3,
            level: 'Intermediate',
            focus: 'Biceps, triceps, forearms',
            description: 'Targeted arm volume for visible bicep and tricep development.',
            videos: makeDayVideos('mg-arm-block', 'Muscle Growth', 'Intermediate', 3, [780, 840, 900, 720, 860, 800]).map(withUrl),
            exercises: [
                { name: 'Barbell Curl', sets: '4', reps: '10', muscleGroup: 'Biceps' },
                { name: 'Incline Dumbbell Curl', sets: '3', reps: '12', muscleGroup: 'Biceps' },
                { name: 'Hammer Curl', sets: '3', reps: '12', muscleGroup: 'Biceps, Forearms' },
                { name: 'Close-Grip Bench Press', sets: '4', reps: '8', muscleGroup: 'Triceps' },
                { name: 'Overhead Tricep Extension', sets: '3', reps: '12', muscleGroup: 'Triceps' },
                { name: 'Wrist Curl', sets: '3', reps: '15', muscleGroup: 'Forearms' },
            ],
        },
    ],
    Stretching: [
        {
            id: 'st-morning-mobility',
            title: 'Morning Mobility Routine',
            coachName: 'Coach Sarah Mitchell',
            durationWeeks: 2,
            level: 'Beginner',
            focus: 'Full body flexibility',
            description: 'Short daily sessions for smoother movement and less stiffness.',
            videos: makeDayVideos('st-morning-mobility', 'Stretching', 'Beginner', 2, [480, 420, 540, 600, 480, 540]).map(withUrl),
            exercises: [
                { name: 'Cat-Cow Stretch', sets: '2', duration: '60 sec', muscleGroup: 'Spine' },
                { name: 'Standing Hip Circle', sets: '2', duration: '30 sec', muscleGroup: 'Hips' },
                { name: 'Doorway Chest Stretch', sets: '2', duration: '30 sec', muscleGroup: 'Chest, Shoulders' },
                { name: 'Standing Quad Stretch', sets: '2', duration: '30 sec', muscleGroup: 'Quads' },
                { name: 'Seated Hamstring Stretch', sets: '2', duration: '45 sec', muscleGroup: 'Hamstrings' },
                { name: 'Neck Side Bend', sets: '2', duration: '20 sec', muscleGroup: 'Neck, Traps' },
            ],
        },
        {
            id: 'st-runner-release',
            title: 'Runner Release Series',
            coachName: 'Coach Lauren Mitchell',
            durationWeeks: 3,
            level: 'Intermediate',
            focus: 'Hips, calves, hamstrings',
            description: 'Targeted mobility for athletes who run, sprint, or play field sports.',
            videos: makeDayVideos('st-runner-release', 'Stretching', 'Intermediate', 3, [540, 600, 480, 720, 560, 500]).map(withUrl),
            exercises: [
                { name: 'Hip Flexor Lunge Stretch', sets: '2', duration: '45 sec', muscleGroup: 'Hip Flexors' },
                { name: 'Pigeon Pose', sets: '2', duration: '60 sec', muscleGroup: 'Glutes, Hips' },
                { name: 'Standing Calf Stretch', sets: '2', duration: '30 sec', muscleGroup: 'Calves' },
                { name: 'Figure-4 Stretch', sets: '2', duration: '45 sec', muscleGroup: 'Glutes' },
                { name: "World's Greatest Stretch", sets: '3', reps: '5', muscleGroup: 'Full Body' },
                { name: 'Ankle Circles', sets: '2', duration: '30 sec', muscleGroup: 'Ankles' },
            ],
        },
        {
            id: 'st-posture-flow',
            title: 'Posture & Spine Flow',
            coachName: 'Coach Hannah Reed',
            durationWeeks: 4,
            level: 'Beginner',
            focus: 'Spine and shoulders',
            description: 'Gentle routines for desk posture, upper back tension, and breathing.',
            videos: makeDayVideos('st-posture-flow', 'Stretching', 'Beginner', 4, [480, 420, 360, 540, 480, 420]).map(withUrl),
            exercises: [
                { name: 'Thoracic Extension over Foam Roller', sets: '2', duration: '60 sec', muscleGroup: 'Upper Back' },
                { name: 'Shoulder Retraction', sets: '3', reps: '15', muscleGroup: 'Upper Back, Rhomboids' },
                { name: 'Chin Tuck', sets: '3', reps: '10', muscleGroup: 'Neck' },
                { name: "Child's Pose", sets: '2', duration: '45 sec', muscleGroup: 'Lower Back' },
                { name: 'Doorway Pec Stretch', sets: '2', duration: '30 sec', muscleGroup: 'Chest' },
                { name: 'Diaphragmatic Breathing', sets: '3', duration: '60 sec', muscleGroup: 'Core, Diaphragm' },
            ],
        },
        {
            id: 'st-hip-freedom',
            title: 'Hip Flexor Freedom',
            coachName: 'Coach Jessica Lane',
            durationWeeks: 3,
            level: 'Beginner',
            focus: 'Hips and lower back',
            description: 'Release tight hip flexors and restore pain-free movement.',
            videos: makeDayVideos('st-hip-freedom', 'Stretching', 'Beginner', 3, [540, 480, 600, 420, 500, 480]).map(withUrl),
            exercises: [
                { name: 'Low Lunge Hold', sets: '2', duration: '60 sec', muscleGroup: 'Hip Flexors' },
                { name: 'Supine Hip Flexor Stretch', sets: '2', duration: '45 sec', muscleGroup: 'Hip Flexors' },
                { name: 'Seated Spinal Twist', sets: '2', duration: '30 sec', muscleGroup: 'Spine, Hips' },
                { name: 'Butterfly Stretch', sets: '2', duration: '45 sec', muscleGroup: 'Inner Thighs' },
                { name: 'Glute Bridge', sets: '3', reps: '15', muscleGroup: 'Glutes, Lower Back' },
                { name: 'Prone Hip Extension', sets: '3', reps: '12', muscleGroup: 'Glutes, Lower Back' },
            ],
        },
    ],
    AthleticPerformance: [
        {
            id: 'ap-speed-school',
            title: 'Speed School',
            coachName: 'Coach Marcus Johnson',
            durationWeeks: 2,
            level: 'Intermediate',
            focus: 'Acceleration and agility',
            description: 'Improve first-step quickness, footwork, and change of direction.',
            videos: makeDayVideos('ap-speed-school', 'Athletic Performance', 'Intermediate', 2, [480, 420, 540, 480, 520, 460]).map(withUrl),
            exercises: [
                { name: 'Agility Ladder — Ickey Shuffle', sets: '4', duration: '20 sec', muscleGroup: 'Legs, Coordination' },
                { name: 'Sprint Start Drill', sets: '6', reps: '1', muscleGroup: 'Full Body' },
                { name: 'Lateral Shuffle', sets: '4', duration: '15 sec', muscleGroup: 'Hips, Legs' },
                { name: 'Cone T-Drill', sets: '4', reps: '1', muscleGroup: 'Full Body' },
                { name: 'High Knees', sets: '3', duration: '20 sec', muscleGroup: 'Core, Hip Flexors' },
                { name: 'Resisted Broad Jump', sets: '4', reps: '5', muscleGroup: 'Glutes, Quads' },
            ],
        },
        {
            id: 'ap-explosive-power',
            title: 'Explosive Power Block',
            coachName: 'Coach Jason Miller',
            durationWeeks: 4,
            level: 'Advanced',
            focus: 'Jumps, throws, power',
            description: 'Plyometric and strength-speed sessions for explosive athletes.',
            videos: makeDayVideos('ap-explosive-power', 'Athletic Performance', 'Advanced', 4, [600, 540, 480, 420, 580, 520]).map(withUrl),
            exercises: [
                { name: 'Box Jump', sets: '5', reps: '5', muscleGroup: 'Quads, Glutes, Calves' },
                { name: 'Depth Drop Jump', sets: '4', reps: '6', muscleGroup: 'Glutes, Quads' },
                { name: 'Medicine Ball Slam', sets: '4', reps: '8', muscleGroup: 'Core, Shoulders' },
                { name: 'Power Clean', sets: '5', reps: '3', muscleGroup: 'Full Body' },
                { name: 'Plyometric Push-Up', sets: '4', reps: '8', muscleGroup: 'Chest, Triceps' },
                { name: 'Broad Jump', sets: '4', reps: '5', muscleGroup: 'Glutes, Quads' },
            ],
        },
        {
            id: 'ap-conditioning',
            title: 'Conditioning Engine',
            coachName: 'Coach Nicole Parker',
            durationWeeks: 3,
            level: 'Intermediate',
            focus: 'Endurance and repeat effort',
            description: 'Conditioning sessions for stronger late-game output and stamina.',
            videos: makeDayVideos('ap-conditioning', 'Athletic Performance', 'Intermediate', 3, [900, 600, 840, 720, 780, 660]).map(withUrl),
            exercises: [
                { name: 'Tempo Run Intervals', sets: '6', duration: '90 sec', muscleGroup: 'Full Body' },
                { name: 'Burpee', sets: '4', reps: '10', muscleGroup: 'Full Body' },
                { name: 'Kettlebell Swing', sets: '4', reps: '15', muscleGroup: 'Glutes, Hamstrings, Core' },
                { name: 'Battle Rope Wave', sets: '4', duration: '30 sec', muscleGroup: 'Arms, Core' },
                { name: 'Box Step-Up', sets: '3', reps: '12', muscleGroup: 'Glutes, Quads' },
                { name: 'Mountain Climber', sets: '3', duration: '30 sec', muscleGroup: 'Core, Shoulders' },
            ],
        },
        {
            id: 'ap-sport-ready',
            title: 'Sport Ready Program',
            coachName: 'Coach Kevin Davis',
            durationWeeks: 6,
            level: 'Advanced',
            focus: 'Multi-directional athleticism',
            description: 'Full athletic development combining speed, power, and conditioning.',
            videos: makeDayVideos('ap-sport-ready', 'Athletic Performance', 'Advanced', 6, [600, 540, 480, 660, 720, 500]).map(withUrl),
            exercises: [
                { name: 'Hang Clean', sets: '5', reps: '3', muscleGroup: 'Full Body' },
                { name: 'Single-Leg Broad Jump', sets: '4', reps: '5', muscleGroup: 'Glutes, Quads' },
                { name: 'Pro Agility Drill', sets: '6', reps: '1', muscleGroup: 'Full Body' },
                { name: 'Trap Bar Deadlift', sets: '4', reps: '6', muscleGroup: 'Posterior Chain' },
                { name: 'Reactive Shuffle', sets: '4', duration: '15 sec', muscleGroup: 'Legs, Hips' },
                { name: 'Nordic Hamstring Curl', sets: '3', reps: '8', muscleGroup: 'Hamstrings' },
                { name: 'Sprint 20m', sets: '6', reps: '1', muscleGroup: 'Full Body' },
            ],
        },
    ],
    InjuryRehab: [
        {
            id: 'ir-knee-comeback',
            title: 'Knee Comeback Plan',
            coachName: 'Dr. Megan Foster',
            durationWeeks: 2,
            level: 'Beginner',
            focus: 'Knee stability',
            description: 'Low-impact activation and stability work for rebuilding confidence.',
            videos: makeDayVideos('ir-knee-comeback', 'Injury Rehab', 'Beginner', 2, [840, 480, 360, 540, 600, 480]).map(withUrl),
            exercises: [
                { name: 'Quad Set', sets: '3', reps: '15', muscleGroup: 'Quads' },
                { name: 'Straight Leg Raise', sets: '3', reps: '12', muscleGroup: 'Quads, Hip Flexors' },
                { name: 'Knee Tracking Squat', sets: '3', reps: '10', muscleGroup: 'Quads, Glutes' },
                { name: 'Step-Up (low box)', sets: '3', reps: '10', muscleGroup: 'Quads, Glutes' },
                { name: 'Terminal Knee Extension', sets: '3', reps: '15', muscleGroup: 'Quads' },
                { name: 'Glute Bridge', sets: '3', reps: '15', muscleGroup: 'Glutes, Hamstrings' },
            ],
        },
        {
            id: 'ir-shoulder-reset',
            title: 'Shoulder Reset Series',
            coachName: 'Dr. Nathan Clark',
            durationWeeks: 3,
            level: 'Intermediate',
            focus: 'Rotator cuff and scapula',
            description: 'Controlled shoulder rehab drills for better range and stability.',
            videos: makeDayVideos('ir-shoulder-reset', 'Injury Rehab', 'Intermediate', 3, [720, 420, 360, 360, 480, 540]).map(withUrl),
            exercises: [
                { name: 'Shoulder External Rotation (band)', sets: '3', reps: '15', muscleGroup: 'Rotator Cuff' },
                { name: 'Scapular Retraction', sets: '3', reps: '15', muscleGroup: 'Rhomboids, Traps' },
                { name: 'Wall Slide', sets: '3', reps: '10', muscleGroup: 'Serratus, Shoulder' },
                { name: 'Prone Y-T-W', sets: '3', reps: '10', muscleGroup: 'Lower Traps, Rear Delt' },
                { name: 'Internal Rotation (band)', sets: '3', reps: '15', muscleGroup: 'Rotator Cuff' },
                { name: 'Side-Lying Abduction', sets: '3', reps: '12', muscleGroup: 'Rotator Cuff' },
            ],
        },
        {
            id: 'ir-back-to-training',
            title: 'Back to Training',
            coachName: 'Dr. Ashley Brown',
            durationWeeks: 4,
            level: 'Beginner',
            focus: 'Lower back and core',
            description: 'Gentle trunk stability and mobility work for returning to exercise.',
            videos: makeDayVideos('ir-back-to-training', 'Injury Rehab', 'Beginner', 4, [600, 480, 540, 420, 560, 500]).map(withUrl),
            exercises: [
                { name: 'Dead Bug', sets: '3', reps: '10', muscleGroup: 'Core' },
                { name: 'Bird Dog', sets: '3', reps: '10', muscleGroup: 'Core, Lower Back' },
                { name: 'Pallof Press', sets: '3', reps: '12', muscleGroup: 'Core, Obliques' },
                { name: "McGill's Big 3 — Curl-Up", sets: '3', reps: '10', muscleGroup: 'Core' },
                { name: 'Side Plank', sets: '3', duration: '20 sec', muscleGroup: 'Obliques, Core' },
                { name: 'Hip Hinge Pattern', sets: '3', reps: '12', muscleGroup: 'Lower Back, Glutes' },
            ],
        },
        {
            id: 'ir-hip-restore',
            title: 'Hip Mobility Restore',
            coachName: 'Dr. Jennifer Reed',
            durationWeeks: 3,
            level: 'Intermediate',
            focus: 'Hip capsule and glute med',
            description: 'Safe hip mobility drills to resolve impingement and restore movement.',
            videos: makeDayVideos('ir-hip-restore', 'Injury Rehab', 'Intermediate', 3, [600, 720, 480, 540, 660, 500]).map(withUrl),
            exercises: [
                { name: 'Clamshell', sets: '3', reps: '15', muscleGroup: 'Glute Med, Hip Rotators' },
                { name: 'Banded Monster Walk', sets: '3', duration: '20 sec', muscleGroup: 'Glute Med' },
                { name: '90/90 Hip Switch', sets: '3', reps: '8', muscleGroup: 'Hip Capsule' },
                { name: 'Hip CARS (Controlled Articular Rotations)', sets: '2', reps: '5', muscleGroup: 'Hip Capsule' },
                { name: 'Glute Bridge — Single Leg', sets: '3', reps: '10', muscleGroup: 'Glutes, Hamstrings' },
                { name: 'Standing Hip Abduction (band)', sets: '3', reps: '15', muscleGroup: 'Glute Med' },
            ],
        },
    ],
};

export const PRE_RECORDED_PROGRAMS = PROGRAMS_RAW;

export const getAllPrograms = (): PreRecordedProgram[] =>
    Object.values(PRE_RECORDED_PROGRAMS).flat();

export const getProgramCategoryKey = (programId: string): ProgramCategoryKey | null => {
    for (const [key, programs] of Object.entries(PRE_RECORDED_PROGRAMS)) {
        if (programs.some((p) => p.id === programId)) return key as ProgramCategoryKey;
    }
    return null;
};

export const getProgramsByCategory = (categoryKey: ProgramCategoryKey): PreRecordedProgram[] =>
    PRE_RECORDED_PROGRAMS[categoryKey] ?? [];

export const getProgramById = (categoryKey: ProgramCategoryKey, programId: string) =>
    getProgramsByCategory(categoryKey).find((p) => p.id === programId);

/** Returns the program that owns a given day-video ID (e.g. "mg-lean-bulk_d3" → mg-lean-bulk program). */
export const getProgramByVideoId = (videoId: string): PreRecordedProgram | undefined => {
    // Video IDs follow the pattern {programId}_d{n}
    const programId = String(videoId ?? '').replace(/(_d\d+|_intro)$/, '');
    for (const programs of Object.values(PROGRAMS_RAW)) {
        const found = programs.find((p) => p.id === programId);
        if (found) return found;
    }
    return undefined;
};
