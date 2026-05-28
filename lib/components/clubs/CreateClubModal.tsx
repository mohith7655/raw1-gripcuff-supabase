import React, { useState, useCallback, useRef } from 'react';
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
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { Lock, Image as ImageIcon, Plus, X as XIcon, MapPin } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../providers/AuthContext';
import { supabase } from '../../core/config/supabase';

const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const RED = '#ef4444';

const CATEGORIES = ['Powerlifting', 'Calisthenics', 'Running', 'CrossFit', 'Martial Arts', 'Yoga', 'General'];
const AGE_MIN = 13;
const AGE_MAX = 80;
const THUMB_SIZE = 26;

interface CreateClubModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (club: any) => void;
}

// ── Dual-handle age range slider ─────────────────────────────────────────────

function AgeRangeSlider({
  low,
  high,
  onChange,
}: {
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
}) {
  const trackWidth = useRef(0);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const posFromAge = (age: number) =>
    trackWidth.current > 0
      ? ((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * trackWidth.current
      : 0;

  const ageFromPos = (pos: number) =>
    Math.round(clamp((pos / trackWidth.current) * (AGE_MAX - AGE_MIN) + AGE_MIN, AGE_MIN, AGE_MAX));

  const makePan = (which: 'low' | 'high') =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        const basePos = posFromAge(which === 'low' ? low : high);
        const newPos = clamp(basePos + gs.dx, 0, trackWidth.current);
        const newAge = ageFromPos(newPos);
        if (which === 'low') {
          onChange(Math.min(newAge, high - 1), high);
        } else {
          onChange(low, Math.max(newAge, low + 1));
        }
      },
    });

  const lowPan = useRef(makePan('low')).current;
  const highPan = useRef(makePan('high')).current;

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const lowPct = ((low - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100;
  const highPct = ((high - AGE_MIN) / (AGE_MAX - AGE_MIN)) * 100;

  return (
    <View style={sliderStyles.wrapper}>
      <View style={sliderStyles.labelRow}>
        <Text style={sliderStyles.labelVal}>{low}</Text>
        <Text style={sliderStyles.labelSep}>–</Text>
        <Text style={sliderStyles.labelVal}>{high}</Text>
        <Text style={sliderStyles.labelUnit}>yrs</Text>
      </View>

      <View style={sliderStyles.trackArea} onLayout={onLayout}>
        {/* Full track */}
        <View style={sliderStyles.track} />
        {/* Active range fill */}
        <View
          style={[
            sliderStyles.fill,
            { left: `${lowPct}%` as any, right: `${100 - highPct}%` as any },
          ]}
        />
        {/* Low thumb */}
        <View
          style={[sliderStyles.thumb, { left: `${lowPct}%` as any, marginLeft: -(THUMB_SIZE / 2) }]}
          {...lowPan.panHandlers}
        />
        {/* High thumb */}
        <View
          style={[sliderStyles.thumb, { left: `${highPct}%` as any, marginLeft: -(THUMB_SIZE / 2) }]}
          {...highPan.panHandlers}
        />
      </View>

      <View style={sliderStyles.boundRow}>
        <Text style={sliderStyles.boundLabel}>{AGE_MIN}</Text>
        <Text style={sliderStyles.boundLabel}>{AGE_MAX}+</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrapper: { marginTop: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 14 },
  labelVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
  labelSep: { color: TEXT_SECONDARY, fontSize: 16 },
  labelUnit: { color: TEXT_SECONDARY, fontSize: 13, marginLeft: 2 },
  trackArea: {
    height: THUMB_SIZE,
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: THUMB_SIZE / 2,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  fill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: ORANGE,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: ORANGE,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  boundRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  boundLabel: { color: TEXT_SECONDARY, fontSize: 11 },
});

// ── Main modal ────────────────────────────────────────────────────────────────

export function CreateClubModal({ visible, onClose, onCreated }: CreateClubModalProps) {
  const { supabaseUserId } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Age range
  const [ageLow, setAgeLow] = useState(16);
  const [ageHigh, setAgeHigh] = useState(50);

  // Locations
  const [locations, setLocations] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState('');

  const canCreate = name.trim().length > 0 && !creating;

  const resetForm = () => {
    setName(''); setCategory('General'); setDescription('');
    setAvatarUri(null); setIsPrivate(false); setError(null);
    setAgeLow(16); setAgeHigh(50);
    setLocations([]); setLocationInput('');
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

  const addLocation = () => {
    const val = locationInput.trim();
    if (!val || locations.includes(val)) return;
    setLocations(prev => [...prev, val]);
    setLocationInput('');
  };

  const removeLocation = (loc: string) => {
    setLocations(prev => prev.filter(l => l !== loc));
  };

  const handleCreate = useCallback(async () => {
    if (!canCreate || !supabaseUserId) return;
    setCreating(true);
    setError(null);

    try {
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
          age_min: ageLow,
          age_max: ageHigh,
          locations: locations.length > 0 ? locations : null,
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
  }, [canCreate, supabaseUserId, name, category, description, avatarUri, isPrivate, ageLow, ageHigh, locations, onCreated]);

  return (
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

          {/* Age Range */}
          <Text style={styles.fieldLabel}>Age Group Allowed</Text>
          <View style={styles.sectionCard}>
            <AgeRangeSlider
              low={ageLow}
              high={ageHigh}
              onChange={(l, h) => { setAgeLow(l); setAgeHigh(h); }}
            />
          </View>

          {/* Locations */}
          <Text style={styles.fieldLabel}>Locations</Text>
          <View style={styles.sectionCard}>
            <View style={styles.locationInputRow}>
              <MapPin size={16} color={TEXT_SECONDARY} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.locationInput}
                placeholder="Add a city or location"
                placeholderTextColor={TEXT_SECONDARY}
                value={locationInput}
                onChangeText={setLocationInput}
                onSubmitEditing={addLocation}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={addLocation}
                style={[styles.addLocBtn, !locationInput.trim() && styles.addLocBtnDisabled]}
                disabled={!locationInput.trim()}
                activeOpacity={0.8}
              >
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            {locations.length > 0 && (
              <View style={styles.locationTags}>
                {locations.map(loc => (
                  <View key={loc} style={styles.locationTag}>
                    <MapPin size={12} color={ORANGE} />
                    <Text style={styles.locationTagText}>{loc}</Text>
                    <TouchableOpacity onPress={() => removeLocation(loc)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <XIcon size={13} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

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

  scrollContent: { padding: 16, paddingBottom: 48 },

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

  sectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  // Location
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 4,
  },
  addLocBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addLocBtnDisabled: { opacity: 0.35 },
  locationTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,107,0,0.12)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  locationTagText: { color: '#fff', fontSize: 13 },

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
});
