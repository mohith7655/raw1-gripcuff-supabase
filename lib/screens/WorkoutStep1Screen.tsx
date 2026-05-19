import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { useWorkout } from '../providers/WorkoutContext';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';

const BODY_AREAS = ['Upper Body', 'Lower Body', 'Core', 'Full Body'];
const MUSCLES = [
    { name: 'Chest', area: 'Upper Body' },
    { name: 'Back', area: 'Upper Body' },
    { name: 'Shoulders', area: 'Upper Body' },
    { name: 'Biceps', area: 'Upper Body' },
    { name: 'Triceps', area: 'Upper Body' },
    { name: 'Quads', area: 'Lower Body' },
    { name: 'Hamstrings', area: 'Lower Body' },
    { name: 'Glutes', area: 'Lower Body' },
    { name: 'Calves', area: 'Lower Body' },
    { name: 'Abs', area: 'Core' },
    { name: 'Obliques', area: 'Core' },
    { name: 'Total Body', area: 'Full Body' },
];

export const WorkoutStep1Screen = () => {
    const navigation = useNavigation<any>();
    const { setSelectedMuscles, selectedEquipment, setSelectedEquipment } = useWorkout();
    const [gender, setGender] = useState<'Male' | 'Female'>('Male');
    const [selectedArea, setSelectedArea] = useState(BODY_AREAS[0]);
    const [localSelectedMuscles, setLocalSelectedMuscles] = useState<string[]>([]);

    const toggleMuscle = (muscle: string) => {
        if (localSelectedMuscles.includes(muscle)) {
            setLocalSelectedMuscles(localSelectedMuscles.filter(m => m !== muscle));
        } else {
            setLocalSelectedMuscles([...localSelectedMuscles, muscle]);
        }
    };

    const removeMuscle = (muscle: string) => {
        setLocalSelectedMuscles(localSelectedMuscles.filter(m => m !== muscle));
    };

    const displayedMuscles = MUSCLES.filter(m => m.area === selectedArea);

    const handleContinue = () => {
        setSelectedMuscles(localSelectedMuscles);
        navigation.navigate('WorkoutStep2', { muscles: localSelectedMuscles, gender });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Step 1: Select Target Area</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.subtitleContainer}>
                <Text style={styles.subtitle}>Choose body area and muscle group</Text>
            </View>

            {/* Gender Toggle */}
            <View style={styles.genderToggleContainer}>
                <TouchableOpacity
                    style={[styles.genderButton, gender === 'Male' && styles.genderButtonSelected]}
                    onPress={() => setGender('Male')}
                >
                    <Text style={[styles.genderText, gender === 'Male' && styles.genderTextSelected]}>Male</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.genderButton, gender === 'Female' && styles.genderButtonSelected]}
                    onPress={() => setGender('Female')}
                >
                    <Text style={[styles.genderText, gender === 'Female' && styles.genderTextSelected]}>Female</Text>
                </TouchableOpacity>
            </View>

            {/* Body Area Tabs */}
            <View style={styles.tabsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {BODY_AREAS.map((area) => (
                        <TouchableOpacity
                            key={area}
                            style={[styles.tabButton, selectedArea === area && styles.tabButtonSelected]}
                            onPress={() => setSelectedArea(area)}
                        >
                            <Text style={[styles.tabText, selectedArea === area && styles.tabTextSelected]}>
                                {area}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Muscle Grid */}
            <ScrollView contentContainerStyle={styles.muscleGrid}>
                {displayedMuscles.map((muscle) => {
                    const isSelected = localSelectedMuscles.includes(muscle.name);
                    return (
                        <TouchableOpacity
                            key={muscle.name}
                            style={[styles.muscleCard, isSelected && styles.muscleCardSelected]}
                            onPress={() => toggleMuscle(muscle.name)}
                        >
                            <Text style={[styles.muscleText, isSelected && styles.muscleTextSelected]}>
                                {muscle.name}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                {/* Selected Chips */}
                {localSelectedMuscles.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                        {localSelectedMuscles.map(muscle => (
                            <TouchableOpacity key={muscle} style={styles.chip} onPress={() => removeMuscle(muscle)}>
                                <Text style={styles.chipText}>{muscle} ✕</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                <TouchableOpacity
                    style={[styles.continueButton, localSelectedMuscles.length === 0 && styles.continueButtonDisabled]}
                    disabled={localSelectedMuscles.length === 0}
                    onPress={handleContinue}
                >
                    <Text style={[styles.continueButtonText, localSelectedMuscles.length === 0 && styles.continueButtonTextDisabled]}>
                        Continue
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#1d2337',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    subtitleContainer: {
        alignItems: 'center',
        paddingBottom: 24,
    },
    subtitle: {
        fontSize: 14,
        color: '#a6afc2',
    },
    genderToggleContainer: {
        flexDirection: 'row',
        marginHorizontal: 24,
        backgroundColor: '#465060',
        borderRadius: 24,
        padding: 4,
        marginBottom: 24,
    },
    genderButton: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 20,
    },
    genderButtonSelected: {
        backgroundColor: '#e46600',
    },
    genderText: {
        color: '#a6afc2',
        fontWeight: 'bold',
    },
    genderTextSelected: {
        color: '#fff',
    },
    tabsContainer: {
        marginBottom: 24,
        paddingLeft: 16,
    },
    tabButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginRight: 12,
        borderRadius: 20,
        backgroundColor: '#465060',
    },
    tabButtonSelected: {
        backgroundColor: '#e46600',
    },
    tabText: {
        color: '#a6afc2',
        fontWeight: '600',
    },
    tabTextSelected: {
        color: '#fff',
    },
    muscleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        justifyContent: 'space-between',
    },
    muscleCard: {
        width: '48%',
        backgroundColor: '#465060',
        borderRadius: 16,
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    muscleCardSelected: {
        backgroundColor: 'rgba(228, 102, 0, 0.12)',
        borderColor: '#e46600',
    },
    muscleText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    muscleTextSelected: {
        color: '#e46600',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#465060',
        backgroundColor: '#1d2337',
    },
    chipsContainer: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    chip: {
        backgroundColor: '#465060',
        borderRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginRight: 8,
    },
    chipText: {
        color: '#fff',
        fontSize: 12,
    },
    continueButton: {
        backgroundColor: '#e46600',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    continueButtonDisabled: {
        backgroundColor: '#465060',
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    continueButtonTextDisabled: {
        color: '#a6afc2',
    },
});
