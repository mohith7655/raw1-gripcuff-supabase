/**
 * SocialProfile
 *
 * Social identity fields enrich the profile progressively. Legacy social
 * fields still live on `users`; place metadata is read/written through the
 * `profiles` table columns added in the profile place migration.
 */

export type LookingToMeet = 'social' | 'professional' | 'both';

export type ConnectionGoal =
    | 'workout_buddies'
    | 'fitness_motivation'
    | 'training_partners'
    | 'friends'
    | 'networking'
    | 'mentorship'
    | 'collaboration'
    | 'event_partners';

export type Hobby =
    | 'gym'
    | 'cycling'
    | 'photography'
    | 'reading'
    | 'running'
    | 'travel'
    | 'cooking'
    | 'gaming'
    | 'hiking'
    | 'swimming'
    | 'yoga'
    | 'football'
    | 'basketball'
    | 'martial_arts'
    | 'music'
    | 'art';

export type AgeGroup =
    | 'teens'
    | 'young_adults'
    | 'adults'
    | 'middle_aged'
    | 'seniors';

export interface ProfilePlace {
    placeId?: string | null;
    name?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
}

export interface SocialProfile {
    uid: string;
    qrSlug?: string | null;
    bio?: string | null;
    whatIDo?: string | null;
    openToConnect?: boolean;
    lookingToMeet?: LookingToMeet | null;
    connectionGoals?: ConnectionGoal[];

    gymPlaceId?: string | null;
    gymName?: string | null;
    gymArea?: string | null;
    gymAddress?: string | null;
    gymLat?: number | null;
    gymLng?: number | null;

    housePlaceId?: string | null;
    houseName?: string | null;
    houseAddress?: string | null;
    houseLat?: number | null;
    houseLng?: number | null;

    parkPlaceId?: string | null;
    parkName?: string | null;
    parkAddress?: string | null;
    parkLat?: number | null;
    parkLng?: number | null;

    hobbies?: Hobby[];
    communityNote?: string | null;
    helpingBeginners?: boolean;
    openToMentor?: boolean;
    openToTrainAgeGroups?: AgeGroup[];

    /** Preferred city / location — maps to profiles.city */
    city?: string | null;
    /** Country — maps to profiles.country */
    country?: string | null;
}

export const CONNECTION_GOAL_META: Record<ConnectionGoal, { label: string; emoji: string }> = {
    workout_buddies: { label: 'Workout Buddies', emoji: '' },
    fitness_motivation: { label: 'Fitness Motivation', emoji: '' },
    training_partners: { label: 'Training Partners', emoji: '' },
    friends: { label: 'Friends', emoji: '' },
    networking: { label: 'Networking', emoji: '' },
    mentorship: { label: 'Mentorship', emoji: '' },
    collaboration: { label: 'Collaboration', emoji: '' },
    event_partners: { label: 'Event Partners', emoji: '' },
};

export const HOBBY_META: Record<Hobby, { label: string; emoji: string }> = {
    gym: { label: 'Gym', emoji: '' },
    cycling: { label: 'Cycling', emoji: '' },
    photography: { label: 'Photography', emoji: '' },
    reading: { label: 'Reading', emoji: '' },
    running: { label: 'Running', emoji: '' },
    travel: { label: 'Travel', emoji: '' },
    cooking: { label: 'Cooking', emoji: '' },
    gaming: { label: 'Gaming', emoji: '' },
    hiking: { label: 'Hiking', emoji: '' },
    swimming: { label: 'Swimming', emoji: '' },
    yoga: { label: 'Yoga', emoji: '' },
    football: { label: 'Football', emoji: '' },
    basketball: { label: 'Basketball', emoji: '' },
    martial_arts: { label: 'Martial Arts', emoji: '' },
    music: { label: 'Music', emoji: '' },
    art: { label: 'Art', emoji: '' },
};

export const AGE_GROUP_META: Record<AgeGroup, string> = {
    teens: 'Teens (13-17)',
    young_adults: 'Young Adults (18-25)',
    adults: 'Adults (26-40)',
    middle_aged: 'Middle-aged (41-55)',
    seniors: 'Seniors (55+)',
};

export const ALL_HOBBIES = Object.keys(HOBBY_META) as Hobby[];
export const ALL_CONNECTION_GOALS = Object.keys(CONNECTION_GOAL_META) as ConnectionGoal[];
export const ALL_AGE_GROUPS = Object.keys(AGE_GROUP_META) as AgeGroup[];

export const WHAT_I_DO_PRESETS = [
    'Gym & Fitness',
    'Software Engineer',
    'Student',
    'Content Creator',
    'Personal Trainer',
    'Entrepreneur',
    'Designer',
    'Healthcare',
    'Chef',
    'Musician',
    'Researcher',
    'Builder',
];
