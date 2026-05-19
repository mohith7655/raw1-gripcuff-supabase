import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    FlatList,
    Dimensions,
    Modal,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Play, Lock, Heart } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme } from '../core/theme/app_theme';
import { SCREEN_PADDING } from '../constants/theme';

const tierCardStyle = {
    backgroundColor: '#1A1A35',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
};

const tierBadge = {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 10,
};

const tierBadgeText = {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
};

const tierPrice = {
    color: '#F97316',
    fontSize: 13,
    fontWeight: '600' as const,
};

const tierDesc = {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
};

const tierFeatures = {
    color: '#ccc',
    fontSize: 12,
    lineHeight: 22,
};

const { width } = Dimensions.get('window');
// Calculate card width based on screen width, padding, and gap
const CARD_GAP = 10;
const CARD_WIDTH = (width - (SCREEN_PADDING * 2) - CARD_GAP) / 2;

// Ordered array of specific gradient colors
const BG_COLORS = [
    ['#E8732A', '#D4622A'], // Orange
    ['#8B5CF6', '#7C3AED'], // Purple
    ['#3B82F6', '#2563EB'], // Blue
    ['#10B981', '#059669'], // Green
] as const;

const VIDEOS = [
    { id: 1, level: "Level 1", title: "Introduction to GripCuff", desc: "What is GripCuff and how it works", duration: "15:00", credits: 0, locked: false },
    { id: 2, level: "Level 2", title: "Basic Grip Techniques", desc: "Foundation grip positions", duration: "18:00", credits: 5, locked: true },
    { id: 3, level: "Level 3", title: "Wrist Strength Training", desc: "Build wrist endurance", duration: "20:00", credits: 5, locked: true },
    { id: 4, level: "Level 4", title: "Forearm Activation", desc: "Activate deep forearm muscles", duration: "22:00", credits: 10, locked: true },
    { id: 5, level: "Level 5", title: "Pinch Grip Mastery", desc: "Advanced pinch grip drills", duration: "25:00", credits: 10, locked: true },
    { id: 6, level: "Level 6", title: "Crushing Grip Power", desc: "Maximum grip strength techniques", duration: "28:00", credits: 15, locked: true },
    { id: 7, level: "Level 7", title: "Finger Isolation Drills", desc: "Individual finger strength", duration: "30:00", credits: 15, locked: true },
    { id: 8, level: "Level 8", title: "Dynamic Grip Training", desc: "Explosive grip movements", duration: "32:00", credits: 20, locked: true },
    { id: 9, level: "Level 9", title: "Grip Endurance Protocol", desc: "Long duration grip training", duration: "35:00", credits: 20, locked: true },
    { id: 10, level: "Level 10", title: "Elite GripCuff Master", desc: "Full program integration", duration: "40:00", credits: 30, locked: true },
];

export const GripCuffVideosScreen = () => {
    const navigation = useNavigation<any>();
    const [unlockedVideos, setUnlockedVideos] = useState<number[]>(
        VIDEOS.filter(v => !v.locked).map(v => v.id)
    );
    const [showTiersModal, setShowTiersModal] = useState(false);

    const numCompleted = unlockedVideos.length;
    const progressPercent = Math.round((numCompleted / VIDEOS.length) * 100);

    const handleVideoPress = (video: typeof VIDEOS[0]) => {
        if (unlockedVideos.includes(video.id)) {
            navigation.navigate('VideoPlayer', {
                title: video.title,
            });
        } else {
            Alert.alert(
                'Unlock required',
                `Unlock for ${video.credits} credits?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Unlock',
                        onPress: () => {
                            // Simulating an unlock
                            setUnlockedVideos([...unlockedVideos, video.id]);
                        }
                    }
                ]
            );
        }
    };

    const renderHeader = () => (
        <View>
            {/* Header */}
            <View style={styles.headerRow}>
                <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.headerBackText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitleText}>
                    GripCuff Training
                </Text>
            </View>
            <Text style={styles.headerSubtitleText}>
                Beginner
            </Text>
            {/* MEMBERSHIP TIERS TRIGGER */}
            <TouchableOpacity
                onPress={() => setShowTiersModal(true)}
                style={{ alignItems: 'center', marginTop: 2, marginBottom: 8 }}
            >
                <Text style={{
                    color: '#F97316',
                    fontSize: 13,
                    fontWeight: '600',
                    textDecorationLine: 'underline',
                }}>
                    ✦ Upgrade
                </Text>
            </TouchableOpacity>
            <View style={styles.headerDivider} />

            {/* Progress Card */}
            <View style={styles.progressContainer}>
                <View style={styles.progressCard}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressTitle}>Your Progress</Text>
                        <Text style={styles.progressPercentText}>{numCompleted}/{VIDEOS.length} completed</Text>
                    </View>
                    <View style={styles.progressRow}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                        </View>
                        <Text style={styles.progressPercent}>{progressPercent}%</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderVideoCard = ({ item, index }: { item: typeof VIDEOS[0]; index: number }) => {
        const isUnlocked = unlockedVideos.includes(item.id);
        const colorIndex = index % BG_COLORS.length;
        const gradientColors = BG_COLORS[colorIndex];

        // Format duration as MM:SS
        const [mins, secs] = item.duration.split(':').map(Number);
        const formattedDuration = `${mins}:${(secs || 0).toString().padStart(2, '0')}`;

        return (
            <TouchableOpacity
                style={styles.gridCard}
                activeOpacity={0.8}
                onPress={() => handleVideoPress(item)}
            >
                <View style={styles.thumbnailContainer}>
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.thumbnailGradient}
                    >
                        {isUnlocked ? (
                            <View style={styles.playIconCircle}>
                                <Play color="#fff" size={16} fill="#fff" />
                            </View>
                        ) : (
                            <>
                                <View style={styles.lockedOverlay} />
                                <Lock color="#ffffff" size={20} style={{ zIndex: 2 }} />
                            </>
                        )}
                    </LinearGradient>

                    <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{formattedDuration}</Text>
                    </View>
                </View>

                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    <Heart color="#607a94" size={16} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <FlatList
                data={VIDEOS}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderVideoCard}
                numColumns={2}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.scrollContent}
                columnWrapperStyle={styles.columnWrapper}
                showsVerticalScrollIndicator={false}
            />

            {/* MEMBERSHIP TIERS MODAL */}
            <Modal
                visible={showTiersModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTiersModal(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    justifyContent: 'flex-end',
                }}>
                    <View style={{
                        backgroundColor: '#12122A',
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingHorizontal: 20,
                        paddingTop: 20,
                        paddingBottom: 40,
                        maxHeight: '85%',
                    }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>
                                GripCuff Memberships
                            </Text>
                            <TouchableOpacity onPress={() => setShowTiersModal(false)}>
                                <Ionicons name="close-circle" size={28} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* STARTER */}
                            <View style={tierCardStyle}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <View style={[tierBadge, { backgroundColor: '#1E3A5F' }]}>
                                        <Text style={tierBadgeText}>STARTER</Text>
                                    </View>
                                    <Text style={tierPrice}>Free</Text>
                                </View>
                                <Text style={tierDesc}>
                                    Get started with GripCuff basics. Access the first introductory video, track your progress, and explore the app. Perfect for beginners who want to experience GripCuff before committing to a plan.
                                </Text>
                                <Text style={tierFeatures}>
                                    ✓ Access to 1 free video{'\n'}
                                    ✓ Progress tracking{'\n'}
                                    ✓ Community access{'\n'}
                                    ✗ Locked advanced content
                                </Text>
                            </View>

                            {/* LIFTER */}
                            <View style={tierCardStyle}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <View style={[tierBadge, { backgroundColor: '#7C3AED' }]}>
                                        <Text style={tierBadgeText}>LIFTER</Text>
                                    </View>
                                </View>
                                <Text style={tierDesc}>
                                    Unlock the full GripCuff training library. Follow structured programs, track strength gains, and access all beginner to advanced workout videos. Built for serious athletes who train regularly.
                                </Text>
                                <Text style={tierFeatures}>
                                    ✓ Full video library access{'\n'}
                                    ✓ Structured training programs{'\n'}
                                    ✓ Progress analytics{'\n'}
                                    ✓ Live workout sessions{'\n'}
                                    ✗ Upload access
                                </Text>
                            </View>

                            {/* TRAINER */}
                            <View style={tierCardStyle}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <View style={[tierBadge, { backgroundColor: '#F97316' }]}>
                                        <Text style={tierBadgeText}>TRAINER</Text>
                                    </View>
                                </View>
                                <Text style={tierDesc}>
                                    Everything in Lifter, plus the ability to upload your own workout videos to the app. Build your personal brand, grow a following, and coach clients directly through the GripCuff platform.
                                </Text>
                                <Text style={tierFeatures}>
                                    ✓ Everything in Lifter{'\n'}
                                    ✓ Upload custom videos{'\n'}
                                    ✓ Client management tools{'\n'}
                                    ✓ Trainer profile badge{'\n'}
                                    ✓ Revenue sharing on content
                                </Text>
                            </View>

                            {/* INFLUENCER */}
                            <View style={tierCardStyle}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <View style={[tierBadge, { backgroundColor: '#D4AF37' }]}>
                                        <Text style={tierBadgeText}>INFLUENCER</Text>
                                    </View>
                                </View>
                                <Text style={tierDesc}>
                                    The ultimate GripCuff tier. Designed for content creators and fitness influencers who want maximum visibility. Get featured on the home page, access exclusive partnership deals, and earn commission on referred members.
                                </Text>
                                <Text style={tierFeatures}>
                                    ✓ Everything in Trainer{'\n'}
                                    ✓ Featured homepage placement{'\n'}
                                    ✓ Affiliate commission program{'\n'}
                                    ✓ Priority support{'\n'}
                                    ✓ Brand partnership access{'\n'}
                                    ✓ Custom profile banner
                                </Text>
                            </View>
                        </ScrollView>

                        {/* CTA Button */}
                        <TouchableOpacity
                            onPress={() => setShowTiersModal(false)}
                            style={{
                                backgroundColor: '#F97316',
                                borderRadius: 12,
                                paddingVertical: 14,
                                alignItems: 'center',
                                marginTop: 16,
                            }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                                Got It
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: AppTheme.background,
    },
    scrollContent: {
        paddingBottom: 40,
        paddingHorizontal: SCREEN_PADDING,
    },
    columnWrapper: {
        gap: CARD_GAP,
        justifyContent: 'space-between',
    },

    /* Header */
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        position: 'relative',
    },
    headerBackBtn: {
        position: 'absolute',
        left: 16,
        padding: 4,
        zIndex: 10,
    },
    headerBackText: {
        color: AppTheme.primaryColor,
        fontSize: 24,
    },
    headerTitleText: {
        color: AppTheme.textWhite,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    headerSubtitleText: {
        color: AppTheme.primaryColor,
        fontSize: 13,
        textAlign: 'center',
        marginTop: -4,
        marginBottom: 12,
    },
    headerDivider: {
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginTop: 16,
    },

    /* Progress Card */
    progressContainer: {
        paddingVertical: 16,
    },
    progressCard: {
        backgroundColor: '#131f2e',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    progressTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    progressPercentText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: '#1c2e42',
        borderRadius: 3,
        marginRight: 12,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#D4622A',
        borderRadius: 3,
    },
    progressPercent: {
        color: '#607a94',
        fontSize: 12,
        fontWeight: '600',
        width: 32,
        textAlign: 'right',
    },

    /* Grid Video Cards */
    gridCard: {
        flex: 1,
        marginBottom: 16,
    },
    thumbnailContainer: {
        width: '100%',
        height: 130,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 8,
    },
    thumbnailGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    lockedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1,
    },
    playIconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    durationBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },
    durationText: {
        color: '#ffffff',
        fontSize: 10,
    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 4,
        gap: 8,
    },
    cardTitle: {
        flex: 1,
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 0,
    },
});
