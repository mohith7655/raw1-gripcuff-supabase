import React, { createContext, useContext, useState, useEffect } from 'react';
import { VideoService } from '../services/video.service';
import { Video, VideoType, SubTab } from '../models';

const EXERCISE_LIBRARY_VIDEO_URL = 'https://firebasestorage.googleapis.com/v0/b/wazy-6c4a9.firebasestorage.app/o/Exercise%20Tutorial%20-%20Squat.mp4?alt=media&token=48cf44d1-0a5f-4ff5-b1d4-62e19c46dfc6';

interface LibraryContextType {
  allVideos: Video[];
  gripCuffVideos: Video[];
  trainerVideos: Video[];
  bodyPartVideos: Video[];
  selectedTab: VideoType;
  loading: boolean;
  error: string | null;
  completedCount: number;
  totalGripCuff: number;
  progress: number;
  isAllCompleted: boolean;
  isTrainerListLocked: boolean;
  subTab: SubTab | null;
  setSubTab: (tab: SubTab | null) => void;
  isGripCuffActive: boolean;
  setIsGripCuffActive: (active: boolean) => void;
  fetchVideos: () => Promise<void>;
  setTab: (tab: VideoType) => void;
  toggleVideoCompletion: (id: string) => void;
  clearError: () => void;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [allVideos] = useState<Video[]>(getMockAllVideos());
  const [gripCuffVideos, setGripCuffVideos] = useState<Video[]>(getMockGripCuffVideos());
  const [trainerVideos] = useState<Video[]>(getMockTrainerVideos());
  const [bodyPartVideos] = useState<Video[]>(getMockBodyPartVideos());
  const [selectedTab, setSelectedTab] = useState<VideoType>('All');
  const [subTab, setSubTab] = useState<SubTab | null>('all');
  const [isGripCuffActive, setIsGripCuffActive] = useState<boolean>(false);
  const loading = false;
  const [error, setError] = useState<string | null>(null);

  // Calculate derived state
  const completedCount = gripCuffVideos.filter(v => v.isCompleted).length;
  const totalGripCuff = gripCuffVideos.length;
  const progress = totalGripCuff === 0 ? 0 : completedCount / totalGripCuff;
  const isAllCompleted = completedCount === totalGripCuff && totalGripCuff > 0;
  const isTrainerListLocked = !isAllCompleted;

  const fetchVideos = async () => {
    // Videos are initialized with mock data, no async fetch needed
  };

  const setTab = (tab: VideoType) => {
    // Don't allow accessing Trainer tab if not unlocked
    if (tab === 'Trainer' && isTrainerListLocked) {
      setError('Complete all GripCuff training videos to unlock Trainer content.');
      return;
    }
    setSelectedTab(tab);
    setError(null);
  };

  const toggleVideoCompletion = (id: string) => {
    setGripCuffVideos(prevVideos =>
      prevVideos.map(v =>
        v.id === id ? { ...v, isCompleted: !v.isCompleted } : v
      )
    );
  };

  const clearError = () => setError(null);

  return (
    <LibraryContext.Provider
      value={{
        allVideos,
        gripCuffVideos,
        trainerVideos,
        bodyPartVideos,
        selectedTab,
        loading,
        error,
        completedCount,
        totalGripCuff,
        progress,
        isAllCompleted,
        isTrainerListLocked,
        fetchVideos,
        setTab,
        toggleVideoCompletion,
        clearError,
        subTab,
        setSubTab,
        isGripCuffActive,
        setIsGripCuffActive,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

function getMockAllVideos(): Video[] {
  const categorizedVideos = [
    // Muscle Growth (6)
    { title: 'Upper Body Hypertrophy', duration: 10, category: 'MuscleGrowth', difficulty: 'Intermediate' },
    { title: 'Leg Day Volume', duration: 10, category: 'MuscleGrowth', difficulty: 'Advanced' },
    { title: 'Chest & Triceps Pump', duration: 10, category: 'MuscleGrowth', difficulty: 'Intermediate' },
    { title: 'Back & Biceps Builder', duration: 10, category: 'MuscleGrowth', difficulty: 'Intermediate' },
    { title: 'Shoulder Sculpting', duration: 10, category: 'MuscleGrowth', difficulty: 'Beginner' },
    { title: 'Full Body Mass Circuit', duration: 10, category: 'MuscleGrowth', difficulty: 'Advanced' },
    // Stretching (6)
    { title: 'Morning Flexibility Flow', duration: 10, category: 'Stretching', difficulty: 'Beginner' },
    { title: 'Dynamic Warm-Up Stretch', duration: 10, category: 'Stretching', difficulty: 'Beginner' },
    { title: 'Deep Hip Openers', duration: 10, category: 'Stretching', difficulty: 'Intermediate' },
    { title: 'Hamstring & Lower Back', duration: 10, category: 'Stretching', difficulty: 'Beginner' },
    { title: 'Full Body Cool Down', duration: 10, category: 'Stretching', difficulty: 'Beginner' },
    { title: 'Advanced Splits Routine', duration: 10, category: 'Stretching', difficulty: 'Advanced' },
    // Athletic Performance (6)
    { title: 'Sprint Speed Drills', duration: 10, category: 'AthleticPerformance', difficulty: 'Advanced' },
    { title: 'Agility Ladder Work', duration: 10, category: 'AthleticPerformance', difficulty: 'Intermediate' },
    { title: 'Plyometric Power', duration: 10, category: 'AthleticPerformance', difficulty: 'Advanced' },
    { title: 'Reaction Time Training', duration: 10, category: 'AthleticPerformance', difficulty: 'Intermediate' },
    { title: 'Power Clean Technique', duration: 10, category: 'AthleticPerformance', difficulty: 'Advanced' },
    { title: 'Explosive Box Jumps', duration: 10, category: 'AthleticPerformance', difficulty: 'Intermediate' },
    // Injury Rehab (6)
    { title: 'Shoulder Rehab Basics', duration: 10, category: 'InjuryRehab', difficulty: 'Beginner' },
    { title: 'Knee Recovery Protocol', duration: 10, category: 'InjuryRehab', difficulty: 'Beginner' },
    { title: 'Lower Back Relief', duration: 10, category: 'InjuryRehab', difficulty: 'Beginner' },
    { title: 'Ankle Stability Work', duration: 10, category: 'InjuryRehab', difficulty: 'Intermediate' },
    { title: 'Wrist & Elbow Rehab', duration: 10, category: 'InjuryRehab', difficulty: 'Beginner' },
    { title: 'Post-Surgery Mobility', duration: 10, category: 'InjuryRehab', difficulty: 'Intermediate' },
  ];

  return categorizedVideos.map((v, i) => ({
    id: `all-${i + 1}`,
    title: v.title,
    duration: v.duration,
    category: v.category as any,
    difficulty: v.difficulty as any,
    thumbnail: `https://images.unsplash.com/photo-${1517836357463 + i}?auto=format&fit=crop&q=80&w=800`,
    description: `A great ${v.category.toLowerCase()} session.`,
    videoType: 'All',
    isCompleted: false,
    videoUrl: EXERCISE_LIBRARY_VIDEO_URL,
  }));
}

// Mock data for GripCuff videos
function getMockGripCuffVideos(): Video[] {
  const videos: { title: string; duration: number; category: string; difficulty: string }[] = [
    { title: 'Introduction to GripCuff', duration: 225, category: 'GripCuff', difficulty: 'Beginner' },
    { title: 'Proper Strap Placement', duration: 312, category: 'GripCuff', difficulty: 'Beginner' },
    { title: 'Wrist Curl Fundamentals', duration: 270, category: 'GripCuff', difficulty: 'Intermediate' },
    { title: 'Reverse Wrist Curls', duration: 360, category: 'GripCuff', difficulty: 'Intermediate' },
    { title: 'Finger Extension Drills', duration: 255, category: 'GripCuff', difficulty: 'Intermediate' },
    { title: 'Grip Squeeze Technique', duration: 345, category: 'GripCuff', difficulty: 'Advanced' },
    { title: 'Pronation & Supination', duration: 430, category: 'GripCuff', difficulty: 'Advanced' },
    { title: 'Endurance Hold Training', duration: 500, category: 'GripCuff', difficulty: 'Advanced' },
    { title: 'Advanced Pinch Grips', duration: 415, category: 'GripCuff', difficulty: 'Advanced' },
    { title: 'Full Recovery Routine', duration: 240, category: 'GripCuff', difficulty: 'Beginner' },
  ];

  return videos.map((v, i) => ({
    id: `gc_${i + 1}`,
    title: v.title,
    category: v.category as any,
    duration: v.duration,
    thumbnail: '',
    description: v.title,
    difficulty: v.difficulty as any,
    videoType: 'GripCuff' as const,
    isCompleted: false,
    videoUrl: EXERCISE_LIBRARY_VIDEO_URL,
  }));
}

// Mock data for Trainer videos
function getMockTrainerVideos(): Video[] {
  const titles = [
    'Coach Warm-Up Routine',
    'Strength Circuit Overview',
    'Mobility Flow Session',
    'HIIT Grip Challenge',
    'Cool-Down & Stretching',
  ];

  return titles.map((title, i) => ({
    id: `tv_${i + 1}`,
    title,
    category: 'Strength',
    duration: 10,
    thumbnail: '',
    description: title,
    difficulty: 'Advanced',
    videoType: 'Trainer',
    isCompleted: false,
  }));
}
// Body Part Videos with 6 videos per body part
function getMockBodyPartVideos(): Video[] {
  const bodyPartData = [
    {
      bodyPart: 'Chest',
      videos: [
        { title: 'Bench Press Fundamentals', duration: 10 },
        { title: 'Incline DB Press', duration: 10 },
        { title: 'Cable Fly Burnout', duration: 10 },
        { title: 'Push Up Variations', duration: 10 },
        { title: 'Chest Dip Technique', duration: 10 },
        { title: 'Pec Deck Form', duration: 10 },
      ]
    },
    {
      bodyPart: 'Back',
      videos: [
        { title: 'Deadlift Mechanics', duration: 10 },
        { title: 'Pull Up Progressions', duration: 10 },
        { title: 'Barbell Row Form', duration: 10 },
        { title: 'Lat Pulldown', duration: 10 },
        { title: 'Seated Cable Row', duration: 10 },
        { title: 'Single Arm DB Row', duration: 10 },
      ]
    },
    {
      bodyPart: 'Shoulders',
      videos: [
        { title: 'Overhead Press', duration: 10 },
        { title: 'Lateral Raise', duration: 10 },
        { title: 'Front Raise Drill', duration: 10 },
        { title: 'Face Pull Technique', duration: 10 },
        { title: 'Arnold Press', duration: 10 },
        { title: 'Rear Delt Fly', duration: 10 },
      ]
    },
    {
      bodyPart: 'Biceps',
      videos: [
        { title: 'Barbell Curl Form', duration: 10 },
        { title: 'Hammer Curl', duration: 10 },
        { title: 'Incline DB Curl', duration: 10 },
        { title: 'Cable Curl Burnout', duration: 10 },
        { title: 'Concentration Curl', duration: 10 },
        { title: 'Preacher Curl', duration: 10 },
      ]
    },
    {
      bodyPart: 'Triceps',
      videos: [
        { title: 'Skull Crusher', duration: 10 },
        { title: 'Tricep Pushdown', duration: 10 },
        { title: 'Close Grip Bench', duration: 10 },
        { title: 'Overhead Extension', duration: 10 },
        { title: 'Dips for Triceps', duration: 10 },
        { title: 'Kickback Form', duration: 10 },
      ]
    },
    {
      bodyPart: 'Legs',
      videos: [
        { title: 'Squat Mechanics', duration: 10 },
        { title: 'Romanian Deadlift', duration: 10 },
        { title: 'Leg Press Form', duration: 10 },
        { title: 'Walking Lunges', duration: 10 },
        { title: 'Leg Curl Machine', duration: 10 },
        { title: 'Calf Raises', duration: 10 },
      ]
    },
    {
      bodyPart: 'Core',
      videos: [
        { title: 'Plank Variations', duration: 10 },
        { title: 'Cable Crunch', duration: 10 },
        { title: 'Hanging Leg Raise', duration: 10 },
        { title: 'Ab Wheel Rollout', duration: 10 },
        { title: 'Russian Twist', duration: 10 },
        { title: 'Dragon Flag', duration: 10 },
      ]
    },
    {
      bodyPart: 'Full Body',
      videos: [
        { title: 'Clean and Press', duration: 10 },
        { title: 'Thruster Complex', duration: 10 },
        { title: 'KB Swing Circuit', duration: 10 },
        { title: 'Burpee Protocol', duration: 10 },
        { title: 'Battle Rope HIIT', duration: 10 },
        { title: 'Bear Crawl Drill', duration: 10 },
      ]
    },
  ];

  // YouTube IDs for the first 10 Muscle Growth videos
  const youtubeIdMap: Record<string, string> = {
    'bp-1': 'AdqrTg_hpEQ',
    'bp-2': 'czkGj5vJEFQ',
    'bp-3': 'Ag7Dui9Plys',
    'bp-4': 'cbKkB3POqaY',
    'bp-5': 'edIK5SZYMZo',
    'bp-6': 'o_AhdsD03qo',
    'bp-7': 'IXBt541mHL4',
    'bp-8': 'sTzodL_7iB8',
    'bp-9': 'tU0t5JoVWxA',
    'bp-10': '8uUawnM-FD8',
  };

  let videoId = 1;
  const gradients = [
    ['#FF6B35', '#E84100'],
    ['#7C3AED', '#4F46E5'],
    ['#059669', '#047857'],
    ['#DC2626', '#991B1B'],
    ['#06B6D4', '#0891B2'],
    ['#F59E0B', '#D97706'],
    ['#8B5CF6', '#6D28D9'],
    ['#EC4899', '#BE185D'],
  ];

  const videos: Video[] = [];
  bodyPartData.forEach((bodyPartInfo, bodyPartIndex) => {
    bodyPartInfo.videos.forEach((videoInfo, videoIndex) => {
      const gradient = gradients[bodyPartIndex % gradients.length];
      const id = `bp-${videoId}`;
      const ytId = youtubeIdMap[id];
      videos.push({
        id,
        title: videoInfo.title,
        duration: videoInfo.duration,
        category: 'MuscleGrowth',
        difficulty: videoIndex < 2 ? 'Beginner' : videoIndex < 4 ? 'Intermediate' : 'Advanced',
        thumbnail: ytId
          ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
          : `https://images.unsplash.com/photo-${1517836357463 + videoId}?auto=format&fit=crop&q=80&w=800`,
        description: `${bodyPartInfo.bodyPart} training: ${videoInfo.title}`,
        videoType: 'All',
        isCompleted: false,
        bodyPart: bodyPartInfo.bodyPart,
        videoUrl: EXERCISE_LIBRARY_VIDEO_URL,
        youtubeId: undefined,
      });
      videoId++;
    });
  });

  return videos;
}
export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within LibraryProvider');
  return context;
}
