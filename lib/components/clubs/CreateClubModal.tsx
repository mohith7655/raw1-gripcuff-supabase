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
import { Lock, Image as ImageIcon, X as XIcon, MapPin, Plus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useAuth } from '../../providers/AuthContext';
import { supabase } from '../../core/config/supabase';

const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const RED = '#ef4444';

const CATEGORIES = ['Walking', 'Jogging', 'Running', 'Stretching', 'Injury Rehab', 'Yoga', 'Pilates', 'Swimming', 'Cycling', 'CrossFit', 'Calisthenics', 'Martial Arts', 'Weight Lifting'];
const AGE_MIN = 13;
const AGE_MAX = 80;
const THUMB_SIZE = 26;

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
const PLACES_PROXY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_WEB_PROXY_URL ?? '/api/maps';

export interface ClubLocation {
  label: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
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
  const lowRef = useRef(low);
  const highRef = useRef(high);
  lowRef.current = low;
  highRef.current = high;
  const lowStartPos = useRef(0);
  const highStartPos = useRef(0);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const posFromAge = (age: number) =>
    trackWidth.current > 0
      ? ((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * trackWidth.current
      : 0;

  const ageFromPos = (pos: number) =>
    Math.round(clamp((pos / trackWidth.current) * (AGE_MAX - AGE_MIN) + AGE_MIN, AGE_MIN, AGE_MAX));

  const lowPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { lowStartPos.current = posFromAge(lowRef.current); },
      onPanResponderMove: (_, gs) => {
        const newPos = clamp(lowStartPos.current + gs.dx, 0, trackWidth.current);
        onChange(Math.min(ageFromPos(newPos), highRef.current - 1), highRef.current);
      },
    })
  ).current;

  const highPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { highStartPos.current = posFromAge(highRef.current); },
      onPanResponderMove: (_, gs) => {
        const newPos = clamp(highStartPos.current + gs.dx, 0, trackWidth.current);
        onChange(lowRef.current, Math.max(ageFromPos(newPos), lowRef.current + 1));
      },
    })
  ).current;

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
        <View style={sliderStyles.track} />
        <View style={[sliderStyles.fill, { left: `${lowPct}%` as any, right: `${100 - highPct}%` as any }]} />
        <View style={[sliderStyles.thumb, { left: `${lowPct}%` as any, marginLeft: -(THUMB_SIZE / 2) }]} {...lowPan.panHandlers} />
        <View style={[sliderStyles.thumb, { left: `${highPct}%` as any, marginLeft: -(THUMB_SIZE / 2) }]} {...highPan.panHandlers} />
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
  track: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: ORANGE },
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

// ── Location card with embedded map ──────────────────────────────────────────

function LocationCard({ loc, onRemove }: { loc: ClubLocation; onRemove: () => void }) {
  const hasCoords = loc.lat !== 0 && loc.lng !== 0;
  const embedUrl =
    `https://www.google.com/maps/embed/v1/place` +
    `?key=${PLACES_API_KEY}` +
    `&q=${hasCoords ? `${loc.lat},${loc.lng}` : encodeURIComponent(loc.address)}` +
    `&zoom=15`;

  return (
    <View style={locStyles.card}>
      <View style={locStyles.cardHeader}>
        <MapPin size={14} color={ORANGE} />
        <Text style={locStyles.cardLabel} numberOfLines={1}>{loc.label}</Text>
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <XIcon size={16} color={TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>
      <Text style={locStyles.cardAddress} numberOfLines={2}>{loc.address}</Text>
      <View style={locStyles.mapWrap}>
        {/* @ts-ignore — iframe is valid on web */}
        <iframe
          src={embedUrl}
          width="100%"
          height="160"
          style={{ border: 0, borderRadius: 8, display: 'block' } as any}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </View>
    </View>
  );
}

const locStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,107,0,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.2)',
    padding: 12,
    marginTop: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardLabel: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
  cardAddress: { color: TEXT_SECONDARY, fontSize: 12, marginBottom: 10 },
  mapWrap: { height: 160, borderRadius: 8, overflow: 'hidden' } as any,
});

// ── Main modal ────────────────────────────────────────────────────────────────

interface CreateClubModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (club: any) => void;
}

export function CreateClubModal({ visible, onClose, onCreated }: CreateClubModalProps) {
  const { supabaseUserId } = useAuth();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ageLow, setAgeLow] = useState(16);
  const [ageHigh, setAgeHigh] = useState(50);

  const [locations, setLocations] = useState<ClubLocation[]>([]);

  const canCreate = name.trim().length > 0 && !creating;

  const resetForm = () => {
    setName(''); setCategory('General'); setDescription('');
    setAvatarUri(null); setIsPrivate(false); setError(null);
    setAgeLow(16); setAgeHigh(50); setLocations([]);
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
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const addLocation = (loc: ClubLocation) => {
    if (locations.find(l => l.placeId === loc.placeId)) return;
    setLocations(prev => [...prev, loc]);
  };

  const removeLocation = (placeId: string) => {
    setLocations(prev => prev.filter(l => l.placeId !== placeId));
  };

  const handleCreate = useCallback(async () => {
    if (!canCreate || !supabaseUserId) return;
    setCreating(true);
    setError(null);

    try {
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

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {/* Avatar */}
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
          <View style={styles.locationHeader}>
            <MapPin size={14} color={TEXT_SECONDARY} />
            <Text style={styles.fieldLabel}>Locations</Text>
          </View>

          <View style={styles.locationSection}>
            {/* Added location cards */}
            {locations.map(loc => (
              <LocationCard
                key={loc.placeId}
                loc={loc}
                onRemove={() => removeLocation(loc.placeId)}
              />
            ))}

            {/* + Add location label + input, grouped so label stays above input */}
            <View style={styles.addLocationBlock}>
              <View style={styles.addLocationRow}>
                <View style={styles.addLocationIconWrap}>
                  <Plus size={16} color="#fff" />
                </View>
                <Text style={styles.addLocationLabel}>Add location</Text>
              </View>
              <GooglePlacesAutocomplete
                placeholder="Search city, gym, or address…"
                fetchDetails
                minLength={2}
                debounce={300}
                query={{ key: PLACES_API_KEY, language: 'en' }}
                requestUrl={{ useOnPlatform: 'web', url: PLACES_PROXY }}
                onPress={(data, details) => {
                  const label = details?.name || data.description.split(',')[0]?.trim() || data.description;
                  addLocation({
                    label,
                    address: details?.formatted_address || data.description,
                    lat: details?.geometry?.location?.lat ?? 0,
                    lng: details?.geometry?.location?.lng ?? 0,
                    placeId: data.place_id,
                  });
                }}
                styles={{
                  container: styles.placesContainer as any,
                  textInputContainer: styles.placesInputContainer,
                  textInput: styles.placesInput,
                  listView: styles.placesListView as any,
                  row: styles.placesRow,
                  description: styles.placesDescription,
                  separator: styles.placesSeparator,
                }}
                textInputProps={{ placeholderTextColor: TEXT_SECONDARY }}
                enablePoweredByContainer={false}
                keepResultsAfterBlur={false}
              />
            </View>
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

  scrollContent: { padding: 16, paddingBottom: 60 },

  avatarPicker: {
    width: 90, height: 90, borderRadius: 45,
    alignSelf: 'center', marginBottom: 20, overflow: 'hidden',
  },
  avatarImg: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: CARD_BG,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 4,
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
  charCount: { color: TEXT_SECONDARY, fontSize: 11, textAlign: 'right' },

  categoryRow: { marginBottom: 4 },
  categoryPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginRight: 8,
  },
  categoryPillActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  categoryPillText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  categoryPillTextActive: { color: '#fff' },

  sectionCard: {
    backgroundColor: CARD_BG, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16, paddingVertical: 16,
  },

  // Locations section
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 6,
  },
  locationSection: { zIndex: 100 } as any,
  addLocationBlock: {
    marginTop: 12,
    zIndex: 100,
  } as any,
  addLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  addLocationIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLocationLabel: {
    color: ORANGE,
    fontSize: 13,
    fontWeight: '700',
  },

  placesContainer: {
    zIndex: 100,
    backgroundColor: 'transparent',
  },
  placesInputContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  placesInput: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: 44,
    outlineStyle: 'none',
  } as any,
  placesListView: {
    backgroundColor: '#1a2740',
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#1e2d40',
    zIndex: 200,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  } as any,
  placesRow: { backgroundColor: 'transparent', paddingVertical: 12, paddingHorizontal: 14 },
  placesDescription: { color: '#fff', fontSize: 14 },
  placesSeparator: { height: 1, backgroundColor: '#1e2d40' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20,
    backgroundColor: CARD_BG, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  toggleLabel: { flex: 1, color: '#fff', fontSize: 15 },
  errorText: { color: RED, fontSize: 13, marginTop: 12, textAlign: 'center' },
});
