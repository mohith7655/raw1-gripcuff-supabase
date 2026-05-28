import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Users } from 'lucide-react-native';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';
import type { Club } from './ClubsScreen';

const { width: SW } = Dimensions.get('window');
const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const COVER_HEIGHT = 200;

type Tab = 'posts' | 'members';

interface Member {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  profiles: { full_name: string | null; avatar_url: string | null };
}

function RoleBadge({ role }: { role: string }) {
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  if (!isOwner && !isAdmin) return null;
  return (
    <View style={[styles.roleBadge, isOwner && styles.roleBadgeOwner]}>
      <Text style={styles.roleBadgeText}>{isOwner ? 'Owner' : 'Admin'}</Text>
    </View>
  );
}

export function ClubDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const club: Club = route.params?.club;
  const { supabaseUserId } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const isMember = myRole !== null;
  const isOwner = myRole === 'owner';

  const fetchMyMembership = useCallback(async () => {
    if (!supabaseUserId) return;
    const { data } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', club.id)
      .eq('user_id', supabaseUserId)
      .maybeSingle();
    setMyRole(data?.role ?? null);
  }, [club.id, supabaseUserId]);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    const { data } = await supabase
      .from('club_members')
      .select('user_id, role, profiles:user_id (full_name, avatar_url)')
      .eq('club_id', club.id)
      .order('role', { ascending: true });
    setMembers((data ?? []) as unknown as Member[]);
    setLoadingMembers(false);
  }, [club.id]);

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    const { data } = await supabase
      .from('posts')
      .select('id, caption, created_at, profiles:user_id (full_name, avatar_url)')
      .eq('club_id', club.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(20);
    setPosts(data ?? []);
    setLoadingPosts(false);
  }, [club.id]);

  useEffect(() => {
    fetchMyMembership();
    fetchMembers();
    fetchPosts();
  }, [fetchMyMembership, fetchMembers, fetchPosts]);

  const handleJoin = async () => {
    if (!supabaseUserId || joining) return;
    setJoining(true);
    try {
      await supabase.from('club_members').insert({ club_id: club.id, user_id: supabaseUserId, role: 'member' });
      setMyRole('member');
      fetchMembers();
    } catch { /* silent */ }
    finally { setJoining(false); }
  };

  const handleLeave = async () => {
    if (!supabaseUserId || isOwner || joining) return;
    setJoining(true);
    try {
      await supabase.from('club_members').delete().eq('club_id', club.id).eq('user_id', supabaseUserId);
      setMyRole(null);
      fetchMembers();
    } catch { /* silent */ }
    finally { setJoining(false); }
  };

  const renderMember = ({ item }: { item: Member }) => {
    const name = item.profiles?.full_name ?? 'User';
    const avatar = item.profiles?.avatar_url;
    return (
      <View style={styles.memberRow}>
        <View style={styles.memberAvatar}>
          {avatar
            ? <Image source={{ uri: avatar }} style={styles.memberAvatarImg} />
            : <Text style={styles.memberAvatarInitial}>{name.charAt(0).toUpperCase()}</Text>
          }
        </View>
        <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
        <RoleBadge role={item.role} />
      </View>
    );
  };

  const renderPost = ({ item }: { item: any }) => {
    const name = item.profiles?.full_name ?? 'User';
    return (
      <View style={styles.postCard}>
        <Text style={styles.postAuthor}>{name}</Text>
        {item.caption && <Text style={styles.postCaption}>{item.caption}</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Cover */}
      <View style={styles.cover}>
        {club.avatar_url
          ? <Image source={{ uri: club.avatar_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, styles.coverGradient]} />
        }
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        {!isOwner && (
          <TouchableOpacity
            style={isMember ? styles.leaveBtn : styles.joinBtnLarge}
            onPress={isMember ? handleLeave : handleJoin}
            disabled={joining}
            activeOpacity={0.85}
          >
            {joining
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.joinLeaveBtnText}>{isMember ? 'Leave' : 'Join'}</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Club info */}
      <View style={styles.clubHeader}>
        <View style={styles.clubAvatarWrap}>
          {club.avatar_url
            ? <Image source={{ uri: club.avatar_url }} style={styles.clubAvatar} />
            : (
              <View style={[styles.clubAvatar, styles.clubAvatarFallback]}>
                <Text style={styles.clubAvatarInitial}>{club.name.charAt(0).toUpperCase()}</Text>
              </View>
            )
          }
        </View>
        <Text style={styles.clubName}>{club.name}</Text>
        <View style={styles.clubMeta}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{club.category}</Text>
          </View>
          <Text style={styles.memberCount}>
            <Users size={12} color={TEXT_SECONDARY} /> {club.member_count} members
          </Text>
        </View>
        {club.description && <Text style={styles.clubDesc}>{club.description}</Text>}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {(['posts', 'members'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'posts' ? (
        loadingPosts ? (
          <View style={styles.center}><ActivityIndicator color={ORANGE} /></View>
        ) : posts.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No posts yet in this club.</Text>
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={renderPost}
            contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : (
        loadingMembers ? (
          <View style={styles.center}><ActivityIndicator color={ORANGE} /></View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={item => item.user_id}
            renderItem={renderMember}
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  cover: {
    height: COVER_HEIGHT,
    backgroundColor: '#0a1520',
    position: 'relative',
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  coverGradient: { backgroundColor: '#0d1825' },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  joinBtnLarge: {
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  leaveBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  joinLeaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  clubHeader: { paddingHorizontal: 16, paddingBottom: 12 },
  clubAvatarWrap: { marginTop: -32, marginBottom: 8 },
  clubAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: BG },
  clubAvatarFallback: { backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  clubAvatarInitial: { color: '#fff', fontSize: 24, fontWeight: '800' },
  clubName: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  clubMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  categoryPill: {
    backgroundColor: 'rgba(255,107,0,0.15)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryPillText: { color: ORANGE, fontSize: 12, fontWeight: '600' },
  memberCount: { color: TEXT_SECONDARY, fontSize: 12 },
  clubDesc: { color: TEXT_SECONDARY, fontSize: 13, lineHeight: 18 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: ORANGE },
  tabBtnText: { color: TEXT_SECONDARY, fontSize: 14, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14 },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  memberAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#2a3a4a',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  memberAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  memberAvatarInitial: { color: '#fff', fontSize: 15, fontWeight: '700' },
  memberName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  roleBadgeOwner: { backgroundColor: 'rgba(255,107,0,0.2)' },
  roleBadgeText: { color: ORANGE, fontSize: 11, fontWeight: '700' },

  postCard: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  postAuthor: { color: ORANGE, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  postCaption: { color: '#E2E8F0', fontSize: 14, lineHeight: 20 },
});
