import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { ArrowLeft, Lock, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '../../providers/UserContext';
import { useAuth } from '../../providers/AuthContext';
import { CreditService } from '../../services/credit.service';
import { supabase } from '../../core/config/supabase';
import { BuyCreditsModal } from '../credits/BuyCreditsModal';

const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const RED = '#ef4444';
const CLUB_COST = 10;

const CATEGORIES = ['Powerlifting', 'Calisthenics', 'Running', 'CrossFit', 'Martial Arts', 'Yoga', 'General'];

function RBadge() {
  return (
    <View style={styles.rBadge}>
      <Text style={styles.rText}>R</Text>
    </View>
  );
}

interface CreateClubModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (club: any) => void;
}

export function CreateClubModal({ visible, onClose, onCreated }: CreateClubModalProps) {
  const { profile } = useUser();
  const { supabaseUserId } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyVisible, setBuyVisible] = useState(false);

  const credits = profile?.credits ?? 0;
  const hasEnough = credits >= CLUB_COST;
  const canCreate = name.trim().length > 0 && hasEnough && !creating;

  const resetForm = () => {
    setName(''); setCategory('General'); setDescription('');
    setAvatarUri(null); setIsPrivate(false); setError(null);
  };

  const handleClose = () => {
    if (creating) return;
    resetForm();
    onClose();
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleCreate = useCallback(async () => {
    if (!canCreate || !supabaseUserId) return;
    setCreating(true);
    setError(null);

    try {
      // Spend credits
      const spent = await CreditService.spendCredits(
        supabaseUserId,
        CLUB_COST,
        `Created club: ${name.trim()}`,
      );
      if (!spent) {
        setError('Insufficient credits');
        setCreating(false);
        return;
      }

      // Upload avatar if selected
      let avatarUrl: string | null = null;
      if (avatarUri) {
        const response = await fetch(avatarUri);
        const blob = await response.blob();
        const ext = avatarUri.split('.').pop() ?? 'jpg';
        const path = `${supabaseUserId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('club-avatars')
          .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('club-avatars').getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }

      // Insert club
      const { data: club, error: clubErr } = await supabase
        .from('clubs')
        .insert({
          name: name.trim(),
          category,
          description: description.trim() || null,
          avatar_url: avatarUrl,
          is_private: isPrivate,
          owner_id: supabaseUserId,
          member_count: 1,
        })
        .select()
        .single();
      if (clubErr || !club) throw clubErr ?? new Error('Failed to create club');

      // Add creator as owner member
      await supabase.from('club_members').insert({
        club_id: club.id,
        user_id: supabaseUserId,
        role: 'owner',
      });

      resetForm();
      onCreated(club);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create club');
    } finally {
      setCreating(false);
    }
  }, [canCreate, supabaseUserId, name, category, description, avatarUri, isPrivate, onCreated]);

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} disabled={creating} style={styles.headerBtn} activeOpacity={0.7}>
              <Text style={[styles.cancelText, creating && { opacity: 0.4 }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Club</Text>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={!canCreate}
              style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
              activeOpacity={0.85}
            >
              {creating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.createBtnText}>Create</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Cost banner */}
          <View style={[styles.costBanner, !hasEnough && styles.costBannerWarn]}>
            <RBadge />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.costTitle}>Creating a club costs {CLUB_COST} credits</Text>
              <Text style={[styles.costSub, !hasEnough && { color: RED }]}>
                You have {credits} credits
                {!hasEnough ? ' — not enough' : ''}
              </Text>
            </View>
            {!hasEnough && (
              <TouchableOpacity onPress={() => setBuyVisible(true)} style={styles.buyLink} activeOpacity={0.8}>
                <Text style={styles.buyLinkText}>Buy Credits</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Avatar picker */}
            <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar} activeOpacity={0.8}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                : (
                  <View style={styles.avatarPlaceholder}>
                    <ImageIcon size={28} color={TEXT_SECONDARY} />
                    <Text style={styles.avatarPlaceholderText}>Add photo</Text>
                  </View>
                )
              }
            </TouchableOpacity>

            {/* Name */}
            <Text style={styles.fieldLabel}>Club Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter club name"
              placeholderTextColor={TEXT_SECONDARY}
              value={name}
              onChangeText={setName}
              maxLength={40}
              autoFocus
            />
            <Text style={styles.charCount}>{name.length}/40</Text>

            {/* Category */}
            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, category === cat && styles.categoryPillActive]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryPillText, category === cat && styles.categoryPillTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Description */}
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="What's this club about? (optional)"
              placeholderTextColor={TEXT_SECONDARY}
              value={description}
              onChangeText={setDescription}
              maxLength={200}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/200</Text>

            {/* Private toggle */}
            <View style={styles.toggleRow}>
              <Lock size={18} color={TEXT_SECONDARY} />
              <Text style={styles.toggleLabel}>Private club</Text>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: ORANGE }}
                thumbColor="#fff"
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>
        </View>
      </Modal>

      <BuyCreditsModal
        visible={buyVisible}
        onClose={() => setBuyVisible(false)}
        onPurchased={() => setBuyVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerBtn: { minWidth: 60 },
  cancelText: { color: TEXT_SECONDARY, fontSize: 15 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  createBtn: {
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    minWidth: 70,
    alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  costBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,0,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,107,0,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  costBannerWarn: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderBottomColor: 'rgba(239,68,68,0.2)',
  },
  costTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  costSub: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  buyLink: {
    backgroundColor: ORANGE,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  buyLinkText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  scrollContent: { padding: 16, paddingBottom: 40 },
  avatarPicker: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignSelf: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  avatarImg: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  avatarPlaceholderText: { color: TEXT_SECONDARY, fontSize: 11 },
  fieldLabel: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { color: TEXT_SECONDARY, fontSize: 11, textAlign: 'right', marginTop: 4 },
  categoryRow: { marginBottom: 4 },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  categoryPillActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  categoryPillText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  categoryPillTextActive: { color: '#fff' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
    backgroundColor: CARD_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toggleLabel: { flex: 1, color: '#fff', fontSize: 15 },
  errorText: { color: RED, fontSize: 13, marginTop: 12, textAlign: 'center' },
  rBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
  rText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
