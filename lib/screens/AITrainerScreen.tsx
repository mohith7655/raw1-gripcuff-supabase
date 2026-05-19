import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';

export const AITrainerScreen = () => {
    const navigation = useNavigation();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AI Personal Trainer</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.iconCircle}>
                    <Sparkles color={AppTheme.primaryColor} size={48} />
                </View>

                <Text style={styles.messageText}>Your AI trainer is getting ready...</Text>

                <TouchableOpacity style={styles.ctaButton} activeOpacity={0.8}>
                    <LinearGradient
                        colors={[AppTheme.primaryColor, '#ff8534']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.ctaGradient}
                    >
                        <Text style={styles.ctaText}>Start AI Workout</Text>
                    </LinearGradient>
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
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 107, 0, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    messageText: {
        fontSize: 18,
        color: '#a6afc2',
        textAlign: 'center',
        marginBottom: 40,
    },
    ctaButton: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
    },
    ctaGradient: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
