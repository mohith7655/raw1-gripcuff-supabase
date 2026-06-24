import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, LogBox, BackHandler, Alert, Platform, Animated } from 'react-native';
import { NavigationContainer, DefaultTheme, getStateFromPath as navGetStateFromPath, getPathFromState as navGetPathFromState } from '@react-navigation/native';
import * as ExpoLinking from 'expo-linking';
import { navigationRef } from './core/navigation';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Video, Dumbbell, User, Users, Calendar } from 'lucide-react-native';
import { useNotifications } from './hooks/useNotifications';
import * as Notifications from 'expo-notifications';
import { WorkoutReminderModal } from './components/WorkoutReminderModal';
import { WorkoutReminderService } from './services/workoutReminder.service';
import { EXERCISE_SQUAT_VIDEO_URL } from './constants/videoUrls';
import { SessionReminderService } from './services/sessionReminder.service';
import { reminderWatcherService, ForegroundAlarm } from './services/reminderWatcher.service';
import { migrateLegacyReminders } from './services/moveReminder.service';
import { unlockAudio } from './utils/webAudio';
import { ChallengeSessionService } from './services/challengeSession.service';
import { fetchAgoraToken } from './services/agora/AgoraTokenService';
import { supabase } from './core/config/supabase';
import { AppState } from 'react-native';
import { CastManager } from './services/cast/castManager';
import { AuthProvider, useAuth } from './providers/AuthContext';
import { UserProvider, useUser } from './providers/UserContext';
import { FriendProvider } from './providers/FriendContext';
import { UserService } from './services/user.service';
import { LibraryProvider } from './providers/LibraryContext';
import { WorkoutProvider } from './providers/WorkoutContext';
import { WorkoutSessionProvider, useWorkoutSession } from './providers/WorkoutSessionContext';
import { StrangerInviteProvider } from './providers/StrangerInviteProvider';
import { FavoritesProvider } from './providers/FavoritesContext';
import { NotificationProvider } from './providers/NotificationProvider';
import { MiniPlayerProvider } from './providers/MiniPlayerContext';
import { MiniPlayer } from './components/MiniPlayer';
import { AppTheme, CoachingTheme } from './core/theme/app_theme';

// Screens
import { SplashScreen } from './screens/SplashScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { PaywallScreen } from './screens/PaywallScreen';
import { GripcuffSurveyModal } from './screens/GripcuffSurveyModal';
import { AccessProvider, useAccess } from './providers/AccessContext';
import { TierProvider } from './providers/TierContext';
import { TabBarVisibilityProvider, useTabBarVisibility } from './providers/TabBarVisibilityContext';
import { HomeScreen } from './screens/HomeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { WorkoutsScreen } from './screens/WorkoutsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AccountSettingsScreen } from './screens/AccountSettingsScreen';
import { CreditsScreen } from './screens/CreditsScreen';
import { EarnCreditsScreen } from './screens/EarnCreditsScreen';
import { GripCuffTrainingScreen } from './screens/GripCuffTrainingScreen';
import { GripCuffVideosScreen } from './screens/GripCuffVideosScreen';
import { VideoDashboard } from './screens/VideoDashboard';
import { WorkoutStep1Screen } from './screens/WorkoutStep1Screen';
import { WorkoutStep2Screen } from './screens/WorkoutStep2Screen';
import { WorkoutResultScreen } from './screens/WorkoutResultScreen';
import { FacePullDetailsPage } from './screens/FacePullDetailsPage';
import VideoPlayerScreen from './screens/VideoPlayerScreen';
import { VideoDetailScreen } from './screens/VideoDetailScreen';
import { CategoryVideosScreen } from './screens/CategoryVideosScreen';
import { MuscleGrowthScreen } from './screens/MuscleGrowthScreen';
import { BodyPartVideosScreen } from './screens/BodyPartVideosScreen';
import { AITrainerScreen } from './screens/AITrainerScreen';
import { PersonalTrainerScreen } from './screens/PersonalTrainerScreen';
import { StretchingScreen } from './screens/StretchingScreen';
import { AthleticPerformanceScreen } from './screens/AthleticPerformanceScreen';
import { InjuryRehabScreen } from './screens/InjuryRehabScreen';
import { FriendsScreen } from './screens/FriendsScreen';
import { UpcomingSessionsScreen } from './screens/UpcomingSessionsScreen';
import { WorkoutWithFriendFlow } from './screens/WorkoutWithFriendFlow';
import { SyncedVideoPlayerScreen } from './screens/SyncedVideoPlayerScreen';
import { InviteFriendsFlow } from './screens/InviteFriendsFlow';
import RecommendationScreen from './screens/RecommendationScreen';
import { AgoraVideoRoom } from './screens/AgoraVideoRoom';
import { ChallengeVideoRoom } from './screens/ChallengeVideoRoom';
import { ChallengeLobbyScreen } from './screens/ChallengeLobbyScreen';
import { WorkoutWithFriendScreen } from './screens/WorkoutWithFriendScreen';
import { ChatInboxScreen } from './screens/ChatInboxScreen';
import { ChatRoomScreen } from './screens/ChatRoomScreen';
import { ChatFriendProfileScreen } from './screens/ChatFriendProfileScreen';
import { SocialProfileScreen } from './screens/SocialProfileScreen';
import { EditSocialProfileScreen } from './screens/EditSocialProfileScreen';
import { HowILookNowScreen } from './screens/HowILookNowScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { BadgesScreen } from './screens/BadgesScreen';
import { QRCodeScreen } from './screens/QRCodeScreen';
import { QRProfileScreen } from './screens/QRProfileScreen';
import { LookingToMeetEditScreen } from './screens/LookingToMeetEditScreen';
import { MoveReminderScreen } from './screens/MoveReminderScreen';
import { ScannedProfileScreen } from './screens/ScannedProfileScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AllFavouritesScreen } from './screens/AllFavouritesScreen';
import { AllRecentlyWatchedScreen } from './screens/AllRecentlyWatchedScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { FeedScreen } from './screens/FeedScreen';
import { ClubsScreen } from './screens/ClubsScreen';
import { ClubDetailScreen } from './screens/ClubDetailScreen';
import { ClubChatScreen } from './screens/ClubChatScreen';
import { StreakService } from './services/streak.service';
import { TimezoneService } from './services/timezone.service';
import { initializeCurrentUserOnLeaderboard } from './services/leaderboard.service';
import { WorkoutInviteModal } from './components/WorkoutInviteModal';

LogBox.ignoreAllLogs(); // temporary to identify crash

class ErrorBoundary extends React.Component<any, { hasError: boolean, error: any }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{
          flex: 1, backgroundColor: '#EEEEF2',
          justifyContent: 'center', alignItems: 'center', padding: 20
        }}>
          <Text style={{ color: '#F25912', fontSize: 18, fontWeight: '700' }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#7A7C90', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
            {this.state.error ? String(this.state.error) : ''}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ marginTop: 20, backgroundColor: '#F25912', padding: 12, borderRadius: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
type PublicProfileParams = { uid?: string; username?: string; slug?: string } | null;

const parsePublicProfilePath = (pathname: string): PublicProfileParams => {
  const clean = (pathname || '/').replace(/\/+$/, '');
  const slugMatch = clean.match(/^\/u\/([^/?#]+)/i) || clean.match(/^\/profile\/([^/?#]+)/i);
  if (slugMatch) return { slug: decodeURIComponent(slugMatch[1]) };
  const uidMatch = clean.match(/^\/p\/([^/?#]+)/i);
  if (uidMatch) return { uid: decodeURIComponent(uidMatch[1]) };
  return null;
};

const parsePublicProfileFromUrl = (urlLike?: string | null): PublicProfileParams => {
  const raw = String(urlLike || '').trim();
  if (!raw) return null;

  const nativeMatch = raw.match(/^raw1:\/\/profile\/([^/?#]+)/i);
  if (nativeMatch) return { slug: decodeURIComponent(nativeMatch[1]) };

  const fromPathMatch = raw.match(/\/u\/([^/?#]+)/i) || raw.match(/\/profile\/([^/?#]+)/i);
  if (fromPathMatch) return { slug: decodeURIComponent(fromPathMatch[1]) };

  const uidMatch = raw.match(/\/p\/([^/?#]+)/i);
  if (uidMatch) return { uid: decodeURIComponent(uidMatch[1]) };

  const queryIdx = raw.indexOf('?');
  if (queryIdx !== -1) {
    const q = new URLSearchParams(raw.slice(queryIdx + 1).split('#')[0]);
    const slug = (q.get('slug') || q.get('u') || q.get('username') || '').trim();
    if (slug) return { slug };
    const uid = (q.get('p') || q.get('uid') || '').trim();
    if (uid) return { uid };
  }

  const hashIdx = raw.indexOf('#');
  if (hashIdx !== -1) {
    const hashPart = raw.slice(hashIdx + 1);
    const hashPathMatch = hashPart.match(/\/u\/([^/?#]+)/i) || hashPart.match(/\/profile\/([^/?#]+)/i);
    if (hashPathMatch) return { slug: decodeURIComponent(hashPathMatch[1]) } as any;
  }

  return null;
};

const parsePublicProfileFromLocation = (
  locationLike: { pathname?: string; search?: string; hash?: string },
): PublicProfileParams => {
  const fullUrl = `${locationLike.pathname || ''}${locationLike.search || ''}${locationLike.hash || ''}`;
  const parsedByUrl = parsePublicProfileFromUrl(fullUrl);
  if (parsedByUrl) return parsedByUrl;

  const fromPath = parsePublicProfilePath(locationLike.pathname || '/');
  if (fromPath) return fromPath;

  const query = new URLSearchParams(locationLike.search || '');
  const querySlug = (query.get('slug') || query.get('u') || query.get('username') || '').trim();
  if (querySlug) return { slug: querySlug };
  const queryUid = (query.get('p') || query.get('uid') || '').trim();
  if (queryUid) return { uid: queryUid };

  const rawHash = (locationLike.hash || '').replace(/^#/, '');
  if (!rawHash) return null;

  const hashPath = rawHash.startsWith('/') ? rawHash : `/${rawHash}`;
  const fromHashPath = parsePublicProfilePath(hashPath);
  if (fromHashPath) return fromHashPath;

  const hashQueryIdx = rawHash.indexOf('?');
  if (hashQueryIdx === -1) return null;
  const hashQuery = new URLSearchParams(rawHash.slice(hashQueryIdx + 1));
  const hashSlug = (hashQuery.get('slug') || hashQuery.get('u') || hashQuery.get('username') || '').trim();
  if (hashSlug) return { slug: hashSlug };
  const hashUid = (hashQuery.get('p') || hashQuery.get('uid') || '').trim();
  if (hashUid) return { uid: hashUid };
  return null;
};

const APP_WEB_BASE_URL = (process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://raw1.app').replace(/\/+$/, '');
const linking = {
  prefixes: [
    ExpoLinking.createURL('/'),
    'raw1://',
    'https://raw1.app',
    'https://www.raw1.app',
    APP_WEB_BASE_URL,
  ],
  config: {
    screens: {
      ScannedProfileScreen: {
        path: 'u/:slug',
        parse: { slug: (v: string) => decodeURIComponent(v) },
      },
    },
  },
  // Only the public-profile deep link (/u/:slug, /profile/:slug) is restored from
  // the URL. Every other path resolves to the app's default route — so a hard
  // refresh never tries to rebuild an internal auto-generated path like
  // /HomeTabs/HomeTab (which left the app stuck on the loading screen).
  getStateFromPath: (path: string, options: any) => {
    const normalized = path.replace(/^\/?profile\//i, 'u/');
    if (/^\/?u\//i.test(normalized)) {
      return navGetStateFromPath(normalized, options);
    }
    return undefined;
  },
  // Keep the address bar clean: reflect only the public-profile route, and
  // collapse all internal navigation to '/'. Without this, React Navigation
  // writes the raw screen names to the URL (e.g. /HomeTabs/HomeTab).
  getPathFromState: (state: any, options: any) => {
    const path = navGetPathFromState(state, options);
    return /^\/?u\//i.test(path) ? path : '/';
  },
};

// Auth Stack
function AuthStack({ initialPublicProfile }: { initialPublicProfile?: PublicProfileParams }) {
  return (
    <Stack.Navigator
      initialRouteName={initialPublicProfile ? 'ScannedProfileScreen' : 'Welcome'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000' }
      }}
    >
      <Stack.Screen
        name="ScannedProfileScreen"
        component={ScannedProfileScreen}
        initialParams={initialPublicProfile ?? undefined}
      />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

// Bottom tab bar — floating pill bar (Samsung dialer style)
function PillTabBar({ state, descriptors, navigation, appMode }: any) {
  const isCoaching    = appMode === 'coaching';
  const activeColor   = isCoaching ? CoachingTheme.tabActive : '#4C4E78';
  const inactiveColor = isCoaching ? CoachingTheme.textMuted : '#9A9CB0';
  const barBg         = isCoaching ? CoachingTheme.background : '#FFFFFF';

  // Auto-hide on scroll-down / reveal on scroll-up (shared with the screens).
  const tabBar = useTabBarVisibility();
  const translateY = tabBar?.translateY;
  // Always reveal the bar when switching tabs.
  React.useEffect(() => { tabBar?.show(); }, [state.index]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingBottom: 24,
        backgroundColor: 'transparent',
      }}
    >
      <Animated.View style={{
        flexDirection: 'row',
        alignSelf: 'center',
        width: '72%',
        backgroundColor: barBg,
        borderRadius: 30,
        paddingHorizontal: 8,
        paddingVertical: 12,
        gap: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
        transform: translateY ? [{ translateY }] : undefined,
      }}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = options.tabBarLabel as string;
          const color = isFocused ? activeColor : inactiveColor;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              {options.tabBarIcon?.({ color, size: 22, focused: isFocused })}
              <Text style={{
                color,
                fontSize: 11,
                fontWeight: isFocused ? '700' : '500',
                letterSpacing: 0.1,
              }}>
                {isFocused ? 'RAW1' : label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

// Home Tab Navigator
function HomeTabs() {
  const { appMode } = useUser();
  const { unreadInvitesCount } = useWorkoutSession();

  return (
    <TabBarVisibilityProvider>
      <Tab.Navigator
        backBehavior="history"
        tabBar={(props) => <PillTabBar {...props} appMode={appMode} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, size, focused }) => <Home color={color} size={size} fill={focused ? color : 'none'} strokeWidth={focused ? 0 : 1.5} />,
          }}
        />
        <Tab.Screen
          name="SocialTab"
          component={FeedScreen}
          options={{
            tabBarLabel: 'Social',
            tabBarIcon: ({ color, size, focused }) => <Users color={color} size={size} fill={focused ? color : 'none'} strokeWidth={focused ? 0 : 1.5} />,
          }}
        />
        <Tab.Screen
          name="LibraryTab"
          component={LibraryScreen}
          options={{
            tabBarLabel: appMode === 'coaching' ? 'Explore Coaches' : 'Workouts',
            tabBarIcon: ({ color, size, focused }) =>
              appMode === 'coaching' ? (
                <Users color={color} size={size} fill={focused ? color : 'none'} strokeWidth={focused ? 0 : 1.5} />
              ) : (
                <Dumbbell color={color} size={size} fill={focused ? color : 'none'} strokeWidth={focused ? 0 : 1.5} />
              ),
          }}
        />
      </Tab.Navigator>
    </TabBarVisibilityProvider>
  );
}

function AppStack({
  initialRoute,
  initialPublicProfile,
}: {
  initialRoute?: string;
  initialPublicProfile?: PublicProfileParams;
}) {
  return (
    <Stack.Navigator
      initialRouteName={initialPublicProfile ? 'ScannedProfileScreen' : (initialRoute ?? 'HomeTabs')}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#EEEEF2' }
      }}
    >
      <Stack.Screen name="HomeTabs" component={HomeTabs} />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ gestureEnabled: false }}
      />
      {/* Modal screens for other flows */}
      <Stack.Group
        screenOptions={{
          presentation: 'card',
          contentStyle: { backgroundColor: '#EEEEF2' }
        }}
      >
        <Stack.Screen name="WorkoutStep1" component={WorkoutStep1Screen} />
        <Stack.Screen name="WorkoutStep2" component={WorkoutStep2Screen} />
        <Stack.Screen name="WorkoutResult" component={WorkoutResultScreen} />
        <Stack.Screen name="FacePullDetails" component={FacePullDetailsPage} />
        <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
        <Stack.Screen name="AccountSettingsScreen" component={AccountSettingsScreen} />
        <Stack.Screen name="CreditsScreen" component={CreditsScreen} />
        <Stack.Screen name="EarnCreditsScreen" component={EarnCreditsScreen} />
        <Stack.Screen name="GripCuffTrainingScreen" component={GripCuffTrainingScreen} />
        <Stack.Screen name="GripCuffVideos" component={GripCuffVideosScreen} />
        <Stack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
        <Stack.Screen name="VideoDetail" component={VideoDetailScreen} />
        <Stack.Screen name="SyncedVideoPlayer" component={SyncedVideoPlayerScreen} />
        <Stack.Screen name="CategoryVideos" component={CategoryVideosScreen} />
        <Stack.Screen name="MuscleGrowth" component={MuscleGrowthScreen} />
        <Stack.Screen name="Stretching" component={StretchingScreen} />
        <Stack.Screen name="AthleticPerformance" component={AthleticPerformanceScreen} />
        <Stack.Screen name="InjuryRehab" component={InjuryRehabScreen} />
        <Stack.Screen name="BodyPartVideos" component={BodyPartVideosScreen} />
        <Stack.Screen name="AITrainerScreen" component={AITrainerScreen} />
        <Stack.Screen name="PersonalTrainerScreen" component={PersonalTrainerScreen} />
        <Stack.Screen name="FriendsScreen" component={FriendsScreen} />
        <Stack.Screen name="UpcomingSessionsScreen" component={UpcomingSessionsScreen} />
        <Stack.Screen name="WorkoutWithFriendFlow" component={WorkoutWithFriendFlow} />
        <Stack.Screen name="InviteFriendsFlow" component={InviteFriendsFlow} />
        <Stack.Screen name="Recommendation" component={RecommendationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AllFavourites" component={AllFavouritesScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AllRecentlyWatched" component={AllRecentlyWatchedScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="AgoraVideoRoom"
          component={AgoraVideoRoom}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="ChallengeVideoRoom"
          component={ChallengeVideoRoom}
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
        <Stack.Screen name="ChatFriendProfile" component={ChatFriendProfileScreen} />
        <Stack.Screen name="LeaderboardScreen" component={LeaderboardScreen} />
        {/* ── Social Profile System ── */}
        <Stack.Screen name="SocialProfileScreen" component={SocialProfileScreen} />
        <Stack.Screen name="EditSocialProfileScreen" component={EditSocialProfileScreen} />
        <Stack.Screen name="HowILookNow" component={HowILookNowScreen} />
        <Stack.Screen name="Goals" component={GoalsScreen} />
        <Stack.Screen name="QRCodeScreen" component={QRCodeScreen} />
        <Stack.Screen name="QRProfileScreen" component={QRProfileScreen} />
        <Stack.Screen name="LookingToMeetEditScreen" component={LookingToMeetEditScreen} />
        <Stack.Screen name="MoveReminderScreen" component={MoveReminderScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CommunityScreen" component={CommunityScreen} />
        <Stack.Screen name="BadgesScreen" component={BadgesScreen} />
        <Stack.Screen name="FeedScreen" component={FeedScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ChallengeLobbyScreen" component={ChallengeLobbyScreen} options={{ headerShown: false }} />
        <Stack.Screen name="WorkoutWithFriendScreen" component={WorkoutWithFriendScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ClubsScreen" component={ClubsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ClubDetailScreen" component={ClubDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ClubChatScreen" component={ClubChatScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="ScannedProfileScreen"
          component={ScannedProfileScreen}
          initialParams={initialPublicProfile ?? undefined}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
}

// Global unhandled error logger — captures full stack for locale/runtime crashes.
// Remove once the s.replace bug is confirmed fixed.
if (typeof global !== 'undefined' && !(global as any).__errorHandlerInstalled) {
  (global as any).__errorHandlerInstalled = true;
  const origHandler = (global as any).ErrorUtils?.getGlobalHandler?.();
  (global as any).ErrorUtils?.setGlobalHandler?.((error: any, isFatal: boolean) => {
    console.error('[GlobalErrorHandler] CRASH', {
      message: error?.message,
      stack: error?.stack,
      isFatal,
      locale: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : 'unknown',
      timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'unknown',
    });
    origHandler?.(error, isFatal);
  });
}

// ── Inline challenge invite alert shown to the guest ─────────────────────────
function ChallengeInviteAlert({
  session, onAccept, onDecline,
}: {
  session: any;
  myUid: string;
  onAccept: (session: any) => void;
  onDecline: (session: any) => void;
}) {
  return (
    <View style={challengeAlertStyles.card}>
      <Text style={challengeAlertStyles.title}>💪 Exercise Challenge!</Text>
      <Text style={challengeAlertStyles.body}>
        You've been challenged to {session.duration_seconds / 60} min of {session.exercise_name}.
      </Text>
      <View style={challengeAlertStyles.row}>
        <TouchableOpacity
          style={challengeAlertStyles.acceptBtn}
          onPress={() => onAccept(session)}
          activeOpacity={0.85}
        >
          <Text style={challengeAlertStyles.acceptText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={challengeAlertStyles.declineBtn}
          onPress={() => onDecline(session)}
          activeOpacity={0.85}
        >
          <Text style={challengeAlertStyles.declineText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const challengeAlertStyles = StyleSheet.create({
  card: {
    position: 'absolute', bottom: 120, left: 16, right: 16, zIndex: 9999,
    backgroundColor: '#EEEEF2', borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: 'rgba(242,89,18,0.35)',
    shadowColor: '#F25912', shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  title: { color: '#211832', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  body:  { color: 'rgba(150,180,210,0.7)', fontSize: 13, marginBottom: 16 },
  row:   { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, backgroundColor: '#F25912', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  acceptText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  declineBtn: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(33,24,50,0.1)',
    paddingVertical: 12, alignItems: 'center',
  },
  declineText: { color: 'rgba(150,180,210,0.7)', fontWeight: '700', fontSize: 14 },
});

function MainApp() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const { loading: accessLoading } = useAccess();
  const { supabaseUserId, email, user, loading: authLoading } = useAuth();
  const [initialPublicProfile, setInitialPublicProfile] = useState<PublicProfileParams>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return parsePublicProfileFromLocation(window.location);
    }
    return null;
  });
  const hasHandledPublicRouteRef = useRef(false);

  // Registers for FCM push notifications and handles notification-click navigation.
  // Must be called here — inside all providers but outside NavigationContainer.
  useNotifications(navigationRef as any);

  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<ForegroundAlarm | null>(null);
  const [pendingChallengeSession, setPendingChallengeSession] = useState<any>(null);
  const profileReminderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const profileReminderVisibleRef = useRef(false);
  const leaderboardSeeded = useRef(false);

  // Presence heartbeat — stamp last_active_at on login and every foreground.
  useEffect(() => {
    if (!supabaseUserId) return;
    UserService.touchLastActive();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') UserService.touchLastActive();
    });
    return () => sub.remove();
  }, [supabaseUserId]);

  // Expire stale reminders whenever the app comes back to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const uid = supabaseUserId;
        if (uid) WorkoutReminderService.cleanupExpired(uid);
        if (uid) WorkoutReminderService.restoreRecurringReminders(uid).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [supabaseUserId]);


  useEffect(() => {
    const runBootSync = async () => {
      if (supabaseUserId) {
        // Restore recurring reminders
        WorkoutReminderService.restoreRecurringReminders(supabaseUserId).catch(() => {});

        // Resolve onboarding from localStorage only
        const localFlag = typeof localStorage !== 'undefined'
          ? !!localStorage.getItem('onboarding_complete_' + supabaseUserId)
          : false;
        setNeedsOnboarding(!localFlag && !user?.fullName);

        // Timezone — no Firestore write, just invalidate cache
        TimezoneService.invalidateCache(supabaseUserId);

        // Streak check — independent, never blocks auth flow
        StreakService.checkAndBreakStreak(supabaseUserId).catch(() => {});

        // Leaderboard sync — stub, no-op
        if (!leaderboardSeeded.current) {
          leaderboardSeeded.current = true;
          initializeCurrentUserOnLeaderboard(supabaseUserId, {}).catch(e => {
            console.error('[Leaderboard] seed failed:', e?.message ?? e);
          });
        }
      } else {
        setNeedsOnboarding(false);
      }
      setBootLoading(false);
    };
    runBootSync();
  }, [supabaseUserId]);

  // Register service worker + request notification permission on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err =>
        console.warn('[SW] registration failed:', err)
      );
    }
    // Unlock audio on first user interaction
    const unlock = () => { unlockAudio(); };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  useEffect(() => {
    if (!supabaseUserId) {
      // User logged out — stop the clock
      reminderWatcherService.stop();
      return;
    }

    // Request browser notification permission for PWA
    if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Start the persistent reminder clock for this user.
    // NO cleanup return here — the clock is a global singleton that must
    // survive React re-renders, navigation, and tab switches.
    // It is only stopped above when the user logs out (uid becomes falsy).
    // Calling start() again with the same uid is safe: start() calls stop()
    // internally first, so it always restarts cleanly.
    migrateLegacyReminders(supabaseUserId).catch(() => {});
    reminderWatcherService.start(supabaseUserId, (alarm) => {
      setActiveAlarm(alarm);
      setAlarmModalVisible(true);

      // Browser notification — fires even when the tab is in background
      if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new (window as any).Notification(alarm.workoutTitle || 'Reminder to Move 💪', {
            body: alarm.recurrenceLabel || 'Time to move — stay active!',
            icon: '/assets/icon.png',
            tag: 'move-reminder',
            renotify: true,
            silent: false,
          });
        } catch {}
      }
    });
  }, [supabaseUserId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return; // NEVER stop the clock — only restart if needed
      const uid = supabaseUserId;
      if (!uid) return;
      // App returned to foreground. Restart only if the clock was stopped
      // (e.g. OS killed background intervals, or user just logged in).
      if (!reminderWatcherService.isRunning) {
        console.log('[MoveReminder] app foregrounded — restarting stopped clock');
        reminderWatcherService.start(uid, (alarm) => {
          setActiveAlarm(alarm);
          setAlarmModalVisible(true);
        });
      }
    });
    return () => sub.remove();
  }, [supabaseUserId]);

  // ── Incoming challenge invite listener ────────────────────────────────────
  useEffect(() => {
    if (!supabaseUserId) return;

    const channel = supabase
      .channel(`challenge-invites:${supabaseUserId}`)
      .on(
        'postgres_changes' as any,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'challenge_sessions',
          filter: `guest_id=eq.${supabaseUserId}`,
        },
        async (payload: any) => {
          const session = payload.new;
          if (!session || session.status !== 'pending') return;
          setPendingChallengeSession(session);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabaseUserId]);

  useEffect(() => {
    const getMissingProfileFields = (data: any): string[] => {
      const missing: string[] = [];
      const hasDob = !!(
        (typeof data?.dateOfBirth === 'string' && data.dateOfBirth.trim()) ||
        (data?.dob && data.dob.month && data.dob.year)
      );
      const hasWorkoutSpot = !!(data?.locations?.gym || data?.locations?.home || data?.locations?.park);
      const requiredChecks: Array<{ key: string; ok: boolean }> = [
        { key: 'username', ok: typeof data?.username === 'string' && data.username.trim().length > 0 },
        { key: 'dateOfBirth', ok: hasDob },
        { key: 'gender', ok: typeof data?.gender === 'string' && data.gender.trim().length > 0 },
        { key: 'locations', ok: hasWorkoutSpot },
      ];
      requiredChecks.forEach((check) => {
        if (!check.ok) missing.push(check.key);
      });
      return missing;
    };

    const promptForProfileCompletion = () => {
      if (profileReminderVisibleRef.current) return;
      profileReminderVisibleRef.current = true;
      Alert.alert(
        'Complete Your Profile',
        'Some profile details are missing. Please add them for a better workout experience.',
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => { profileReminderVisibleRef.current = false; },
          },
          {
            text: 'Add Now',
            onPress: () => {
              profileReminderVisibleRef.current = false;
              if (navigationRef.isReady()) {
                navigationRef.navigate('ProfileScreen' as never);
              }
            },
          },
        ],
        { cancelable: true, onDismiss: () => { profileReminderVisibleRef.current = false; } }
      );
    };

    const runProfileReminderCheck = async () => {
      // No Firestore — profile reminder check skipped
    };

    if (!supabaseUserId) {
      if (profileReminderIntervalRef.current) {
        clearInterval(profileReminderIntervalRef.current);
        profileReminderIntervalRef.current = null;
      }
      return;
    }

    runProfileReminderCheck();
    if (profileReminderIntervalRef.current) {
      clearInterval(profileReminderIntervalRef.current);
    }
    profileReminderIntervalRef.current = setInterval(runProfileReminderCheck, 5 * 60 * 1000);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') runProfileReminderCheck();
    });

    return () => {
      appStateSub.remove();
      if (profileReminderIntervalRef.current) {
        clearInterval(profileReminderIntervalRef.current);
        profileReminderIntervalRef.current = null;
      }
    };
  }, [supabaseUserId, navigationRef]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backAction = () => {
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
        return true;
      }

      Alert.alert(
        'Exit App',
        'Are you sure you want to exit?',
        [
          { text: 'Cancel', onPress: () => null, style: 'cancel' },
          { text: 'Exit', onPress: () => BackHandler.exitApp(), style: 'destructive' },
        ]
      );
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigationRef]);

  useEffect(() => {
    let mounted = true;

    const hydrateInitialPublicRoute = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (mounted) setInitialPublicProfile(parsePublicProfileFromLocation(window.location));
        return;
      }
      try {
        const initialUrl = await ExpoLinking.getInitialURL();
        if (!mounted || !initialUrl) return;
        const parsed = parsePublicProfileFromUrl(initialUrl);
        if (parsed) setInitialPublicProfile(parsed);
      } catch {}
    };

    hydrateInitialPublicRoute();

    const sub = ExpoLinking.addEventListener('url', ({ url }: { url: string }) => {
      const parsed = parsePublicProfileFromUrl(url);
      if (!parsed) return;
      setInitialPublicProfile(parsed);
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('ScannedProfileScreen', parsed);
      }
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Ensure public profile routes always land on the scanned profile screen, not home/welcome.
  useEffect(() => {
    if (!initialPublicProfile || hasHandledPublicRouteRef.current) return;
    if (!navigationRef.isReady()) return;

    hasHandledPublicRouteRef.current = true;
    (navigationRef as any).navigate('ScannedProfileScreen', initialPublicProfile);
  }, [initialPublicProfile, supabaseUserId, authLoading, bootLoading, accessLoading]);

  // Web back navigation is handled entirely by React Navigation's internal
  // popstate listener (createMemoryHistory). No custom handler needed here.

  // Listen for recurring reminder notifications and refresh schedules when fired
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as any;
      if (!data || data.type !== 'recurring_reminder') return;
      const uid = supabaseUserId;
      if (!uid) return;
      try {
        await WorkoutReminderService.restoreRecurringReminders(uid);
      } catch (e) {
        // non-fatal
      }
    });

    const respSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as any;
      if (!data || data.type !== 'recurring_reminder') return;
      const uid = supabaseUserId;
      if (!uid) return;
      try {
        await WorkoutReminderService.restoreRecurringReminders(uid);
      } catch (e) {}
    });

    return () => {
      sub.remove();
      respSub.remove();
    };
  }, [supabaseUserId]);

  // ── Session reminder response handler ─────────────────────────────────────
  // Handles action buttons and taps on workout-session notifications:
  //   • SNOOZE  → re-schedule +5 minutes
  //   • DISMISS → silently close (do nothing)
  //   • Tap     → open UpcomingSessionsScreen so the user can join the session

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sessionRespSub = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data as any;
        if (!data || data.type !== 'session_reminder') return;

        const action = response.actionIdentifier;

        if (action === 'SNOOZE') {
          await SessionReminderService.snooze(response.notification.request.content)
            .catch(e => console.warn('[App] session reminder snooze failed:', e));
          return;
        }

        if (action === 'DISMISS') {
          // User explicitly dismissed — nothing to do.
          return;
        }

        // Any other action (including the default notification tap) → navigate
        // to UpcomingSessionsScreen so the user can see and join their session.
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate('UpcomingSessionsScreen', {});
        }
      },
    );

    return () => sessionRespSub.remove();
  }, []); // no deps — navigationRef is a stable ref, no uid needed here

  if (authLoading || bootLoading || accessLoading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: '#EEEEF2',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <ActivityIndicator color="#F25912" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        linking={linking as any}
        theme={{
          ...DefaultTheme,
          colors: {
            ...DefaultTheme.colors,
            background: '#EEEEF2',
            card: '#F8F8FC',
            text: '#211832',
            border: '#D8D8E4',
            primary: '#F25912',
            notification: '#F25912',
          },
        }}
      >
        {supabaseUserId ? (
          <StrangerInviteProvider>
            <AppStack
              initialRoute={needsOnboarding ? 'Onboarding' : 'HomeTabs'}
              initialPublicProfile={initialPublicProfile}
            />
            <WorkoutInviteModal />
          </StrangerInviteProvider>
        ) : (
          <AuthStack initialPublicProfile={initialPublicProfile} />
        )}
      </NavigationContainer>
      {/* Floating mini-player — above the navigator, persists across screens */}
      {!!supabaseUserId && <MiniPlayer />}
      {/* Survey + Paywall overlays — sit above all navigation */}
      {!!supabaseUserId && <GripcuffSurveyModal />}
      {!!supabaseUserId && <PaywallScreen />}
      {/* Incoming challenge invite — in-app accept/decline prompt */}
      {pendingChallengeSession && (
        <ChallengeInviteAlert
          session={pendingChallengeSession}
          myUid={supabaseUserId!}
          onAccept={async (session) => {
            setPendingChallengeSession(null);
            const token = await fetchAgoraToken(session.channel_name, 0).catch(() => '');
            if (navigationRef.isReady()) {
              (navigationRef as any).navigate('ChallengeVideoRoom', {
                channelName: session.channel_name,
                opponentName: 'Challenger',
                opponentUid: session.host_id,
                token,
                challengeSessionId: session.id,
                exerciseName: session.exercise_name,
                workoutDurationSecs: session.duration_seconds,
                isHost: false,
                myUid: supabaseUserId,
              });
            }
          }}
          onDecline={(session) => {
            setPendingChallengeSession(null);
            ChallengeSessionService.cancel(session.id).catch(() => {});
          }}
        />
      )}

      {/* Fullscreen workout alarm modal — global foreground watcher */}
      <WorkoutReminderModal
        visible={alarmModalVisible}
        workout={activeAlarm ? {
          id: activeAlarm.id,
          workoutName: activeAlarm.workoutTitle,
          videoTitle: activeAlarm.workoutTitle,
          videoId: activeAlarm.videoId,
          thumbnail: activeAlarm.thumbnail ?? null,
          scheduledAt: activeAlarm.scheduledAt,
          recurrenceLabel: activeAlarm.recurrenceLabel,
          source: activeAlarm.source,
          isStartTime: activeAlarm.isStartTime,
        } : null}
        onDismiss={() => {
          setAlarmModalVisible(false);
          setActiveAlarm(null);
        }}
        onStartNow={(workout) => {
          setAlarmModalVisible(false);
          setActiveAlarm(null);
          if (!navigationRef.isReady()) return;

          // "Reminder to Move" → jump straight into a 1-minute squat in workout mode.
          if (workout.source === 'dailyReminder') {
            (navigationRef as any).navigate('VideoPlayer', {
              videoId: 'move-squat',
              title: 'Squats',
              videoUrl: EXERCISE_SQUAT_VIDEO_URL,
              initialMode: 'workout',
              autoStartWorkout: true,
              targetDurationSec: 60,
            });
            return;
          }

          const targetVideoId = activeAlarm?.videoId || workout.videoId;
          if (targetVideoId) {
            console.log('[ReminderWatcherService] navigation triggered', { videoId: targetVideoId });
            (navigationRef as any).navigate('VideoPlayer', {
              videoId: targetVideoId,
              allowInvite: true,
              autoStart: true,
            });
          }
        }}
      />
    </View>
  );
}

export default function App() {
  const [password, setPassword] = useState('');
  // Access gate disabled: set this back to false to re-enable the admin password screen.
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    // Initialize Google Cast SDK once at startup (kicks off iOS discovery)
    CastManager.initialize();
  }, []);

  if (!isAuthenticated) {
    return (
      <View style={styles.gateContainer}>
        <Text style={styles.gateTitle}>Access Restricted</Text>
        <TextInput
          style={styles.gateInput}
          placeholder="Enter password"
          placeholderTextColor="#888"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => {
            if (password === 'admin') setIsAuthenticated(true);
          }}
        />
        <TouchableOpacity
          style={styles.gateButton}
          onPress={() => {
            if (password === 'admin') setIsAuthenticated(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.gateButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <FavoritesProvider>
          <UserProvider>
            <FriendProvider>
              <LibraryProvider>
                <WorkoutProvider>
                  <WorkoutSessionProvider>
                    <NotificationProvider>
                      <AccessProvider>
                        <TierProvider>
                          <MiniPlayerProvider>
                            <MainApp />
                          </MiniPlayerProvider>
                        </TierProvider>
                      </AccessProvider>
                    </NotificationProvider>
                  </WorkoutSessionProvider>
                </WorkoutProvider>
              </LibraryProvider>
            </FriendProvider>
          </UserProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  gateContainer: {
    flex: 1,
    backgroundColor: '#F8F8FC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#211832',
    marginBottom: 24,
  },
  gateInput: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#F8F8FC',
    color: '#211832',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F8F8FC',
    marginBottom: 16,
    fontSize: 16,
  },
  gateButton: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ff5252',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateButtonText: {
    color: '#211832',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
