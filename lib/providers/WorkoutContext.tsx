import React, { createContext, useContext, useState } from 'react';
import { WorkoutService } from '../services/workout.service';
import { Exercise, Workout, WorkoutGenerationParams } from '../models';

interface WorkoutContextType {
  currentWorkout: Workout | null;
  exercises: Exercise[];
  loading: boolean;
  error: string | null;
  // Step 1: Body area selection
  selectedMuscles: string[];
  setSelectedMuscles: (muscles: string[]) => void;
  // Step 2: Equipment selection
  selectedEquipment: string[];
  setSelectedEquipment: (equipment: string[]) => void;
  // Step 3: Duration and difficulty
  duration: number;
  setDuration: (duration: number) => void;
  difficulty: string;
  setDifficulty: (difficulty: string) => void;
  environment: string;
  setEnvironment: (environment: string) => void;
  // Generation
  generateWorkout: (params: WorkoutGenerationParams) => Promise<void>;
  resetWorkout: () => void;
  clearError: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step selections
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [environment, setEnvironment] = useState('Gym');

  const generateWorkout = async (params: WorkoutGenerationParams) => {
    try {
      setLoading(true);
      setError(null);
      const generatedExercises = await WorkoutService.generateWorkout(params);
      setExercises(generatedExercises);
      
      // Create a workout object
      const newWorkout: Workout = {
        id: Date.now().toString(),
        userId: '', // Will be set from auth context
        targetArea: 'Custom',
        targetMuscles: params.targetMuscles,
        equipment: params.equipment,
        environment: params.environment,
        duration: params.duration,
        difficulty: params.difficulty,
        exercises: generatedExercises,
        createdAt: new Date(),
      };
      setCurrentWorkout(newWorkout);
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetWorkout = () => {
    setCurrentWorkout(null);
    setExercises([]);
    setSelectedMuscles([]);
    setSelectedEquipment([]);
    setDuration(30);
    setDifficulty('Intermediate');
    setEnvironment('Gym');
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <WorkoutContext.Provider
      value={{
        currentWorkout,
        exercises,
        loading,
        error,
        selectedMuscles,
        setSelectedMuscles,
        selectedEquipment,
        setSelectedEquipment,
        duration,
        setDuration,
        difficulty,
        setDifficulty,
        environment,
        setEnvironment,
        generateWorkout,
        resetWorkout,
        clearError,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (!context) throw new Error('useWorkout must be used within WorkoutProvider');
  return context;
}
