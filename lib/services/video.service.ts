import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../core/config/firebase';
import { Video, VideoCategory } from '../models';

// Mock videos for development (will be replaced by Firestore data)
const MOCK_VIDEOS: Video[] = [
  // ── GripCuff Training Videos (10) ──
  {
    id: 'gc_1',
    title: 'Introduction to GripCuff',
    category: 'Strength',
    duration: 225,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+1',
    description: 'Get started with GripCuff training basics',
    difficulty: 'Beginner',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },
  {
    id: 'gc_2',
    title: 'Proper Strap Placement',
    category: 'Strength',
    duration: 312,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+2',
    description: 'Learn the correct way to place straps',
    difficulty: 'Beginner',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },
  {
    id: 'gc_3',
    title: 'Wrist Curl Fundamentals',
    category: 'Strength',
    duration: 270,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+3',
    description: 'Master the foundational wrist curl technique',
    difficulty: 'Intermediate',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },
  {
    id: 'gc_4',
    title: 'Reverse Wrist Curls',
    category: 'Strength',
    duration: 360,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+4',
    description: 'Perform reverse wrist curl exercises',
    difficulty: 'Intermediate',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },
  {
    id: 'gc_5',
    title: 'Finger Extension Drills',
    category: 'Strength',
    duration: 255,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+5',
    description: 'Strengthen your fingers with extension exercises',
    difficulty: 'Intermediate',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },
  {
    id: 'gc_6',
    title: 'Grip Squeeze Technique',
    category: 'Strength',
    duration: 345,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+6',
    description: 'Develop proper grip squeezing technique',
    difficulty: 'Advanced',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },
  {
    id: 'gc_7',
    title: 'Pronation & Supination',
    category: 'Strength',
    duration: 430,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+7',
    description: 'Master pronation and supination movements',
    difficulty: 'Advanced',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },
  {
    id: 'gc_8',
    title: 'Endurance Hold Training',
    category: 'Strength',
    duration: 500,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+8',
    description: 'Build grip endurance through hold training',
    difficulty: 'Advanced',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },
  {
    id: 'gc_9',
    title: 'Advanced Pinch Grips',
    category: 'Strength',
    duration: 415,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+9',
    description: 'Advanced pinch grip techniques for maximum strength',
    difficulty: 'Advanced',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },
  {
    id: 'gc_10',
    title: 'Full Recovery Routine',
    category: 'Recovery',
    duration: 240,
    thumbnail: 'https://via.placeholder.com/300x200?text=GripCuff+10',
    description: 'Complete recovery and stretching routine',
    difficulty: 'Beginner',
    instructor: 'Coach Raw1',
    videoType: 'GripCuff',
    isCompleted: false,
  },

  // ── Trainer Videos (5) ──
  {
    id: 'tv_1',
    title: 'Coach Warm-Up Routine',
    category: 'Strength',
    duration: 600,
    thumbnail: 'https://via.placeholder.com/300x200?text=Trainer+1',
    description: 'Professional warm-up routine from top trainers',
    difficulty: 'Intermediate',
    instructor: 'Coach Raw1',
    videoType: 'Trainer',
    isCompleted: false,
  },
  {
    id: 'tv_2',
    title: 'Strength Circuit Overview',
    category: 'Strength',
    duration: 930,
    thumbnail: 'https://via.placeholder.com/300x200?text=Trainer+2',
    description: 'Complete strength circuit for maximum gains',
    difficulty: 'Advanced',
    instructor: 'Coach Raw1',
    videoType: 'Trainer',
    isCompleted: false,
  },
  {
    id: 'tv_3',
    title: 'Mobility Flow Session',
    category: 'Mobility',
    duration: 765,
    thumbnail: 'https://via.placeholder.com/300x200?text=Trainer+3',
    description: 'Dynamic mobility flow for injury prevention',
    difficulty: 'Intermediate',
    instructor: 'Coach Raw1',
    videoType: 'Trainer',
    isCompleted: false,
  },
  {
    id: 'tv_4',
    title: 'HIIT Grip Challenge',
    category: 'HIIT',
    duration: 495,
    thumbnail: 'https://via.placeholder.com/300x200?text=Trainer+4',
    description: 'High-intensity grip training challenge',
    difficulty: 'Advanced',
    instructor: 'Coach Raw1',
    videoType: 'Trainer',
    isCompleted: false,
  },
  {
    id: 'tv_5',
    title: 'Cool-Down & Stretching',
    category: 'Recovery',
    duration: 390,
    thumbnail: 'https://via.placeholder.com/300x200?text=Trainer+5',
    description: 'Professional cool-down and stretching routine',
    difficulty: 'Beginner',
    instructor: 'Coach Raw1',
    videoType: 'Trainer',
    isCompleted: false,
  },
];

export class VideoService {
  static async getVideos(): Promise<Video[]> {
    if (!isFirebaseConfigured) {
      // Return mock data if Firebase not configured
      return MOCK_VIDEOS;
    }

    try {
      const collectionRef = collection(db, 'videos');
      const snapshot = await getDocs(collectionRef);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Video));
    } catch (error) {
      console.warn('Failed to fetch videos from Firestore, using mock data:', error);
      return MOCK_VIDEOS;
    }
  }

  static async getVideosByCategory(category: VideoCategory): Promise<Video[]> {
    if (category === 'All') return this.getVideos();

    if (!isFirebaseConfigured) {
      return MOCK_VIDEOS.filter(v => v.category === category);
    }

    try {
      const collectionRef = collection(db, 'videos');
      const q = query(collectionRef, where('category', '==', category));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Video));
    } catch (error) {
      console.warn('Failed to fetch videos by category, using mock data:', error);
      return MOCK_VIDEOS.filter(v => v.category === category);
    }
  }

  static async getVideoById(id: string): Promise<Video | null> {
    if (!isFirebaseConfigured) {
      return MOCK_VIDEOS.find(v => v.id === id) || null;
    }

    try {
      const docRef = doc(db, 'videos', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return null;
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Video;
    } catch (error) {
      console.warn('Failed to fetch video by ID, using mock data:', error);
      return MOCK_VIDEOS.find(v => v.id === id) || null;
    }
  }

  static async searchVideos(searchTerm: string): Promise<Video[]> {
    const allVideos = await this.getVideos();
    return allVideos.filter(v =>
      v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  static getCategories(): VideoCategory[] {
    return ['All', 'Strength', 'HIIT', 'Cardio', 'Recovery', 'Mobility', 'Tutorial'];
  }
}
