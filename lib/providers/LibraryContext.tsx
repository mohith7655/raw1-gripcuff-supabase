import React, { createContext, useContext, useState, useEffect } from 'react';
import { VideoService } from '../services/video.service';
import { Video, VideoType, SubTab } from '../models';

import { getWorkoutVideoUrl } from '../constants/videoUrls';

const EXERCISE_LIBRARY_VIDEO_URL = getWorkoutVideoUrl('exercise');

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
    { title: 'Upper Body Hypertrophy', duration: 10, category: 'MuscleGrowth', difficulty: 'Intermediate',
      purpose: { summary: 'This session targets the chest, shoulders, and triceps with volume-focused sets designed to create the mechanical tension and metabolic stress that drives upper-body muscle growth.', benefits: ['Stimulates hypertrophy across pressing muscles for a thicker upper body', 'Produces the metabolic pump that drives satellite cell activation in muscle fibres', 'Improves structural balance between anterior and posterior upper-body musculature'] } },
    { title: 'Leg Day Volume', duration: 10, category: 'MuscleGrowth', difficulty: 'Advanced',
      purpose: { summary: 'High-volume lower-body training targets the quads, hamstrings, and glutes simultaneously — the largest muscle mass in the body — triggering maximum anabolic hormone release.', benefits: ['Drives systemic testosterone and growth hormone release through large-muscle loading', 'Builds quad thickness and glute mass that reshape the lower-body silhouette', 'Develops the knee and hip stability that underpins every sport and daily movement'] } },
    { title: 'Chest & Triceps Pump', duration: 10, category: 'MuscleGrowth', difficulty: 'Intermediate',
      purpose: { summary: 'Pairing chest and tricep work maximises pressing volume in a single session, creating deep muscle fatigue that signals powerful hypertrophic adaptation in both muscle groups.', benefits: ['Builds pectoral thickness and full chest width through varied pressing angles', 'Develops tricep mass that accounts for two-thirds of overall upper-arm size', 'Improves raw pushing strength across bench, overhead, and dip movements'] } },
    { title: 'Back & Biceps Builder', duration: 10, category: 'MuscleGrowth', difficulty: 'Intermediate',
      purpose: { summary: 'Combining back and bicep training maximises pulling-muscle volume, building the lat width and arm thickness that create a visually dominant physique from every angle.', benefits: ['Develops lat width and rhomboid thickness for a pronounced V-taper', 'Builds bicep peak by taking the elbow flexors to failure at the end of the session', 'Improves spinal decompression and posture by strengthening the posterior chain'] } },
    { title: 'Shoulder Sculpting', duration: 10, category: 'MuscleGrowth', difficulty: 'Beginner',
      purpose: { summary: 'This session isolates all three deltoid heads with targeted movements, building the rounded shoulder width that dramatically improves the appearance of the upper body.', benefits: ['Develops anterior, lateral, and posterior deltoid equally for full 3D shoulder shape', 'Strengthens the rotator cuff to protect the shoulder joint under pressing loads', 'Creates the capped shoulder look that visually narrows the waist by contrast'] } },
    { title: 'Full Body Mass Circuit', duration: 10, category: 'MuscleGrowth', difficulty: 'Advanced',
      purpose: { summary: 'Full-body circuit training stimulates every major muscle group in a single session with minimal rest, maximising both hypertrophic volume and metabolic conditioning simultaneously.', benefits: ['Accumulates high weekly training volume across all muscle groups efficiently', 'Elevates resting metabolic rate for 24–48 hours post-session through EPOC', 'Builds functional full-body strength that transfers to athletic performance'] } },
    // Stretching (6)
    { title: 'Morning Flexibility Flow', duration: 10, category: 'Stretching', difficulty: 'Beginner',
      purpose: { summary: 'A gentle morning routine that mobilises the spine and major joints, reversing overnight stiffness and preparing the neuromuscular system for the day ahead.', benefits: ['Reduces morning spinal stiffness by mobilising intervertebral disc hydration', 'Activates the parasympathetic nervous system for calm, focused energy', 'Increases synovial fluid circulation in hips, knees, and shoulders'] } },
    { title: 'Dynamic Warm-Up Stretch', duration: 10, category: 'Stretching', difficulty: 'Beginner',
      purpose: { summary: 'Dynamic movement patterns raise core temperature and increase muscle elasticity before training, directly reducing injury risk and improving power output in subsequent exercise.', benefits: ['Elevates muscle temperature by 1–2°C to increase contraction velocity', 'Activates the stretch-shortening cycle for improved explosive performance', 'Reduces risk of muscle tears by increasing viscoelastic tissue compliance'] } },
    { title: 'Deep Hip Openers', duration: 10, category: 'Stretching', difficulty: 'Intermediate',
      purpose: { summary: 'Sustained hip mobility work lengthens the hip flexors and external rotators — chronically tight from prolonged sitting — restoring the range of motion needed for pain-free squatting and running.', benefits: ['Lengthens the iliopsoas to correct anterior pelvic tilt caused by desk posture', 'Improves squat depth by releasing hip capsule and external rotator restriction', 'Reduces lower-back pain by decompressing the lumbosacral joint through hip release'] } },
    { title: 'Hamstring & Lower Back', duration: 10, category: 'Stretching', difficulty: 'Beginner',
      purpose: { summary: 'This session targets the posterior chain with progressive stretching that relieves the chronic tension between the hamstrings and lumbar spine responsible for most lower-back discomfort.', benefits: ['Lengthens hamstring muscle fibres to reduce posterior pelvic pull on the lumbar spine', 'Decompresses lumbar vertebrae through forward-fold traction', 'Improves hip hinge range of motion for safer deadlift and bend mechanics'] } },
    { title: 'Full Body Cool Down', duration: 10, category: 'Stretching', difficulty: 'Beginner',
      purpose: { summary: 'Post-workout cool-down stretching gradually lowers heart rate, clears lactic acid, and begins the parasympathetic recovery process that determines how well you recover for the next session.', benefits: ['Accelerates lactate clearance from working muscles through increased blood flow', 'Prevents post-exercise blood pooling in the legs by gradually reducing cardiac output', 'Reduces next-day muscle soreness by beginning the restoration of resting muscle length'] } },
    { title: 'Advanced Splits Routine', duration: 10, category: 'Stretching', difficulty: 'Advanced',
      purpose: { summary: 'Progressive splits training develops extreme hip and hamstring range of motion through consistent end-range loading, producing flexibility gains that take years with passive stretching alone.', benefits: ['Develops hip flexor and hamstring end-range strength through active flexibility work', 'Improves hip abductor extensibility for lateral movement in dance and martial arts', 'Enhances overall joint health through regular full range-of-motion loading'] } },
    // Athletic Performance (6)
    { title: 'Sprint Speed Drills', duration: 10, category: 'AthleticPerformance', difficulty: 'Advanced',
      purpose: { summary: 'Sprint mechanics training develops the neuromuscular coordination and hip drive efficiency needed to produce maximum velocity with minimal energy waste.', benefits: ['Improves stride frequency by training rapid limb cycling and ground contact mechanics', 'Develops hip flexor and glute power for the explosive push-off phase of sprinting', 'Reduces injury risk by teaching safe deceleration and change-of-direction technique'] } },
    { title: 'Agility Ladder Work', duration: 10, category: 'AthleticPerformance', difficulty: 'Intermediate',
      purpose: { summary: 'Ladder drills train the rapid foot repositioning and ankle stiffness that underpin agility, improving the ability to change direction quickly without losing speed or balance.', benefits: ['Improves foot-speed and proprioceptive control at the ankle joint', 'Develops the cognitive motor patterns needed for rapid sport-specific direction changes', 'Strengthens calf and tibialis anterior for reduced lower-leg injury risk'] } },
    { title: 'Plyometric Power', duration: 10, category: 'AthleticPerformance', difficulty: 'Advanced',
      purpose: { summary: 'Plyometric training exploits the stretch-shortening cycle to develop explosive lower-body power, directly improving jump height, sprint acceleration, and reactive strength.', benefits: ['Increases tendon stiffness and elastic energy storage for greater jump performance', 'Develops fast-twitch motor unit recruitment in the quads, hamstrings, and glutes', 'Improves reactive strength index — the ability to absorb and immediately redirect force'] } },
    { title: 'Reaction Time Training', duration: 10, category: 'AthleticPerformance', difficulty: 'Intermediate',
      purpose: { summary: 'This session trains the neural pathway from stimulus perception to motor execution, compressing the reaction gap that separates elite athletes from average performers.', benefits: ['Reduces simple and choice reaction time through repeated sensorimotor practice', 'Improves anticipatory motor planning for faster first-step response in sport', 'Develops visual-motor integration for more efficient reading of game situations'] } },
    { title: 'Power Clean Technique', duration: 10, category: 'AthleticPerformance', difficulty: 'Advanced',
      purpose: { summary: 'The power clean is the most transferable whole-body power exercise, simultaneously developing triple extension strength, bar speed, and the athletic catching position.', benefits: ['Develops explosive hip extension that transfers directly to vertical jump and sprint', 'Builds the posterior chain coordination linking the ankles, knees, hips, and back', 'Improves bar path mechanics for safe progressive loading of the Olympic pull'] } },
    { title: 'Explosive Box Jumps', duration: 10, category: 'AthleticPerformance', difficulty: 'Intermediate',
      purpose: { summary: 'Box jumps train maximal rate of force development in the lower body, building the explosive leg power used in every sport that requires jumping, cutting, or rapid acceleration.', benefits: ['Maximises rate of force development in the quads and hip extensors', 'Trains safe landing mechanics to reduce ACL and patellar tendon stress', 'Builds the confidence and coordination to produce full effort explosive movements'] } },
    // Injury Rehab (6)
    { title: 'Shoulder Rehab Basics', duration: 10, category: 'InjuryRehab', difficulty: 'Beginner',
      purpose: { summary: 'This protocol rebuilds rotator cuff strength and scapular control lost during shoulder injury or immobilisation, restoring the muscular support that protects the glenohumeral joint.', benefits: ['Reactivates the infraspinatus and supraspinatus for stable external rotation', 'Corrects scapular winging by strengthening the serratus anterior and lower trapezius', 'Restores pain-free shoulder range of motion through progressive load tolerance'] } },
    { title: 'Knee Recovery Protocol', duration: 10, category: 'InjuryRehab', difficulty: 'Beginner',
      purpose: { summary: 'A structured progression that rebuilds the quad and VMO strength critical for knee-joint stability, allowing a safe return to loading after injury or surgery.', benefits: ['Reactivates the VMO to restore proper patellar tracking and reduce knee pain', 'Rebuilds quad-to-hamstring strength ratio that protects the ACL under load', 'Improves proprioceptive feedback from the knee joint for safer movement patterns'] } },
    { title: 'Lower Back Relief', duration: 10, category: 'InjuryRehab', difficulty: 'Beginner',
      purpose: { summary: 'Targeted core and hip work decompresses the lumbar spine, reactivates inhibited stabilisers, and breaks the pain-tension cycle responsible for chronic lower-back discomfort.', benefits: ['Activates transverse abdominis and multifidus for deep spinal segmental support', 'Releases piriformis and hip flexor tension that compresses the lumbar vertebrae', 'Reduces neural inflammation by gently mobilising the sacroiliac joint'] } },
    { title: 'Ankle Stability Work', duration: 10, category: 'InjuryRehab', difficulty: 'Intermediate',
      purpose: { summary: 'Progressive ankle rehab rebuilds the peroneal and tibialis strength and proprioceptive sensitivity lost after sprains, preventing the chronic re-injury cycle common in athletes.', benefits: ['Restores peroneal muscle activation for rapid inversion-sprain protection', 'Rebuilds proprioceptive joint-position sense that prevents repeat ankle rolling', 'Improves single-leg balance and landing stability for safe sport return'] } },
    { title: 'Wrist & Elbow Rehab', duration: 10, category: 'InjuryRehab', difficulty: 'Beginner',
      purpose: { summary: 'This rehabilitation routine addresses the forearm muscle imbalances and tendon irritation underlying most wrist and elbow overuse injuries including tennis and golfer\'s elbow.', benefits: ['Reduces lateral epicondyle tendon irritation through eccentric loading protocol', 'Rebalances wrist flexor-to-extensor strength ratio to eliminate chronic tension', 'Restores pain-free pronation and supination range for daily and sporting use'] } },
    { title: 'Post-Surgery Mobility', duration: 10, category: 'InjuryRehab', difficulty: 'Intermediate',
      purpose: { summary: 'Carefully sequenced post-surgical mobility work restores joint range, reduces scar tissue adhesion, and reintegrates normal movement patterns lost during the immobilisation period.', benefits: ['Prevents scar tissue from limiting long-term joint range of motion', 'Reactivates inhibited muscles that shut down in response to post-operative swelling', 'Rebuilds neuromuscular movement patterns for a confident return to full activity'] } },
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
    purpose: (v as any).purpose,
  }));
}

// Mock data for GripCuff videos
function getMockGripCuffVideos(): Video[] {
  const videos: { title: string; duration: number; category: string; difficulty: string; purpose: any }[] = [
    { title: 'Introduction to GripCuff', duration: 225, category: 'GripCuff', difficulty: 'Beginner',
      purpose: { summary: 'This foundational session familiarises you with the GripCuff device and its resistance mechanism, setting the correct movement patterns before progressive loading begins.', benefits: ['Establishes safe device handling to prevent early wrist strain', 'Builds proprioceptive awareness of forearm tension during resistance work', 'Creates a baseline grip strength measurement to track future progress'] } },
    { title: 'Proper Strap Placement', duration: 312, category: 'GripCuff', difficulty: 'Beginner',
      purpose: { summary: 'Learning exact strap placement ensures even load distribution across the wrist and forearm, making every subsequent session safer and more effective.', benefits: ['Prevents pressure-point discomfort that limits training duration', 'Optimises force transfer from the cuff to the target forearm muscles', 'Reduces risk of wrist impingement during loaded flexion and extension'] } },
    { title: 'Wrist Curl Fundamentals', duration: 270, category: 'GripCuff', difficulty: 'Intermediate',
      purpose: { summary: 'Wrist curls directly isolate the wrist flexors and build the foundational strength that underpins all gripping, carrying, and pulling movements.', benefits: ['Strengthens the flexor carpi radialis and ulnaris for powerful grip closure', 'Increases wrist stability under load to protect the joint during lifting', 'Develops the forearm belly thickness associated with visible arm strength'] } },
    { title: 'Reverse Wrist Curls', duration: 360, category: 'GripCuff', difficulty: 'Intermediate',
      purpose: { summary: 'Reverse wrist curls train the often-neglected extensor muscles of the forearm, correcting the muscular imbalance that leads to tennis elbow and repetitive strain injuries.', benefits: ['Strengthens wrist extensors to counterbalance heavy flexor training', 'Reduces risk of lateral epicondylitis by equalising forearm muscle tension', 'Improves wrist control during the release phase of gripping movements'] } },
    { title: 'Finger Extension Drills', duration: 255, category: 'GripCuff', difficulty: 'Intermediate',
      purpose: { summary: 'Finger extension work builds the opening muscles of the hand — chronically weak in most people — restoring balance that directly enhances closing grip strength.', benefits: ['Develops extensor digitorum strength for a fuller range of grip motion', 'Alleviates finger flexor tightness that restricts hand dexterity', 'Improves grip endurance by reducing antagonist muscle fatigue during holds'] } },
    { title: 'Grip Squeeze Technique', duration: 345, category: 'GripCuff', difficulty: 'Advanced',
      purpose: { summary: 'This session teaches maximal voluntary contraction technique against GripCuff resistance, producing peak motor unit recruitment and rapid hand-strength gains.', benefits: ['Maximises fast-twitch motor unit activation in the intrinsic hand muscles', 'Builds crushing grip force directly applicable to deadlifts and pull-ups', 'Improves neuromuscular efficiency so strength gains outpace hypertrophy'] } },
    { title: 'Pronation & Supination', duration: 430, category: 'GripCuff', difficulty: 'Advanced',
      purpose: { summary: 'Rotational forearm training develops the pronator and supinator muscles that stabilise the elbow and wrist under twisting loads encountered in throwing, racket sports, and bar work.', benefits: ['Strengthens pronator teres and supinator for rotational wrist control', 'Protects the elbow joint during forearm rotation under resistance', 'Transfers directly to bat speed, racket power, and bar-spin strength'] } },
    { title: 'Endurance Hold Training', duration: 500, category: 'GripCuff', difficulty: 'Advanced',
      purpose: { summary: 'Sustained-hold training shifts adaptation toward slow-twitch endurance fibres in the forearm, allowing you to maintain grip force over extended periods without early fatigue.', benefits: ['Develops forearm slow-twitch endurance for long carries and climbing holds', 'Increases capillary density in forearm muscles for faster metabolite clearance', 'Delays grip failure during high-rep pulling and rowing movements'] } },
    { title: 'Advanced Pinch Grips', duration: 415, category: 'GripCuff', difficulty: 'Advanced',
      purpose: { summary: 'Pinch grip training isolates the thumb and thenar muscles — the primary drivers of object-control strength — producing grip capability that crush-only training cannot replicate.', benefits: ['Strengthens flexor pollicis longus and thenar eminence for thumb power', 'Improves object-control precision needed in lifting straps and equipment', 'Builds the index-thumb pinch strength used in every tool-based sport'] } },
    { title: 'Full Recovery Routine', duration: 240, category: 'GripCuff', difficulty: 'Beginner',
      purpose: { summary: 'This active recovery session promotes blood flow through the forearm muscles, flushing metabolic waste and restoring full range of motion between hard training days.', benefits: ['Reduces delayed-onset muscle soreness in the flexors and extensors', 'Restores wrist and finger range of motion lost through training-induced tightness', 'Prepares connective tissue for the next high-intensity GripCuff session'] } },
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
    purpose: v.purpose,
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
        { title: 'Bench Press Fundamentals', duration: 10, purpose: { summary: 'The flat bench press is the premier horizontal pushing movement, building maximum pectoral thickness and raw pressing strength across the entire chest.', benefits: ['Develops mid and lower pec mass through full horizontal press range', 'Recruits anterior deltoids and triceps as key synergists for upper-body pressing', 'Builds the baseline pressing strength required for all chest accessory work'] } },
        { title: 'Incline DB Press', duration: 10, purpose: { summary: 'Incline pressing shifts emphasis to the clavicular head of the pectoralis major, filling in the upper-chest shelf that separates a complete from an underdeveloped physique.', benefits: ['Isolates the upper pec head for the chest fullness that flat pressing alone cannot build', 'Independent dumbbell movement allows greater range of motion and pec stretch', 'Strengthens the front deltoid-to-chest transition for a thicker upper-body appearance'] } },
        { title: 'Cable Fly Burnout', duration: 10, purpose: { summary: 'Cable flys create constant tension through the full arc of pec contraction, delivering a deep muscle-building stimulus that barbell pressing cannot replicate at the shortened range.', benefits: ['Provides peak contraction tension at the midline where pressing loses resistance', 'Stretches the pec fibres under load for maximal muscle-damage and growth signal', 'Isolates the chest from tricep assistance, forcing pecs to work to full failure'] } },
        { title: 'Push Up Variations', duration: 10, purpose: { summary: 'Push-up variations train the chest, shoulders, and triceps using bodyweight through multiple movement angles, building functional pressing strength with zero equipment.', benefits: ['Develops the serratus anterior and shoulder protractors alongside the pecs', 'Progressive hand-position variations shift stimulus from lower to upper chest', 'Builds pressing endurance and core stability simultaneously'] } },
        { title: 'Chest Dip Technique', duration: 10, purpose: { summary: 'Forward-lean dips target the lower and outer pectoral fibres with a deep loaded stretch, producing the lower chest sweep that defines a well-developed physique.', benefits: ['Develops lower pec fibres that decline pressing and flat work underemphasise', 'Loads the pec at a deep stretched position to maximise hypertrophic stimulus', 'Builds compound pushing strength transferable to all overhead pressing movements'] } },
        { title: 'Pec Deck Form', duration: 10, purpose: { summary: 'The pec deck isolates the chest through pure adduction with no tricep involvement, making it the most targeted chest isolation exercise for completing full pec development.', benefits: ['Maximises pec minor and inner chest engagement through horizontal adduction', 'Teaches the mind-muscle connection needed for effective chest stimulation in all exercises', 'Builds inner chest density for the defined sternum line of a developed physique'] } },
      ]
    },
    {
      bodyPart: 'Back',
      videos: [
        { title: 'Deadlift Mechanics', duration: 10, purpose: { summary: 'The conventional deadlift is the most powerful posterior chain exercise, simultaneously strengthening the erectors, glutes, hamstrings, and traps through a maximum hip-hinge loading pattern.', benefits: ['Builds the erector spinae and multifidus for bulletproof spinal support', 'Develops glute and hamstring strength that transfers to every athletic movement', 'Teaches the hip hinge movement pattern fundamental to all safe bending and lifting'] } },
        { title: 'Pull Up Progressions', duration: 10, purpose: { summary: 'Pull-ups are the definitive lat and bicep development exercise — every rep performed correctly builds the V-taper width and arm thickness visible in a well-trained physique.', benefits: ['Develops lat width through the full overhead pull range that cable work cannot match', 'Builds relative pulling strength and grip endurance simultaneously', 'Progressive loading options allow every level to build toward and beyond bodyweight'] } },
        { title: 'Barbell Row Form', duration: 10, purpose: { summary: 'Bent-over barbell rows are the primary upper-back mass builder, loading the lats, rhomboids, and traps with heavy compound weight that dumbbell work cannot replicate.', benefits: ['Builds rhomboid and mid-trap thickness for a dense, powerful upper back', 'Develops the hip-hinge strength and isometric erector endurance to hold row position', 'Improves posture by strengthening the posterior shoulder and scapular retractors'] } },
        { title: 'Lat Pulldown', duration: 10, purpose: { summary: 'The lat pulldown trains the primary lat function — shoulder adduction — in a controlled environment perfect for building lat width before progressing to bodyweight pull-ups.', benefits: ['Develops lat width through controlled adduction against adjustable resistance', 'Teaches scapular depression and retraction mechanics essential for injury-free back training', 'Allows precise grip-width variation to shift emphasis between outer and inner lats'] } },
        { title: 'Seated Cable Row', duration: 10, purpose: { summary: 'Seated cable rows target the mid-back and rhomboids with constant tension throughout the entire rowing arc, building the back thickness that widening exercises alone cannot produce.', benefits: ['Develops mid-back thickness in the rhomboids and middle trapezius', 'Constant cable tension maintains stimulus at both the stretched and contracted positions', 'Corrects the forward shoulder posture caused by overdeveloped pressing relative to rowing'] } },
        { title: 'Single Arm DB Row', duration: 10, purpose: { summary: 'Unilateral dumbbell rowing corrects left-right strength asymmetries while allowing a greater range of motion and lat stretch than bilateral movements, maximising per-set muscle stimulus.', benefits: ['Corrects side-to-side lat strength imbalances that compound rows mask', 'Allows a deeper lat stretch at the bottom for greater hypertrophic range of motion', 'Reduces lumbar stress versus barbell rows through supported single-arm setup'] } },
      ]
    },
    {
      bodyPart: 'Shoulders',
      videos: [
        { title: 'Overhead Press', duration: 10, purpose: { summary: 'The standing overhead press is the foundational upper-body strength exercise, building full deltoid development and the core stability needed to press heavy weight overhead safely.', benefits: ['Builds all three deltoid heads with emphasis on anterior and medial from the press', 'Develops overhead pushing strength that transfers to every sport and daily task', 'Strengthens the deep core and serratus anterior through forced upright stabilisation'] } },
        { title: 'Lateral Raise', duration: 10, purpose: { summary: 'Lateral raises isolate the medial deltoid head — the primary driver of shoulder width — producing the broad, capped shoulder appearance that only targeted abduction work can create.', benefits: ['Isolates the medial deltoid to build the shoulder width that pressing cannot develop', 'Creates the visual illusion of a narrower waist through increased shoulder breadth', 'Strengthens the supraspinatus, supporting healthy rotator cuff function under load'] } },
        { title: 'Front Raise Drill', duration: 10, purpose: { summary: 'Front raises isolate the anterior deltoid and build the shoulder-to-chest transition thickness, addressing a head often overtrained by pressing but underdeveloped by neglect of isolation work.', benefits: ['Builds anterior deltoid thickness for a full shoulder appearance from the front', 'Strengthens the shoulder flexors used in every pushing and overhead carrying task', 'Improves shoulder joint stability under loaded anterior flexion'] } },
        { title: 'Face Pull Technique', duration: 10, purpose: { summary: 'Face pulls are the most important shoulder health exercise, directly strengthening the external rotators and posterior deltoid that pressing training systematically weakens over time.', benefits: ['Develops posterior deltoid for complete 3D shoulder development and balance', 'Strengthens external rotators to counteract the internal rotation dominance from pressing', 'Reduces shoulder impingement risk by restoring ideal scapular and humeral positioning'] } },
        { title: 'Arnold Press', duration: 10, purpose: { summary: 'The Arnold press rotates through both pressing and lateral raise movement paths in a single rep, simultaneously developing all three deltoid heads and improving shoulder joint mobility.', benefits: ['Trains anterior, medial, and posterior deltoid through the full rotational arc', 'Improves glenohumeral joint rotation mobility as a byproduct of the movement path', 'Builds shoulder coordination and stability under load through multiple movement planes'] } },
        { title: 'Rear Delt Fly', duration: 10, purpose: { summary: 'Rear deltoid isolation corrects the most common shoulder imbalance in the gym — overdeveloped pressing muscles and underdeveloped posterior shoulder — improving posture and reducing injury risk.', benefits: ['Targets the posterior deltoid and external rotators neglected by all pressing movements', 'Corrects rounded-shoulder posture by strengthening the horizontal abductors', 'Reduces risk of shoulder impingement by balancing anterior and posterior deltoid strength'] } },
      ]
    },
    {
      bodyPart: 'Biceps',
      videos: [
        { title: 'Barbell Curl Form', duration: 10, purpose: { summary: 'The barbell curl allows maximum loading of the bicep brachii and brachialis simultaneously, making it the most efficient mass-building exercise for the front of the arm.', benefits: ['Maximises bicep mechanical tension through full supinated curl range of motion', 'Allows heavier loading than dumbbells, driving greater overall arm-thickness stimulus', 'Develops the brachialis beneath the bicep for a wider, more three-dimensional arm'] } },
        { title: 'Hammer Curl', duration: 10, purpose: { summary: 'Hammer curls train the brachialis and brachioradialis in the neutral grip position, building the arm thickness and forearm development that supinated curls miss entirely.', benefits: ['Develops the brachialis, which pushes the bicep peak upward for greater arm height', 'Builds brachioradialis mass for a thicker forearm and wrist transition', 'Provides variety in elbow flexion angle to reduce repetitive strain on the bicep tendon'] } },
        { title: 'Incline DB Curl', duration: 10, purpose: { summary: 'Incline curls stretch the long head of the bicep beyond what standing curls allow, creating a deeper muscle stimulus and the distinctive bicep peak built only at extended positions.', benefits: ['Maximally stretches the long head of the bicep for superior peak development', 'Eliminates momentum and shoulder flexion cheating for pure bicep isolation', 'Develops the fully lengthened position strength that transfers to pulling movements'] } },
        { title: 'Cable Curl Burnout', duration: 10, purpose: { summary: 'Cable curls provide constant tension throughout the entire curl arc — including the top contracted position where free weights go slack — maximising time under tension for hypertrophy.', benefits: ['Maintains resistance at the peak contracted position where barbells lose tension', 'Adjustable pulleys allow optimal cable angle for targeted short or long head emphasis', 'High-rep burnout sets maximise metabolic stress and pump for hypertrophic signalling'] } },
        { title: 'Concentration Curl', duration: 10, purpose: { summary: 'The concentration curl eliminates all cheating, forcing the bicep to produce force in complete isolation — building the mind-muscle connection and peak that compound curls cannot achieve alone.', benefits: ['Eliminates shoulder flexion and body sway to achieve pure bicep isolation', 'Develops the neuromuscular connection for peak contraction awareness in all curl variations', 'Targets the short head of the bicep for the inner arm thickness visible from the front'] } },
        { title: 'Preacher Curl', duration: 10, purpose: { summary: 'The preacher curl locks the upper arm against the pad, removing all momentum and training the lower bicep and brachialis in the lengthened position where maximal growth stimulus occurs.', benefits: ['Targets the lower bicep and distal tendon insertion for complete arm development', 'Forces the lengthened-position overload associated with the greatest hypertrophic response', 'Builds the bicep fullness that makes arms look developed even with arms at rest'] } },
      ]
    },
    {
      bodyPart: 'Triceps',
      videos: [
        { title: 'Skull Crusher', duration: 10, purpose: { summary: 'Skull crushers train the long head of the tricep through full elbow extension range with a loaded overhead stretch, building the mass in the back of the arm that pushdown exercises cannot reach.', benefits: ['Maximally loads the tricep long head through the stretched overhead position', 'Builds the deep belly of the tricep responsible for overall arm size and thickness', 'Develops elbow extension strength directly applied to all pressing movements'] } },
        { title: 'Tricep Pushdown', duration: 10, purpose: { summary: 'Cable pushdowns isolate all three tricep heads through constant tension, making them the most efficient finishing exercise for complete tricep development and pre-exhaustion work.', benefits: ['Provides constant cable tension at both the stretched and contracted tricep positions', 'Easily adjustable grip and attachment allow shifting emphasis between all three tricep heads', 'High-rep pump work drives metabolic hypertrophy signalling to complement heavy compound pressing'] } },
        { title: 'Close Grip Bench', duration: 10, purpose: { summary: 'Close-grip bench pressing is the heaviest tricep compound exercise, allowing you to overload the elbow extensors with significantly more weight than any isolation movement can achieve.', benefits: ['Applies maximal mechanical tension to the triceps through the heaviest possible loading', 'Develops the lockout strength that transfers to every wide-grip bench and overhead press', 'Trains all three tricep heads simultaneously through a full pressing range of motion'] } },
        { title: 'Overhead Extension', duration: 10, purpose: { summary: 'Overhead tricep extensions place the long head in its maximally stretched position, producing a unique growth stimulus not achievable with pushdowns or pressing movements alone.', benefits: ['Fully stretches and contracts the tricep long head through the overhead arm position', 'Builds the horseshoe-shaped tricep mass visible from behind and in side-chest poses', 'Strengthens the tricep through its full functional range for complete elbow extension capacity'] } },
        { title: 'Dips for Triceps', duration: 10, purpose: { summary: 'Upright-torso dips are the most effective bodyweight tricep exercise, loading the elbow extensors with full bodyweight or added resistance through the complete dip range of motion.', benefits: ['Loads the tricep with full bodyweight for a compound mass-building stimulus', 'Builds the lower-arm sweep of the tricep visible in the upright arm position', 'Improves pressing endurance and strengthens elbow joint connective tissue'] } },
        { title: 'Kickback Form', duration: 10, purpose: { summary: 'Tricep kickbacks isolate the lateral and medial tricep heads at peak contraction with no shoulder involvement, developing the detail and separation that makes the tricep look fully trained.', benefits: ['Maximises peak contraction in the lateral tricep head for visible horseshoe definition', 'Eliminates shoulder and chest assistance for pure elbow extension isolation', 'Builds the fine motor control and mind-muscle connection for all tricep pressing movements'] } },
      ]
    },
    {
      bodyPart: 'Legs',
      videos: [
        { title: 'Squat Mechanics', duration: 10, purpose: { summary: 'The back squat is the foundational lower-body strength exercise, loading the quads, glutes, and hamstrings with the greatest possible mechanical overload for maximum leg development.', benefits: ['Builds quad and glute mass through the deepest possible range of lower-body loading', 'Develops the knee and hip stability that underpins every sport and daily movement pattern', 'Triggers the greatest systemic anabolic hormone response of any lower-body exercise'] } },
        { title: 'Romanian Deadlift', duration: 10, purpose: { summary: 'The RDL targets the hamstrings and glutes through a hip-hinge loading pattern that maximises the stretched-position stimulus most responsible for hamstring hypertrophy and strength.', benefits: ['Develops hamstring mass through the critical lengthened-position overload', 'Builds glute thickness and hip-hinge strength transferable to all pulling and sprinting', 'Strengthens the posterior chain to protect the lower back under athletic loading'] } },
        { title: 'Leg Press Form', duration: 10, purpose: { summary: 'The leg press isolates the quads with heavy compound loading while reducing spinal compressive forces, making it the premier quad-building exercise for those with lower-back limitations.', benefits: ['Develops quad thickness safely under high-load conditions with minimal spinal stress', 'Foot-position variation allows targeting of inner, outer, or full quad sweep', 'Builds absolute leg pressing strength through loads impossible to achieve with squats'] } },
        { title: 'Walking Lunges', duration: 10, purpose: { summary: 'Walking lunges develop each leg independently, correcting strength asymmetries while simultaneously building quad, glute, and hamstring mass and functional single-leg stability.', benefits: ['Corrects left-right leg strength imbalances that bilateral exercises hide', 'Develops hip flexor strength and step-to-step balance that squatting cannot train', 'Builds the glute-to-ham tie-in at the bottom of each lunge for complete posterior definition'] } },
        { title: 'Leg Curl Machine', duration: 10, purpose: { summary: 'The lying leg curl isolates the hamstrings in knee flexion — a function compound movements underload — providing the isolated hypertrophic stimulus needed for complete hamstring development.', benefits: ['Isolates knee-flexion hamstring function that squats and deadlifts largely bypass', 'Develops distal hamstring and bicep femoris for the leg-bicep sweep visible from behind', 'Reduces risk of hamstring strains by building balanced strength through full ROM'] } },
        { title: 'Calf Raises', duration: 10, purpose: { summary: 'Calf raises isolate the gastrocnemius and soleus through loaded plantarflexion, developing the lower leg mass and ankle stability that no other compound movement trains directly.', benefits: ['Builds gastrocnemius mass visible as the diamond-shape calf from behind', 'Strengthens the soleus for ankle stability under walking, running, and jumping loads', 'Improves Achilles tendon strength and resilience to reduce lower-leg injury risk'] } },
      ]
    },
    {
      bodyPart: 'Core',
      videos: [
        { title: 'Plank Variations', duration: 10, purpose: { summary: 'Plank progressions build isometric anti-extension core strength — the fundamental ability to resist spinal flexion under load that protects the back in every lift and athletic movement.', benefits: ['Develops transverse abdominis and lumbar multifidus for deep spinal stabilisation', 'Builds full anterior-chain tension including serratus, obliques, and hip flexors', 'Improves shoulder and hip stability through the integrated full-body tension hold'] } },
        { title: 'Cable Crunch', duration: 10, purpose: { summary: 'Cable crunches allow heavy progressive loading of the rectus abdominis through its primary function — spinal flexion — making it the most effective resistance-training exercise for abs.', benefits: ['Allows progressive overload of the rectus abdominis with measurable weight increments', 'Develops the upper and mid-ab striations associated with visible core definition', 'Teaches spinal flexion under load to differentiate abs from hip-flexor dominant movements'] } },
        { title: 'Hanging Leg Raise', duration: 10, purpose: { summary: 'Hanging leg raises develop the lower abs and hip flexors through a full range of motion decompressing movement, building the lower-abdominal definition most difficult to achieve with floor exercises.', benefits: ['Targets the lower rectus abdominis and inguinal region with full ROM leg loading', 'Strengthens the hip flexors in coordination with the abdominals for functional core power', 'Decompresses the lumbar spine through the hanging position while training the abs'] } },
        { title: 'Ab Wheel Rollout', duration: 10, purpose: { summary: 'The ab wheel rollout is the most demanding anti-extension core exercise, training the entire anterior chain at long lever lengths to build the deep core strength and stability that planks cannot approach.', benefits: ['Maximises anti-extension demand on the core through the longest possible lever position', 'Develops lat, serratus, and shoulder stability as the wheel travels overhead', 'Builds the explosive core stiffness needed for heavy compound lifts and athletic rotation'] } },
        { title: 'Russian Twist', duration: 10, purpose: { summary: 'Russian twists train the obliques through rotational resistance, building the lateral core strength and rotational power that protect the spine and drive sport-specific twisting movements.', benefits: ['Develops the internal and external obliques for lateral core strength and definition', 'Builds rotational power transferable to throwing, batting, and racket-sport performance', 'Strengthens the transverse abdominis through anti-rotation demand at the end range of twist'] } },
        { title: 'Dragon Flag', duration: 10, purpose: { summary: 'The dragon flag is an advanced full-body anterior chain exercise that trains the core under extreme long-lever loads, building the elite-level abdominal strength seen in gymnasts and advanced athletes.', benefits: ['Develops full-length rectus abdominis and hip flexor strength through maximum lever loading', 'Builds the lat and shoulder stability required to maintain the rigid body position', 'Produces the highest level of neuromuscular core activation achievable without equipment'] } },
      ]
    },
    {
      bodyPart: 'Full Body',
      videos: [
        { title: 'Clean and Press', duration: 10, purpose: { summary: 'The clean and press combines explosive hip extension with overhead pressing in a single fluid movement, developing full-body power coordination and strength that no isolation exercise can replicate.', benefits: ['Develops triple extension power in the ankles, knees, and hips for explosive athleticism', 'Builds overhead pressing strength from a dynamically loaded catch position', 'Trains the entire kinetic chain in coordinated sequence for functional whole-body power'] } },
        { title: 'Thruster Complex', duration: 10, purpose: { summary: 'Thrusters combine a front squat into an overhead press in one continuous movement, maximising full-body muscle recruitment and metabolic demand in the most efficient possible compound exercise.', benefits: ['Maximises caloric expenditure through simultaneous lower and upper-body loading', 'Builds front squat strength and overhead stability through a combined movement pattern', 'Develops cardiovascular conditioning alongside muscular strength in a single exercise'] } },
        { title: 'KB Swing Circuit', duration: 10, purpose: { summary: 'Kettlebell swings train powerful hip extension — the same motor pattern as sprinting and jumping — with a ballistic loading that develops posterior chain power and cardiovascular conditioning simultaneously.', benefits: ['Develops explosive glute and hamstring hip extension through ballistic loading', 'Builds posterior chain endurance through high-rep hip hinge repetitions', 'Improves cardiovascular conditioning and fat burning through sustained high-intensity effort'] } },
        { title: 'Burpee Protocol', duration: 10, purpose: { summary: 'The burpee integrates a push-up, plank, and vertical jump into a continuous movement demanding full-body strength, coordination, and maximum cardiovascular output with zero equipment.', benefits: ['Maximises cardiovascular demand through rapid transitions between floor and jump positions', 'Builds push-up and plank strength endurance through repeated bodyweight pressing', 'Develops the explosive hip extension and jump mechanics needed for sport-specific power'] } },
        { title: 'Battle Rope HIIT', duration: 10, purpose: { summary: 'Battle rope intervals develop upper-body and core endurance through high-force wave and slam patterns, simultaneously building shoulder work capacity and cardiovascular conditioning.', benefits: ['Develops shoulder and arm endurance through sustained high-force wave production', 'Builds core anti-rotation stability through unilateral alternating rope movements', 'Maximises cardiovascular output and caloric burn through short-rest interval structure'] } },
        { title: 'Bear Crawl Drill', duration: 10, purpose: { summary: 'Bear crawl progressions develop contralateral coordination, shoulder stability, and core anti-rotation strength through a fundamental primal movement pattern that transfers to every athletic activity.', benefits: ['Builds shoulder stability and rotator cuff strength through loaded weight-bearing position', 'Develops contralateral limb coordination critical for running and climbing efficiency', 'Trains anti-rotation core stiffness through the opposing arm-leg movement pattern'] } },
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
        purpose: (videoInfo as any).purpose,
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
