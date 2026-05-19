import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Image, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Play, Settings, Accessibility, Dumbbell, BarChart3, History, Info, Pause, X } from 'lucide-react-native';
import { TTSService } from '../services/tts.service';

const INSTRUCTIONS = [
    'Select a light load, set the pulley to a high position, and attach a rope.',
    'Grab the rope with your thumbs facing the ceiling.',
    'Take a step back to lift the weight off its stack, bring your shoulders back, and stagger your stance for extra support.',
    'Take a breath and pull the rope to your face, splitting it by bringing your arms to your sides. Breathe out.',
    'Extend your arms as you breathe in.',
];

export const FacePullDetailsPage = () => {
    const navigation = useNavigation<any>();
    const [activeTab, setActiveTab] = useState(2); // Start on "How to"
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

    const handleInstructionTTS = async (text: string, index: number) => {
        try {
            if (speakingIndex === index && isSpeaking) {
                // Toggle pause/resume
                if (isPaused) {
                    await TTSService.resume();
                    setIsPaused(false);
                } else {
                    await TTSService.pause();
                    setIsPaused(true);
                }
            } else {
                // Start new speech
                await TTSService.stop();
                setSpeakingIndex(index);
                setIsSpeaking(true);
                setIsPaused(false);
                
                await TTSService.speak(
                    text,
                    () => {
                        setIsSpeaking(false);
                        setIsPaused(false);
                        setSpeakingIndex(null);
                    },
                    () => {
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

    const handleStopTTS = async () => {
        try {
            await TTSService.stop();
            setIsSpeaking(false);
            setIsPaused(false);
            setSpeakingIndex(null);
        } catch (err) {
            Alert.alert('Error', (err as Error).message);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Exercise</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
                <View style={styles.infoContent}>
                    <Text style={styles.exerciseName}>Face Pull</Text>

                    <View style={styles.detailRow}>
                        <Settings color="#e46600" size={16} />
                        <Text style={styles.detailLabel}>Equipment: <Text style={styles.detailValue}>Machine</Text></Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Accessibility color="#e46600" size={16} />
                        <Text style={styles.detailLabel}>Primary Muscle Group: <Text style={styles.detailValue}>Shoulders</Text></Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Dumbbell color="#e46600" size={16} />
                        <Text style={styles.detailLabel}>Secondary Muscle Group: <Text style={styles.detailValue}>Biceps</Text></Text>
                    </View>
                </View>

                <View style={styles.gifContainer}>
                    <View style={styles.gifPlaceholder}>
                        <Play color="#1d2337" size={32} />
                    </View>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity style={[styles.tabButton, activeTab === 0 && styles.tabButtonActive]} onPress={() => setActiveTab(0)}>
                    <Text style={[styles.tabText, activeTab === 0 && styles.tabTextActive]}>Statistics</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 1 && styles.tabButtonActive]} onPress={() => setActiveTab(1)}>
                    <Text style={[styles.tabText, activeTab === 1 && styles.tabTextActive]}>History</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabButton, activeTab === 2 && styles.tabButtonActive]} onPress={() => setActiveTab(2)}>
                    <Text style={[styles.tabText, activeTab === 2 && styles.tabTextActive]}>How to</Text>
                </TouchableOpacity>
            </View>

            {/* Tab Content */}
            <View style={styles.tabContentContainer}>
                {activeTab === 0 && (
                    <View style={styles.placeholderTab}>
                        <BarChart3 color="rgba(166, 175, 194, 0.4)" size={48} />
                        <Text style={styles.placeholderText}>Statistics coming soon</Text>
                    </View>
                )}
                {activeTab === 1 && (
                    <View style={styles.placeholderTab}>
                        <History color="rgba(166, 175, 194, 0.4)" size={48} />
                        <Text style={styles.placeholderText}>History coming soon</Text>
                    </View>
                )}
                {activeTab === 2 && (
                    <ScrollView contentContainerStyle={styles.howToContent}>
                        <View style={styles.howToHeader}>
                            <Text style={styles.howToTitle}>Instructions</Text>
                            <TouchableOpacity>
                                <Play color="#e46600" size={32} />
                            </TouchableOpacity>
                        </View>

                        {INSTRUCTIONS.map((instruction, index) => (
                            <View key={index} style={styles.instructionStep}>
                                <View style={styles.stepNumberBadge}>
                                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                                </View>
                                <Text style={styles.instructionText}>{instruction}</Text>
                            </View>
                        ))}
                    </ScrollView>
                )}
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
    infoCard: {
        flexDirection: 'row',
        margin: 16,
        padding: 16,
        backgroundColor: 'rgba(70, 80, 96, 0.5)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(228, 102, 0, 0.25)',
    },
    infoContent: {
        flex: 3,
        paddingRight: 12,
    },
    exerciseName: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 14,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    detailLabel: {
        color: '#a6afc2',
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 6,
        flex: 1,
    },
    detailValue: {
        fontWeight: '400',
    },
    gifContainer: {
        flex: 2,
    },
    gifPlaceholder: {
        height: 160,
        backgroundColor: '#a6afc2',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(228, 102, 0, 0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        backgroundColor: 'rgba(70, 80, 96, 0.35)',
        borderRadius: 12,
        padding: 4,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 8,
    },
    tabButtonActive: {
        backgroundColor: '#1d2337',
    },
    tabText: {
        color: '#a6afc2',
        fontWeight: 'bold',
        fontSize: 14,
    },
    tabTextActive: {
        color: '#e46600',
    },
    tabContentContainer: {
        flex: 1,
        marginTop: 16,
    },
    placeholderTab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: '#a6afc2',
        marginTop: 12,
        fontSize: 16,
    },
    howToContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    howToHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    howToTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    instructionStep: {
        flexDirection: 'row',
        backgroundColor: 'rgba(70, 80, 96, 0.35)',
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(228, 102, 0, 0.12)',
    },
    stepNumberBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#e46600',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    stepNumberText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    instructionText: {
        flex: 1,
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        lineHeight: 21,
    }
});
