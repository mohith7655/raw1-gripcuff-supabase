import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Switch, Dimensions, NativeScrollEvent, NativeSyntheticEvent, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CoachingTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { Star, Settings } from 'lucide-react-native';
import { NotificationBell } from '../components/NotificationBell';
import { SCREEN_PADDING } from '../constants/theme';

const { width, height } = Dimensions.get('window');
const SCREEN_WIDTH = width;
const SCREEN_HEIGHT = height;
const CARD_WIDTH = width - 40;
const CARD_HEIGHT = height - 56 - 40 - 40;

type CoachCategory = 'MuscleGrowth' | 'Stretching' | 'AthleticPerformance' | 'InjuryRehab';

interface Coach {
    id: string;
    name: string;
    specialty: string;
    rating: number;
    reviews: number;
    imageUrl: string;
    category: CoachCategory;
}

const DUMMY_COACHES: Coach[] = [
    { id: '1', name: 'Marcus Titan', specialty: 'Weight Loss & Muscle Gain', rating: 4.9, reviews: 124, imageUrl: 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '2', name: 'Sarah Jenkins', specialty: 'Cardio & Endurance', rating: 4.8, reviews: 98, imageUrl: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&q=80&w=200', category: 'AthleticPerformance' },
    { id: '3', name: 'David Chen', specialty: 'Injury Recovery & Mobility', rating: 4.9, reviews: 156, imageUrl: 'https://images.unsplash.com/photo-1611672585731-fa10603fb9e0?auto=format&fit=crop&q=80&w=200', category: 'InjuryRehab' },
    { id: '4', name: 'Elena Rodriguez', specialty: 'HIIT & Fat Loss', rating: 4.7, reviews: 89, imageUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '5', name: 'James Wilson', specialty: 'Powerlifting & Strength', rating: 5.0, reviews: 211, imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '6', name: 'Aisha Patel', specialty: 'Yoga & Core Stability', rating: 4.8, reviews: 134, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&q=80&w=200', category: 'Stretching' },
    { id: '7', name: 'Tom Hardy', specialty: 'Bodybuilding', rating: 4.6, reviews: 75, imageUrl: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '8', name: 'Jessica Alba', specialty: 'Pilates & Flexibility', rating: 4.9, reviews: 167, imageUrl: 'https://images.unsplash.com/photo-1522845015757-50bce044e5da?auto=format&fit=crop&q=80&w=200', category: 'Stretching' },
    { id: '9', name: 'Mike Johnson', specialty: 'Athletic Conditioning', rating: 4.7, reviews: 92, imageUrl: 'https://images.unsplash.com/photo-1507314961628-144cf28892f3?auto=format&fit=crop&q=80&w=200', category: 'AthleticPerformance' },
    { id: '10', name: 'Emma Watson', specialty: 'Postpartum Fitness', rating: 5.0, reviews: 145, imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '11', name: 'Chris Evans', specialty: 'Functional Training', rating: 4.8, reviews: 112, imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200', category: 'AthleticPerformance' },
    { id: '12', name: 'Sophia Lee', specialty: 'Dance & Cardio', rating: 4.7, reviews: 88, imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200', category: 'AthleticPerformance' },
    { id: '13', name: 'Daniel Craig', specialty: 'Senior Fitness & Mobility', rating: 4.9, reviews: 130, imageUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200', category: 'Stretching' },
    { id: '14', name: 'Olivia Munn', specialty: 'Kickboxing & Core', rating: 4.8, reviews: 105, imageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=200', category: 'AthleticPerformance' },
    { id: '15', name: 'Luke Bryan', specialty: 'CrossFit & Endurance', rating: 4.6, reviews: 67, imageUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200', category: 'AthleticPerformance' },
    { id: '16', name: 'Mia Wallace', specialty: 'Nutrition & Weight Loss', rating: 5.0, reviews: 189, imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '17', name: 'Ethan Hunt', specialty: 'Calisthenics', rating: 4.8, reviews: 118, imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '18', name: 'Chloe Moretz', specialty: 'Pre-natal Fitness', rating: 4.9, reviews: 142, imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '19', name: 'Ryan Reynolds', specialty: 'Agility & Speed', rating: 4.7, reviews: 96, imageUrl: 'https://images.unsplash.com/photo-1552058544-e2234dce9b29?auto=format&fit=crop&q=80&w=200', category: 'AthleticPerformance' },
    { id: '20', name: 'Zoe Saldana', specialty: 'Mindfulness & Yoga', rating: 4.9, reviews: 175, imageUrl: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&q=80&w=200', category: 'Stretching' },
    { id: '21', name: 'Bruce Wayne', specialty: 'Combat & Strength', rating: 5.0, reviews: 302, imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '22', name: 'Lisa Anderson', specialty: 'Strength Training', rating: 4.8, reviews: 156, imageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '23', name: 'Kevin Richards', specialty: 'Flexibility & Mobility', rating: 4.7, reviews: 89, imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200', category: 'Stretching' },
    { id: '24', name: 'Rachel Green', specialty: 'Rehabilitation Specialist', rating: 4.9, reviews: 201, imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200', category: 'InjuryRehab' },
    { id: '25', name: 'Alex Turner', specialty: 'Sport Performance', rating: 5.0, reviews: 234, imageUrl: 'https://images.unsplash.com/photo-1507314961628-144cf28892f3?auto=format&fit=crop&q=80&w=200', category: 'AthleticPerformance' },
    { id: '26', name: 'Nina Patel', specialty: 'Core Strength', rating: 4.8, reviews: 143, imageUrl: 'https://images.unsplash.com/photo-1522845015757-50bce044e5da?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '27', name: 'Jordan Stone', specialty: 'Athletic Recovery', rating: 4.6, reviews: 98, imageUrl: 'https://images.unsplash.com/photo-1611672585731-fa10603fb9e0?auto=format&fit=crop&q=80&w=200', category: 'InjuryRehab' },
    { id: '28', name: 'Victoria Cross', specialty: 'Flexibility Training', rating: 4.9, reviews: 176, imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&q=80&w=200', category: 'Stretching' },
    { id: '29', name: 'Marcus Steel', specialty: 'Hypertrophy Training', rating: 4.7, reviews: 127, imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=200', category: 'MuscleGrowth' },
    { id: '30', name: 'Sophie Chen', specialty: 'Speed & Agility', rating: 4.8, reviews: 164, imageUrl: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&q=80&w=200', category: 'AthleticPerformance' },
];

const CATEGORY_SECTIONS: { key: CoachCategory; label: string }[] = [
    { key: 'MuscleGrowth', label: 'Muscle Growth' },
    { key: 'Stretching', label: 'Stretching' },
    { key: 'AthleticPerformance', label: 'Athletic Performance' },
    { key: 'InjuryRehab', label: 'Injury Rehab' },
];

export const ExploreCoaches = () => {
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [selectedCategoryForModal, setSelectedCategoryForModal] = useState<CoachCategory | null>(null);
    const [selectedCoachForDropdown, setSelectedCoachForDropdown] = useState<string | null>(null);
    const [sectionVisibility, setSectionVisibility] = useState<{ [key: string]: boolean }>({
        MuscleGrowth: true,
        Stretching: true,
        AthleticPerformance: true,
        InjuryRehab: true,
    });
    const [currentPage, setCurrentPage] = useState(0);
    const horizontalScrollRef = useRef<ScrollView>(null);
    const navigation = useNavigation<any>();

    useEffect(() => {
        const loadVisibility = async () => {
            try {
                const saved = await AsyncStorage.getItem('coachSectionVisibility');
                if (saved) {
                    setSectionVisibility(JSON.parse(saved));
                }
            } catch (e) {
                console.log('Failed to load visibility settings.', e);
            }
        };
        loadVisibility();
    }, []);

    const toggleSection = (key: string) => {
        setSectionVisibility((prev) => {
            const updated = {
                ...prev,
                [key]: !prev[key],
            };
            // Save to AsyncStorage
            try {
                AsyncStorage.setItem('coachSectionVisibility', JSON.stringify(updated));
            } catch (e) {
                console.log('Failed to save visibility settings.', e);
            }
            return updated;
        });
    };

    const handleHorizontalScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const snapInterval = CARD_WIDTH + 40; // Total card width including margins
        const page = Math.round(offsetX / snapInterval);
        setCurrentPage(page);
    };

    const getTotalCoaches = () => {
        return selectedCategoryForModal
            ? DUMMY_COACHES.filter(c => c.category === selectedCategoryForModal).length
            : 0;
    };

    const saveAndCloseSettings = () => {
        setIsSettingsVisible(false);
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Explore Coaches</Text>
                <View style={{ position: 'absolute', right: 24, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <NotificationBell color={CoachingTheme.textWhite} size={24} />
                    <TouchableOpacity onPress={() => setIsSettingsVisible(true)}>
                        <Settings color={CoachingTheme.textWhite} size={24} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Show all coaches grouped by category */}
            <ScrollView contentContainerStyle={styles.contentContainer}>
                {CATEGORY_SECTIONS.map((section) => {
                    const sectionCoaches = DUMMY_COACHES.filter(coach => coach.category === section.key);
                    if (sectionCoaches.length === 0 || sectionVisibility[section.key] === false) return null;

                    const handleSeeAll = () => {
                        setSelectedCategoryForModal(section.key);
                    };

                    return (
                        <View key={section.key} style={styles.categorySection}>
                            {/* Section Header */}
                            <View style={styles.categorySectionHeader}>
                                <Text style={styles.categorySectionTitle}>{section.label}</Text>

                                <View style={styles.categoryHeaderActions}>
                                    <TouchableOpacity
                                        style={styles.hidePill}
                                        onPress={() => toggleSection(section.key)}
                                    >
                                        <Text style={styles.hidePillText}>Hide</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleSeeAll}>
                                        <Text style={styles.categorySeeAll}>See All &gt;</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Horizontal scroll of coach cards */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.categoryScrollRow}
                            >
                                {sectionCoaches.slice(0, 5).map((coach) => (
                                    <CoachCard
                                        key={coach.id}
                                        coach={coach}
                                        isSelected={selectedCoachForDropdown === coach.id}
                                        onPress={() => setSelectedCoachForDropdown(selectedCoachForDropdown === coach.id ? null : coach.id)}
                                    />
                                ))}
                            </ScrollView>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Settings Modal */}
            <Modal
                visible={isSettingsVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={saveAndCloseSettings}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFillObject}
                        activeOpacity={1}
                        onPress={saveAndCloseSettings}
                    />
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Customize Sections</Text>

                        {CATEGORY_SECTIONS.map((section) => (
                            <View key={section.key} style={styles.modalRow}>
                                <Text style={styles.modalRowText}>{section.label}</Text>
                                <Switch
                                    value={sectionVisibility[section.key] !== false}
                                    onValueChange={() => toggleSection(section.key)}
                                    trackColor={{ false: CoachingTheme.cardColor, true: CoachingTheme.primaryColor }}
                                    thumbColor="#fff"
                                />
                            </View>
                        ))}

                        <TouchableOpacity style={styles.modalDoneBtn} onPress={saveAndCloseSettings}>
                            <Text style={styles.modalDoneText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* See All Coaches Modal */}
            <Modal
                visible={selectedCategoryForModal !== null}
                animationType="slide"
                transparent={false}
                onRequestClose={() => {
                    setSelectedCategoryForModal(null);
                    setCurrentPage(0);
                }}
            >
                <SafeAreaView style={styles.seeAllModalContainer} edges={['top']}>
                    <View style={styles.seeAllHeader}>
                        <TouchableOpacity
                            onPress={() => {
                                setSelectedCategoryForModal(null);
                                setCurrentPage(0);
                            }}
                        >
                            <Text style={styles.seeAllBackButton}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.seeAllTitle}>
                            {selectedCategoryForModal ? CATEGORY_SECTIONS.find(s => s.key === selectedCategoryForModal)?.label : 'Coaches'}
                        </Text>
                        <View style={{ width: 60 }} />
                    </View>

                    {/* Horizontal Coaches Scroll */}
                    <FlatList
                        ref={horizontalScrollRef as any}
                        data={selectedCategoryForModal ? DUMMY_COACHES.filter(c => c.category === selectedCategoryForModal) : []}
                        keyExtractor={(item) => item.id}
                        horizontal
                        pagingEnabled={true}
                        snapToInterval={CARD_WIDTH + 40}
                        snapToAlignment="start"
                        decelerationRate="fast"
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 20 }}
                        renderItem={({ item: coach }) => (
                            <CoachHorizontalCard
                                coach={coach}
                                isSelected={selectedCoachForDropdown === coach.id}
                                onPress={() => setSelectedCoachForDropdown(selectedCoachForDropdown === coach.id ? null : coach.id)}
                            />
                        )}
                        onScroll={handleHorizontalScroll}
                        scrollEventThrottle={16}
                    />

                    {/* Pagination Dots */}
                    <View style={styles.paginationContainer}>
                        <View style={styles.dotsRow}>
                            {Array.from({ length: getTotalCoaches() }).map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.dot,
                                        currentPage === index && styles.activeDot
                                    ]}
                                />
                            ))}
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

// Reusable Coach Card Component
const CoachCard = ({ coach, isSelected, onPress }: { coach: Coach; isSelected: boolean; onPress: () => void }) => {
    return (
        <View>
            <TouchableOpacity style={styles.coachCard} activeOpacity={0.8} onPress={onPress}>
                <Image source={{ uri: coach.imageUrl }} style={styles.coachImage} />
                <View style={styles.coachInfoContainer}>
                    <Text style={styles.coachName} numberOfLines={1}>{coach.name}</Text>
                    <Text style={styles.coachSpecialty} numberOfLines={2}>{coach.specialty}</Text>
                    <View style={styles.ratingRow}>
                        <Star color={CoachingTheme.primaryLight} size={12} fill={CoachingTheme.primaryLight} />
                        <Text style={styles.ratingText}>{coach.rating}</Text>
                        <Text style={styles.reviewText}>({coach.reviews})</Text>
                    </View>
                </View>
            </TouchableOpacity>
            {isSelected && (
                <View style={styles.dropdownContainer}>
                    <Text style={styles.dropdownText}>Booking coming soon</Text>
                </View>
            )}
        </View>
    );
};

// Horizontal Coach Card Component for "See All" Modal
const CoachHorizontalCard = ({ coach, isSelected, onPress }: { coach: Coach; isSelected: boolean; onPress: () => void }) => {
    return (
        <View style={styles.horizontalCardWrapper}>
            <TouchableOpacity
                style={styles.horizontalCoachCard}
                activeOpacity={0.9}
                onPress={onPress}
            >
                {/* Image Section Wrapper */}
                <View style={styles.imageSectionWrapper}>
                    {/* Background gym image */}
                    <Image
                        source={{ uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400' }}
                        style={styles.backgroundImage}
                    />
                    <View style={styles.darkOverlay} />
                    {/* Circular coach photo overlay */}
                    <Image
                        source={{ uri: coach.imageUrl }}
                        style={styles.largeCoachImage}
                    />
                </View>

                {/* Content Section */}
                <View style={styles.horizontalCardContent}>
                    {/* Coach Name and Specialty */}
                    <View style={styles.headerSection}>
                        <Text style={styles.largeCoachName} numberOfLines={1}>{coach.name}</Text>
                        <Text style={styles.largeCoachSpecialty} numberOfLines={1}>{coach.specialty}</Text>
                    </View>

                    {/* Rating Row */}
                    <View style={styles.ratingSection}>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((idx) => (
                                <Star
                                    key={idx}
                                    color={CoachingTheme.primaryLight}
                                    size={16}
                                    fill={idx <= Math.floor(coach.rating) ? CoachingTheme.primaryLight : "none"}
                                />
                            ))}
                        </View>
                        <Text style={styles.largeRatingText}>{coach.rating}</Text>
                        <Text style={styles.largeReviewText}>({coach.reviews} reviews)</Text>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>120+</Text>
                            <Text style={styles.statLabel}>Sessions</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{coach.reviews}</Text>
                            <Text style={styles.statLabel}>Clients</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>5 yrs</Text>
                            <Text style={styles.statLabel}>Experience</Text>
                        </View>
                    </View>

                    {/* About Section */}
                    <View style={styles.aboutSection}>
                        <Text style={styles.aboutText} numberOfLines={2}>
                            Certified fitness coach specializing in personalized training programs. Passionate about helping clients achieve their fitness goals.
                        </Text>
                    </View>

                    {/* Availability Badges */}
                    <View style={styles.availabilitySection}>
                        <View style={styles.badgeRow}>
                            {['Mon', 'Wed', 'Fri', 'Sun'].map((day) => (
                                <View key={day} style={styles.availabilityBadge}>
                                    <Text style={styles.badgeText}>{day}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Price Per Session */}
                    <View style={styles.priceSection}>
                        <Text style={styles.priceText}>$12 / session</Text>
                    </View>

                    {/* Book Now Button */}
                    <TouchableOpacity style={styles.bookNowButton} activeOpacity={0.8}>
                        <Text style={styles.bookNowText}>Book Now</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
            {isSelected && (
                <View style={styles.horizontalDropdownContainer}>
                    <Text style={styles.dropdownText}>Booking coming soon</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: CoachingTheme.background,
    },
    header: {
        paddingHorizontal: SCREEN_PADDING,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: FontSizes.h2,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.textWhite,
    },
    /* ── Content Container ── */
    contentContainer: {
        paddingVertical: 16,
    },
    /* ── Category Section ── */
    categorySection: {
        marginBottom: 24,
        paddingHorizontal: SCREEN_PADDING,
    },
    categorySectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    categorySectionTitle: {
        fontSize: FontSizes.h5,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.textWhite,
    },
    categoryHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    hidePill: {
        backgroundColor: CoachingTheme.cardDark,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    hidePillText: {
        color: CoachingTheme.textGrey,
        fontSize: 11,
        fontWeight: FontWeights.semibold as any,
    },
    categorySeeAll: {
        fontSize: FontSizes.small,
        color: CoachingTheme.primaryColor,
        fontWeight: FontWeights.semibold as any,
    },
    categoryScrollRow: {
        gap: 12,
        paddingHorizontal: SCREEN_PADDING,
    },
    /* ── Coach Card ── */
    coachCard: {
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: CoachingTheme.cardColor,
        borderRadius: 16,
        padding: 12,
        width: 140,
        minHeight: 200,
        borderWidth: 1,
        borderColor: CoachingTheme.border,
    },
    coachImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: CoachingTheme.cardDark,
        marginBottom: 10,
    },
    coachInfoContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
    },
    coachName: {
        fontSize: FontSizes.small,
        fontWeight: FontWeights.semibold as any,
        color: CoachingTheme.textWhite,
        textAlign: 'center',
        marginBottom: 4,
    },
    coachSpecialty: {
        fontSize: 10,
        color: CoachingTheme.primaryColor,
        marginBottom: 8,
        textAlign: 'center',
        lineHeight: 13,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 'auto',
    },
    ratingText: {
        fontSize: 10,
        fontWeight: FontWeights.semibold as any,
        color: CoachingTheme.textWhite,
    },
    reviewText: {
        fontSize: 10,
        color: CoachingTheme.textGrey,
    },
    emptyState: {
        paddingVertical: 48,
        paddingHorizontal: SCREEN_PADDING,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: CoachingTheme.textGrey,
        fontSize: FontSizes.body,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: CoachingTheme.cardDark,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalTitle: {
        fontSize: FontSizes.h3,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.textWhite,
        marginBottom: 20,
        textAlign: 'center',
    },
    modalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    modalRowText: {
        fontSize: FontSizes.body,
        fontWeight: FontWeights.semibold as any,
        color: CoachingTheme.textWhite,
    },
    modalDoneBtn: {
        backgroundColor: CoachingTheme.primaryColor,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
    },
    modalDoneText: {
        color: '#fff',
        fontSize: FontSizes.body,
        fontWeight: FontWeights.bold as any,
    },
    /* ── See All Coaches Modal ── */
    seeAllModalContainer: {
        flex: 1,
        backgroundColor: CoachingTheme.background,
    },
    seeAllHeader: {
        height: 56,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SCREEN_PADDING,
        borderBottomWidth: 1,
        borderBottomColor: CoachingTheme.border,
    },
    seeAllBackButton: {
        color: CoachingTheme.primaryColor,
        fontSize: 14,
        fontWeight: FontWeights.semibold as any,
    },
    seeAllTitle: {
        fontSize: FontSizes.h4,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.textWhite,
    },
    horizontalCardWrapper: {
        width: CARD_WIDTH,
        marginHorizontal: 20,
        height: CARD_HEIGHT,
    },
    horizontalCoachCard: {
        backgroundColor: CoachingTheme.cardColor,
        borderRadius: 20,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        flexDirection: 'column',
        borderWidth: 1,
        borderColor: CoachingTheme.border,
    },
    imageSectionWrapper: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
        alignItems: 'center',
    },
    backgroundImage: {
        width: '100%',
        height: CARD_HEIGHT * 0.35,
    },
    darkOverlay: {
        width: '100%',
        height: CARD_HEIGHT * 0.35,
        backgroundColor: 'rgba(0,0,0,0.4)',
        position: 'absolute',
        top: 0,
        left: 0,
    },
    largeCoachImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginTop: -60,
        zIndex: 1,
        borderWidth: 2,
        borderColor: CoachingTheme.cardColor,
    },
    horizontalCardContent: {
        flex: 1,
        justifyContent: 'space-evenly',
        paddingHorizontal: 20,
        paddingBottom: 16, // Use small padding to ensure button is nicely spaced exactly at the bottom with no empty space
    },
    headerSection: {
        alignItems: 'center',
    },
    largeCoachName: {
        fontSize: 22,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.textWhite,
        textAlign: 'center',
        marginBottom: 2,
    },
    largeCoachSpecialty: {
        fontSize: 14,
        color: CoachingTheme.primaryColor,
        textAlign: 'center',
        fontWeight: FontWeights.semibold as any,
    },
    ratingSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 2,
    },
    largeRatingText: {
        fontSize: 14,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.textWhite,
    },
    largeReviewText: {
        fontSize: 12,
        color: CoachingTheme.textGrey,
    },
    divider: {
        height: 1,
        backgroundColor: CoachingTheme.border,
        marginVertical: 4,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        width: '100%',
        overflow: 'hidden',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: '#333',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 16,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.primaryColor,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 11,
        color: CoachingTheme.textGrey,
        fontWeight: FontWeights.semibold as any,
    },
    aboutSection: {
        width: '100%',
        overflow: 'hidden',
    },
    aboutText: {
        fontSize: 12,
        color: CoachingTheme.textGrey,
        textAlign: 'center',
        lineHeight: 16,
        fontWeight: FontWeights.medium as any,
    },
    availabilitySection: {
        width: '100%',
        overflow: 'hidden',
    },
    badgeRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    availabilityBadge: {
        borderWidth: 1,
        borderColor: CoachingTheme.primaryColor,
        backgroundColor: CoachingTheme.primaryGlow,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 11,
        color: CoachingTheme.primaryColor,
        fontWeight: FontWeights.semibold as any,
    },
    priceSection: {
        alignItems: 'center',
    },
    priceText: {
        fontSize: 16,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.textWhite,
    },
    bookNowButton: {
        backgroundColor: CoachingTheme.primaryColor,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        marginHorizontal: 0,
        marginBottom: 0,
    },
    bookNowText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: FontWeights.bold as any,
    },
    horizontalDropdownContainer: {
        backgroundColor: CoachingTheme.primaryColor,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 12,
        alignItems: 'center',
        width: '100%',
    },
    /* ── Pagination Dots ── */
    paginationContainer: {
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: CoachingTheme.cardColor,
    },
    activeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: CoachingTheme.primaryColor,
    },
    seeAllGridContainer: {
        paddingHorizontal: SCREEN_PADDING,
        paddingVertical: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
    },
    gridItemWrapper: {
        width: '48%',
        marginBottom: 12,
    },
    gridCoachCard: {
        backgroundColor: CoachingTheme.cardColor,
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        width: '100%',
        borderWidth: 1,
        borderColor: CoachingTheme.border,
    },
    gridCoachImage: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: CoachingTheme.cardDark,
        marginBottom: 8,
    },
    gridCoachName: {
        fontSize: 13,
        fontWeight: FontWeights.semibold as any,
        color: CoachingTheme.textWhite,
        textAlign: 'center',
        marginBottom: 4,
    },
    gridCoachSpecialty: {
        fontSize: 10,
        color: CoachingTheme.primaryColor,
        marginBottom: 8,
        textAlign: 'center',
        lineHeight: 13,
    },
    gridRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    gridRatingText: {
        fontSize: 10,
        fontWeight: FontWeights.semibold as any,
        color: CoachingTheme.textWhite,
    },
    gridReviewText: {
        fontSize: 10,
        color: CoachingTheme.textGrey,
    },
    /* ── Dropdown ── */
    dropdownContainer: {
        backgroundColor: CoachingTheme.primaryColor,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 6,
        alignItems: 'center',
        width: '100%',
    },
    dropdownText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: FontWeights.semibold as any,
        textAlign: 'center',
    },
});
