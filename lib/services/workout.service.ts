import { OPENAI_API_KEY, OPENAI_API_BASE } from '../core/config/api_keys';
import { Exercise, WorkoutGenerationParams, EQUIPMENT_DESCRIPTIONS } from '../models';

export class WorkoutService {
  static async generateWorkout(params: WorkoutGenerationParams): Promise<Exercise[]> {
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured, using mock workout');
      return this.getMockWorkout();
    }

    const equipmentNames = params.equipment.map(id => {
      const label = EQUIPMENT_DESCRIPTIONS[id];
      return label || id;
    });

    const prompt = `
Act as a professional fitness coach.
Context: User is working out at ${params.environment}.
Input: Duration: ${params.duration} minutes. Level: ${params.difficulty}.
${params.gender ? `Gender: ${params.gender}.` : ''}
${params.targetMuscles && params.targetMuscles.length > 0 ? `Target Muscles: ${params.targetMuscles.join(', ')}.` : ''}
Available Equipment: ${equipmentNames.join(', ')}.

CRITICAL RULES:
1. ONLY suggest exercises that can be done with the listed equipment.
2. If "Resistance Bands" → suggest only band exercises.
3. If "Bodyweight only" → suggest only body-only exercises.
4. NEVER suggest machine-based exercises unless explicitly listed.

NAMING RULES (VERY IMPORTANT):
1. Use standard, simple exercise names. No parentheses or extra descriptions.
2. Examples of CORRECT names: "Bench Press", "Squat", "Deadlift", "Push Up", "Plank"
3. Examples of WRONG names: "Bench Press (Barbell)", "Squat (Wide Stance)"
4. Keep names short: 2-3 words maximum when possible.
5. Do NOT add equipment type in parentheses after the name.

VOICEOVER SCRIPT RULES (MANDATORY):
For each exercise, you MUST generate a "voiceover_script" field.
This script should be approximately 130-150 words (about 1 minute of speaking).
Structure the script like a real personal trainer speaking directly to the user:
1. Start with an energetic opening (e.g. "Alright, next up is the Bench Press!").
2. Explain the SETUP clearly (e.g. "Lie back on the bench, plant your feet firmly...").
3. Explain the MOVEMENT step by step (e.g. "Lower the bar slowly to your chest...").
4. Give 2-3 specific coaching cues (e.g. "Keep your elbows tucked at 45 degrees").
5. End with motivation and a countdown (e.g. "Let's crush this set! 3, 2, 1, GO!").
Use a conversational, motivating tone. Speak as if you are standing next to the user.

FORMATTING RULES:
1. Return strictly a JSON object with key "workout" containing the exercises array.
2. All fields must be STRINGS in double quotes.
   - Correct: "reps": "10-12"
   - Incorrect: "reps": 10-12, or "reps": "10 to 12"
3. Do not use Markdown.
4. Generate ${Math.ceil(params.duration / 5)} exercises based on duration.

Return ONLY valid JSON, no markdown, no code blocks.`;

    try {
      const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional fitness coach that generates detailed workout plans.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Parse the JSON response
      let workoutData;
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        workoutData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content);
        throw new Error('Failed to parse workout data from AI response');
      }

      if (!workoutData.workout || !Array.isArray(workoutData.workout)) {
        throw new Error('Invalid workout format from AI');
      }

      return workoutData.workout as Exercise[];
    } catch (error) {
      console.error('Workout generation error:', error);
      throw error;
    }
  }

  static getEquipmentOptions() {
    return Object.entries(EQUIPMENT_DESCRIPTIONS).map(([id, label]) => ({
      id,
      label,
    }));
  }

  static getEnvironmentOptions() {
    return ['Home', 'Gym', 'Outdoor'];
  }

  static getDifficultyOptions() {
    return ['Beginner', 'Intermediate', 'Advanced'];
  }

  static getMockWorkout(): Exercise[] {
    return [
      {
        name: 'Push Up',
        sets: '3',
        reps: '10-15',
        notes: 'Keep your body straight, elbows at 45 degrees',
        voiceover_script: 'Alright, let\'s start with Push Ups! This is a foundational exercise that works your chest, shoulders, and triceps. Get into a plank position with your hands shoulder-width apart. Keep your body in a straight line from your head to your heels. Lower yourself down until your chest nearly touches the ground. Push yourself back up to the starting position. Remember, it\'s better to do fewer reps with good form than many with bad form. Keep those elbows tucked in. Let\'s go for 10 to 15 reps. You got this!',
      },
      {
        name: 'Bodyweight Squat',
        sets: '3',
        reps: '15-20',
        notes: 'Knees in line with toes, weight in heels',
        voiceover_script: 'Next up is the Bodyweight Squat. This exercise works your legs and glutes. Stand with your feet shoulder-width apart, toes pointing forward. Keep your weight in your heels and your chest up. Lower yourself down as if you\'re sitting in a chair. Go as low as you can comfortably go while keeping your knees behind your toes. Push through your heels to stand back up. This is a great exercise for building leg strength and endurance. Let\'s aim for 15 to 20 reps. Go!',
      },
      {
        name: 'Plank',
        sets: '3',
        reps: '30-60 seconds',
        notes: 'Keep hips level, engage core',
        voiceover_script: 'Now let\'s move into a Plank. This is an excellent core stabilizer exercise. Get into a push-up position but with your forearms on the ground instead of your hands. Your elbows should be under your shoulders. Keep your body in a straight line from your head to your heels. Engage your core by pulling your belly button in towards your spine. Don\'t let your hips sag or pike up. Breathe steadily and hold this position. This will challenge your entire core, including your abs, back, and shoulders. Give it 30 to 60 seconds. You\'ve got this!',
      },
    ];
  }
}
