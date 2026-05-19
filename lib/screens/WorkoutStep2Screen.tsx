import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { useWorkout } from '../providers/WorkoutContext';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';

const EQUIPMENT = [
  { name: 'Bodyweight only', id: 'bodyweight' },
  { name: 'Dumbbells', id: 'dumbbells' },
  { name: 'Barbell', id: 'barbell' },
  { name: 'Resistance Bands', id: 'bands' },
  { name: 'Cable Machine', id: 'cables' },
  { name: 'Kettlebell', id: 'kettlebell' },
  { name: 'Medicine Ball', id: 'medicine_ball' },
  { name: 'Pull-up Bar', id: 'pullup_bar' },
];

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];
const ENVIRONMENTS = ['Home', 'Gym', 'Outdoor'];
const DURATIONS = [15, 20, 30, 45, 60];

export const WorkoutStep2Screen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { setSelectedEquipment, setDifficulty, setEnvironment, setDuration } = useWorkout();
  
  const muscles = route.params?.muscles || [];
  const [selectedEquipment, setLocalEquipment] = useState<string[]>([]);
  const [selectedDifficulty, setLocalDifficulty] = useState('Intermediate');
  const [selectedEnvironment, setLocalEnvironment] = useState('Gym');
  const [selectedDuration, setLocalDuration] = useState(30);

  const toggleEquipment = (id: string) => {
    if (selectedEquipment.includes(id)) {
      setLocalEquipment(selectedEquipment.filter(e => e !== id));
    } else {
      setLocalEquipment([...selectedEquipment, id]);
    }
  };

  const handleContinue = () => {
    if (selectedEquipment.length === 0) {
      Alert.alert('Error', 'Please select at least one equipment');
      return;
    }

    // Save selections to context
    setSelectedEquipment(selectedEquipment);
    setDifficulty(selectedDifficulty);
    setEnvironment(selectedEnvironment);
    setDuration(selectedDuration);

    // Navigate to result with all params
    navigation.navigate('WorkoutResult', {
      muscles,
      equipment: selectedEquipment,
      difficulty: selectedDifficulty,
      environment: selectedEnvironment,
      duration: selectedDuration,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Step 2: Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Equipment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Equipment</Text>
          <Text style={styles.sectionSubtitle}>Choose what you have available</Text>
          <View style={styles.equipmentGrid}>
            {EQUIPMENT.map((equip) => {
              const isSelected = selectedEquipment.includes(equip.id);
              return (
                <TouchableOpacity
                  key={equip.id}
                  style={[styles.equipmentCard, isSelected && styles.equipmentCardSelected]}
                  onPress={() => toggleEquipment(equip.id)}
                >
                  <Text style={[styles.equipmentText, isSelected && styles.equipmentTextSelected]}>
                    {equip.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Duration Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.optionsRow}>
            {DURATIONS.map((duration) => (
              <TouchableOpacity
                key={duration}
                style={[styles.optionButton, selectedDuration === duration && styles.optionButtonSelected]}
                onPress={() => setLocalDuration(duration)}
              >
                <Text style={[styles.optionText, selectedDuration === duration && styles.optionTextSelected]}>
                  {duration}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Difficulty Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Difficulty Level</Text>
          <View style={styles.optionsRow}>
            {DIFFICULTIES.map((difficulty) => (
              <TouchableOpacity
                key={difficulty}
                style={[styles.optionButton, selectedDifficulty === difficulty && styles.optionButtonSelected]}
                onPress={() => setLocalDifficulty(difficulty)}
              >
                <Text style={[styles.optionText, selectedDifficulty === difficulty && styles.optionTextSelected]}>
                  {difficulty}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Environment Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout Location</Text>
          <View style={styles.optionsRow}>
            {ENVIRONMENTS.map((environment) => (
              <TouchableOpacity
                key={environment}
                style={[styles.optionButton, selectedEnvironment === environment && styles.optionButtonSelected]}
                onPress={() => setLocalEnvironment(environment)}
              >
                <Text style={[styles.optionText, selectedEnvironment === environment && styles.optionTextSelected]}>
                  {environment}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, selectedEquipment.length === 0 && styles.continueButtonDisabled]}
          disabled={selectedEquipment.length === 0}
          onPress={handleContinue}
        >
          <Text style={[styles.continueButtonText, selectedEquipment.length === 0 && styles.continueButtonTextDisabled]}>
            Generate Workout
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  container: {
    padding: 16,
    paddingBottom: 80,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: FontSizes.h5,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: FontSizes.small,
    color: AppTheme.textGrey,
    marginBottom: 12,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  equipmentCard: {
    width: '48%',
    backgroundColor: AppTheme.cardColor,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  equipmentCardSelected: {
    borderColor: AppTheme.primaryColor,
    backgroundColor: `rgba(249, 115, 22, 0.1)`,
  },
  equipmentText: {
    color: AppTheme.textWhite,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold as any,
    textAlign: 'center',
  },
  equipmentTextSelected: {
    color: AppTheme.primaryColor,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    backgroundColor: AppTheme.cardColor,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: AppTheme.primaryColor,
    backgroundColor: `rgba(249, 115, 22, 0.2)`,
  },
  optionText: {
    color: AppTheme.textWhite,
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold as any,
  },
  optionTextSelected: {
    color: AppTheme.primaryColor,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: AppTheme.background,
    borderTopWidth: 1,
    borderTopColor: AppTheme.cardColor,
  },
  continueButton: {
    backgroundColor: AppTheme.primaryColor,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: AppTheme.cardColor,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: FontSizes.h5,
    fontWeight: FontWeights.bold as any,
  },
  continueButtonTextDisabled: {
    color: AppTheme.textGrey,
  },
});
