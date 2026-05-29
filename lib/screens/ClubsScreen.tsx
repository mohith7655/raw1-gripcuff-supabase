import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Users,
  Plus,
  ArrowLeft,
  CalendarDays,
  Trophy,
  User,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Bell,
  Clock,
} from 'lucide-react-native';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { CreateClubModal } from '../components/clubs/CreateClubModal';
import { LeaderboardEntry, LeaderboardService } from '../services/leaderboard.service';

// ── Design tokens ──────────────────────────────────────────────────────────────
const ORANGE = '#F97316';
const BG = '#051424';
const CARD_BG = '#1E293B';
const TEXT = '#D4E4FA';
const TEXT_SUB = '#E0C0B1';
const BORDER = 'rgba(255,255,255,0.05)';
const SURFACE_HIGH = '#1C2B3C';
const SURFACE_VAR = '#273647';

type Tab = 'community' | 'classroom' | 'calendar' | 'leaderboard' | 'profile';

// ── Club types ─────────────────────────────────────────────────────────────────
export interface Club {
  id: string;
  name: string;
  category: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  is_private: boolean;
  creator_id: string;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function ClubAvatar({ club, size = 48 }: { club: Club; size?: number }) {
  if (club.avatar_url) {
    return <Image source={{ uri: club.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[s.clubAvatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '800' }}>
        {club.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// ── Community (Clubs) Tab ──────────────────────────────────────────────────────
function CommunityTab({
  myClubs, discoverClubs, loading, refreshing, joiningId,
  onRefresh, onJoin, onNavigateClub, onCreateClub,
}: {
  myClubs: Club[]; discoverClubs: Club[];
  loading: boolean; refreshing: boolean; joiningId: string | null;
  onRefresh: () => void; onJoin: (id: string) => void;
  onNavigateClub: (club: Club) => void; onCreateClub: () => void;
}) {
  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={ORANGE} /></View>;
  }

  const sections = [
    { key: 'my', title: 'My Clubs', data: myClubs },
    { key: 'discover', title: 'Discover', data: discoverClubs },
  ];

  return (
    <FlatList
      data={[]}
      renderItem={null}
      keyExtractor={() => ''}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />}
      ListHeaderComponent={
        <>
          <Text style={s.tabPageTitle}>Community</Text>
          {sections.map(section => (
            <View key={section.key}>
              <Text style={s.sectionHeader}>{section.title}</Text>
              {section.data.length === 0 ? (
                <View style={s.emptySection}>
                  <Users size={28} color={TEXT_SUB} />
                  {section.key === 'my' ? (
                    <>
                      <Text style={s.emptyTitle}>No clubs yet</Text>
                      <Text style={s.emptySub}>Create or join one below</Text>
                    </>
                  ) : (
                    <Text style={s.emptyTitle}>No clubs to discover</Text>
                  )}
                </View>
              ) : (
                section.data.map(club => (
                  <TouchableOpacity
                    key={club.id}
                    style={s.clubCard}
                    onPress={() => onNavigateClub(club)}
                    activeOpacity={0.8}
                  >
                    <ClubAvatar club={club} />
                    <View style={s.clubInfo}>
                      <Text style={s.clubName} numberOfLines={1}>{club.name}</Text>
                      <Text style={s.clubMeta} numberOfLines={1}>
                        {club.category} · {club.member_count} member{club.member_count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    {section.key === 'my' ? (
                      <View style={s.joinedPill}><Text style={s.joinedText}>Joined</Text></View>
                    ) : (
                      <TouchableOpacity
                        style={s.joinBtn}
                        onPress={() => onJoin(club.id)}
                        disabled={joiningId === club.id}
                        activeOpacity={0.8}
                      >
                        {joiningId === club.id
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={s.joinBtnText}>Join</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          ))}
        </>
      }
      contentContainerStyle={{ paddingBottom: 30 }}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ── Classroom Tab ──────────────────────────────────────────────────────────────
function ClassroomTab() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
      <Text style={s.tabPageTitle}>Classroom</Text>
      <View style={s.placeholderCard}>
        <BookOpen size={40} color={TEXT_SUB} />
        <Text style={s.placeholderTitle}>Coming Soon</Text>
        <Text style={s.placeholderSub}>Club lessons and workshops will appear here.</Text>
      </View>
    </ScrollView>
  );
}

// ── Calendar Tab ──────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_ABBR = ['S','M','T','W','T','F','S'];

// Placeholder events — in production these would come from Supabase
const PLACEHOLDER_EVENTS = [
  {
    id: '1',
    title: 'Saturday Morning Gripcuff Challenge',
    badge: 'Live Session',
    badgeColor: ORANGE,
    host: 'by Coach Marcus',
    date: 'Sat, Oct 6',
    time: '08:00 AM',
    actionLabel: 'Join Session',
    actionStyle: 'primary' as const,
    day: 6,
  },
  {
    id: '2',
    title: 'Mindset Workshop',
    badge: 'Webinar',
    badgeColor: '#00A6E0',
    host: 'by Dr. Sarah Jenkins',
    date: 'Tue, Oct 13',
    time: '05:30 PM',
    actionLabel: 'Remind Me',
    actionStyle: 'outline' as const,
    day: 13,
  },
  {
    id: '3',
    title: 'Personal Leg Day',
    badge: 'Self-Guided',
    badgeColor: TEXT_SUB,
    host: '',
    date: 'Thu, Oct 19',
    time: 'Anytime',
    actionLabel: 'View Routine',
    actionStyle: 'muted' as const,
    day: 19,
  },
];

const EVENT_DAYS = new Set(PLACEHOLDER_EVENTS.map(e => e.day));

function CalendarGrid({ year, month }: { year: number; month: number }) {
  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  return (
    <View>
      {/* Day-of-week headers */}
      <View style={s.calGridRow}>
        {DAYS_ABBR.map((d, i) => (
          <View key={i} style={s.calCell}>
            <Text style={s.calDayLabel}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Day cells in rows of 7 */}
      {chunk(cells, 7).map((row, ri) => (
        <View key={ri} style={s.calGridRow}>
          {row.map((cell, ci) => (
            <View key={ci} style={s.calCell}>
              {cell !== null && (
                <View style={[s.calDayBtn, isToday(cell) && s.calDayToday]}>
                  <Text style={[s.calDayNum, isToday(cell) && s.calDayNumToday]}>
                    {cell}
                  </Text>
                  {EVENT_DAYS.has(cell) && (
                    <View style={s.calDot} />
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function CalendarTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [eventTab, setEventTab] = useState<'events' | 'workouts'>('events');

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
      <Text style={s.tabPageTitle}>Calendar</Text>

      {/* Events / My Workouts pill toggle */}
      <View style={s.pillToggleRow}>
        <View style={s.pillToggle}>
          <TouchableOpacity
            style={[s.pillBtn, eventTab === 'events' && s.pillBtnActive]}
            onPress={() => setEventTab('events')}
            activeOpacity={0.8}
          >
            <Text style={[s.pillBtnText, eventTab === 'events' && s.pillBtnTextActive]}>Events</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.pillBtn, eventTab === 'workouts' && s.pillBtnActive]}
            onPress={() => setEventTab('workouts')}
            activeOpacity={0.8}
          >
            <Text style={[s.pillBtnText, eventTab === 'workouts' && s.pillBtnTextActive]}>My Workouts</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Monthly calendar card */}
      <View style={s.calCard}>
        <View style={s.calHeader}>
          <Text style={s.calMonthTitle}>{MONTHS[month]} {year}</Text>
          <View style={s.calNavRow}>
            <TouchableOpacity onPress={prevMonth} style={s.calNavBtn} activeOpacity={0.7}>
              <ChevronLeft size={18} color={TEXT_SUB} />
            </TouchableOpacity>
            <TouchableOpacity onPress={nextMonth} style={s.calNavBtn} activeOpacity={0.7}>
              <ChevronRight size={18} color={TEXT_SUB} />
            </TouchableOpacity>
          </View>
        </View>
        <CalendarGrid year={year} month={month} />
      </View>

      {/* Upcoming Events */}
      <Text style={s.sectionHeader2}>Upcoming Events</Text>
      {PLACEHOLDER_EVENTS.map(ev => (
        <View key={ev.id} style={s.eventCard}>
          <View style={s.eventCardTop}>
            <Text style={s.eventTitle} numberOfLines={2}>{ev.title}</Text>
            <View style={[s.eventBadge, { borderColor: ev.badgeColor + '55' }]}>
              <Text style={[s.eventBadgeText, { color: ev.badgeColor }]}>{ev.badge}</Text>
            </View>
          </View>
          {ev.host ? <Text style={s.eventHost}>{ev.host}</Text> : null}
          <View style={s.eventMeta}>
            <View style={s.eventMetaItem}>
              <CalendarDays size={15} color={TEXT_SUB} />
              <Text style={s.eventMetaText}>{ev.date}</Text>
            </View>
            <View style={s.eventMetaItem}>
              <Clock size={15} color={TEXT_SUB} />
              <Text style={s.eventMetaText}>{ev.time}</Text>
            </View>
          </View>
          <View style={s.eventActions}>
            {ev.actionStyle === 'primary' && (
              <TouchableOpacity style={s.eventBtnPrimary} activeOpacity={0.85}>
                <Text style={s.eventBtnPrimaryText}>{ev.actionLabel}</Text>
              </TouchableOpacity>
            )}
            {ev.actionStyle === 'outline' && (
              <TouchableOpacity style={s.eventBtnOutline} activeOpacity={0.85}>
                <Text style={s.eventBtnOutlineText}>{ev.actionLabel}</Text>
              </TouchableOpacity>
            )}
            {ev.actionStyle === 'muted' && (
              <TouchableOpacity style={s.eventBtnMuted} activeOpacity={0.85}>
                <Text style={s.eventBtnMutedText}>{ev.actionLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.eventBtnIcon} activeOpacity={0.85}>
              <Bell size={18} color={TEXT} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Leaderboard Tab ────────────────────────────────────────────────────────────
type LBPeriod = 'weekly' | 'monthly' | 'alltime';

function LeaderboardTab() {
  const { supabaseUserId } = useAuth();
  const { profile } = useUser();
  const [period, setPeriod] = useState<LBPeriod>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setEntries([]);

    const injectSelf = (list: LeaderboardEntry[]): LeaderboardEntry[] => {
      if (!supabaseUserId || list.some(r => r.uid === supabaseUserId)) return list;
      const selfEntry: LeaderboardEntry = {
        uid: supabaseUserId,
        displayName: profile?.username || profile?.fullName || 'You',
        photoURL: profile?.profileImageUrl || '',
        score: Number(profile?.watchedSeconds ?? 0),
        currentStreak: Number(profile?.currentStreak ?? 0),
        bestStreak: Number(profile?.bestStreak ?? 0),
        workouts: Number(profile?.completedWorkouts ?? 0),
        liveSessions: Number(profile?.totalLiveSessions ?? 0),
        workoutsCompleted: Number(profile?.completedWorkouts ?? 0),
      };
      return [...list, selfEntry].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    };

    if (period === 'monthly') {
      const unsub = LeaderboardService.subscribeWeeklyLeaderboard(
        supabaseUserId || '',
        (data) => { setEntries(injectSelf(data)); setLoading(false); },
        () => setLoading(false),
      );
      return () => unsub();
    }

    if (period === 'alltime') {
      const unsub = LeaderboardService.subscribeAllTimeLeaderboard(
        supabaseUserId || '',
        (data) => { setEntries(injectSelf(data)); setLoading(false); },
        () => setLoading(false),
      );
      return () => unsub();
    }

    // weekly
    const unsub = LeaderboardService.subscribeWeeklyLeaderboard(
      supabaseUserId || '',
      (data) => { setEntries(injectSelf(data)); setLoading(false); },
      () => setLoading(false),
    );
    return () => unsub();
  }, [period, supabaseUserId]);

  const myRank = entries.findIndex(e => e.uid === supabaseUserId) + 1;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
      <Text style={s.tabPageTitle}>Leaderboard</Text>
      <Text style={s.tabPageSub}>See how you stack up against the community.</Text>

      {/* User progress card */}
      <View style={s.lbSelfCard}>
        <View style={s.lbSelfInner}>
          <View style={s.lbAvatarWrap}>
            {profile?.profileImageUrl ? (
              <Image source={{ uri: profile.profileImageUrl }} style={s.lbSelfAvatar} />
            ) : (
              <View style={[s.lbSelfAvatar, s.lbSelfAvatarFallback]}>
                <Text style={s.lbSelfAvatarLetter}>
                  {(profile?.username || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            {myRank > 0 && (
              <View style={s.lbRankBubble}>
                <Text style={s.lbRankBubbleText}>Rank {myRank}</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={s.lbSelfName}>{profile?.username || profile?.fullName || 'You'}</Text>
            <Text style={s.lbSelfScore}>
              {Math.round((profile?.watchedSeconds ?? 0) / 60)} min · 🔥 {profile?.currentStreak ?? 0} day streak
            </Text>
          </View>
        </View>
      </View>

      {/* Period filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.lbFilterScroll} contentContainerStyle={s.lbFilterContent}>
        {([['weekly','This Week'],['monthly','This Month'],['alltime','All Time']] as [LBPeriod,string][]).map(([val, label]) => (
          <TouchableOpacity
            key={val}
            style={[s.lbFilterBtn, period === val && s.lbFilterBtnActive]}
            onPress={() => setPeriod(val)}
            activeOpacity={0.8}
          >
            <Text style={[s.lbFilterText, period === val && s.lbFilterTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Ranked list */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={ORANGE} /></View>
      ) : (
        entries.map((entry, i) => {
          const isMe = entry.uid === supabaseUserId;
          const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
          const rankColor = i < 3 ? rankColors[i] : TEXT_SUB;
          return (
            <View key={entry.uid} style={[s.lbRow, isMe && s.lbRowMe, i < 3 && s.lbRowTop]}>
              <Text style={[s.lbRank, { color: rankColor }]}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
              </Text>
              {entry.photoURL ? (
                <Image source={{ uri: entry.photoURL }} style={s.lbAvatar} />
              ) : (
                <View style={[s.lbAvatar, s.lbAvatarFallback]}>
                  <Text style={s.lbAvatarLetter}>{(entry.displayName || 'U')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[s.lbName, isMe && { color: ORANGE }]} numberOfLines={1}>
                  {entry.displayName || 'User'}{isMe ? ' (You)' : ''}
                </Text>
                <Text style={s.lbSubText}>
                  💪 {entry.workoutsCompleted || 0} · 🔥 {entry.currentStreak || 0} streak
                </Text>
              </View>
              <Text style={[s.lbScore, { color: i === 0 ? ORANGE : TEXT }]}>
                {Math.round((entry.score || 0) / 60)}m
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// ── Profile Tab ────────────────────────────────────────────────────────────────
function ProfileTab() {
  const navigation = useNavigation<any>();
  const { profile } = useUser();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
      <Text style={s.tabPageTitle}>Profile</Text>
      <View style={s.profileCard}>
        {profile?.profileImageUrl ? (
          <Image source={{ uri: profile.profileImageUrl }} style={s.profileAvatar} />
        ) : (
          <View style={[s.profileAvatar, s.profileAvatarFallback]}>
            <Text style={s.profileAvatarLetter}>
              {(profile?.username || 'U')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={s.profileName}>{profile?.username || profile?.fullName || 'You'}</Text>
        <View style={s.profileStats}>
          <View style={s.profileStat}>
            <Text style={s.profileStatNum}>{profile?.completedWorkouts ?? 0}</Text>
            <Text style={s.profileStatLabel}>Workouts</Text>
          </View>
          <View style={s.profileStatDivider} />
          <View style={s.profileStat}>
            <Text style={s.profileStatNum}>{profile?.currentStreak ?? 0}</Text>
            <Text style={s.profileStatLabel}>Day Streak</Text>
          </View>
          <View style={s.profileStatDivider} />
          <View style={s.profileStat}>
            <Text style={s.profileStatNum}>{Math.round((profile?.watchedSeconds ?? 0) / 60)}</Text>
            <Text style={s.profileStatLabel}>Minutes</Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.profileEditBtn}
          onPress={() => navigation.navigate('ProfileScreen')}
          activeOpacity={0.8}
        >
          <Text style={s.profileEditBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Bottom Tab Bar ─────────────────────────────────────────────────────────────
const TAB_ITEMS: { key: Tab; label: string; icon: React.ElementType; iconFilled?: React.ElementType }[] = [
  { key: 'community', label: 'Community', icon: Users },
  { key: 'classroom', label: 'Classroom', icon: BookOpen },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'profile', label: 'Profile', icon: User },
];

function BottomTabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <View style={s.tabBar}>
      {TAB_ITEMS.map(item => {
        const isActive = item.key === active;
        const Icon = item.icon;
        return (
          <TouchableOpacity
            key={item.key}
            style={s.tabBarItem}
            onPress={() => onChange(item.key)}
            activeOpacity={0.7}
          >
            <Icon size={22} color={isActive ? ORANGE : TEXT_SUB} strokeWidth={isActive ? 2 : 1.5} />
            <Text style={[s.tabBarLabel, isActive && s.tabBarLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Root Screen ────────────────────────────────────────────────────────────────
export function ClubsScreen() {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const [tab, setTab] = useState<Tab>('community');
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [discoverClubs, setDiscoverClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);

  const fetchClubs = useCallback(async () => {
    if (!supabaseUserId) return;
    try {
      const { data: memberRows } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', supabaseUserId);
      const myIds = (memberRows ?? []).map((r: any) => r.club_id);

      const { data: allClubs } = await supabase
        .from('clubs')
        .select('*')
        .eq('is_private', false)
        .order('member_count', { ascending: false })
        .limit(50);

      const clubs = (allClubs ?? []) as Club[];
      setMyClubs(clubs.filter(c => myIds.includes(c.id)));
      setDiscoverClubs(clubs.filter(c => !myIds.includes(c.id)));
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [supabaseUserId]);

  useEffect(() => { fetchClubs(); }, [fetchClubs]);

  const handleJoin = async (clubId: string) => {
    if (!supabaseUserId || joiningId) return;
    setJoiningId(clubId);
    try {
      await supabase.from('club_members').insert({ club_id: clubId, user_id: supabaseUserId, role: 'member' });
      await Promise.resolve(supabase.rpc('increment_club_members', { p_club_id: clubId })).catch(() => {});
      fetchClubs();
    } catch { /* silent */ }
    finally { setJoiningId(null); }
  };

  const handleClubCreated = (club: Club) => {
    setCreateVisible(false);
    fetchClubs();
    navigation.navigate('ClubDetailScreen', { club });
  };

  const TAB_TITLES: Record<Tab, string> = {
    community: 'Clubs',
    classroom: 'Clubs',
    calendar: 'Clubs',
    leaderboard: 'Clubs',
    profile: 'Clubs',
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Clubs</Text>
        <TouchableOpacity style={s.createBtn} onPress={() => setCreateVisible(true)} activeOpacity={0.85}>
          <Plus size={16} color="#fff" />
          <Text style={s.createBtnText}>Create Club</Text>
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {tab === 'community' && (
          <CommunityTab
            myClubs={myClubs}
            discoverClubs={discoverClubs}
            loading={loading}
            refreshing={refreshing}
            joiningId={joiningId}
            onRefresh={() => { setRefreshing(true); fetchClubs(); }}
            onJoin={handleJoin}
            onNavigateClub={(club) => navigation.navigate('ClubDetailScreen', { club })}
            onCreateClub={() => setCreateVisible(true)}
          />
        )}
        {tab === 'classroom' && <ClassroomTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'leaderboard' && <LeaderboardTab />}
        {tab === 'profile' && <ProfileTab />}
      </View>

      {/* Bottom tab bar */}
      <BottomTabBar active={tab} onChange={setTab} />

      <CreateClubModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={handleClubCreated}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1, marginLeft: 8 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ORANGE, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Tab page headers
  tabPageTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 20, marginBottom: 4 },
  tabPageSub: { color: TEXT_SUB, fontSize: 14, marginBottom: 16 },

  // Section headers
  sectionHeader: {
    color: TEXT_SUB, fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    paddingTop: 18, paddingBottom: 8, textTransform: 'uppercase',
  },
  sectionHeader2: {
    color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 20, marginBottom: 12,
  },

  // Club cards
  clubCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: CARD_BG, marginBottom: 8, borderRadius: 12,
    padding: 12, gap: 12, borderWidth: 1, borderColor: BORDER,
  },
  clubAvatarFallback: { backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  clubInfo: { flex: 1 },
  clubName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  clubMeta: { color: TEXT_SUB, fontSize: 12, marginTop: 2 },
  joinBtn: { backgroundColor: ORANGE, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, minWidth: 54, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  joinedPill: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)' },
  joinedText: { color: ORANGE, fontSize: 12, fontWeight: '600' },

  // Empty states
  emptySection: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptySub: { color: TEXT_SUB, fontSize: 13 },

  // Placeholder
  placeholderCard: {
    backgroundColor: CARD_BG, borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 12, marginTop: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  placeholderTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  placeholderSub: { color: TEXT_SUB, fontSize: 14, textAlign: 'center' },

  // ── Calendar ──
  pillToggleRow: { marginBottom: 16 },
  pillToggle: {
    flexDirection: 'row', backgroundColor: SURFACE_HIGH,
    borderRadius: 999, padding: 4, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: BORDER,
  },
  pillBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999 },
  pillBtnActive: { backgroundColor: ORANGE },
  pillBtnText: { color: TEXT_SUB, fontSize: 13, fontWeight: '700' },
  pillBtnTextActive: { color: '#fff' },

  calCard: {
    backgroundColor: CARD_BG, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: BORDER, marginBottom: 8,
  },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  calMonthTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  calNavRow: { flexDirection: 'row', gap: 4 },
  calNavBtn: { padding: 6, borderRadius: 999, backgroundColor: SURFACE_VAR },
  calGridRow: { flexDirection: 'row', marginBottom: 2 },
  calCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  calDayLabel: { color: TEXT_SUB, fontSize: 11, fontWeight: '700', paddingBottom: 6 },
  calDayBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  calDayToday: { backgroundColor: 'rgba(249,115,22,0.2)' },
  calDayNum: { color: TEXT_SUB, fontSize: 13 },
  calDayNumToday: { color: ORANGE, fontWeight: '800' },
  calDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ORANGE, marginTop: 1 },

  // Events
  eventCard: {
    backgroundColor: CARD_BG, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: BORDER, gap: 10,
  },
  eventCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eventTitle: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  eventBadge: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  eventBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  eventHost: { color: TEXT_SUB, fontSize: 12 },
  eventMeta: { flexDirection: 'row', gap: 16 },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eventMetaText: { color: TEXT_SUB, fontSize: 13 },
  eventActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  eventBtnPrimary: { flex: 1, backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  eventBtnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  eventBtnOutline: { flex: 1, borderWidth: 1, borderColor: 'rgba(249,115,22,0.5)', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  eventBtnOutlineText: { color: ORANGE, fontSize: 13, fontWeight: '700' },
  eventBtnMuted: { flex: 1, backgroundColor: SURFACE_VAR, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  eventBtnMutedText: { color: TEXT, fontSize: 13, fontWeight: '700' },
  eventBtnIcon: { width: 44, borderWidth: 1, borderColor: BORDER, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  // ── Leaderboard ──
  lbSelfCard: {
    backgroundColor: CARD_BG, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  lbSelfInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lbAvatarWrap: { position: 'relative' },
  lbSelfAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: ORANGE },
  lbSelfAvatarFallback: { backgroundColor: SURFACE_VAR, alignItems: 'center', justifyContent: 'center' },
  lbSelfAvatarLetter: { color: '#fff', fontSize: 22, fontWeight: '800' },
  lbRankBubble: {
    position: 'absolute', bottom: -8, left: '50%',
    backgroundColor: ORANGE, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
    transform: [{ translateX: -24 }],
  },
  lbRankBubbleText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  lbSelfName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  lbSelfScore: { color: TEXT_SUB, fontSize: 13, marginTop: 2 },

  lbFilterScroll: { marginBottom: 16 },
  lbFilterContent: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  lbFilterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: SURFACE_VAR },
  lbFilterBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  lbFilterText: { color: TEXT_SUB, fontSize: 13, fontWeight: '700' },
  lbFilterTextActive: { color: '#fff' },

  lbRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD_BG, borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  lbRowTop: { borderLeftWidth: 3, borderLeftColor: ORANGE },
  lbRowMe: { borderColor: 'rgba(249,115,22,0.4)' },
  lbRank: { width: 28, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  lbAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: BORDER },
  lbAvatarFallback: { backgroundColor: SURFACE_VAR, alignItems: 'center', justifyContent: 'center' },
  lbAvatarLetter: { color: '#fff', fontSize: 17, fontWeight: '800' },
  lbName: { color: TEXT, fontSize: 13, fontWeight: '700' },
  lbSubText: { color: TEXT_SUB, fontSize: 11, marginTop: 2 },
  lbScore: { fontSize: 16, fontWeight: '800' },

  // ── Profile ──
  profileCard: {
    backgroundColor: CARD_BG, borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 12, marginTop: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: ORANGE },
  profileAvatarFallback: { backgroundColor: SURFACE_VAR, alignItems: 'center', justifyContent: 'center' },
  profileAvatarLetter: { color: '#fff', fontSize: 32, fontWeight: '800' },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  profileStats: { flexDirection: 'row', alignItems: 'center', gap: 0, marginTop: 4 },
  profileStat: { alignItems: 'center', paddingHorizontal: 20 },
  profileStatNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
  profileStatLabel: { color: TEXT_SUB, fontSize: 12, marginTop: 2 },
  profileStatDivider: { width: 1, height: 36, backgroundColor: BORDER },
  profileEditBtn: {
    marginTop: 8, borderWidth: 1, borderColor: 'rgba(249,115,22,0.5)',
    borderRadius: 20, paddingHorizontal: 28, paddingVertical: 10,
  },
  profileEditBtnText: { color: ORANGE, fontSize: 14, fontWeight: '700' },

  // ── Bottom Tab Bar ──
  tabBar: {
    flexDirection: 'row', height: 64,
    backgroundColor: 'rgba(5,20,36,0.92)',
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  tabBarItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabBarLabel: { color: TEXT_SUB, fontSize: 10, fontWeight: '700' },
  tabBarLabelActive: { color: ORANGE },
});
