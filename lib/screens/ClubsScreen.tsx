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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Users, Plus } from 'lucide-react-native';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';
import { CreateClubModal } from '../components/clubs/CreateClubModal';

const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';

export interface Club {
  id: string;
  name: string;
  category: string;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  is_private: boolean;
  owner_id: string;
}

function ClubAvatar({ club, size = 48 }: { club: Club; size?: number }) {
  if (club.avatar_url) {
    return <Image source={{ uri: club.avatar_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.clubAvatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '800' }}>
        {club.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

interface ClubCardProps {
  club: Club;
  isMember: boolean;
  onPress: () => void;
  onJoin: (clubId: string) => void;
  joining: boolean;
}

function ClubCard({ club, isMember, onPress, onJoin, joining }: ClubCardProps) {
  return (
    <TouchableOpacity style={styles.clubCard} onPress={onPress} activeOpacity={0.8}>
      <ClubAvatar club={club} />
      <View style={styles.clubInfo}>
        <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
        <Text style={styles.clubMeta} numberOfLines={1}>
          {club.category} · {club.member_count} member{club.member_count !== 1 ? 's' : ''}
        </Text>
      </View>
      {isMember ? (
        <View style={styles.joinedPill}>
          <Text style={styles.joinedText}>Joined</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.joinBtn}
          onPress={() => onJoin(club.id)}
          disabled={joining}
          activeOpacity={0.8}
        >
          {joining
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.joinBtnText}>Join</Text>
          }
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export function ClubsScreen() {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [discoverClubs, setDiscoverClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);

  const fetchClubs = useCallback(async () => {
    if (!supabaseUserId) return;
    try {
      // My memberships
      const { data: memberRows } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', supabaseUserId);
      const myIds = (memberRows ?? []).map((r: any) => r.club_id);

      // All public clubs
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
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabaseUserId]);

  useEffect(() => { fetchClubs(); }, [fetchClubs]);

  const handleRefresh = () => { setRefreshing(true); fetchClubs(); };

  const handleJoin = async (clubId: string) => {
    if (!supabaseUserId || joiningId) return;
    setJoiningId(clubId);
    try {
      await supabase.from('club_members').insert({ club_id: clubId, user_id: supabaseUserId, role: 'member' });
      await Promise.resolve(supabase.rpc('increment_club_members', { p_club_id: clubId })).catch(() => {
        // RPC may not exist yet; member_count updated server-side by trigger
      });
      fetchClubs();
    } catch { /* silent */ }
    finally { setJoiningId(null); }
  };

  const handleClubCreated = (club: Club) => {
    setCreateVisible(false);
    fetchClubs();
    navigation.navigate('ClubDetailScreen', { club });
  };

  const navigateToClub = (club: Club) => {
    navigation.navigate('ClubDetailScreen', { club });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  const sections = [
    { key: 'my', title: 'My Clubs', data: myClubs },
    { key: 'discover', title: 'Discover', data: discoverClubs },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Clubs</Text>
        <TouchableOpacity
          style={styles.createClubBtn}
          onPress={() => setCreateVisible(true)}
          activeOpacity={0.85}
        >
          <Plus size={16} color="#fff" />
          <Text style={styles.createClubBtnText}>Create Club</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => ''}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} />}
        ListHeaderComponent={
          <>
            {sections.map(section => (
              <View key={section.key}>
                <Text style={styles.sectionHeader}>{section.title}</Text>
                {section.data.length === 0 ? (
                  <View style={styles.emptySection}>
                    <Users size={28} color={TEXT_SECONDARY} />
                    {section.key === 'my' ? (
                      <>
                        <Text style={styles.emptyTitle}>No clubs yet</Text>
                        <Text style={styles.emptySub}>Create or join one below</Text>
                      </>
                    ) : (
                      <Text style={styles.emptyTitle}>No clubs to discover</Text>
                    )}
                  </View>
                ) : (
                  section.data.map(club => (
                    <ClubCard
                      key={club.id}
                      club={club}
                      isMember={section.key === 'my'}
                      onPress={() => navigateToClub(club)}
                      onJoin={handleJoin}
                      joining={joiningId === club.id}
                    />
                  ))
                )}
              </View>
            ))}
          </>
        }
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      />

      <CreateClubModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={handleClubCreated}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  createClubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  createClubBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sectionHeader: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptySub: { color: TEXT_SECONDARY, fontSize: 13 },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  clubAvatarFallback: {
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clubInfo: { flex: 1 },
  clubName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  clubMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  joinBtn: {
    backgroundColor: ORANGE,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 54,
    alignItems: 'center',
  },
  joinBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  joinedPill: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.4)',
  },
  joinedText: { color: ORANGE, fontSize: 12, fontWeight: '600' },
});
