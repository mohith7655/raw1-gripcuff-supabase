export interface Exercise {
  id?: string;
  name: string;
  equipment?: string[];
  muscleGroup?: string;
  sets: string;
  reps: string;
  notes: string;
  voiceover_script: string;
  imageUrl?: string;
  gifUrl?: string;
}

export interface Workout {
  id: string;
  userId: string;
  targetArea: string;
  targetMuscles: string[];
  equipment: string[];
  environment: string;
  duration: number;
  difficulty: string;
  exercises: Exercise[];
  createdAt: Date;
  completedAt?: Date;
}

export interface WorkoutGenerationParams {
  targetMuscles: string[];
  equipment: string[];
  duration: number;
  difficulty: string;
  environment: string;
  gender?: string;
  goal?: string;
}
