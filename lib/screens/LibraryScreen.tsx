import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NotificationBell } from '../components/NotificationBell';
import { AccessBadge } from '../components/AccessBadge';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  Animated,
  FlatList,
  Switch,
  Platform,
  LayoutAnimation,
} from 'react-native';
import { ViewMode, VIEW_MODE_COLS, VIEW_MODE_OPTIONS, ViewModeIcon, MultiColVideoCard, ListVideoCard } from '../components/LibraryViewCards';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Play, Lock, Heart, Target, LayoutGrid, Medal, Settings, Sparkles, Dumbbell, PlusCircle, Users, ChevronRight, Search } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibrary } from '../providers/LibraryContext';
import { useUser } from '../providers/UserContext';
import { useTabBarVisibility } from '../providers/TabBarVisibilityContext';
import { DifficultyDot, ThumbnailCategory } from '../components/VideoCardBits';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, VideoType, SubTab } from '../models/Video';
import { ExploreCoaches } from './ExploreCoaches';
import { useFavorites } from '../hooks/useFavorites';
import { useFavouritedVideos } from '../hooks/useFavouritedVideos';
import { GridVideoCard } from '../components/GridVideoCard';
import { SCREEN_PADDING, CARD_BORDER_RADIUS, CARD_GAP } from '../constants/theme';
import { getAllPrograms, getProgramByVideoId } from '../data/preRecordedPrograms';

import { Raw1Logo } from '../raw1_logo';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Featured hero carousel (badge + title + meta + play + dots) ──
type HeroSlide = {
  badge: string;
  badgeColor: string;       // solid badge bg ('MASTERCLASS' = frosted glass variant)
  gradient: [string, string, string];
  title: string;
  meta: string;
  onPress?: () => void;
};

const HeroCardFace = ({ slide }: { slide: HeroSlide }) => (
  <LinearGradient
    colors={slide.gradient}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={{ flex: 1 }}
  >
    {/* Badge + caption */}
    {slide.badge === 'MASTERCLASS' ? (
      <View style={{ position: 'absolute', bottom: 12, left: 12, right: 64, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
        <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 3 }}>MASTERCLASS</Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 18 }}>{slide.title}</Text>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{slide.meta}</Text>
      </View>
    ) : (
      <>
        <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: slide.badgeColor, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{slide.badge}</Text>
        </View>
        <View style={{ position: 'absolute', bottom: 16, left: 16, right: 64 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', lineHeight: 20 }}>{slide.title}</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{slide.meta}</Text>
        </View>
      </>
    )}
    {/* Play button */}
    <View style={{ position: 'absolute', bottom: 20, right: 16, alignItems: 'center', justifyContent: 'center' }}>
      <Play color="rgba(255,255,255,0.12)" size={44} fill="rgba(255,255,255,0.12)" />
    </View>
  </LinearGradient>
);

const FeaturedHero = ({ slides }: { slides: HeroSlide[] }) => {
  const [index, setIndex] = useState(0);
  const pageW = SCREEN_WIDTH;
  const cardW = SCREEN_WIDTH - 32;
  return (
    <View style={{ marginBottom: 18 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / pageW);
          if (next !== index) setIndex(next);
        }}
        onMomentumScrollEnd={(e) => {
          setIndex(Math.round(e.nativeEvent.contentOffset.x / pageW));
        }}
      >
        {slides.map((slide, i) => (
          <View key={i} style={{ width: pageW, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: cardW,
                height: 170,
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <TouchableOpacity activeOpacity={0.9} onPress={slide.onPress} style={{ flex: 1 }}>
                <HeroCardFace slide={slide} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      {/* Dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {slides.map((_, i) => (
          <View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: i === index ? '#211832' : '#D8D8E4' }} />
        ))}
      </View>
    </View>
  );
};

const WorkoutsTabContent = () => {
  const navigation = useNavigation<any>();
  const CategoryRow = ({ title, subtitle, iconName, color, last, onPress }: {
    title: string; subtitle: string; iconName: any; color: string; last?: boolean; onPress?: () => void;
  }) => (
    <>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}
        activeOpacity={0.7}
        onPress={onPress}
      >
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${color}1A`, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name={iconName} color={color} size={24} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#211832', marginBottom: 1 }}>{title}</Text>
          <Text style={{ fontSize: 12, color: '#7A7C90' }}>{subtitle}</Text>
        </View>
        <ChevronRight color="#7A7C90" size={16} />
      </TouchableOpacity>
      {!last && <View style={{ height: 1, backgroundColor: '#D8D8E4', marginHorizontal: 16 }} />}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}>

        {/* Featured — Trending & New */}
        <FeaturedHero
          slides={[
            { badge: '🔥 TRENDING', badgeColor: 'rgba(242,89,18,0.9)', gradient: ['#3B1F0B', '#5C3319', '#2A1508'], title: 'Full Body HIIT Circuit', meta: '32 min • Intermediate', onPress: () => navigation.navigate('MuscleGrowth', { allowInvite: true }) },
            { badge: '✨ NEW', badgeColor: 'rgba(34,197,94,0.9)', gradient: ['#1a2a1a', '#2d4a2d', '#0f1a0f'], title: 'Grip Endurance Challenge', meta: '20 min • Advanced', onPress: () => navigation.navigate('GripCuffVideos') },
            { badge: '🔥 TRENDING', badgeColor: 'rgba(139,92,246,0.9)', gradient: ['#1a1a3a', '#2d2d5a', '#0f0f2a'], title: 'Recovery Yoga Flow', meta: '28 min • Beginner', onPress: () => navigation.navigate('Stretching', { allowInvite: true }) },
          ]}
        />

        {/* Category rows */}
        <View style={{ marginHorizontal: SCREEN_PADDING, backgroundColor: '#F8F8FC', borderRadius: 14, borderWidth: 1, borderColor: '#D8D8E4', overflow: 'hidden', marginBottom: 16 }}>
          <CategoryRow title="Muscle Growth" subtitle="Hypertrophy focused programs" iconName="arm-flex" color="#66BB6A" onPress={() => navigation.navigate('MuscleGrowth', { allowInvite: true })} />
          <CategoryRow title="Stretching" subtitle="Improve flexibility & range of motion" iconName="yoga" color="#4FC3F7" onPress={() => navigation.navigate('Stretching', { allowInvite: true })} />
          <CategoryRow title="Athletic Performance" subtitle="Speed, power & agility training" iconName="run-fast" color="#D4A600" onPress={() => navigation.navigate('AthleticPerformance', { allowInvite: true })} />
          <CategoryRow title="Injury Rehab" subtitle="Safe recovery & rehabilitation" iconName="human-cane" color="#f44336" last onPress={() => navigation.navigate('InjuryRehab', { allowInvite: true })} />
        </View>

      </ScrollView>
    </View>
  );
};

export const LibraryScreen = () => {
  const navigation = useNavigation<any>();
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  const [hiddenSections, setHiddenSections] = useState<string[]>([]);
  const [showRecommended, setShowRecommended] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('large');
  const { isFavorite, toggleFavorite } = useFavorites();
  // Floating Exercises/Workouts toggle — appears bottom-right once the top
  // toggle is scrolled away AND scrolling has paused; hidden while scrolling.
  const [floatToggleVisible, setFloatToggleVisible] = useState(false);
  const floatScrollY = useRef(0);
  const floatPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFloatScroll = (e: any) => {
    floatScrollY.current = e?.nativeEvent?.contentOffset?.y ?? 0;
    setFloatToggleVisible(false);
    if (floatPauseTimer.current) clearTimeout(floatPauseTimer.current);
    floatPauseTimer.current = setTimeout(() => {
      if (floatScrollY.current > 120) setFloatToggleVisible(true);
    }, 350);
  };
  useEffect(() => () => { if (floatPauseTimer.current) clearTimeout(floatPauseTimer.current); }, []);
  const tabBar = useTabBarVisibility();
  // Reveal the bottom bar whenever this tab regains focus.
  useFocusEffect(useCallback(() => { tabBar?.show(); }, [tabBar]));

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedSections, savedViewMode] = await Promise.all([
          AsyncStorage.getItem('libraryHiddenSections'),
          AsyncStorage.getItem('libraryViewMode'),
        ]);
        if (savedSections) setHiddenSections(JSON.parse(savedSections));
        if (savedViewMode) setViewMode(savedViewMode as ViewMode);
      } catch (e) {
        console.log('Failed to load library settings.', e);
      }
    };
    loadSettings();
  }, []);

  const handleViewModeChange = async (mode: ViewMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode(mode);
    try {
      await AsyncStorage.setItem('libraryViewMode', mode);
    } catch (e) { }
  };

  const toggleHiddenSection = async (id: string) => {
    const newHidden = hiddenSections.includes(id)
      ? hiddenSections.filter(x => x !== id)
      : [...hiddenSections, id];
    setHiddenSections(newHidden);
    try {
      await AsyncStorage.setItem('libraryHiddenSections', JSON.stringify(newHidden));
    } catch (e) { }
  };

  const {
    allVideos,
    gripCuffVideos,
    selectedTab,
    completedCount,
    totalGripCuff,
    progress,
    isAllCompleted,
    subTab,
    setSubTab,
    setTab,
    toggleVideoCompletion,
    clearError,
  } = useLibrary();
  const { appMode } = useUser();

  const handleTabChange = (tab: VideoType) => {
    setTab(tab);
    clearError();
  };

  if (appMode === 'coaching') {
    return <ExploreCoaches />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={(e) => { onFloatScroll(e); tabBar?.onScroll(e); }}
        scrollEventThrottle={16}
      >
      {/* Header — Search · RAW1 (centered) · Settings */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
      }}>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Search color="#211832" size={22} />
        </TouchableOpacity>
        <Raw1Logo fontSize={20} />
        <TouchableOpacity onPress={() => setShowCustomizeModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Settings color="#211832" size={22} />
        </TouchableOpacity>
      </View>

      {/* Exercises / Workouts — compact pill toggle */}
      <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', backgroundColor: '#EEEEF2', borderRadius: 100, padding: 2, borderWidth: 1, borderColor: '#D8D8E4' }}>
          <TouchableOpacity
            onPress={() => setSubTab('all')}
            activeOpacity={0.8}
            style={{ paddingHorizontal: 22, paddingVertical: 6, borderRadius: 100, backgroundColor: subTab === 'all' ? '#211832' : 'transparent' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: subTab === 'all' ? '#fff' : '#7A7C90' }}>Exercises</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSubTab('workouts')}
            activeOpacity={0.8}
            style={{ paddingHorizontal: 22, paddingVertical: 6, borderRadius: 100, backgroundColor: subTab === 'workouts' ? '#211832' : 'transparent' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: subTab === 'workouts' ? '#fff' : '#7A7C90' }}>Workouts</Text>
          </TouchableOpacity>
        </View>
      </View>



      {/* Exercises featured hero */}
      {subTab === 'all' && (
        <FeaturedHero
          slides={[
            { badge: 'MASTERCLASS', badgeColor: '', gradient: ['#2a2a3e', '#1a1a2e', '#2d2d44'], title: 'Daily Flow: Industrial Mobility', meta: '24 mins • 🔴 Complex', onPress: () => navigation.navigate('GripCuffVideos') },
            { badge: '✨ NEW', badgeColor: 'rgba(34,197,94,0.9)', gradient: ['#4A3728', '#6B4E38', '#3A2718'], title: 'Forearm Crusher Series', meta: '18 min • 🟡 Medium', onPress: () => navigation.navigate('GripCuffVideos') },
            { badge: '🔥 POPULAR', badgeColor: 'rgba(79,195,247,0.9)', gradient: ['#0D2137', '#1A3A5C', '#0A1829'], title: 'Deep Stretch Recovery', meta: '35 min • 🟢 Easy', onPress: () => navigation.navigate('Stretching', { allowInvite: true }) },
          ]}
        />
      )}

      {/* RECOMMENDED SECTION (hidden — replaced by featured hero) */}
      {false && (
        <View style={{ marginBottom: 16 }}>
          {showRecommended ? (
            <>
              {/* Section Header */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                marginBottom: 12,
              }}>
                <Text style={{ color: '#211832', fontSize: 18, fontWeight: '700' }}>Recommended</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowRecommended(false)}
                    style={{ backgroundColor: '#F8F8FC', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
                  >
                    <Text style={{ color: '#7A7C90', fontSize: 12, fontWeight: '500' }}>Hide</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigation.navigate('Recommendation')}>
                    <Text style={{ color: '#F25912', fontSize: 13, fontWeight: '600' }}>See All ›</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Video Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
              >
                {RECOMMENDED_VIDEOS.map((video) => (
                  <TouchableOpacity
                    key={video.id}
                    style={{ width: 185 }}
                    onPress={() => navigation.navigate('VideoPlayer', {
                      title: video.title,
                      videoUrl: EXERCISE_LIBRARY_VIDEO_URL,
                      youtubeId: null,
                      videoType: 'exercise_library',
                    })}
                  >
                    <View style={{
                      width: 185, height: 140, borderRadius: 12, backgroundColor: video.color,
                      justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative',
                    }}>
                      <View style={{
                        width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.3)',
                        justifyContent: 'center', alignItems: 'center',
                      }}>
                        <Text style={{ color: '#211832', fontSize: 20, marginLeft: 3 }}>▶</Text>
                      </View>
                      <View style={{
                        position: 'absolute', bottom: 8, right: 8,
                        paddingHorizontal: 8, paddingVertical: 4,
                      }}>
                        <Text style={{ color: '#D8D8E4', fontSize: 12, fontWeight: '700' }}>{video.duration}</Text>
                      </View>
                      <View style={{ position: 'absolute', top: 6, left: 6 }}>
                        <Raw1Logo fontSize={12} transparent />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8, paddingRight: 2 }}>
                      <Text style={{ color: '#211832', fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 }} numberOfLines={2}>
                        {video.title}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 }}>
              <Text style={{ color: '#7A7C90', fontSize: 14, fontWeight: '600' }}>Recommended</Text>
              <TouchableOpacity
                onPress={() => setShowRecommended(true)}
                style={{ backgroundColor: '#F8F8FC', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
              >
                <Text style={{ color: '#7A7C90', fontSize: 12, fontWeight: '500' }}>Unhide</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Content */}
      <VideoContent
        videos={[...gripCuffVideos, ...allVideos]}
        completedCount={completedCount}
        total={totalGripCuff}
        progress={progress}
        isAllCompleted={isAllCompleted}
        onToggle={toggleVideoCompletion}
        subTab={subTab}
        showProgress={false}
        hiddenSections={hiddenSections}
        onHideSection={toggleHiddenSection}
        scrollable={false}
        viewMode={viewMode}
      />
      </ScrollView>

      {/* Floating Exercises/Workouts toggle — centered above the nav bar */}
      {floatToggleVisible && (
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 96,
          alignItems: 'center',
          zIndex: 90,
        }} pointerEvents="box-none">
        <View style={{
          flexDirection: 'row',
          backgroundColor: '#EEEEF2',
          borderRadius: 100,
          padding: 2,
          borderWidth: 1,
          borderColor: '#D8D8E4',
          shadowColor: '#211832',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.14,
          shadowRadius: 10,
          elevation: 6,
        }}>
          <TouchableOpacity
            onPress={() => setSubTab('all')}
            activeOpacity={0.8}
            style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100, backgroundColor: subTab === 'all' ? '#211832' : 'transparent' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: subTab === 'all' ? '#fff' : '#7A7C90' }}>Exercises</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSubTab('workouts')}
            activeOpacity={0.8}
            style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100, backgroundColor: subTab === 'workouts' ? '#211832' : 'transparent' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: subTab === 'workouts' ? '#fff' : '#7A7C90' }}>Workouts</Text>
          </TouchableOpacity>
        </View>
        </View>
      )}

      {/* Customize Modal */}
      {showCustomizeModal && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end', zIndex: 999,
        }}>
          <View style={{
            backgroundColor: '#F8F8FC',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: 40,
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}>
              <Text style={{
                color: '#211832', fontSize: 18, fontWeight: '700'
              }}>Customize Library</Text>
              <TouchableOpacity onPress={() => setShowCustomizeModal(false)}>
                <Text style={{ color: '#F25912', fontSize: 15, fontWeight: '600' }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            {/* View Style Picker — Shopify-style count + layout toggles */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 4,
              marginBottom: 22,
            }}>
              <Text style={{ color: '#7A7C90', fontSize: 13, fontWeight: '600' }}>
                {gripCuffVideos.length + allVideos.length} items
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {VIEW_MODE_OPTIONS.map(({ key }) => {
                  const active = viewMode === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => handleViewModeChange(key)}
                      activeOpacity={0.8}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? '#211832' : '#EEEEF2',
                        borderWidth: 1,
                        borderColor: active ? '#211832' : '#D8D8E4',
                      }}
                    >
                      <ViewModeIcon mode={key} color={active ? '#fff' : '#7A7C90'} size={15} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 16 }} />

            {/* Section Visibility */}
            <Text style={{ color: '#7A7C90', fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 }}>
              SECTIONS
            </Text>
            <Text style={{ color: '#7A7C90', fontSize: 12, marginBottom: 14 }}>
              Show or hide sections in your library
            </Text>

            {SECTIONS.map(section => {
              const isHidden = hiddenSections.includes(section.id);
              return (
                <TouchableOpacity
                  key={section.id}
                  onPress={() => setHiddenSections(prev =>
                    isHidden
                      ? prev.filter(id => id !== section.id)
                      : [...prev, section.id]
                  )}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F8F8FC',
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 14 }}>
                    {section.icon}
                  </Text>
                  <Text style={{
                    flex: 1,
                    color: isHidden ? '#D8D8E4' : '#ffffff',
                    fontSize: 15,
                    fontWeight: '500',
                  }}>
                    {section.label}
                  </Text>

                  {/* Toggle switch */}
                  <View style={{
                    width: 50, height: 28,
                    borderRadius: 14,
                    backgroundColor: isHidden ? '#F8F8FC' : '#F25912',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                    alignItems: isHidden ? 'flex-start' : 'flex-end',
                  }}>
                    <View style={{
                      width: 22, height: 22,
                      borderRadius: 11,
                      backgroundColor: '#ffffff',
                    }} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </SafeAreaView >
  );
};

import { getWorkoutVideoUrl } from '../constants/videoUrls';

// ── Category sections config ──
const EXERCISE_LIBRARY_VIDEO_URL = getWorkoutVideoUrl('exercise');

const RECOMMENDED_VIDEOS = [
  { id: 1, title: "Upper Body Hypertrophy", duration: "0:10", color: "#F25912" },
  { id: 2, title: "Morning Flexibility Flow", duration: "0:10", color: "#8B5CF6" },
  { id: 3, title: "Sprint Speed Drills", duration: "0:10", color: "#3B82F6" },
  { id: 4, title: "Core Strength Blast", duration: "0:10", color: "#10B981" },
  { id: 5, title: "Hip Impingement Relief", duration: "0:10", color: "#F25912" },
  { id: 6, title: "Leg Day Volume", duration: "0:10", color: "#8B5CF6" },
];

const SECTIONS = [
  { id: 'recommended', label: 'Recommended', icon: '⭐' },
  { id: 'muscle', label: 'Muscle Growth', icon: '🏋️' },
  { id: 'stretching', label: 'Stretching', icon: '🧘' },
  { id: 'athletic', label: 'Athletic Performance', icon: '🏃' },
];

const CATEGORY_SECTIONS: { key: string; label: string; mappingKey: string; icon: string }[] = [
  { key: 'Gripcuff', label: 'Gripcuff Training', mappingKey: 'gripcuff', icon: '🤜' },
  { key: 'MuscleGrowth', label: 'Muscle Growth', mappingKey: 'muscle', icon: '🏋️' },
  { key: 'Stretching', label: 'Stretching', mappingKey: 'stretching', icon: '🧘' },
  { key: 'AthleticPerformance', label: 'Athletic Performance', mappingKey: 'athletic', icon: '🏃' },
  { key: 'InjuryRehab', label: 'Injury Rehab', mappingKey: 'rehab', icon: '🩹' },
];

// ── Shared Video Content ──
const QUIZ_QUESTIONS: { id: number; question: string; options: { label: string; emoji: string; keywords?: string[] }[] }[] = [
  {
    id: 1,
    question: 'What is your fitness goal?',
    options: [
      { label: 'Muscle Growth', emoji: '💪', keywords: ['Hypertrophy', 'Bicep', 'Chest', 'Mass', 'Back'] },
      { label: 'Stretching', emoji: '🧘', keywords: ['Stretch', 'Mobility', 'Flexibility', 'Flow', 'Recovery'] },
      { label: 'Athletic Performance', emoji: '🏆', keywords: ['Performance', 'Circuit', 'Endurance', 'Stamina', 'HIIT', 'Cardio'] },
      { label: 'Injury Rehab', emoji: '🩹', keywords: ['Rehab', 'Recovery', 'Mobility', 'Low', 'Spine', 'Hip'] },
    ],
  },
  {
    id: 2,
    question: 'Which body part do you want to focus on?',
    // options are dynamic — resolved at render time from BODY_PART_OPTIONS
    options: [],
  },
];

// Dynamic Q2 options based on Q1 answer
const BODY_PART_OPTIONS: Record<string, { label: string; emoji: string }[]> = {
  'Muscle Growth': [
    { label: 'Upper Body', emoji: '💪' },
    { label: 'Lower Body', emoji: '🦵' },
    { label: 'Full Body', emoji: '🏋️' },
    { label: 'Core & Abs', emoji: '🎯' },
  ],
  'Stretching': [
    { label: 'Spine & Back', emoji: '🦴' },
    { label: 'Hips & Legs', emoji: '🦵' },
    { label: 'Shoulders & Neck', emoji: '💪' },
    { label: 'Full Body Stretch', emoji: '�' },
  ],
  'Athletic Performance': [
    { label: 'Speed & Agility', emoji: '⚡' },
    { label: 'Power & Strength', emoji: '💥' },
    { label: 'Cardio & Stamina', emoji: '🫀' },
    { label: 'Full Body Circuit', emoji: '🔄' },
  ],
  'Injury Rehab': [
    { label: 'Lower Back', emoji: '🦴' },
    { label: 'Knee & Hip', emoji: '🦵' },
    { label: 'Shoulder & Rotator', emoji: '💪' },
    { label: 'Ankle & Foot', emoji: '🦶' },
  ],
};

// Combined Q1+Q2 keyword lookup for video filtering
const COMBINED_KEYWORDS: Record<string, Record<string, string[]>> = {
  'Muscle Growth': {
    'Upper Body': ['Chest', 'Back', 'Shoulder', 'Bicep', 'Tricep'],
    'Lower Body': ['Leg', 'Squat', 'Hamstring', 'Glute', 'Quad'],
    'Full Body': ['Full Body', 'Mass', 'Circuit'],
    'Core & Abs': ['Core', 'Abs', 'Plank'],
  },
  'Stretching': {
    'Spine & Back': ['Spine', 'Back', 'Posture'],
    'Hips & Legs': ['Hip', 'Flexibility', 'Mobility'],
    'Shoulders & Neck': ['Shoulder', 'Neck', 'Stretch'],
    'Full Body Stretch': ['Flow', 'Recovery', 'Stretch'],
  },
  'Athletic Performance': {
    'Speed & Agility': ['Speed', 'Agility', 'Sprint'],
    'Power & Strength': ['Power', 'Strength', 'Explosive'],
    'Cardio & Stamina': ['Cardio', 'HIIT', 'Endurance', 'Stamina'],
    'Full Body Circuit': ['Circuit', 'Full Body', 'Functional'],
  },
  'Injury Rehab': {
    'Lower Back': ['Back', 'Spine', 'Rehab'],
    'Knee & Hip': ['Knee', 'Hip', 'Rehab', 'Mobility'],
    'Shoulder & Rotator': ['Shoulder', 'Rotator', 'Recovery'],
    'Ankle & Foot': ['Ankle', 'Foot', 'Balance'],
  },
};


const VideoContent = ({
  videos,
  completedCount,
  total,
  progress,
  isAllCompleted,
  onToggle,
  subTab,
  showProgress,
  hiddenSections,
  onHideSection,
  scrollable = true,
  viewMode = 'large',
}: {
  videos: Video[];
  completedCount: number;
  total: number;
  progress: number;
  isAllCompleted: boolean;
  onToggle: (id: string) => void;
  subTab: SubTab | null;
  showProgress: boolean;
  hiddenSections?: string[];
  onHideSection?: (key: string) => void;
  scrollable?: boolean;
  viewMode?: ViewMode;
}) => {
  const navigation = useNavigation<any>();
  const { height: screenHeight } = Dimensions.get('window');
  const contentHeight = showProgress ? screenHeight - 340 : screenHeight - 220;

  // Section display state


  // Quiz state - persisted for Goals tab only
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);

  // Reset quiz state on component mount - always start fresh, never restore from storage
  useEffect(() => {
    setQuizCompleted(false);
    setQuizStarted(false);
    setCurrentQuestion(0);
    setUserAnswers([]);
  }, []);


  // Save quiz state to AsyncStorage
  const saveQuizState = async (answers: string[], completed: boolean) => {
    try {
      await AsyncStorage.setItem('videoLibraryQuizState', JSON.stringify({
        quizCompleted: completed,
        userAnswers: answers,
      }));
    } catch (e) {
      console.log('Failed to save quiz state:', e);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...userAnswers];
    if (currentQuestion === 1) {
      // Q2 options are dynamic — resolve from BODY_PART_OPTIONS
      const goal = newAnswers[0] ?? '';
      const q2Options = BODY_PART_OPTIONS[goal] ?? [];
      newAnswers[1] = q2Options[answerIndex]?.label ?? '';
    } else {
      newAnswers[currentQuestion] = QUIZ_QUESTIONS[currentQuestion].options[answerIndex].label;
    }
    setUserAnswers(newAnswers);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < QUIZ_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Quiz complete
      saveQuizState(userAnswers, true);
      setQuizCompleted(true);
    }
  };

  const handleRetakeQuiz = async () => {
    setQuizCompleted(false);
    setQuizStarted(false);
    setCurrentQuestion(0);
    setUserAnswers([]);
    await saveQuizState([], false);
  };

  // Filter videos based on combined Q1 + Q2 quiz answers
  const getRecommendedVideos = () => {
    if (!quizCompleted || userAnswers.length === 0) {
      return videos.filter((_, i) => i < 4);
    }

    const goal = userAnswers[0];
    const bodyPart = userAnswers[1];

    // Try combined lookup first
    const keywords: string[] | undefined =
      COMBINED_KEYWORDS[goal]?.[bodyPart];

    if (keywords && keywords.length > 0) {
      const filtered = videos.filter(video =>
        keywords.some(kw =>
          video.title.toLowerCase().includes(kw.toLowerCase())
        )
      );
      // Fallback: show all videos if nothing matched
      return filtered.length > 0 ? filtered : videos;
    }

    // Fallback to Q1-only keywords
    const goalOption = QUIZ_QUESTIONS[0].options.find(o => o.label === goal);
    if (goalOption?.keywords) {
      const filtered = videos.filter(video =>
        (goalOption.keywords as string[]).some(kw =>
          video.title.toLowerCase().includes(kw.toLowerCase())
        )
      );
      return filtered.length > 0 ? filtered : videos;
    }

    return videos;
  };

  const filteredVideos = videos;

  // Grouped layout only for "All Videos" tab (subTab === 'all')
  const isGroupedView = subTab === 'all';

  // Supabase-backed favourites: refetches on screen focus via useFocusEffect inside the hook.
  const { exerciseIds: favExerciseIds, workoutIds: favWorkoutIds } = useFavouritedVideos();
  const { allVideos, gripCuffVideos, trainerVideos, bodyPartVideos } = useLibrary();

  const Outer = ({ children }: { children: React.ReactNode }) =>
    scrollable
      ? <ScrollView contentContainerStyle={styles.contentContainer}>{children}</ScrollView>
      : <View style={styles.contentContainer}>{children}</View>;

  if (subTab === 'workouts') {
    return <WorkoutsTabContent />;
  }

  if (isGroupedView && !showProgress) {
    // Collect hidden category sections for bottom rendering
    const hiddenCategorySections = CATEGORY_SECTIONS.filter((s) =>
      hiddenSections?.includes(s.mappingKey) && videos.some((v) => v.category === s.key)
    );

    return (
      <Outer>
        {/* CATEGORY SECTIONS — visible only */}
        {CATEGORY_SECTIONS.map((section) => {
          const sectionVideos = videos.filter((v) => v.category === section.key);
          if (sectionVideos.length === 0) return null;
          if (hiddenSections?.includes(section.mappingKey)) return null;

          const handleSeeAll = () => {
            if (section.key === 'Gripcuff') {
              navigation.navigate('GripCuffVideos');
            } else {
              navigation.navigate('CategoryVideos', { categoryKey: section.key, categoryLabel: section.label });
            }
          };

          return (
            <View key={section.key} style={styles.categorySection}>
              <View style={styles.categorySectionHeader}>
                <Text style={styles.categorySectionTitle}>{section.label}</Text>
                <View style={styles.categoryHeaderActions}>
                  {onHideSection && (
                    <TouchableOpacity
                      style={styles.hidePill}
                      onPress={() => onHideSection(section.mappingKey)}
                    >
                      <Text style={styles.hidePillText}>Hide</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleSeeAll}>
                    <Text style={styles.categorySeeAll}>See All &gt;</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {viewMode === 'large' ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScrollRow}
                >
                  {sectionVideos.map((video, index) => (
                    <VideoTile
                      key={video.id}
                      video={video}
                      index={index}
                      showCheckbox={false}
                      onToggle={() => onToggle(video.id)}
                      onPress={() => navigation.navigate('VideoPlayer', { title: video.title, videoId: video.id, videoUrl: EXERCISE_LIBRARY_VIDEO_URL, youtubeId: null, videoType: 'exercise_library' })}
                    />
                  ))}
                </ScrollView>
              ) : viewMode === 'list' ? (
                <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
                  {sectionVideos.map((video, index) => (
                    <ListVideoCard
                      key={video.id}
                      video={video}
                      index={index}
                      onPress={() => navigation.navigate('VideoPlayer', { title: video.title, videoId: video.id, videoUrl: EXERCISE_LIBRARY_VIDEO_URL, youtubeId: null, videoType: 'exercise_library' })}
                    />
                  ))}
                </View>
              ) : (() => {
                const { width: sw } = Dimensions.get('window');
                const cols = VIEW_MODE_COLS[viewMode];
                const gap = cols === 4 ? 6 : 8;
                const cardWidth = (sw - 32 - gap * (cols - 1)) / cols;
                return (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap }}>
                    {sectionVideos.map((video, index) => (
                      <MultiColVideoCard
                        key={video.id}
                        video={video}
                        index={index}
                        cardWidth={cardWidth}
                        onPress={() => navigation.navigate('VideoPlayer', { title: video.title, videoId: video.id, videoUrl: EXERCISE_LIBRARY_VIDEO_URL, youtubeId: null, videoType: 'exercise_library' })}
                      />
                    ))}
                  </View>
                );
              })()}
            </View>
          );
        })}

        {/* HIDDEN SECTIONS — at the bottom */}
        {hiddenCategorySections.length > 0 && (
          <View style={styles.hiddenSectionsGroup}>
            {hiddenCategorySections.map((section) => (
              <View key={section.key} style={styles.hiddenSectionRow}>
                <Text style={styles.hiddenSectionLabel}>{section.label}</Text>
                {onHideSection && (
                  <TouchableOpacity style={styles.unhidePill} onPress={() => onHideSection(section.mappingKey)}>
                    <Text style={styles.unhidePillText}>Unhide</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </Outer>
    );
  }

  // Flat layout for Favorites / Goals
  return (
    <Outer>
      {showProgress && (
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Your Progress</Text>
            <View
              style={[
                styles.progressBadge,
                isAllCompleted && styles.progressBadgeComplete,
              ]}
            >
              <Text
                style={[
                  styles.progressBadgeText,
                  isAllCompleted && styles.progressBadgeTextComplete,
                ]}
              >
                {completedCount} / {total} Completed
              </Text>
            </View>
          </View>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: isAllCompleted ? '#059669' : AppTheme.primaryColor,
                },
              ]}
            />
          </View>
          {isAllCompleted && (
            <View style={styles.completeMessage}>
              <Text style={styles.completeEmoji}>🎉</Text>
              <Text style={styles.completeText}>
                All Gripcuff training videos completed!
              </Text>
            </View>
          )}
        </View>
      )}

    </Outer>
  );
};

// ── Video Tile Component ──
const VideoTile = ({
  video,
  index,
  showCheckbox = true,
  onPress,
  onToggle,
}: {
  video: Video;
  index: number;
  showCheckbox?: boolean;
  onPress: () => void;
  onToggle?: () => void;
}) => {
  const { isFavorite, toggleFavorite } = useFavorites();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const fav = isFavorite(video.id);
  const parseDurationSeconds = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d+$/.test(trimmed)) return Number(trimmed);
      const parts = trimmed.split(':').map((p) => Number(p));
      if (parts.every((p) => Number.isFinite(p))) {
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
    }
    return 0;
  };
  const durationSeconds = parseDurationSeconds((video as any).duration);
  const durationLabel = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`;
  const program = getProgramByVideoId(video.id);
  const displayTitle = /^Day\s+\d+$/i.test(video.title) && program
    ? `${program.title} - ${video.title}`
    : video.title;

  const handleFavoritePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
    toggleFavorite({
      id: video.id,
      title: displayTitle,
      duration: durationLabel,
      category: video.category,
      difficulty: video.difficulty,
      videoUrl: video.videoUrl,
    });
  };

  // Muted earthy / slate thumbnail gradients (Ash & Midnight)
  const gradients = [
    ['#8B7355', '#6B5B45'],   // tan / brown
    ['#7A8A8A', '#5A6A6A'],   // slate green-grey
    ['#4A5568', '#2D3748'],   // slate-blue
    ['#6B4226', '#4A2E1A'],   // brown
    ['#2A2A3E', '#1A1A2E'],   // dark navy
    ['#0D2137', '#1A3A5C'],   // deep blue
    ['#C4B8A8', '#A09488'],   // beige
    ['#3B1F0B', '#5C3319'],   // dark amber
  ];

  let finalColors = gradients[index % gradients.length];
  if (video.color) {
    finalColors = [video.color, video.color];
  }

  return (
    <TouchableOpacity style={styles.videoCard} onPress={onPress}>
      <LinearGradient
        colors={[
          finalColors[0].slice(0, 7) + (video.isCompleted ? '66' : 'FF'),
          finalColors[1].slice(0, 7) + (video.isCompleted ? '66' : 'FF'),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.videoThumbnail}
      >
        {/* Center Icon */}
        <View
          style={[
            styles.centerIcon,
            video.isCompleted
              ? { backgroundColor: '#059669' }
              : { backgroundColor: 'transparent' },
          ]}
        >
          {video.isCompleted ? (
            <Check color="#fff" size={14} />
          ) : (
            <Play color="rgba(255,255,255,0.12)" size={28} fill="rgba(255,255,255,0.12)" />
          )}
        </View>

        {/* Duration Badge */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {durationLabel}
          </Text>
        </View>

        {/* RAW1 logo watermark */}
        <View style={{ position: 'absolute', top: 6, left: 6 }}>
          <Raw1Logo fontSize={12} transparent />
        </View>

        {/* Completion Checkbox - Tappable independently */}
        {showCheckbox && (
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={(e) => {
              e.stopPropagation();
              if (onToggle) onToggle();
            }}
            activeOpacity={0.6}
          >
            <View
              style={[
                styles.checkbox,
                video.isCompleted && styles.checkboxChecked,
              ]}
            >
              {video.isCompleted && (
                <Check color="#211832" size={12} />
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Lock Overlay */}
        {video.locked && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }]}>
            <Lock color="#211832" size={28} />
          </View>
        )}
        <ThumbnailCategory category={video.category} />
      </LinearGradient>

      {/* Text Info */}
      <View style={styles.videoInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingRight: 8 }}>
          <Text
            style={[
              styles.videoTitle,
              { flex: 1 },
              video.isCompleted && styles.videoTitleCompleted,
            ]}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
          <DifficultyDot difficulty={video.difficulty} style={{ marginTop: 4 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: FontSizes.h2,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
  },
  /* ── Sub Tabs ── */
  tabContainer: {
    backgroundColor: '#F8F8FC',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 4,
  },
  tabScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#000000',  // pure black
    borderRadius: 10,
  },
  tabIcon: {
    fontSize: 13,
    color: '#7A7C90',
  },
  tabText: {
    color: '#7A7C90',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  /* ── Gripcuff Card (Compact) ── */
  gripCuffCard: {
    backgroundColor: AppTheme.cardColor,
    borderRadius: 14,
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gripCuffCardTitle: {
    fontSize: 13,
    fontWeight: '600' as any,
    color: AppTheme.textWhite,
    marginBottom: 2,
  },
  gripCuffCardMeta: {
    fontSize: 10,
    color: '#7A7C90',
  },
  gripCuffCardButtonSmall: {
    backgroundColor: '#F25912',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gripCuffCardButtonTextSmall: {
    color: AppTheme.textWhite,
    fontSize: 11,
    fontWeight: '700' as any,
  },
  gripCuffCardProgressStackSmall: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gripCuffCardProgressSmall: {
    fontSize: 10,
    fontWeight: '600' as any,
    color: AppTheme.primaryColor,
    marginBottom: 3,
  },
  gripCuffCardProgressBarSmall: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden' as any,
  },
  gripCuffCardProgressBarFillSmall: {
    height: '100%' as any,
    borderRadius: 2,
  },

  /* ── AI Personalized Workout CTA ── */
  aiCtaCard: {
    backgroundColor: 'rgba(242,89,18, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(242,89,18, 0.35)',
    borderRadius: 14,
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiCtaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiCtaTitle: {
    fontSize: 14,
    fontWeight: '700' as any,
    color: AppTheme.textWhite,
    marginLeft: 6,
  },
  aiCtaSubtitle: {
    fontSize: 12,
    color: '#7A7C90',
  },
  aiCtaArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F25912',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  /* ── Content ── */
  contentContainer: {
    paddingBottom: 32,
  },

  /* ── Category Sections (All Videos grouped) ── */
  favoritesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 24,
    paddingHorizontal: SCREEN_PADDING,
  },
  categorySection: {
    marginBottom: 28,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: SCREEN_PADDING,
  },
  categorySectionTitle: {
    fontSize: FontSizes.h5,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
  },
  categoryHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hidePill: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#7A7C90',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hidePillText: {
    color: '#7A7C90',
    fontSize: 11,
    fontWeight: FontWeights.semibold as any,
  },
  hiddenSectionsGroup: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8F8FC',
    paddingTop: 8,
  },
  hiddenSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hiddenSectionLabel: {
    color: '#7A7C90',
    fontSize: 14,
    fontWeight: '600' as any,
  },
  unhidePill: {
    backgroundColor: '#F8F8FC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  unhidePillText: {
    color: '#7A7C90',
    fontSize: 12,
    fontWeight: '500' as any,
  },
  categorySeeAll: {
    fontSize: FontSizes.small,
    color: AppTheme.primaryColor,
    fontWeight: FontWeights.semibold as any,
  },
  categoryScrollRow: {
    gap: 12,
    paddingLeft: SCREEN_PADDING,
    paddingRight: SCREEN_PADDING,
  },
  favSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  favSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#211832',
  },
  favViewAll: {
    fontSize: 13,
    color: '#F25912',
    fontWeight: '600',
  },
  emptyVisibilityState: {
    paddingVertical: 60,
    paddingHorizontal: SCREEN_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyVisibilityText: {
    color: AppTheme.textGrey,
    fontSize: FontSizes.body,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 250,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: AppTheme.cardColor,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: FontSizes.h3,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33,24,50,0.05)',
  },
  modalRowText: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold as any,
    color: AppTheme.textWhite,
  },
  modalDoneBtn: {
    backgroundColor: AppTheme.primaryColor,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  modalDoneText: {
    color: '#211832',
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold as any,
  },
  emptyState: {
    paddingVertical: 48,
    paddingHorizontal: SCREEN_PADDING,
    alignItems: 'center',
  },
  emptyText: {
    color: AppTheme.textGrey,
    fontSize: FontSizes.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressCard: {
    backgroundColor: AppTheme.cardColor,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `rgba(242,89,18, 0.2)`,
    padding: 20,
    marginBottom: 24,
    marginHorizontal: SCREEN_PADDING,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: FontSizes.h5,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
  },
  progressBadge: {
    backgroundColor: `rgba(242,89,18, 0.15)`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  progressBadgeComplete: {
    backgroundColor: `rgba(5, 150, 105, 0.15)`,
  },
  progressBadgeText: {
    color: AppTheme.primaryColor,
    fontSize: FontSizes.small,
    fontWeight: FontWeights.semibold as any,
  },
  progressBadgeTextComplete: {
    color: '#059669',
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: AppTheme.inactiveColor,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  completeMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completeEmoji: {
    fontSize: 18,
  },
  completeText: {
    color: '#34D399',
    fontSize: FontSizes.small,
    fontWeight: FontWeights.semibold as any,
  },
  videosHorizontalScroll: {
    paddingLeft: SCREEN_PADDING,
    paddingRight: SCREEN_PADDING,
    gap: 12,
    flexDirection: 'column',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
  },
  videoCard: {
    width: 170,
    backgroundColor: 'transparent',
    borderRadius: 14,
    overflow: 'visible',
    marginRight: 12,
  },
  videoThumbnail: {
    width: 170,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  centerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  durationText: {
    color: '#D8D8E4',
    fontSize: 11,
    fontWeight: '700' as any,
    letterSpacing: 0.3,
  },
  checkboxContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    display: 'none' as any,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.54)',
    borderWidth: 2,
    borderColor: 'rgba(33,24,50, 0.54)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: AppTheme.primaryColor,
    borderColor: AppTheme.primaryColor,
  },
  videoInfo: {
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  videoTitle: {
    fontSize: FontSizes.small,
    fontWeight: FontWeights.semibold as any,
    color: AppTheme.textWhite,
    marginBottom: 4,
  },
  videoTitleCompleted: {
    textDecorationLine: 'line-through',
    color: AppTheme.textGrey,
  },
  videoCategory: {
    fontSize: 10,
    color: AppTheme.textGrey,
  },
  lockedPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppTheme.cardColor,
    borderWidth: 2,
    borderColor: AppTheme.textGrey,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: FontSizes.h4,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 12,
    textAlign: 'center',
  },
  lockedSubtitle: {
    fontSize: FontSizes.body,
    color: AppTheme.textGrey,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 21,
  },
  lockedProgressContainer: {
    backgroundColor: `rgba(242,89,18, 0.12)`,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  lockedProgressText: {
    color: AppTheme.primaryColor,
    fontSize: FontSizes.small,
    fontWeight: FontWeights.semibold as any,
  },
  unlockedMessage: {
    flexDirection: 'row',
    backgroundColor: `rgba(5, 150, 105, 0.1)`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `rgba(5, 150, 105, 0.3)`,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  unlockedEmoji: {
    fontSize: 20,
  },
  unlockedText: {
    flex: 1,
    color: '#34D399',
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold as any,
  },

  /* ── Quiz Styles ── */
  quizInitialCard: {
    backgroundColor: AppTheme.cardColor,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `rgba(242,89,18, 0.2)`,
    padding: 24,
    marginBottom: 24,
    marginHorizontal: SCREEN_PADDING,
    alignItems: 'center',
  },
  quizInitialTitle: {
    fontSize: FontSizes.h4,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  quizInitialSubtitle: {
    fontSize: FontSizes.body,
    color: AppTheme.textGrey,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  quizGetStartedButton: {
    backgroundColor: AppTheme.primaryColor,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  quizGetStartedButtonText: {
    color: '#211832',
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold as any,
  },
  creditBalanceText: {
    color: AppTheme.textGrey,
    fontSize: FontSizes.small,
    textAlign: 'center',
    marginTop: 12,
  },
  quizQuestionCard: {
    backgroundColor: AppTheme.cardColor,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `rgba(242,89,18, 0.2)`,
    padding: 24,
    marginBottom: 24,
    marginHorizontal: SCREEN_PADDING,
  },
  quizProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  quizProgressFill: {
    height: '100%',
    backgroundColor: AppTheme.primaryColor,
  },
  quizProgressText: {
    fontSize: FontSizes.small,
    color: AppTheme.textGrey,
    fontWeight: FontWeights.semibold as any,
    marginBottom: 16,
  },
  quizQuestion: {
    fontSize: FontSizes.h5,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 24,
  },
  quizChoicesContainer: {
    gap: 12,
    marginBottom: 24,
  },
  quizChoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: 'rgba(33,24,50, 0.1)',
    gap: 12,
  },
  quizChoiceButtonSelected: {
    backgroundColor: `rgba(242,89,18, 0.15)`,
    borderColor: AppTheme.primaryColor,
  },
  quizChoiceEmoji: {
    fontSize: 24,
  },
  quizChoiceLabel: {
    flex: 1,
    fontSize: FontSizes.body,
    color: AppTheme.textWhite,
    fontWeight: FontWeights.semibold as any,
  },
  quizNextButton: {
    backgroundColor: AppTheme.primaryColor,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  quizNextButtonDisabled: {
    backgroundColor: AppTheme.inactiveColor,
    opacity: 0.5,
  },
  quizNextButtonText: {
    color: '#211832',
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold as any,
  },
  quizCompletedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
    marginBottom: 16,
  },
  quizCompletedTitle: {
    fontSize: FontSizes.h4,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
  },
  retakeQuizButton: {
    backgroundColor: AppTheme.cardColor,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppTheme.primaryColor,
  },
  retakeQuizButtonText: {
    color: AppTheme.primaryColor,
    fontSize: 12,
    fontWeight: FontWeights.semibold as any,
  },

  /* ── Blurred Teaser Grid ── */
  teaserText: {
    fontSize: 13,
    color: AppTheme.textGrey,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  teaserGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 24,
  },
  teaserCardWrapper: {
    width: '48%',
    position: 'relative',
  },
  teaserCard: {
    backgroundColor: AppTheme.cardColor,
    borderRadius: 12,
    overflow: 'hidden',
  },
  teaserCardThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  teaserCardTitle: {
    fontSize: 11,
    color: AppTheme.textGrey,
    padding: 8,
  },
  teaserLockOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  teaserLockIcon: {
    fontSize: 24,
  },
  comingSoonContainer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 40,
    alignItems: 'center',
  },
  comingSoonCard: {
    backgroundColor: AppTheme.cardColor,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(33,24,50, 0.05)',
  },
  comingSoonEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  comingSoonTitle: {
    fontSize: FontSizes.h3,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  comingSoonSubtitle: {
    fontSize: FontSizes.body,
    color: AppTheme.textGrey,
    textAlign: 'center',
    lineHeight: 22,
  },

  /* ── Gripcuff Dynamic Section Styles ── */
  gripCuffSection: {
    marginBottom: 24,
  },
  gripCuffSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  gripCuffSectionTitle: {
    color: '#211832',
    fontSize: 18,
    fontWeight: '700',
  },
  gripCuffSectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gripCuffHideBtn: {
    backgroundColor: '#F8F8FC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  gripCuffHideBtnText: {
    color: '#7A7C90',
    fontSize: 12,
    fontWeight: '500',
  },
  gripCuffSeeAllText: {
    color: '#F25912',
    fontSize: 13,
    fontWeight: '600',
  },
  goalCardStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FC',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  goalCardIconContainer: {
    width: 44, height: 44,
    borderRadius: 12,
    backgroundColor: '#F8F8FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  goalCardTitle: {
    color: '#211832',
    fontSize: 15,
    fontWeight: '700',
  },
  goalCardSubtitle: {
    color: '#7A7C90',
    fontSize: 12,
    marginTop: 2,
  },
  goalCardArrow: {
    color: '#F25912',
    fontSize: 18,
  },
});
