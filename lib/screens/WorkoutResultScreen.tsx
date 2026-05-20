import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Play, Pause, Volume2, X } from 'lucide-react-native';
import { useWorkout } from '../providers/WorkoutContext';
import { useAuth } from '../providers/AuthContext';
import { TTSService } from '../services/tts.service';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { recordUniversalWorkoutCompletion } from '../services/workoutCompletion.service';

export const WorkoutResultScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { supabaseUserId } = useAuth();
  const { generateWorkout, exercises, loading, error, resetWorkout, currentWorkout } = useWorkout();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState<number | null>(null);
  const [currentText, setCurrentText] = useState<string>('');

  // Generate workout when screen mounts with params
  useEffect(() => {
    if (route.params && !exercises.length && !loading) {
      const { muscles, equipment, duration, difficulty, environment, goal } = route.params;
      generateWorkout({
        targetMuscles: muscles || [],
        equipment: equipment || [],
        duration: duration || 30,
        difficulty: difficulty || 'Intermediate',
        environment: environment || 'Gym',
      }).catch((err) => {
        Alert.alert('Error', 'Failed to generate workout: ' + err.message);
      });
    }
  }, [route.params]);

  const handleTTS = async (text: string, index: number) => {
    try {
      if (currentExerciseIndex === index && isSpeaking) {
        // Resume if paused
        if (isPaused) {
          await TTSService.resume();
          setIsPaused(false);
        } else {
          // Pause if playing
          await TTSService.pause();
          setIsPaused(true);
        }
      } else {
        // Start new speech
        await TTSService.stop();
        setCurrentExerciseIndex(index);
        setCurrentText(text);
        setIsSpeaking(true);
        setIsPaused(false);
        
        await TTSService.speak(
          text,
          () => {
            // On done
            setIsSpeaking(false);
            setIsPaused(false);
            setCurrentExerciseIndex(null);
          },
          () => {
            // On error
            setIsSpeaking(false);
            setIsPaused(false);
          }
        );
      }
    } catch (err) {
      Alert.alert('TTS Error', (err as Error).message);
      setIsSpeaking(false);
      setIsPaused(false);
    }
  };

  const handleStop = async () => {
    try {
      await TTSService.stop();
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentExerciseIndex(null);
    } catch (err) {
      Alert.alert('Error', (err as Error).message);
    }
  };

  const handleFinish = () => {
    Alert.alert('Workout Complete', 'Great job! Save this workout to your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: () => {
          // Record completion — duration in minutes from params, fallback 30
          const uid = supabaseUserId;
          if (uid) {
            const durationMin: number = currentWorkout?.duration ?? route.params?.duration ?? 30;
            recordUniversalWorkoutCompletion(uid, {
              workoutId: `ai_workout_${Date.now()}`,
              workoutTitle: 'AI Generated Workout',
              sourceType: 'ai_trainer',
              watchMinutes: durationMin,
            })
              .then(r => console.log('[WorkoutResult] completion recorded — streak:', r.newStreak))
              .catch(e => console.warn('[WorkoutResult] completion failed:', e?.message ?? e));
          }
          resetWorkout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'HomeTabs', params: { screen: 'WorkoutsTab' } }],
          });
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={AppTheme.primaryColor} />
          <Text style={styles.loaderText}>Generating your workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const workoutExercises = exercises.length > 0 ? exercises : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your AI Workout</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Workout Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>
          {workoutExercises.length} Exercises • {currentWorkout?.duration || 30} min
        </Text>
        <Text style={styles.infoDifficulty}>Level: {currentWorkout?.difficulty || 'Intermediate'}</Text>
      </View>

      {/* Exercises List */}
      <ScrollView contentContainerStyle={styles.listContainer}>
        {workoutExercises.length > 0 ? (
          workoutExercises.map((exercise, index) => (
            <WorkoutExerciseCard
              key={index}
              exercise={exercise}
              number={index + 1}
              isPlaying={currentExerciseIndex === index && isSpeaking && !isPaused}
              isPaused={currentExerciseIndex === index && isPaused}
              onPlay={() => handleTTS(exercise.voiceover_script || exercise.name, index)}
              onStop={handleStop}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No exercises generated yet</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
          <Text style={styles.finishButtonText}>Complete Workout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const WorkoutExerciseCard = ({
  exercise,
  number,
  isPlaying,
  isPaused,
  onPlay,
  onStop,
}: {
  exercise: any;
  number: number;
  isPlaying: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onStop: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(!expanded)}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{number}</Text>
        </View>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.cardTitle}>{exercise.name}</Text>
          <Text style={styles.cardSubtitle}>
            Sets: {exercise.sets} • Reps: {exercise.reps}
          </Text>
        </View>
        <TouchableOpacity style={styles.playButton} onPress={onPlay}>
          {isPlaying ? (
            <Pause color={AppTheme.primaryColor} size={20} />
          ) : isPaused ? (
            <Play color={AppTheme.primaryColor} size={20} />
          ) : (
            <Play color={AppTheme.primaryColor} size={20} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          {exercise.voiceover_script && (
            <View style={styles.voiceoverContainer}>
              <View style={styles.voiceoverHeader}>
                <Volume2 color={AppTheme.primaryColor} size={16} />
                <Text style={styles.voiceoverLabel}>Voiceover Script</Text>
              </View>
              <Text style={styles.voiceoverText}>{exercise.voiceover_script}</Text>
              <View style={styles.ttsControlsContainer}>
                <TouchableOpacity style={styles.ttsButton} onPress={onPlay}>
                  {isPlaying ? (
                    <>
                      <Pause color="#fff" size={16} style={{ marginRight: 8 }} />
                      <Text style={styles.ttsButtonText}>Pause</Text>
                    </>
                  ) : isPaused ? (
                    <>
                      <Play color="#fff" size={16} style={{ marginRight: 8 }} />
                      <Text style={styles.ttsButtonText}>Resume</Text>
                    </>
                  ) : (
                    <>
                      <Play color="#fff" size={16} style={{ marginRight: 8 }} />
                      <Text style={styles.ttsButtonText}>Play Voiceover</Text>
                    </>
                  )}
                </TouchableOpacity>
                {(isPlaying || isPaused) && (
                  <TouchableOpacity style={styles.stopButton} onPress={onStop}>
                    <X color="#fff" size={16} style={{ marginRight: 8 }} />
                    <Text style={styles.ttsButtonText}>Stop</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {exercise.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{exercise.notes}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.cardColor,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: FontSizes.h4,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: AppTheme.cardColor,
  },
  infoTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold as any,
    color: AppTheme.textWhite,
    marginBottom: 4,
  },
  infoDifficulty: {
    fontSize: FontSizes.small,
    color: AppTheme.textGrey,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 16,
    fontSize: FontSizes.body,
    color: AppTheme.textGrey,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: FontSizes.h3,
    fontWeight: FontWeights.bold as any,
    color: '#ff4444',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: FontSizes.body,
    color: AppTheme.textGrey,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: AppTheme.primaryColor,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: FontWeights.bold as any,
  },
  listContainer: {
    padding: 16,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: FontSizes.body,
    color: AppTheme.textGrey,
  },
  card: {
    backgroundColor: AppTheme.cardColor,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `rgba(${parseInt(AppTheme.primaryColor.slice(1, 3), 16)}, ${parseInt(AppTheme.primaryColor.slice(3, 5), 16)}, ${parseInt(AppTheme.primaryColor.slice(5, 7), 16)}, 0.3)`,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  numberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppTheme.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  numberText: {
    color: '#fff',
    fontWeight: FontWeights.bold as any,
    fontSize: FontSizes.body,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: FontSizes.h5,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: FontSizes.small,
    color: AppTheme.textGrey,
  },
  playButton: {
    padding: 8,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  voiceoverContainer: {
    backgroundColor: `rgba(${parseInt(AppTheme.primaryColor.slice(1, 3), 16)}, ${parseInt(AppTheme.primaryColor.slice(3, 5), 16)}, ${parseInt(AppTheme.primaryColor.slice(5, 7), 16)}, 0.1)`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  voiceoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  voiceoverLabel: {
    fontSize: FontSizes.small,
    fontWeight: FontWeights.semibold as any,
    color: AppTheme.primaryColor,
    marginLeft: 6,
  },
  voiceoverText: {
    fontSize: FontSizes.small,
    color: AppTheme.textWhite,
    lineHeight: 20,
    marginBottom: 12,
  },
  ttsButton: {
    flexDirection: 'row',
    backgroundColor: AppTheme.primaryColor,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  stopButton: {
    flexDirection: 'row',
    backgroundColor: '#d32f2f',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  ttsControlsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  ttsButtonText: {
    color: '#fff',
    fontWeight: FontWeights.semibold as any,
    fontSize: FontSizes.small,
  },
  notesContainer: {
    backgroundColor: AppTheme.background,
    padding: 12,
    borderRadius: 8,
  },
  notesLabel: {
    color: AppTheme.primaryColor,
    fontWeight: FontWeights.bold as any,
    fontSize: FontSizes.small,
    marginBottom: 4,
  },
  notesText: {
    color: AppTheme.textWhite,
    fontSize: FontSizes.body,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: AppTheme.cardColor,
  },
  finishButton: {
    backgroundColor: AppTheme.primaryColor,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontWeight: FontWeights.bold as any,
    fontSize: FontSizes.h5,
  },
});
