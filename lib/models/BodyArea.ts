export interface Muscle {
  id: string;
  name: string;
  imageUrl: string;
  aliases: string[];
}

export interface BodyArea {
  id: string;
  name: string;
  imageUrl: string;
  muscles: Muscle[];
}

// Predefined body data (can be moved to Firestore later)
export const BODY_AREAS: BodyArea[] = [
  {
    id: 'upper',
    name: 'Upper Body',
    imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/images/exercises/upper%20pecs/target-2.svg',
    muscles: [
      { id: 'chest', name: 'Chest', imageUrl: '', aliases: ['Pectorals', 'Pecs'] },
      { id: 'back', name: 'Back', imageUrl: '', aliases: ['Lats', 'Dorsal'] },
      { id: 'shoulders', name: 'Shoulders', imageUrl: '', aliases: ['Deltoids', 'Delts'] },
      { id: 'biceps', name: 'Biceps', imageUrl: '', aliases: ['Arm Flexors'] },
      { id: 'triceps', name: 'Triceps', imageUrl: '', aliases: ['Arm Extensors'] },
    ],
  },
  {
    id: 'lower',
    name: 'Lower Body',
    imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/images/exercises/glutes/target-0.svg',
    muscles: [
      { id: 'quads', name: 'Quadriceps', imageUrl: '', aliases: ['Quads', 'Front Thigh'] },
      { id: 'hamstring', name: 'Hamstrings', imageUrl: '', aliases: ['Back Thigh'] },
      { id: 'glutes', name: 'Glutes', imageUrl: '', aliases: ['Butt', 'Buttocks'] },
      { id: 'calves', name: 'Calves', imageUrl: '', aliases: ['Calf'] },
    ],
  },
  {
    id: 'core',
    name: 'Core',
    imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/images/exercises/abs/target-0.svg',
    muscles: [
      { id: 'abs', name: 'Abs', imageUrl: '', aliases: ['Rectus Abdominis', 'Six Pack'] },
      { id: 'obliques', name: 'Obliques', imageUrl: '', aliases: ['Side Abs'] },
    ],
  },
];

export const EQUIPMENT_DESCRIPTIONS: Record<string, string> = {
  'bodyweight': 'Bodyweight only (no equipment)',
  'dumbbells': 'Dumbbells',
  'barbell': 'Barbell',
  'kettlebells': 'Kettlebells',
  'resistance_bands': 'Resistance Bands',
  'cable_machine': 'Cable Machine',
  'smith_machine': 'Smith Machine',
  'bench': 'Bench',
  'pull_up_bar': 'Pull-up Bar',
  'treadmill': 'Treadmill',
  'rowing_machine': 'Rowing Machine',
};

export const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const;
export const ENVIRONMENTS = ['Home', 'Gym', 'Outdoor'] as const;
