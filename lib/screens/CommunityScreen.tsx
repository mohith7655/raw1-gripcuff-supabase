/**
 * CommunityScreen — shows community activities for the logged-in user.
 * Tapping the Community chevron in ProfileScreen navigates here.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, HeartHandshake, Plus, X } from 'lucide-react-native';
import { useAuth } from '../providers/AuthContext';
import { supabase } from '../core/config/supabase';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:           '#0d1520',
  bgCard:       'rgba(255,255,255,0.04)',
  bgInput:      'rgba(255,255,255,0.06)',
  border:       'rgba(255,255,255,0.06)',
  orange:       '#ff7a00',
  accentSoft:   'rgba(255,122,0,0.12)',
  accentBorder: 'rgba(255,122,0,0.28)',
  text:         '#ffffff',
  muted:        '#9ca3af',
  modalBg:      '#111d2c',
};

type Activity = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// ── Activity row ───────────────────────────────────────────────────────────────
function ActivityRow({ item }: { item: Activity }) {
  return (
    <View style={s.activityCard}>
      <View style={s.activityIconBox}>
        <HeartHandshake size={20} color={C.orange} strokeWidth={2.2} />
      </View>
      <View style={s.activityBody}>
        <Text style={s.activityTitle}>{item.title}</Text>
        {!!item.description && (
          <Text style={s.activityDesc} numberOfLines={2}>{item.description}</Text>
        )}
        <Text style={s.activityDate}>{formatDate(item.created_at)}</Text>
      </View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function CommunityScreen() {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [newTitle,   setNewTitle]   = useState('');
  const [newDesc,    setNewDesc]    = useState('');

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!supabaseUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('community_activities')
        .select('*')
        .eq('user_id', supabaseUserId)
        .order('created_at', { ascending: false });

      if (!error && data) setActivities(data as Activity[]);
    } catch {}
    finally { setLoading(false); }
  }, [supabaseUserId]);

  useEffect(() => { load(); }, [load]);

  // ── Add activity ──────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!supabaseUserId || !newTitle.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('community_activities')
        .insert({
          user_id: supabaseUserId,
          title: newTitle.trim(),
          description: newDesc.trim() || null,
        });

      if (error) throw error;
      setNewTitle('');
      setNewDesc('');
      setModalOpen(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not add activity.');
    } finally {
      setSaving(false);
    }
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  const EmptyState = () => (
    <View style={s.empty}>
      <View style={s.emptyIconBox}>
        <HeartHandshake size={40} color={C.orange} strokeWidth={1.8} />
      </View>
      <Text style={s.emptyTitle}>No community activities yet</Text>
      <Text style={s.emptyDesc}>
        Add your volunteer work and community participation to share with your network.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <ArrowLeft size={22} color={C.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Community</Text>
        <TouchableOpacity
          style={s.addIconBtn}
          onPress={() => setModalOpen(true)}
          activeOpacity={0.8}
        >
          <Plus size={20} color={C.orange} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator color={C.orange} style={s.loader} />
      ) : (
        <FlatList
          data={activities}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ActivityRow item={item} />}
          ListEmptyComponent={<EmptyState />}
          contentContainerStyle={[s.list, activities.length === 0 && s.listCentered]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── ADD BUTTON (fixed bottom) ─────────────────────────────────────── */}
      {!loading && (
        <View style={s.fabWrap}>
          <TouchableOpacity
            style={s.fab}
            onPress={() => setModalOpen(true)}
            activeOpacity={0.86}
          >
            <Plus size={22} color="#000" strokeWidth={2.5} />
            <Text style={s.fabText}>Add Activity</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── ADD MODAL ─────────────────────────────────────────────────────── */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={s.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalOpen(false)}
          />
          <View style={s.modalSheet}>
            {/* Modal header */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add Activity</Text>
              <TouchableOpacity onPress={() => setModalOpen(false)} style={s.modalClose}>
                <X size={20} color={C.muted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Title input */}
            <Text style={s.inputLabel}>Title</Text>
            <TextInput
              style={s.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. Volunteered at community run"
              placeholderTextColor={C.muted}
              maxLength={100}
            />

            {/* Description input */}
            <Text style={s.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Tell others what you did..."
              placeholderTextColor={C.muted}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            {/* Save button */}
            <TouchableOpacity
              style={[s.saveBtn, (!newTitle.trim() || saving) && s.saveBtnDisabled]}
              onPress={handleAdd}
              disabled={!newTitle.trim() || saving}
              activeOpacity={0.86}
            >
              {saving
                ? <ActivityIndicator size="small" color="#000" />
                : <Text style={s.saveBtnText}>Save Activity</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  addIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '700', color: C.text,
  },

  loader: { marginTop: 60 },

  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
    gap: 12,
  },
  listCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Activity card
  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  activityIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accentBorder,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  activityBody: { flex: 1 },
  activityTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  activityDesc:  { color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  activityDate:  { color: C.muted, fontSize: 11, marginTop: 6, opacity: 0.7 },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accentBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyDesc:  {
    color: C.muted, fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginTop: 10,
  },

  // FAB
  fabWrap: {
    position: 'absolute', left: 16, right: 16,
    bottom: Platform.OS === 'ios' ? 36 : 20,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 15,
  },
  fabText: { color: '#000', fontSize: 15, fontWeight: '800' },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    backgroundColor: C.modalBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18, fontWeight: '800', color: C.text,
  },
  modalClose: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 11, fontWeight: '800', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.bgInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  inputMulti: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
