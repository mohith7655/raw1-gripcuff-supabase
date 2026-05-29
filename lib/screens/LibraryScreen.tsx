import React, { useState, useEffect } from 'react';
import { NotificationBell } from '../components/NotificationBell';
import { AccessBadge } from '../components/AccessBadge';
import { useNavigation } from '@react-navigation/native';
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
import { ViewMode, VIEW_MODE_COLS, VIEW_MODE_OPTIONS, MultiColVideoCard, ListVideoCard } from '../components/LibraryViewCards';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Play, Lock, Heart, Target, LayoutGrid, Medal, Settings, Sparkles, Dumbbell, Flame, Zap, HeartPulse, PersonStanding, PlusCircle, Users, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibrary } from '../providers/LibraryContext';
import { useUser } from '../providers/UserContext';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Video, VideoType, SubTab } from '../models/Video';
import { ExploreCoaches } from './ExploreCoaches';
import { useFavorites } from '../hooks/useFavorites';
import { useFavouritedVideos } from '../hooks/useFavouritedVideos';
import { GridVideoCard } from '../components/GridVideoCard';
import { SCREEN_PADDING, CARD_BORDER_RADIUS, CARD_GAP } from '../constants/theme';
import { getAllPrograms, getProgramByVideoId } from '../data/preRecordedPrograms';

const WorkoutsTabContent = () => {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'programs' | 'ai'>('programs');

  const CategoryRow = ({ title, subtitle, IconName, color, onPress }: {
    title: string; subtitle: string; IconName: any; color: string; onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 }}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${color}20`, alignItems: 'center', justifyContent: 'center' }}>
        <IconName color={color} size={20} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 2 }}>{title}</Text>
        <Text style={{ fontSize: 12, color: '#888' }}>{subtitle}</Text>
      </View>
      <ChevronRight color="#e46600" size={18} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Pill toggle */}
      <View style={{ flexDirection: 'row', backgroundColor: '#131f2e', borderRadius: 12, padding: 4, marginHorizontal: 16, marginBottom: 4 }}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: activeTab === 'programs' ? '#000000' : 'transparent' }}
          onPress={() => setActiveTab('programs')}
          activeOpacity={0.8}
        >
          <Text style={{ color: activeTab === 'programs' ? '#ffffff' : '#607a94', fontSize: 11, fontWeight: activeTab === 'programs' ? '700' : '500' }}>
            Pre-Recorded Programs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: activeTab === 'ai' ? '#000000' : 'transparent' }}
          onPress={() => setActiveTab('ai')}
          activeOpacity={0.8}
        >
          <Sparkles size={13} color={activeTab === 'ai' ? AppTheme.primaryColor : '#607a94'} />
          <Text style={{ color: activeTab === 'ai' ? '#ffffff' : '#607a94', fontSize: 11, fontWeight: activeTab === 'ai' ? '700' : '500' }}>
            AI Personal Trainer
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingTop: 16, paddingBottom: 40 }}>
        {activeTab === 'programs' && (
          <>
            {/* Workout with a Friend */}
            <TouchableOpacity
              style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}
              onPress={() => navigation.navigate('WorkoutWithFriendFlow')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#1a1a1a', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 12 }}
              >
                <Users color="#fff" size={20} style={{ marginRight: 10 }} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Workout with a Friend</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Category rows */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: CARD_BORDER_RADIUS, borderWidth: 1, borderColor: 'rgba(228,102,0,0.15)', overflow: 'hidden' }}>
              <CategoryRow title="Muscle Growth" subtitle="Hypertrophy focused programs" IconName={Flame} color="#f44336" onPress={() => navigation.navigate('MuscleGrowth', { allowInvite: true })} />
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 }} />
              <CategoryRow title="Stretching" subtitle="Improve flexibility & range of motion" IconName={PersonStanding} color="#4FC3F7" onPress={() => navigation.navigate('Stretching', { allowInvite: true })} />
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 }} />
              <CategoryRow title="Athletic Performance" subtitle="Speed, power & agility training" IconName={Zap} color="#FFD600" onPress={() => navigation.navigate('AthleticPerformance', { allowInvite: true })} />
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 }} />
              <CategoryRow title="Injury Rehab" subtitle="Safe recovery & rehabilitation" IconName={HeartPulse} color="#66BB6A" onPress={() => navigation.navigate('InjuryRehab', { allowInvite: true })} />
            </View>
          </>
        )}

        {activeTab === 'ai' && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: CARD_BORDER_RADIUS, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', padding: 18, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles color={AppTheme.primaryColor} size={24} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 3 }}>AI Personal Trainer</Text>
                <Text style={{ color: '#888', fontSize: 13 }}>Generate custom workouts</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ borderRadius: 12, overflow: 'hidden', width: '100%' }}
              onPress={() => navigation.navigate('AITrainerScreen')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[AppTheme.primaryColor, '#ff8534']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 12 }}
              >
                <PlusCircle color="#fff" size={20} style={{ marginRight: 10 }} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Start AI Workout</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('UpcomingSessionsScreen')} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: AppTheme.primaryColor, fontSize: 13, fontWeight: '600' }}>View All Sessions →</Text>
            </TouchableOpacity>
          </View>
        )}
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
        contentContainerStyle={{ paddingBottom: 40 }}
      >
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}>
        <View>
          <Text style={{
            color: '#ffffff',
            fontSize: 24,
            fontWeight: '800',
          }}>Library</Text>
          <Text style={{
            color: 'rgba(180,200,220,0.6)',
            fontSize: 12,
            fontWeight: '400',
            marginTop: 4,
            lineHeight: 18,
          }}>Explore single short phased exercises for every goal.</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {/* Customize button */}
          <TouchableOpacity
            onPress={() => setShowCustomizeModal(true)}
            style={{
              backgroundColor: '#131f2e',
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 7,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderWidth: 1,
              borderColor: '#1c3a56',
            }}
          >
            <Text style={{ fontSize: 13 }}>⚙️</Text>
            <Text style={{
              color: '#8aaccc',
              fontSize: 13,
              fontWeight: '500',
            }}>Customize</Text>
          </TouchableOpacity>
          <NotificationBell size={24} />
        </View>
      </View>

      {/* Sub Tabs — All / Favorites / Goals / Recommendations */}
      <View style={[styles.tabContainer, { flexDirection: 'row', backgroundColor: '#131f2e', borderRadius: 12, padding: 4, marginHorizontal: 16, marginVertical: 12 }]}>

        {/* All Exercises */}
        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: subTab === 'all' ? '#000000' : 'transparent',
          }}
          onPress={() => {
            setSubTab('all');

          }}
        >
          <LayoutGrid size={13} color={subTab === 'all' ? AppTheme.primaryColor : '#607a94'} />
          <Text
            numberOfLines={1}
            style={{
              color: subTab === 'all' ? '#ffffff' : '#607a94',
              fontSize: 11,
              fontWeight: subTab === 'all' ? '700' : '500',
            }}
          >
            All Exercises
          </Text>
        </TouchableOpacity>

        {/* Workouts */}
        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: subTab === 'workouts' ? '#000000' : 'transparent',
          }}
          onPress={() => setSubTab('workouts')}
        >
          <Dumbbell size={13} color={subTab === 'workouts' ? AppTheme.primaryColor : '#607a94'} />
          <Text
            numberOfLines={1}
            style={{
              color: subTab === 'workouts' ? '#ffffff' : '#607a94',
              fontSize: 11,
              fontWeight: subTab === 'workouts' ? '700' : '500',
            }}
          >
            Workouts
          </Text>
        </TouchableOpacity>

      </View>

      {/* RECOMMENDED SECTION */}
      {subTab === 'all' && (
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
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Recommended</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowRecommended(false)}
                    style={{ backgroundColor: '#1c2e42', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
                  >
                    <Text style={{ color: '#8aaccc', fontSize: 12, fontWeight: '500' }}>Hide</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => navigation.navigate('Recommendation')}>
                    <Text style={{ color: '#D4622A', fontSize: 13, fontWeight: '600' }}>See All ›</Text>
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
                        <Text style={{ color: '#fff', fontSize: 20, marginLeft: 3 }}>▶</Text>
                      </View>
                      <View style={{
                        position: 'absolute', bottom: 8, right: 8, backgroundColor: '#000',
                        borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                      }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{video.duration}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8, paddingRight: 2 }}>
                      <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 }} numberOfLines={2}>
                        {video.title}
                      </Text>
                      <TouchableOpacity
                        style={{ marginLeft: 6, marginTop: 2 }}
                        onPress={() => toggleFavorite({
                          id: String(video.id),
                          title: video.title,
                          duration: video.duration,
                          category: 'Recommended',
                        })}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name={isFavorite(String(video.id)) ? 'heart' : 'heart-outline'}
                          size={20}
                          color={isFavorite(String(video.id)) ? AppTheme.primaryColor : AppTheme.textGrey}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 }}>
              <Text style={{ color: '#607a94', fontSize: 14, fontWeight: '600' }}>Recommended</Text>
              <TouchableOpacity
                onPress={() => setShowRecommended(true)}
                style={{ backgroundColor: '#1c2e42', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}
              >
                <Text style={{ color: '#8aaccc', fontSize: 12, fontWeight: '500' }}>Unhide</Text>
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

      {/* Customize Modal */}
      {showCustomizeModal && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end', zIndex: 999,
        }}>
          <View style={{
            backgroundColor: '#131f2e',
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
                color: '#fff', fontSize: 18, fontWeight: '700'
              }}>Customize Library</Text>
              <TouchableOpacity onPress={() => setShowCustomizeModal(false)}>
                <Text style={{ color: '#D4622A', fontSize: 15, fontWeight: '600' }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            {/* View Style Picker */}
            <Text style={{ color: '#8aaccc', fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 10, marginTop: 4 }}>
              VIEW STYLE
            </Text>
            <View style={{ flexDirection: 'row', gap: 7, marginBottom: 22 }}>
              {VIEW_MODE_OPTIONS.map(({ key, label, icon }) => {
                const active = viewMode === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleViewModeChange(key)}
                    style={{
                      flex: 1,
                      backgroundColor: active ? 'rgba(212,98,42,0.14)' : '#0d1822',
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: active ? '#D4622A' : '#1c3a56',
                      paddingVertical: 10,
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Text style={{ fontSize: 15, color: active ? '#D4622A' : '#607a94' }}>{icon}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: active ? '#D4622A' : '#607a94' }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 16 }} />

            {/* Section Visibility */}
            <Text style={{ color: '#8aaccc', fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 }}>
              SECTIONS
            </Text>
            <Text style={{ color: '#607a94', fontSize: 12, marginBottom: 14 }}>
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
                    borderBottomColor: '#1c3a56',
                  }}
                >
                  <Text style={{ fontSize: 20, marginRight: 14 }}>
                    {section.icon}
                  </Text>
                  <Text style={{
                    flex: 1,
                    color: isHidden ? '#3a5a7a' : '#ffffff',
                    fontSize: 15,
                    fontWeight: '500',
                  }}>
                    {section.label}
                  </Text>

                  {/* Toggle switch */}
                  <View style={{
                    width: 50, height: 28,
                    borderRadius: 14,
                    backgroundColor: isHidden ? '#1c2e42' : '#D4622A',
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
  { id: 1, title: "Upper Body Hypertrophy", duration: "0:10", color: "#E8732A" },
  { id: 2, title: "Morning Flexibility Flow", duration: "0:10", color: "#8B5CF6" },
  { id: 3, title: "Sprint Speed Drills", duration: "0:10", color: "#3B82F6" },
  { id: 4, title: "Core Strength Blast", duration: "0:10", color: "#10B981" },
  { id: 5, title: "Hip Impingement Relief", duration: "0:10", color: "#E8732A" },
  { id: 6, title: "Leg Day Volume", duration: "0:10", color: "#8B5CF6" },
];

const SECTIONS = [
  { id: 'recommended', label: 'Recommended', icon: '⭐' },
  { id: 'muscle', label: 'Muscle Growth', icon: '🏋️' },
  { id: 'stretching', label: 'Stretching', icon: '🧘' },
  { id: 'athletic', label: 'Athletic Performance', icon: '🏃' },
];

const CATEGORY_SECTIONS: { key: string; label: string; mappingKey: string; icon: string }[] = [
  { key: 'GripCuff', label: 'GripCuff Training', mappingKey: 'gripcuff', icon: '🤜' },
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
            if (section.key === 'GripCuff') {
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
                All GripCuff training videos completed!
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

  const gradients = [
    ['#FF6B35', '#E84100'],
    ['#7C3AED', '#4F46E5'],
    ['#059669', '#047857'],
    ['#DB2777', '#9D174D'],
    ['#2563EB', '#1D4ED8'],
    ['#D97706', '#B45309'],
    ['#0891B2', '#0E7490'],
    ['#E11D48', '#BE185D'],
    ['#16A34A', '#15803D'],
    ['#8B5CF6', '#6D28D9'],
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
            { backgroundColor: video.isCompleted ? '#059669' : AppTheme.primaryColor },
          ]}
        >
          {video.isCompleted ? (
            <Check color="#fff" size={14} />
          ) : (
            <Play color="#fff" size={14} fill="#fff" />
          )}
        </View>

        {/* Duration Badge */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {durationLabel}
          </Text>
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
                <Check color="#fff" size={12} />
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Lock Overlay */}
        {video.locked && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }]}>
            <Lock color="#ffffff" size={28} />
          </View>
        )}
      </LinearGradient>

      {/* Text Info */}
      <View style={styles.videoInfo}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text
              style={[
                styles.videoTitle,
                video.isCompleted && styles.videoTitleCompleted,
              ]}
              numberOfLines={1}
            >
              {displayTitle}
            </Text>
            <Text style={styles.videoCategory}>{video.category} • {video.difficulty}</Text>
          </View>
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleFavoritePress(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Ionicons
                name={fav ? "heart" : "heart-outline"}
                size={22}
                color={fav ? AppTheme.primaryColor : AppTheme.textGrey}
              />
            </Animated.View>
          </TouchableOpacity>
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
    backgroundColor: '#131f2e',
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
    color: '#607a94',
  },
  tabText: {
    color: '#607a94',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  /* ── GripCuff Card (Compact) ── */
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
    color: '#888888',
  },
  gripCuffCardButtonSmall: {
    backgroundColor: '#FF6B00',
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
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 0, 0.35)',
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
    color: '#aaaaaa',
  },
  aiCtaArrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B00',
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
    backgroundColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  hidePillText: {
    color: '#bbb',
    fontSize: 11,
    fontWeight: FontWeights.semibold as any,
  },
  hiddenSectionsGroup: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1c3a56',
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
    color: '#607a94',
    fontSize: 14,
    fontWeight: '600' as any,
  },
  unhidePill: {
    backgroundColor: '#1c2e42',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  unhidePillText: {
    color: '#8aaccc',
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
    color: '#ffffff',
  },
  favViewAll: {
    fontSize: 13,
    color: '#FF6B00',
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
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
    color: '#fff',
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
    borderColor: `rgba(228, 102, 0, 0.2)`,
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
    backgroundColor: `rgba(228, 102, 0, 0.15)`,
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
    width: 160,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
    elevation: 5,
    marginRight: 16,
  },
  videoThumbnail: {
    width: 160,
    height: 110,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  durationText: {
    color: AppTheme.textWhite,
    fontSize: 10,
    fontWeight: FontWeights.bold as any,
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
    borderColor: 'rgba(255, 255, 255, 0.54)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: AppTheme.primaryColor,
    borderColor: AppTheme.primaryColor,
  },
  videoInfo: {
    padding: 12,
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
    backgroundColor: `rgba(228, 102, 0, 0.12)`,
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
    borderColor: `rgba(255, 107, 0, 0.2)`,
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
    color: '#fff',
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
    borderColor: `rgba(255, 107, 0, 0.2)`,
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  quizChoiceButtonSelected: {
    backgroundColor: `rgba(255, 107, 0, 0.15)`,
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
    color: '#fff',
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
    borderColor: 'rgba(255, 255, 255, 0.05)',
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

  /* ── GripCuff Dynamic Section Styles ── */
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
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  gripCuffSectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gripCuffHideBtn: {
    backgroundColor: '#1c2e42',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  gripCuffHideBtnText: {
    color: '#8aaccc',
    fontSize: 12,
    fontWeight: '500',
  },
  gripCuffSeeAllText: {
    color: '#D4622A',
    fontSize: 13,
    fontWeight: '600',
  },
  goalCardStyle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131f2e',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  goalCardIconContainer: {
    width: 44, height: 44,
    borderRadius: 12,
    backgroundColor: '#1c2e42',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  goalCardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  goalCardSubtitle: {
    color: '#607a94',
    fontSize: 12,
    marginTop: 2,
  },
  goalCardArrow: {
    color: '#D4622A',
    fontSize: 18,
  },
});
