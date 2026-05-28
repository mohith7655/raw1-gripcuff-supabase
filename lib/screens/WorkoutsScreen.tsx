import React, { useState } from 'react';
import { NotificationBell } from '../components/NotificationBell';
import { AccessBadge } from '../components/AccessBadge';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Search, ChevronRight,
    User, PlusCircle, Sparkles, Users,
    Flame, Zap, HeartPulse, PersonStanding,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../providers/UserContext';
import { useNavigation } from '@react-navigation/native';
import { AppTheme, CoachingTheme } from '../core/theme/app_theme';
import { SCREEN_PADDING, CARD_BORDER_RADIUS } from '../constants/theme';


/* ── Main Component ── */
export const WorkoutsScreen = () => {
    const { appMode } = useUser();
    const navigation = useNavigation<any>();
    const [activeTab, setActiveTab] = useState<'programs' | 'ai'>('programs');

    const CategoryRow = ({ title, subtitle, IconName, color, onPress }: {
        title: string; subtitle: string; IconName: any; color: string; onPress?: () => void;
    }) => (
        <TouchableOpacity style={styles.categoryRow} activeOpacity={0.7} onPress={onPress}>
            <View style={[styles.categoryIcon, { backgroundColor: `${color}20` }]}>
                <IconName color={color} size={20} />
            </View>
            <View style={styles.categoryInfo}>
                <Text style={styles.categoryTitle}>{title}</Text>
                <Text style={styles.categorySubtitle}>{subtitle}</Text>
            </View>
            <ChevronRight color="#e46600" size={18} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.safeArea, appMode === 'coaching' && { backgroundColor: CoachingTheme.darkBg }]} edges={['top']}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>{appMode === 'coaching' ? 'Previous Sessions' : 'Workouts'}</Text>
                    {appMode !== 'coaching' && (
                        <Text style={styles.headerSubtitle}>Structured workout programs for every goal.</Text>
                    )}
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.iconButton}>
                        <Search color="#e46600" size={24} />
                    </TouchableOpacity>
                    <NotificationBell color="#e46600" size={24} containerStyle={styles.iconButton} />
                </View>
            </View>

            {appMode === 'coaching' ? (
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <TouchableOpacity
                        style={styles.bookSessionCtaContainer}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('PersonalTrainerScreen')}
                    >
                        <LinearGradient
                            colors={[CoachingTheme.primaryColor, CoachingTheme.primaryLight]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.bookSessionCtaGradient}
                        >
                            <View style={styles.ctaContent}>
                                <Text style={styles.ctaMainText}>Book a New Session</Text>
                                <Text style={styles.ctaSubText}>Schedule your next coaching session</Text>
                            </View>
                            <ChevronRight color={CoachingTheme.textWhite} size={24} />
                        </LinearGradient>
                    </TouchableOpacity>

                    <Text style={styles.sectionLabel}>Recent Sessions</Text>
                    <View style={{ gap: 10 }}>
                        {[
                            { name: 'Coach Alex', detail: 'Strength & Conditioning • Yesterday, 10:00 AM', color: CoachingTheme.primaryColor },
                            { name: 'Coach Priya', detail: 'Yoga & Flexibility • Mon 24, 6:00 PM', color: CoachingTheme.primaryLight },
                            { name: 'Coach Mike', detail: 'HIIT & Cardio • Sat 22, 9:00 AM', color: '#EF4444' },
                        ].map(coach => (
                            <View key={coach.name} style={[styles.coachingCardWrapper, { backgroundColor: CoachingTheme.cardColor }]}>
                                <TouchableOpacity style={styles.categoryRow} activeOpacity={0.7}>
                                    <View style={[styles.categoryIcon, { backgroundColor: `${coach.color}20` }]}>
                                        <User color={coach.color} size={20} />
                                    </View>
                                    <View style={styles.categoryInfo}>
                                        <Text style={styles.categoryTitle}>{coach.name}</Text>
                                        <Text style={styles.categorySubtitle}>{coach.detail}</Text>
                                    </View>
                                    <ChevronRight color="#e46600" size={18} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            ) : (
                <>
                    {/* ── Pill toggle ── */}
                    <View style={styles.pillToggle}>
                        <TouchableOpacity
                            style={[styles.pillBtn, activeTab === 'programs' && styles.pillBtnActive]}
                            onPress={() => setActiveTab('programs')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.pillTxt, activeTab === 'programs' && styles.pillTxtActive]}>
                                Pre-Recorded Programs
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.pillBtn, activeTab === 'ai' && styles.pillBtnActive]}
                            onPress={() => setActiveTab('ai')}
                            activeOpacity={0.8}
                        >
                            <Sparkles size={13} color={activeTab === 'ai' ? AppTheme.primaryColor : '#607a94'} />
                            <Text style={[styles.pillTxt, activeTab === 'ai' && styles.pillTxtActive]}>
                                AI Personal Trainer
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent}>

                        {activeTab === 'programs' && (
                            <>
                                {/* Workout with a Friend */}
                                <TouchableOpacity
                                    style={styles.friendBtnContainer}
                                    onPress={() => navigation.navigate('WorkoutWithFriendFlow')}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#1a1a1a', '#000000']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.friendBtnGradient}
                                    >
                                        <Users color="#fff" size={20} style={{ marginRight: 10 }} />
                                        <Text style={styles.friendBtnText}>Workout with a Friend</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                {/* Category rows */}
                                <View style={styles.categoryCard}>
                                    <CategoryRow
                                        title="Muscle Growth"
                                        subtitle="Hypertrophy focused programs"
                                        IconName={Flame}
                                        color="#f44336"
                                        onPress={() => navigation.navigate('MuscleGrowth', { allowInvite: true })}
                                    />
                                    <View style={styles.rowDivider} />
                                    <CategoryRow
                                        title="Stretching"
                                        subtitle="Improve flexibility & range of motion"
                                        IconName={PersonStanding}
                                        color="#4FC3F7"
                                        onPress={() => navigation.navigate('Stretching', { allowInvite: true })}
                                    />
                                    <View style={styles.rowDivider} />
                                    <CategoryRow
                                        title="Athletic Performance"
                                        subtitle="Speed, power & agility training"
                                        IconName={Zap}
                                        color="#FFD600"
                                        onPress={() => navigation.navigate('AthleticPerformance', { allowInvite: true })}
                                    />
                                    <View style={styles.rowDivider} />
                                    <CategoryRow
                                        title="Injury Rehab"
                                        subtitle="Safe recovery & rehabilitation"
                                        IconName={HeartPulse}
                                        color="#66BB6A"
                                        onPress={() => navigation.navigate('InjuryRehab', { allowInvite: true })}
                                    />
                                </View>
                            </>
                        )}

                        {activeTab === 'ai' && (
                            <View style={styles.aiCard}>
                                <View style={styles.aiCardHeader}>
                                    <View style={styles.aiIconWrap}>
                                        <Sparkles color={AppTheme.primaryColor} size={24} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 14 }}>
                                        <Text style={styles.aiCardTitle}>AI Personal Trainer</Text>
                                        <Text style={styles.aiCardSubtitle}>Generate custom workouts</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.aiCtaContainer}
                                    onPress={() => navigation.navigate('AITrainerScreen')}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={[AppTheme.primaryColor, '#ff8534']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.aiCtaGradient}
                                    >
                                        <PlusCircle color="#fff" size={20} style={{ marginRight: 10 }} />
                                        <Text style={styles.aiCtaText}>Start AI Workout</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => navigation.navigate('UpcomingSessionsScreen')}
                                    style={{ marginTop: 14, alignItems: 'center' }}
                                >
                                    <Text style={{ color: AppTheme.primaryColor, fontSize: 13, fontWeight: '600' }}>
                                        View All Sessions →
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                    </ScrollView>
                </>
            )}
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
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 16,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 12,
        fontWeight: '400',
        color: 'rgba(180,200,220,0.6)',
        marginTop: 4,
        lineHeight: 18,
    },
    headerActions: {
        flexDirection: 'row',
    },
    iconButton: {
        marginLeft: 16,
    },
    scrollContent: {
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 16,
        paddingBottom: 40,
    },

    /* ── Pill toggle (matches LibraryScreen) ── */
    pillToggle: {
        flexDirection: 'row',
        backgroundColor: '#131f2e',
        borderRadius: 12,
        padding: 4,
        marginHorizontal: SCREEN_PADDING,
        marginBottom: 4,
    },
    pillBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'transparent',
    },
    pillBtnActive: {
        backgroundColor: '#000000',
    },
    pillTxt: {
        color: '#607a94',
        fontSize: 11,
        fontWeight: '500',
    },
    pillTxtActive: {
        color: '#ffffff',
        fontWeight: '700',
    },

    /* ── Workout with a Friend button ── */
    friendBtnContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    friendBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 12,
    },
    friendBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },

    /* ── Category card + rows ── */
    categoryCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: CARD_BORDER_RADIUS,
        borderWidth: 1,
        borderColor: 'rgba(228,102,0,0.15)',
        overflow: 'hidden',
    },
    categoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    categoryIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryInfo: {
        flex: 1,
        marginLeft: 14,
    },
    categoryTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
    },
    categorySubtitle: {
        fontSize: 12,
        color: '#888',
    },
    rowDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.06)',
        marginHorizontal: 16,
    },

    /* ── AI tab card ── */
    aiCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: CARD_BORDER_RADIUS,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.2)',
        padding: 18,
        marginTop: 4,
    },
    aiCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
    },
    aiIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(249,115,22,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiCardTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 3,
    },
    aiCardSubtitle: {
        color: '#888',
        fontSize: 13,
    },
    aiCtaContainer: {
        borderRadius: 12,
        overflow: 'hidden',
        width: '100%',
    },
    aiCtaGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 12,
    },
    aiCtaText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },

    /* ── Coaching mode ── */
    coachingCardWrapper: {
        borderRadius: CARD_BORDER_RADIUS,
    },
    sectionLabel: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
        paddingTop: 12,
    },
    bookSessionCtaContainer: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 20,
        marginTop: 8,
    },
    bookSessionCtaGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 14,
    },
    ctaContent: {
        flex: 1,
    },
    ctaMainText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    ctaSubText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
    },
});

