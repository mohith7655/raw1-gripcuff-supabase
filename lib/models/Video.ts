export type VideoCategory = 'Strength' | 'HIIT' | 'Cardio' | 'Recovery' | 'Mobility' | 'Tutorial' | 'All' | 'GripCuff' | 'MuscleGrowth' | 'Stretching' | 'AthleticPerformance' | 'InjuryRehab';
export type VideoType = 'All' | 'GripCuff' | 'Trainer';
export type SubTab = 'all' | 'workouts' | 'goals';

export interface Video {
  id: string;
  title: string;
  category: VideoCategory;
  duration: number; // in seconds
  thumbnail: string;
  description: string;
  instructor?: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  videoUrl?: string;
  createdAt?: Date;
  videoType: VideoType;
  isCompleted?: boolean;
  bodyPart?: string; // For body part categorization in Muscle Growth section
  locked?: boolean;
  color?: string;
  equipment?: string;
  muscles?: string;
  intensity?: 'Low' | 'Medium' | 'High';
  exerciseType?: 'General' | 'Strength' | 'Stretching' | 'Injury' | 'Athletic';
  experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
  youtubeId?: string;
}

export type CreateVideoInput = Omit<Video, 'id' | 'createdAt' | 'isCompleted'>;
