import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, LogBox, BackHandler, Alert, Platform } from 'react-native';
import { NavigationContainer, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Video, Dumbbell, User, Users, Calendar } from 'lucide-react-native';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './core/config/firebase';

import { useNotifications } from './hooks/useNotifications';
import * as Notifications from 'expo-notifications';
import { WorkoutReminderModal } from './components/WorkoutReminderModal';
import { WorkoutReminderService } from './services/workoutReminder.service';
import { reminderWatcherService, ForegroundAlarm } from './services/reminderWatcher.service';
import { migrateLegacyReminders } from './services/moveReminder.service';
import { AppState } from 'react-native';
import { CastManager } from './services/cast/castManager';
import { AuthProvider, useAuth } from './providers/AuthContext';
import { UserProvider, useUser } from './providers/UserContext';
import { FriendProvider } from './providers/FriendContext';
import { LibraryProvider } from './providers/LibraryContext';
import { WorkoutProvider } from './providers/WorkoutContext';
import { WorkoutSessionProvider, useWorkoutSession } from './providers/WorkoutSessionContext';
import { StrangerInviteProvider } from './providers/StrangerInviteProvider';
import { FavoritesProvider } from './providers/FavoritesContext';
import { NotificationProvider } from './providers/NotificationProvider';
import { AppTheme, CoachingTheme } from './core/theme/app_theme';

// Screens
import { SplashScreen } from './screens/SplashScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { PaywallScreen } from './screens/PaywallScreen';
import { GripcuffSurveyModal } from './screens/GripcuffSurveyModal';
import { AccessProvider, useAccess } from './providers/AccessContext';
import { HomeScreen } from './screens/HomeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { WorkoutsScreen } from './screens/WorkoutsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
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
import { ChatInboxScreen } from './screens/ChatInboxScreen';
import { ChatRoomScreen } from './screens/ChatRoomScreen';
import { ChatFriendProfileScreen } from './screens/ChatFriendProfileScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AllFavouritesScreen } from './screens/AllFavouritesScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { StreakService } from './services/streak.service';
import { TimezoneService } from './services/timezone.service';
import { initializeCurrentUserOnLeaderboard } from './services/leaderboard.service';
import { WorkoutInviteModal } from './components/WorkoutInviteModal';

LogBox.ignoreAllLogs(); // temporary to identify crash

if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    console.log('ERROR:', ...args);
    originalConsoleError(...args);
  };
}

class ErrorBoundary extends React.Component<any, { hasError: boolean, error: any }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{
          flex: 1, backgroundColor: '#0d1520',
          justifyContent: 'center', alignItems: 'center', padding: 20
        }}>
          <Text style={{ color: '#D4622A', fontSize: 18, fontWeight: '700' }}>
            Something went wrong
          </Text>
          <Text style={{ color: '#607a94', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
            {this.state.error ? String(this.state.error) : ''}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ marginTop: 20, backgroundColor: '#D4622A', padding: 12, borderRadius: 10 }}>
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

// Auth Stack
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000' }
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

// Home Tab Navigator
function HomeTabs() {
  const { appMode } = useUser();
  const { unreadInvitesCount } = useWorkoutSession();
  const theme = appMode === 'coaching' ? CoachingTheme : AppTheme;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: appMode === 'coaching' ? CoachingTheme.border : AppTheme.cardColor,
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: theme.primaryColor,
        tabBarInactiveTintColor: appMode === 'coaching' ? CoachingTheme.textMuted : AppTheme.textGrey,
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="LibraryTab"
        component={LibraryScreen}
        options={{
          tabBarLabel: appMode === 'coaching' ? 'Explore Coaches' : 'Exercise Library',
          tabBarIcon: ({ color, size }) =>
            appMode === 'coaching' ? (
              <Users color={color} size={size} />
            ) : (
              <Video color={color} size={size} />
            ),
        }}
      />
      <Tab.Screen
        name="WorkoutsTab"
        component={WorkoutsScreen}
        options={{
          tabBarLabel: appMode === 'coaching' ? 'Previous Sessions' : 'Workouts',
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AppStack({ initialRoute }: { initialRoute?: string }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute ?? 'HomeTabs'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0d1520' }
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
          contentStyle: { backgroundColor: '#0d1520' }
        }}
      >
        <Stack.Screen name="WorkoutStep1" component={WorkoutStep1Screen} />
        <Stack.Screen name="WorkoutStep2" component={WorkoutStep2Screen} />
        <Stack.Screen name="WorkoutResult" component={WorkoutResultScreen} />
        <Stack.Screen name="FacePullDetails" component={FacePullDetailsPage} />
        <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
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
        <Stack.Screen
          name="AgoraVideoRoom"
          component={AgoraVideoRoom}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="ChatInbox" component={ChatInboxScreen} />
        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
        <Stack.Screen name="ChatFriendProfile" component={ChatFriendProfileScreen} />
        <Stack.Screen name="LeaderboardScreen" component={LeaderboardScreen} />
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

function MainApp() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const navigationRef = useNavigationContainerRef();
  const { loading: accessLoading } = useAccess();
  const { identity, loading: authLoading } = useAuth();
  const firebaseUid = identity.firebaseUid;
  const supabaseUserId = identity.supabaseUserId;
  const firebaseUser = identity.firebaseUser;

  // Registers for FCM push notifications and handles notification-click navigation.
  // Must be called here — inside all providers but outside NavigationContainer.
  useNotifications(navigationRef as any);

  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<ForegroundAlarm | null>(null);
  const profileReminderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const profileReminderVisibleRef = useRef(false);
  const leaderboardSeeded = useRef(false);

  // Expire stale reminders whenever the app comes back to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const uid = firebaseUid;
        if (uid) WorkoutReminderService.cleanupExpired(uid);
        if (uid) WorkoutReminderService.restoreRecurringReminders(uid).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [firebaseUid]);

  useEffect(() => {
    const firebaseUid = identity.firebaseUid ?? null;
    console.log({ supabaseUserId, firebaseUid });
  }, [supabaseUserId, identity.firebaseUid]);

  useEffect(() => {
    const runBootSync = async () => {
      if (firebaseUser && firebaseUid) {
        let userProfile: Record<string, any> = {};

        // 1. Load profile and resolve onboarding — must not be blocked by anything else
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUid));
        if (firebaseUid) {
          WorkoutReminderService.restoreRecurringReminders(firebaseUid).catch(() => {});
        }
          userProfile = snap.data() ?? {};
          const localFlag = typeof localStorage !== 'undefined'
            ? !!localStorage.getItem('onboarding_complete_' + firebaseUid)
            : false;
          const onboardingDone = !!userProfile.onboardingCompleted || localFlag;
          setNeedsOnboarding(!onboardingDone);
        } catch {
          // Firestore read failed — fall back to localStorage or displayName
          const localFlag = typeof localStorage !== 'undefined'
            ? !!localStorage.getItem('onboarding_complete_' + firebaseUid)
            : false;
          setNeedsOnboarding(!localFlag && !firebaseUser.displayName);
        }

        // 2. Timezone sync — always write device timezone so stale stored values never win.
        const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (deviceTimezone) {
          updateDoc(doc(db, 'users', firebaseUid), {
            timezone: deviceTimezone,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          TimezoneService.invalidateCache(firebaseUid);
        }

        // 3. Streak check — independent, never blocks auth flow
        StreakService.checkAndBreakStreak(firebaseUid).catch(() => {});

        // 4. Leaderboard sync — once per session only; guard prevents repeat overwrites on token refresh
        if (!leaderboardSeeded.current) {
          leaderboardSeeded.current = true;
          initializeCurrentUserOnLeaderboard(firebaseUid, userProfile).catch(e => {
            console.error('[Leaderboard] seed failed:', e?.message ?? e);
          });
        }
      } else {
        setNeedsOnboarding(false);
      }
      setBootLoading(false);
    };
    runBootSync();
  }, [firebaseUid]);

  useEffect(() => {
    if (!firebaseUid) {
      // User logged out — stop the clock
      reminderWatcherService.stop();
      return;
    }
    // Start the persistent reminder clock for this user.
    // NO cleanup return here — the clock is a global singleton that must
    // survive React re-renders, navigation, and tab switches.
    // It is only stopped above when the user logs out (uid becomes falsy).
    // Calling start() again with the same uid is safe: start() calls stop()
    // internally first, so it always restarts cleanly.
    migrateLegacyReminders(firebaseUid).catch(() => {});
    reminderWatcherService.start(firebaseUid, (alarm) => {
      setActiveAlarm(alarm);
      setAlarmModalVisible(true);
    });
  }, [firebaseUid]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return; // NEVER stop the clock — only restart if needed
      const uid = firebaseUid;
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
  }, [firebaseUid]);

  useEffect(() => {
    const getMissingProfileFields = (data: any): string[] => {
      const missing: string[] = [];
      const hasDob = !!(
        (typeof data?.dateOfBirth === 'string' && data.dateOfBirth.trim()) ||
        (data?.dob && data.dob.month && data.dob.year)
      );
      const hasWorkoutSpot =
        (Array.isArray(data?.workoutLocations) && data.workoutLocations.length > 0) ||
        (typeof data?.workoutLocation === 'string' && data.workoutLocation.trim().length > 0);
      const requiredChecks: Array<{ key: string; ok: boolean }> = [
        { key: 'username', ok: typeof data?.username === 'string' && data.username.trim().length > 0 },
        { key: 'dateOfBirth', ok: hasDob },
        { key: 'gender', ok: typeof data?.gender === 'string' && data.gender.trim().length > 0 },
        { key: 'city', ok: typeof data?.city === 'string' && data.city.trim().length > 0 },
        { key: 'workoutLocation', ok: hasWorkoutSpot },
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
      const uid = firebaseUid;
      if (!uid) return;
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        const data = snap.data() ?? {};
        const isOnboardingDone = !!data?.onboardingCompleted;
        if (!isOnboardingDone) return;
        const missingFields = getMissingProfileFields(data);
        if (missingFields.length > 0) {
          promptForProfileCompletion();
        }
      } catch (e) {
        console.warn('Profile reminder check failed:', e);
      }
    };

    if (!firebaseUid) {
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
  }, [firebaseUid, navigationRef]);

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
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    window.history.pushState({ page: 1 }, '');

    const handlePopState = () => {
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
      }
      window.history.pushState({ page: 1 }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigationRef]);

  // Listen for recurring reminder notifications and refresh schedules when fired
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as any;
      if (!data || data.type !== 'recurring_reminder') return;
      const uid = firebaseUid;
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
      const uid = firebaseUid;
      if (!uid) return;
      try {
        await WorkoutReminderService.restoreRecurringReminders(uid);
      } catch (e) {}
    });

    return () => {
      sub.remove();
      respSub.remove();
    };
  }, [firebaseUid]);

  if (authLoading || bootLoading || accessLoading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: '#0d1520',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <ActivityIndicator color="#D4622A" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        theme={{
          ...DarkTheme,
          colors: {
            ...DarkTheme.colors,
            background: '#0d1520',
            card: '#131f2e',
            text: '#ffffff',
            border: '#1c3a56',
            primary: '#D4622A',
            notification: '#D4622A',
          },
        }}
      >
        {firebaseUid ? (
          <StrangerInviteProvider>
            <AppStack initialRoute={needsOnboarding ? 'Onboarding' : 'HomeTabs'} />
            <WorkoutInviteModal />
          </StrangerInviteProvider>
        ) : (
          <AuthStack />
        )}
      </NavigationContainer>
      {/* Survey + Paywall overlays — sit above all navigation */}
      {!!firebaseUid && <GripcuffSurveyModal />}
      {!!firebaseUid && <PaywallScreen />}
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
          const targetVideoId = activeAlarm?.videoId || workout.videoId;
          if (targetVideoId && navigationRef.isReady()) {
            console.log('[ReminderWatcherService] navigation triggered', { videoId: targetVideoId });
            navigationRef.navigate('VideoPlayer' as never, {
              videoId: targetVideoId,
              allowInvite: true,
              autoStart: true,
            } as never);
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
                        <MainApp />
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
    backgroundColor: '#1d2337',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  gateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
  },
  gateInput: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#2a3143',
    color: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a4155',
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
