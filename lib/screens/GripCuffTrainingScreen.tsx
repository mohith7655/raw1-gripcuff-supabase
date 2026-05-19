import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Play, Lock, CheckCircle2 } from 'lucide-react-native';
import { useUser } from '../providers/UserContext';
import { SCREEN_PADDING } from '../constants/theme';

interface VideoData {
    id: string;
    level: number;
    title: string;
    subtitle: string;
    duration: string;
    cost: number;
    unlockedByDefault: boolean;
}

const VIDEO_DATA: VideoData[] = [
    { id: '1', level: 1, title: 'Introduction to GripCuff', subtitle: 'What is GripCuff and how it works', duration: '15:00', cost: 0, unlockedByDefault: true },
    { id: '2', level: 2, title: 'Basic Grip Techniques', subtitle: 'Foundation grip positions', duration: '15:00', cost: 5, unlockedByDefault: false },
    { id: '3', level: 3, title: 'Wrist Strength Training', subtitle: 'Build wrist endurance', duration: '15:00', cost: 5, unlockedByDefault: false },
    { id: '4', level: 4, title: 'Forearm Activation', subtitle: 'Activate deep forearm muscles', duration: '15:00', cost: 10, unlockedByDefault: false },
    { id: '5', level: 5, title: 'Pinch Grip Mastery', subtitle: 'Advanced pinch grip drills', duration: '15:00', cost: 10, unlockedByDefault: false },
    { id: '6', level: 6, title: 'Crushing Grip Power', subtitle: 'Maximum grip strength techniques', duration: '15:00', cost: 15, unlockedByDefault: false },
    { id: '7', level: 7, title: 'Finger Isolation Drills', subtitle: 'Individual finger strength', duration: '15:00', cost: 15, unlockedByDefault: false },
    { id: '8', level: 8, title: 'Dynamic Grip Training', subtitle: 'Explosive grip movements', duration: '15:00', cost: 20, unlockedByDefault: false },
    { id: '9', level: 9, title: 'Grip Endurance Protocol', subtitle: 'Long duration grip training', duration: '15:00', cost: 20, unlockedByDefault: false },
    { id: '10', level: 10, title: 'Elite GripCuff Master', subtitle: 'Full program integration', duration: '15:00', cost: 30, unlockedByDefault: false },
];

export const GripCuffTrainingScreen = () => {
    const navigation = useNavigation<any>();
    const { profile } = useUser();
    const [activeTab, setActiveTab] = useState<'All' | 'Completed'>('All');
    const [unlockedVideos, setUnlockedVideos] = useState<string[]>(
        VIDEO_DATA.filter((v) => v.unlockedByDefault).map((v) => v.id)
    );
    const [completedVideos, setCompletedVideos] = useState<string[]>([]);
    const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);

    const numCompleted = completedVideos.length;
    const progressPercent = Math.round((numCompleted / VIDEO_DATA.length) * 100);

    const handleVideoPress = (video: VideoData) => {
        if (unlockedVideos.includes(video.id)) {
            // Navigate to video player
            navigation.navigate('VideoPlayer', {
                title: video.title,
            });
        } else {
            // Show unlock modal
            setSelectedVideo(video);
        }
    };

    const handleUnlock = () => {
        if (selectedVideo) {
            // In a real app, deduct credits here via useUser / remote DB call
            setUnlockedVideos([...unlockedVideos, selectedVideo.id]);
            setSelectedVideo(null);
        }
    };

    const filteredVideos = activeTab === 'All'
        ? VIDEO_DATA
        : VIDEO_DATA.filter((v) => completedVideos.includes(v.id));

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <ArrowLeft color="#ffffff" size={24} />
                </TouchableOpacity>
                <View style={styles.headerTitles}>
                    <Text style={styles.headerTitle}>GripCuff Training</Text>
                    <Text style={styles.headerSubtitle}>Beginner · 10 Levels</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* PROGRESS CARD */}
                <View style={styles.progressCard}>
                    <Text style={styles.progressLabel}>Your Progress: {numCompleted}/10 completed</Text>
                    <View style={styles.progressRow}>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                        </View>
                        <Text style={styles.progressPercent}>{progressPercent}%</Text>
                    </View>
                </View>

                {/* TAB BAR */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'All' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('All')}
                    >
                        <Text style={[styles.tabText, activeTab === 'All' && styles.tabTextActive]}>All Videos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'Completed' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('Completed')}
                    >
                        <Text style={[styles.tabText, activeTab === 'Completed' && styles.tabTextActive]}>Completed</Text>
                    </TouchableOpacity>
                </View>

                {/* VIDEO LIST */}
                <View style={styles.videoList}>
                    {filteredVideos.map((video) => {
                        const isUnlocked = unlockedVideos.includes(video.id);

                        return (
                            <TouchableOpacity
                                key={video.id}
                                style={[styles.videoCard, !isUnlocked && styles.videoCardLocked]}
                                activeOpacity={0.8}
                                onPress={() => handleVideoPress(video)}
                            >
                                {/* Thumbnail Left */}
                                <View style={styles.thumbnailContainer}>
                                    <View style={styles.thumbnailPlaceholder}>
                                        <Play color="#D4622A" size={24} fill="#D4622A" />
                                    </View>
                                    <View style={styles.durationBadge}>
                                        <Text style={styles.durationText}>{video.duration}</Text>
                                    </View>
                                </View>

                                {/* Content Right */}
                                <View style={styles.videoContent}>
                                    <View style={styles.levelBadge}>
                                        <Text style={styles.levelText}>Level {video.level}</Text>
                                    </View>
                                    <Text style={styles.videoTitle}>{video.title}</Text>
                                    <Text style={styles.videoSubtitle}>{video.subtitle}</Text>

                                    <View style={styles.costRow}>
                                        {isUnlocked ? (
                                            <>
                                                <CheckCircle2 color="#4CAF50" size={14} />
                                                <Text style={styles.freeBadgeText}>
                                                    {video.cost === 0 ? 'FREE' : 'Unlocked'}
                                                </Text>
                                            </>
                                        ) : (
                                            <>
                                                <Lock color="#D4622A" size={14} />
                                                <Text style={styles.costText}>{video.cost} Credits</Text>
                                            </>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {/* UNLOCK MODAL */}
            <Modal
                visible={!!selectedVideo}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedVideo(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalIconContainer}>
                            <Lock color="#D4622A" size={32} />
                        </View>
                        <Text style={styles.modalTitle}>Unlock Video</Text>
                        <Text style={styles.modalSubtitle}>
                            Unlock "{selectedVideo?.title}" for {selectedVideo?.cost} credits.
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setSelectedVideo(null)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalUnlockBtn}
                                onPress={handleUnlock}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalUnlockText}>Unlock</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0d1520',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SCREEN_PADDING,
        paddingVertical: 16,
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitles: {
        alignItems: 'center',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#607a94',
        fontSize: 13,
        marginTop: 2,
    },
    scrollContent: {
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: 40,
    },

    /* ── PROGRESS CARD ── */
    progressCard: {
        backgroundColor: '#131f2e',
        borderRadius: 16,
        padding: 20,
        marginTop: 8,
        marginBottom: 24,
    },
    progressLabel: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 12,
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
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
        width: 30,
        textAlign: 'right',
    },

    /* ── TAB BAR ── */
    tabBar: {
        flexDirection: 'row',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    tabBtnActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#D4622A',
    },
    tabText: {
        color: '#607a94',
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#ffffff',
    },

    /* ── VIDEO LIST ── */
    videoList: {
        gap: 12,
    },
    videoCard: {
        flexDirection: 'row',
        backgroundColor: '#131f2e',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    videoCardLocked: {
        opacity: 0.8,
    },
    thumbnailContainer: {
        width: 70,
        height: 70,
        borderRadius: 12,
        marginRight: 16,
        overflow: 'hidden',
    },
    thumbnailPlaceholder: {
        flex: 1,
        backgroundColor: '#1c2e42',
        justifyContent: 'center',
        alignItems: 'center',
    },
    durationBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    durationText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    videoContent: {
        flex: 1,
        justifyContent: 'center',
    },
    levelBadge: {
        backgroundColor: '#D4622A',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginBottom: 6,
    },
    levelText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    videoTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    videoSubtitle: {
        color: '#607a94',
        fontSize: 12,
        marginBottom: 6,
    },
    costRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    costText: {
        color: '#D4622A',
        fontSize: 13,
        fontWeight: 'bold',
    },
    freeBadgeText: {
        color: '#4CAF50',
        fontSize: 13,
        fontWeight: 'bold',
    },

    /* ── MODAL ── */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SCREEN_PADDING,
    },
    modalContent: {
        backgroundColor: '#131f2e',
        borderRadius: 20,
        width: '100%',
        padding: 24,
        alignItems: 'center',
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(212, 98, 42, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalSubtitle: {
        color: '#607a94',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#1c2e42',
        alignItems: 'center',
    },
    modalCancelText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    modalUnlockBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#D4622A',
        alignItems: 'center',
    },
    modalUnlockText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
