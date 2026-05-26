/**
 * LookingToMeetEditScreen — Screen 4.
 *
 * Focused editor for connection intent:
 *   • "I'm open to" 3-card selector (Both / Social / Professional)
 *   • "What are you looking for?" chip grid
 *   • "Preferred location" → city via Google Places
 *   • "Age groups" chip grid (open_to_train_age_groups)
 *   • "Bio" text input
 *
 * Saves via SocialProfileService.update() — same backend, focused UI.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Briefcase,
  Check,
  MapPin,
  Users,
  UserCheck,
} from 'lucide-react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useAuth } from '../providers/AuthContext';
import { SocialProfileService } from '../services/socialProfile.service';
import {
  LookingToMeet,
  ConnectionGoal,
  AgeGroup,
  ALL_CONNECTION_GOALS,
  ALL_AGE_GROUPS,
  CONNECTION_GOAL_META,
  AGE_GROUP_META,
} from '../models/SocialProfile';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:           '#0d1520',
  bgCard:       '#0f1923',
  bgInput:      'rgba(255,255,255,0.05)',
  orange:       '#ff7a00',
  accentSoft:   'rgba(255,122,0,0.12)',
  accentBorder: 'rgba(255,122,0,0.28)',
  green:        '#22c55e',
  greenSoft:    'rgba(34,197,94,0.1)',
  greenBorder:  'rgba(34,197,94,0.28)',
  text:         '#ffffff',
  muted:        '#94a3b8',
  dim:          '#64748b',
  border:       'rgba(255,255,255,0.08)',
};

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
const GOOGLE_PLACES_WEB_PROXY_URL =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_WEB_PROXY_URL ??
  'https://corsproxy.io/?https://maps.googleapis.com/maps/api';
const GOOGLE_PLACES_REQUEST_URL =
  Platform.OS === 'web' ? GOOGLE_PLACES_WEB_PROXY_URL : 'https://maps.googleapis.com/maps/api';

const OPEN_TO_OPTIONS = [
  {
    id: 'both'         as LookingToMeet,
    label: 'Both',
    caption: 'Social & Professional',
    icon: UserCheck,
  },
  {
    id: 'social'       as LookingToMeet,
    label: 'Social',
    caption: 'Make friends, workout buddies',
    icon: Users,
  },
  {
    id: 'professional' as LookingToMeet,
    label: 'Professional',
    caption: 'Network, learn & grow',
    icon: Briefcase,
  },
];

// ── Tiny components ────────────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return <Text style={s.sectionLabel}>{text}</Text>;
}

function ToggleChip<T extends string>({
  value, selected, label, onToggle, tone = 'orange',
}: { value: T; selected: boolean; label: string; onToggle: (v: T) => void; tone?: 'orange' | 'green' }) {
  const activeBg     = tone === 'green' ? C.greenSoft   : C.accentSoft;
  const activeBorder = tone === 'green' ? C.greenBorder : C.accentBorder;
  const activeColor  = tone === 'green' ? C.green       : C.orange;
  return (
    <TouchableOpacity
      style={[s.chip, selected && { backgroundColor: activeBg, borderColor: activeBorder }]}
      onPress={() => onToggle(value)}
      activeOpacity={0.72}
    >
      {selected && <Check size={12} color={activeColor} strokeWidth={2.5} />}
      <Text style={[s.chipText, selected && { color: activeColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function LookingToMeetEditScreen() {
  const navigation  = useNavigation<any>();
  const { supabaseUserId } = useAuth();

  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [lookingToMeet, setLookingToMeet] = useState<LookingToMeet>('both');
  const [goals,         setGoals]         = useState<Set<ConnectionGoal>>(new Set());
  const [city,          setCity]          = useState('');
  const [cityPlaceId,   setCityPlaceId]   = useState<string | null>(null);
  const [ageGroups,     setAgeGroups]     = useState<Set<AgeGroup>>(new Set());
  const [bio,           setBio]           = useState('');

  // ── Load existing data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseUserId) return;
    SocialProfileService.get(supabaseUserId)
      .then(sp => {
        if (!sp) return;
        setLookingToMeet(sp.lookingToMeet ?? 'both');
        setGoals(new Set(sp.connectionGoals ?? []));
        setCity(sp.city ?? '');
        setAgeGroups(new Set((sp.openToTrainAgeGroups ?? []) as AgeGroup[]));
        setBio(sp.bio ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [supabaseUserId]);

  const toggleGoal = useCallback((g: ConnectionGoal) => {
    setGoals(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }, []);

  const toggleAgeGroup = useCallback((ag: AgeGroup) => {
    setAgeGroups(prev => {
      const next = new Set(prev);
      next.has(ag) ? next.delete(ag) : next.add(ag);
      return next;
    });
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!supabaseUserId) return;
    setSaving(true);
    try {
      await SocialProfileService.update(supabaseUserId, {
        lookingToMeet,
        connectionGoals: [...goals],
        city: city.trim() || null,
        openToTrainAgeGroups: [...ageGroups],
        bio: bio.trim() || null,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ActivityIndicator color={C.orange} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <ArrowLeft size={22} color={C.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Looking to meet</Text>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.intro}>Tell people what kind of connections you're open to.</Text>

        {/* ── I'M OPEN TO ──────────────────────────────────────────────────── */}
        <SectionLabel text="I'm open to" />
        <View style={s.openToRow}>
          {OPEN_TO_OPTIONS.map(opt => {
            const Icon     = opt.icon;
            const selected = lookingToMeet === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[s.openToCard, selected && s.openToCardActive]}
                onPress={() => setLookingToMeet(opt.id)}
                activeOpacity={0.78}
              >
                {selected && (
                  <View style={s.openToCheck}>
                    <Check size={11} color={C.orange} strokeWidth={3} />
                  </View>
                )}
                <Icon size={22} color={selected ? C.orange : C.muted} strokeWidth={2} />
                <Text style={[s.openToLabel, selected && { color: C.text }]}>{opt.label}</Text>
                <Text style={s.openToCaption}>{opt.caption}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── WHAT ARE YOU LOOKING FOR? ───────────────────────────────────── */}
        <SectionLabel text="What are you looking for?" />
        <View style={s.chipGrid}>
          {ALL_CONNECTION_GOALS.map(goal => {
            const meta     = CONNECTION_GOAL_META[goal];
            const isGreen  = ['friends', 'networking', 'mentorship', 'collaboration'].includes(goal);
            const label    = meta.emoji ? `${meta.emoji} ${meta.label}` : meta.label;
            return (
              <ToggleChip
                key={goal}
                value={goal}
                selected={goals.has(goal)}
                label={label}
                onToggle={toggleGoal}
                tone={isGreen ? 'green' : 'orange'}
              />
            );
          })}
        </View>
        <TouchableOpacity style={{ alignSelf: 'flex-start', marginTop: 4 }}>
          <Text style={s.addCustom}>+ Add custom</Text>
        </TouchableOpacity>

        {/* ── PREFERRED LOCATION ──────────────────────────────────────────── */}
        <SectionLabel text="Preferred location" />
        <View style={[s.placesWrap, { zIndex: 100 }]}>
          <GooglePlacesAutocomplete
            placeholder="Search city or area"
            fetchDetails
            minLength={2}
            debounce={280}
            query={{ key: GOOGLE_KEY, language: 'en', types: '(cities)' }}
            requestUrl={{
              useOnPlatform: 'all',
              url: GOOGLE_PLACES_REQUEST_URL,
            }}
            onPress={(data, details) => {
              const name = details?.name || data.description.split(',')[0]?.trim() || data.description;
              setCity(name);
              setCityPlaceId(data.place_id ?? null);
            }}
            styles={{
              container:         s.gaContainer as any,
              textInputContainer: s.gaInputContainer,
              textInput:          s.gaInput as any,
              listView:           s.gaList as any,
              row:                s.gaRow,
              description:        s.gaDesc,
              separator:          s.gaSep,
            }}
            textInputProps={{
              placeholderTextColor: C.dim,
              autoCorrect: false,
              autoCapitalize: 'none',
            }}
            enablePoweredByContainer={false}
            keepResultsAfterBlur
          />
          {city ? (
            <View style={s.selectedCity}>
              <MapPin size={15} color={C.orange} strokeWidth={2} />
              <Text style={s.selectedCityText}>{city}</Text>
            </View>
          ) : null}
        </View>

        {/* ── AGE GROUPS ──────────────────────────────────────────────────── */}
        <SectionLabel text="Age range (optional)" />
        <View style={s.chipGrid}>
          {ALL_AGE_GROUPS.map(ag => (
            <ToggleChip
              key={ag}
              value={ag}
              selected={ageGroups.has(ag)}
              label={AGE_GROUP_META[ag]}
              onToggle={toggleAgeGroup}
              tone="orange"
            />
          ))}
        </View>

        {/* ── BIO ─────────────────────────────────────────────────────────── */}
        <SectionLabel text="Bio" />
        <TextInput
          style={s.bioInput}
          value={bio}
          onChangeText={setBio}
          placeholder="Gym lover & fitness enthusiast. Always pushing for progress."
          placeholderTextColor={C.dim}
          multiline
          numberOfLines={3}
          maxLength={160}
        />
        <Text style={s.charCount}>{bio.length}/160</Text>

        {/* Bottom save */}
        <TouchableOpacity
          style={[s.bottomSave, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.86}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.bottomSaveText}>Save</Text>
          }
        </TouchableOpacity>
      </ScrollView>
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
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '800', color: C.text,
  },
  saveBtn: {
    backgroundColor: C.orange, borderRadius: 10,
    paddingVertical: 7, paddingHorizontal: 16,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 60,
    gap: 10,
  },

  intro: { color: C.muted, fontSize: 13, lineHeight: 19 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 8,
  },

  // I'm open to
  openToRow: { flexDirection: 'row', gap: 8 },
  openToCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  openToCardActive: {
    backgroundColor: C.accentSoft,
    borderColor: C.accentBorder,
  },
  openToCheck: {
    position: 'absolute',
    top: 7, right: 7,
    width: 18, height: 18,
    borderRadius: 9,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  openToLabel: {
    color: C.muted, fontSize: 13, fontWeight: '800',
  },
  openToCaption: {
    color: C.dim, fontSize: 10, fontWeight: '600', textAlign: 'center',
  },

  // Chip grid
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.border,
  },
  chipText: { color: C.muted, fontSize: 12, fontWeight: '700' },

  addCustom: { color: C.dim, fontSize: 12, fontWeight: '600' },

  // Google Places
  placesWrap: { marginTop: 2, marginBottom: 6 },
  gaContainer: { flex: 0 },
  gaInputContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0, borderBottomWidth: 0, paddingHorizontal: 0,
  },
  gaInput: {
    backgroundColor: C.bgInput,
    borderRadius: 11,
    color: C.text,
    fontSize: 14,
    height: 46,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  gaList: {
    backgroundColor: '#132231',
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  gaRow: { backgroundColor: 'transparent', paddingVertical: 11, paddingHorizontal: 13 },
  gaDesc: { color: C.text, fontSize: 13 },
  gaSep: { height: 1, backgroundColor: C.border },

  selectedCity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 8,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accentBorder,
    borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 8,
  },
  selectedCityText: { color: C.text, fontSize: 13, fontWeight: '700' },

  // Bio
  bioInput: {
    backgroundColor: C.bgInput,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    height: 88,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: C.dim, textAlign: 'right', marginTop: -4 },

  // Bottom save
  bottomSave: {
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  bottomSaveText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
