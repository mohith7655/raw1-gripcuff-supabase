import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Check, MapPin, Camera, CircleUserRound, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { WebSafeAvatar } from '../components/WebSafeAvatar';
import { StorageService } from '../services/storage.service';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { SocialProfileService } from '../services/socialProfile.service';
import {
    SocialProfile,
    ProfilePlace,
    LookingToMeet,
    ConnectionGoal,
    Hobby,
    AgeGroup,
    ALL_HOBBIES,
    ALL_CONNECTION_GOALS,
    ALL_AGE_GROUPS,
    HOBBY_META,
    CONNECTION_GOAL_META,
    AGE_GROUP_META,
    WHAT_I_DO_PRESETS,
} from '../models/SocialProfile';

const C = {
    bg: '#070d1a',
    bgCard: '#0f1923',
    bgInput: 'rgba(255,255,255,0.05)',
    accent: '#ff7a00',
    accentSoft: 'rgba(255,122,0,0.12)',
    accentBorder: 'rgba(255,122,0,0.28)',
    green: '#22C55E',
    text: '#FFFFFF',
    textMuted: '#94A3B8',
    textDim: '#64748B',
    border: 'rgba(255,255,255,0.08)',
};

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
const GOOGLE_PLACES_WEB_URL =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_WEB_PROXY_URL ??
    (Platform.OS === 'web' ? '/api/maps' : 'https://maps.googleapis.com/maps/api');
console.log('[Places] API key:', GOOGLE_PLACES_KEY ? `Present (${GOOGLE_PLACES_KEY.slice(0, 8)}...)` : 'MISSING');
console.log('[Places] Proxy URL:', GOOGLE_PLACES_WEB_URL);
console.log('[Places] Platform:', Platform.OS);

function compactAddress(address?: string | null, name?: string | null) {
    if (!address) return '';
    return address
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .filter(part => part !== name)
        .slice(0, 3)
        .join(', ');
}

const LOOKING_TO_MEET_PRESETS = [
    'Mentor',
    'Investor',
    'Founder',
    'Co-founder',
    'Advisor',
    'Industry Expert',
    'Consultant',
    'Business Owner',
    'Influencer',
    'Community Leader'
];

function placeFromSocial(sp: SocialProfile, kind: 'gym' | 'house' | 'park'): ProfilePlace {
    if (kind === 'gym') {
        return {
            placeId: sp.gymPlaceId ?? null,
            name: sp.gymName ?? null,
            address: sp.gymAddress ?? sp.gymArea ?? null,
            lat: sp.gymLat ?? null,
            lng: sp.gymLng ?? null,
        };
    }
    if (kind === 'house') {
        return {
            placeId: sp.housePlaceId ?? null,
            name: sp.houseName ?? null,
            address: sp.houseAddress ?? null,
            lat: sp.houseLat ?? null,
            lng: sp.houseLng ?? null,
        };
    }
    return {
        placeId: sp.parkPlaceId ?? null,
        name: sp.parkName ?? null,
        address: sp.parkAddress ?? null,
        lat: sp.parkLat ?? null,
        lng: sp.parkLng ?? null,
    };
}

function placePatch(prefix: 'gym' | 'house' | 'park', place: ProfilePlace) {
    const name = place.name?.trim() || null;
    const address = place.address?.trim() || null;
    const base = {
        [`${prefix}PlaceId`]: place.placeId || null,
        [`${prefix}Name`]: name,
        [`${prefix}Address`]: address,
        [`${prefix}Lat`]: place.lat ?? null,
        [`${prefix}Lng`]: place.lng ?? null,
    };
    return base as Partial<Omit<SocialProfile, 'uid'>>;
}

function metaLabel(meta: { emoji: string; label: string }) {
    return meta.emoji ? `${meta.emoji} ${meta.label}` : meta.label;
}

function FieldLabel({ text }: { text: string }) {
    return <Text style={s.fieldLabel}>{text}</Text>;
}

function SectionTitle({ text }: { text: string }) {
    return <Text style={s.sectionTitle}>{text}</Text>;
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
    return <View style={[s.card, style]}>{children}</View>;
}

function ToggleChip<T extends string>({
    value,
    selected,
    onToggle,
    label,
}: {
    value: T;
    selected: boolean;
    onToggle: (v: T) => void;
    label: string;
}) {
    return (
        <TouchableOpacity
            style={[s.chip, selected && s.chipActive]}
            onPress={() => onToggle(value)}
            activeOpacity={0.72}
        >
            {selected ? <Check size={12} color={C.accent} style={s.chipCheck} /> : null}
            <Text style={[s.chipText, selected && s.chipTextActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

function GooglePlaceField({
    label,
    placeholder,
    queryTypes,
    value,
    onSelect,
    zIndex = 9999,
}: {
    label: string;
    placeholder: string;
    queryTypes?: string;
    value: ProfilePlace;
    onSelect: (place: ProfilePlace) => void;
    zIndex?: number;
}) {
    const ref = useRef<GooglePlacesAutocompleteRef>(null);
    const selectedTitle = value.name || value.address;
    const selectedSubtitle = compactAddress(value.address, value.name);

    useEffect(() => {
        const text = value.name || value.address || '';
        if (text && ref.current?.getAddressText() !== text) {
            ref.current?.setAddressText(text);
        }
    }, [value.name, value.address]);

    return (
        <View style={[s.placeWrap, { zIndex }]}>
            <FieldLabel text={label} />
            <GooglePlacesAutocomplete
                ref={ref}
                placeholder={placeholder}
                fetchDetails
                minLength={2}
                debounce={280}
                query={{
                    key: GOOGLE_PLACES_KEY,
                    language: 'en',
                    types: queryTypes,
                }}
                requestUrl={{
                    useOnPlatform: 'web',
                    url: GOOGLE_PLACES_WEB_URL,
                }}
                onFail={(error) => console.error('[Places] onFail:', error)}
                onNotFound={() => console.warn('[Places] onNotFound: no results')}
                onPress={(data, details) => {
                    console.log('[Places] selected:', data.description, details?.geometry?.location);
                    const description = data.description || '';
                    const formatted = details?.formatted_address || description;
                    const name = details?.name || description.split(',')[0]?.trim() || formatted;
                    onSelect({
                        placeId: data.place_id,
                        name,
                        address: formatted,
                        lat: details?.geometry?.location?.lat ?? null,
                        lng: details?.geometry?.location?.lng ?? null,
                    });
                }}
                styles={{
                    container: s.placesContainer,
                    textInputContainer: s.placesInputContainer,
                    textInput: s.placesInput,
                    listView: s.placesList,
                    row: s.placesRow,
                    description: s.placesDescription,
                    separator: s.placesSeparator,
                }}
                textInputProps={{
                    placeholderTextColor: C.textDim,
                    autoCorrect: false,
                    autoCapitalize: 'none',
                    onBlur: () => {
                        const text = ref.current?.getAddressText() || '';
                        if (text && text !== value.name && text !== value.address) {
                            onSelect({
                                placeId: undefined,
                                name: text,
                                address: '',
                                lat: null,
                                lng: null,
                            });
                        }
                    }
                }}
                enablePoweredByContainer={false}
                keepResultsAfterBlur
                listEmptyComponent={() => {
                    console.warn('[Places] listEmptyComponent shown — no suggestions returned');
                    return null;
                }}
            />
            {selectedTitle ? (
                <View style={s.selectedPlace}>
                    <View style={s.selectedIcon}>
                        <MapPin size={16} color={C.accent} />
                    </View>
                    <View style={s.selectedTextBlock}>
                        <Text style={s.selectedTitle} numberOfLines={1}>{selectedTitle}</Text>
                        {selectedSubtitle ? (
                            <Text style={s.selectedSub} numberOfLines={1}>{selectedSubtitle}</Text>
                        ) : null}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

export function EditSocialProfileScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const section = route.params?.section || 'all';
    const { supabaseUserId } = useAuth();
    const { profile, updateProfile, fetchProfile } = useUser();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fullName, setFullName] = useState(profile?.fullName || '');
    const [username, setUsername] = useState(profile?.username || '');
    const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '');
    const [phone, setPhone] = useState(profile?.phone || '');
    const [dob, setDob] = useState(profile?.dateOfBirth || '');
    const [gender, setGender] = useState<string | null>(profile?.gender ?? null);
    const [photoUri, setPhotoUri] = useState<string | null>(profile?.profileImageUrl ? `${profile.profileImageUrl}?t=${Date.now()}` : null);
    const [uploading, setUploading] = useState(false);
    const [uploadPct, setUploadPct] = useState(0);

    const [bio, setBio] = useState('');
    const [selectedWhatIDoPresets, setSelectedWhatIDoPresets] = useState<Set<string>>(new Set());
    const [customWhatIDoText, setCustomWhatIDoText] = useState('');
    const [privacyLevel, setPrivacyLevel] = useState<'public' | 'private' | 'friends_only'>('public');
    const [selectedMeetPresets, setSelectedMeetPresets] = useState<Set<string>>(new Set());
    const [customMeetText, setCustomMeetText] = useState('');
    const [connectionGoals, setGoals] = useState<Set<ConnectionGoal>>(new Set());
    const [gymPlace, setGymPlace] = useState<ProfilePlace>({});
    const [housePlace, setHousePlace] = useState<ProfilePlace>({});
    const [parkPlace, setParkPlace] = useState<ProfilePlace>({});
    const [hobbies, setHobbies] = useState<Set<Hobby>>(new Set());
    const [communityNote, setCommunityNote] = useState('');
    const [helpingBeginners, setHelpBeginners] = useState(false);
    const [openToMentor, setOpenToMentor] = useState(false);
    const [ageGroups, setAgeGroups] = useState<Set<AgeGroup>>(new Set());
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!supabaseUserId || loaded) return;
        SocialProfileService.get(supabaseUserId)
            .then(sp => {
                console.log('[EditProfile] loaded sp:', JSON.stringify(sp));
                if (!sp) return;
                setBio(sp.bio ?? '');
                
                const whatIDoStr = sp.whatIDo || '';
                const whatIDoParts = whatIDoStr.split(',').map(p => p.trim()).filter(Boolean);
                const whatIDoPresetsSet = new Set<string>();
                const whatIDoCustoms: string[] = [];
                for (const p of whatIDoParts) {
                    if (WHAT_I_DO_PRESETS.includes(p)) {
                        whatIDoPresetsSet.add(p);
                    } else {
                        whatIDoCustoms.push(p);
                    }
                }
                setSelectedWhatIDoPresets(whatIDoPresetsSet);
                setCustomWhatIDoText(whatIDoCustoms.join(', '));
                setPrivacyLevel(sp.privacyLevel ?? (sp.openToConnect ? 'public' : 'private'));
                
                const meetStr = sp.lookingToMeet || '';
                const meetParts = meetStr.split(',').map(p => p.trim()).filter(Boolean);
                const presets = new Set<string>();
                const customs: string[] = [];
                for (const p of meetParts) {
                    if (LOOKING_TO_MEET_PRESETS.includes(p)) {
                        presets.add(p);
                    } else {
                        customs.push(p);
                    }
                }
                setSelectedMeetPresets(presets);
                setCustomMeetText(customs.join(', '));
                
                setGoals(new Set(sp.connectionGoals ?? []));
                setGymPlace(placeFromSocial(sp, 'gym'));
                setHousePlace(placeFromSocial(sp, 'house'));
                setParkPlace(placeFromSocial(sp, 'park'));
                setHobbies(new Set(sp.hobbies ?? []));
                setCommunityNote(sp.communityNote ?? '');
                setHelpBeginners(sp.helpingBeginners ?? false);
                setOpenToMentor(sp.openToMentor ?? false);
                setAgeGroups(new Set((sp.openToTrainAgeGroups ?? []) as AgeGroup[]));
                setLoaded(true);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [supabaseUserId, loaded]);

    const toggleWhatIDoPreset = useCallback((preset: string) => {
        setSelectedWhatIDoPresets(prev => {
            const next = new Set(prev);
            next.has(preset) ? next.delete(preset) : next.add(preset);
            return next;
        });
    }, []);

    const toggleMeetPreset = useCallback((preset: string) => {
        setSelectedMeetPresets(prev => {
            const next = new Set(prev);
            next.has(preset) ? next.delete(preset) : next.add(preset);
            return next;
        });
    }, []);

    const toggleGoal = useCallback((g: ConnectionGoal) => {
        setGoals(prev => {
            const next = new Set(prev);
            next.has(g) ? next.delete(g) : next.add(g);
            return next;
        });
    }, []);

    const toggleHobby = useCallback((h: Hobby) => {
        setHobbies(prev => {
            const next = new Set(prev);
            next.has(h) ? next.delete(h) : next.add(h);
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

    const handleSave = async () => {
        if (!supabaseUserId) return;
        setSaving(true);
        try {
            await updateProfile(supabaseUserId, {
                fullName: fullName.trim() || null,
                username: username.trim() || null,
                age: age ? parseInt(age, 10) : null,
                phone: phone.trim() || null,
                dateOfBirth: dob.trim() || null,
                gender: gender || null,
            });

            const gymAddress = gymPlace.address?.trim() || null;
            await SocialProfileService.update(supabaseUserId, {
                bio: bio.trim() || null,
                whatIDo: [...Array.from(selectedWhatIDoPresets), customWhatIDoText.trim()].filter(Boolean).join(', ') || null,
                privacyLevel,
                lookingToMeet: [...Array.from(selectedMeetPresets), customMeetText.trim()].filter(Boolean).join(', ') || null,
                connectionGoals: [...connectionGoals],
                gymName: gymPlace.name?.trim() || null,
                gymArea: compactAddress(gymAddress, gymPlace.name) || gymAddress,
                ...placePatch('gym', gymPlace),
                ...placePatch('house', housePlace),
                ...placePatch('park', parkPlace),
                hobbies: [...hobbies] as Hobby[],
                communityNote: communityNote.trim() || null,
                helpingBeginners,
                openToMentor,
                openToTrainAgeGroups: [...ageGroups],
            });
            await fetchProfile(supabaseUserId);
            navigation.navigate('ProfileScreen');
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not save changes.');
        } finally {
            setSaving(false);
        }
    };

    const pickAndUpload = async () => {
        const uid = supabaseUserId;
        if (!uid) return;

        if (Platform.OS === 'web') {
            const input = document.createElement('input') as any;
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e: any) => {
                const file: File | undefined = e.target?.files?.[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) {
                    Alert.alert('Invalid file', 'Please select an image file.');
                    return;
                }
                setUploading(true);
                setUploadPct(0);
                try {
                    const objectUrl = URL.createObjectURL(file);
                    const url = await StorageService.uploadProfilePicture(uid, objectUrl, pct => setUploadPct(pct));
                    URL.revokeObjectURL(objectUrl);
                    setPhotoUri(`${url}?t=${Date.now()}`);
                    await updateProfile(uid, { profileImageUrl: url });
                } catch (e: any) {
                    Alert.alert('Upload failed', e?.message ?? 'Could not upload photo.');
                } finally { setUploading(false); setUploadPct(0); }
            };
            input.click();
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow photo library access in Settings.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            exif: false,
        });
        if (result.canceled) return;
        setUploading(true);
        setUploadPct(0);
        try {
            const url = await StorageService.uploadProfilePicture(uid, result.assets[0].uri, pct => setUploadPct(pct));
            setPhotoUri(`${url}?t=${Date.now()}`);
            await updateProfile(uid, { profileImageUrl: url });
        } catch (e: any) {
            Alert.alert('Upload failed', e?.message ?? 'Could not upload photo.');
        } finally { setUploading(false); setUploadPct(0); }
    };

    const removePhoto = async () => {
        const uid = supabaseUserId;
        if (!uid) return;
        Alert.alert('Remove Photo', 'Remove your profile picture?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: async () => {
                    setUploading(true);
                    try {
                        await StorageService.deleteProfilePicture(uid);
                        await updateProfile(uid, { profileImageUrl: null as any });
                        setPhotoUri(null);
                    } catch (e: any) {
                        Alert.alert('Error', e?.message ?? 'Could not remove photo.');
                    } finally { setUploading(false); }
                },
            },
        ]);
    };

    if (loading || !loaded) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <ActivityIndicator color={C.accent} style={s.loading} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ProfileScreen'))} style={s.iconBtn}>
                    <ArrowLeft size={22} color={C.text} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Edit Profile</Text>
                <TouchableOpacity
                    style={[s.saveBtn, saving && s.saveBtnBusy]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.82}
                >
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Save</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {(section === 'all' || section === 'hero') && (
                    <>
                        <View style={s.avatarSection}>
                            <View style={s.avatarWrap}>
                                {photoUri ? (
                                    <WebSafeAvatar uri={photoUri} size={110} style={s.avatarImg} />
                                ) : (
                                    <View style={[s.avatarImg, s.avatarPlaceholder]}>
                                        <CircleUserRound size={48} color={C.textMuted} />
                                    </View>
                                )}
                                {uploading && (
                                    <View style={s.uploadOverlay}>
                                        <ActivityIndicator color="#fff" />
                                        {uploadPct > 0 && <Text style={s.uploadText}>{uploadPct}%</Text>}
                                    </View>
                                )}
                            </View>

                            <View style={s.avatarActions}>
                                <TouchableOpacity style={s.photoBtn} onPress={pickAndUpload} disabled={uploading}>
                                    <Camera size={16} color={C.accent} />
                                    <Text style={s.photoBtnText}>Change Photo</Text>
                                </TouchableOpacity>
                                {photoUri && (
                                    <TouchableOpacity style={[s.photoBtn, s.photoBtnDanger]} onPress={removePhoto} disabled={uploading}>
                                        <Trash2 size={16} color="#ef4444" />
                                        <Text style={s.photoBtnTextDanger}>Remove</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text style={s.emailText}>{profile?.email}</Text>
                        </View>

                        <SectionTitle text="Profile Details" />
                        <Card>
                            <FieldLabel text="USERNAME" />
                            <View style={s.inputWrapper}>
                                <Text style={s.inputPrefix}>@ </Text>
                                <TextInput
                                    style={s.inputWithPrefix}
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="Enter username"
                                    placeholderTextColor={C.textDim}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>

                            <FieldLabel text="FULL NAME" />
                            <TextInput
                                style={s.input}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Enter full name"
                                placeholderTextColor={C.textDim}
                            />

                            <FieldLabel text="AGE" />
                            <TextInput
                                style={s.input}
                                value={age}
                                onChangeText={setAge}
                                placeholder="Age"
                                placeholderTextColor={C.textDim}
                                keyboardType="number-pad"
                                maxLength={3}
                            />

                            <FieldLabel text="PHONE" />
                            <TextInput
                                style={s.input}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="e.g. +1 234 567 8900"
                                placeholderTextColor={C.textDim}
                                keyboardType="phone-pad"
                            />

                            <FieldLabel text="DATE OF BIRTH" />
                            <TextInput
                                style={s.input}
                                value={dob}
                                onChangeText={setDob}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor={C.textDim}
                            />

                            <FieldLabel text="GENDER" />
                            <View style={s.genderRow}>
                                <TouchableOpacity
                                    style={[s.genderBtn, gender === 'male' && s.genderBtnActive]}
                                    onPress={() => setGender('male')}
                                >
                                    <Text style={[s.genderBtnText, gender === 'male' && s.genderBtnTextActive]}>👨 Male</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[s.genderBtn, gender === 'female' && s.genderBtnActive]}
                                    onPress={() => setGender('female')}
                                >
                                    <Text style={[s.genderBtnText, gender === 'female' && s.genderBtnTextActive]}>👩 Female</Text>
                                </TouchableOpacity>
                            </View>
                        </Card>
                    </>
                )}

                {(section === 'all' || section === 'about') && (
                    <>
                        <SectionTitle text="About You" />
                        <Card>
                            <FieldLabel text="Bio" />
                            <TextInput
                                style={[s.input, s.inputMulti]}
                                value={bio}
                                onChangeText={setBio}
                                placeholder="Share a short intro about yourself..."
                                placeholderTextColor={C.textDim}
                                multiline
                                numberOfLines={3}
                                maxLength={160}
                            />
                            <Text style={s.charCount}>{bio.length}/160</Text>
                        </Card>
                    </>
                )}

                {(section === 'all' || section === 'whatIDo') && (
                    <>
                        <SectionTitle text="What I Do" />
                        <Card>
                            <FieldLabel text="Profession / Activity" />
                            <View style={[s.chipWrap, { marginBottom: 16 }]}>
                                {WHAT_I_DO_PRESETS.map(p => (
                                    <ToggleChip
                                        key={p}
                                        value={p}
                                        label={p}
                                        selected={selectedWhatIDoPresets.has(p)}
                                        onToggle={toggleWhatIDoPreset}
                                    />
                                ))}
                            </View>
                            <FieldLabel text="Custom (Optional)" />
                            <TextInput
                                style={[s.input, s.inputMultiSmall]}
                                value={customWhatIDoText}
                                onChangeText={(val) => setCustomWhatIDoText(val)}
                                placeholder="Add custom profession or activity..."
                                placeholderTextColor={C.textDim}
                                multiline
                                numberOfLines={2}
                            />
                        </Card>
                    </>
                )}

                {(section === 'all' || section === 'meet') && (
                    <>
                        <SectionTitle text="Connection Intent" />
                        <Card>
                            <FieldLabel text="Privacy / Visibility" />
                            <View style={[s.chipWrap, { marginBottom: 16 }]}>
                                {([
                                    { value: 'public', label: 'Public' },
                                    { value: 'private', label: 'Private' },
                                    { value: 'friends_only', label: 'Only Friends' }
                                ] as const).map(opt => (
                                    <ToggleChip
                                        key={opt.value}
                                        value={opt.value}
                                        label={opt.label}
                                        selected={privacyLevel === opt.value}
                                        onToggle={() => setPrivacyLevel(opt.value)}
                                    />
                                ))}
                            </View>

                            <FieldLabel text="Looking to Meet" />
                            <View style={[s.chipWrap, { marginBottom: 16 }]}>
                                {LOOKING_TO_MEET_PRESETS.map(p => (
                                    <ToggleChip
                                        key={p}
                                        value={p}
                                        label={p}
                                        selected={selectedMeetPresets.has(p)}
                                        onToggle={toggleMeetPreset}
                                    />
                                ))}
                            </View>
                            <FieldLabel text="Custom (Optional)" />
                            <TextInput
                                style={[s.input, s.inputMultiSmall]}
                                value={customMeetText}
                                onChangeText={(val) => setCustomMeetText(val)}
                                placeholder="Add custom looking to meet details..."
                                placeholderTextColor={C.textDim}
                                multiline
                                numberOfLines={2}
                            />
                        </Card>
                    </>
                )}

                {(section === 'all' || section === 'locations') && (
                    <>
                        <SectionTitle text="Locations" />
                        <Card style={s.placesCard}>
                            <GooglePlaceField
                                label="Gym Location"
                                placeholder="Search gym, club, or training studio"
                                queryTypes="establishment"
                                value={gymPlace}
                                onSelect={setGymPlace}
                                zIndex={9003}
                            />
                            <GooglePlaceField
                                label="House Location"
                                placeholder="Search your home area or neighborhood"
                                queryTypes="geocode"
                                value={housePlace}
                                onSelect={setHousePlace}
                                zIndex={9002}
                            />
                            <GooglePlaceField
                                label="Local Park"
                                placeholder="Search a park or outdoor training spot"
                                queryTypes="establishment"
                                value={parkPlace}
                                onSelect={setParkPlace}
                                zIndex={9001}
                            />
                        </Card>
                    </>
                )}

                {(section === 'all' || section === 'hobbies') && (
                    <>
                        <SectionTitle text="Hobbies & Interests" />
                        <Card>
                            <View style={s.chipWrap}>
                                {ALL_HOBBIES.map(h => {
                                    const meta = HOBBY_META[h];
                                    return (
                                        <ToggleChip
                                            key={h}
                                            value={h}
                                            selected={hobbies.has(h)}
                                            onToggle={toggleHobby}
                                            label={metaLabel(meta)}
                                        />
                                    );
                                })}
                            </View>
                        </Card>
                    </>
                )}

                {(section === 'all' || section === 'community') && (
                    <>
                        <SectionTitle text="Community Service" />
                        <Card>
                            <View style={s.switchRow}>
                                <View style={s.flex}>
                                    <Text style={s.switchLabel}>Helping Beginners</Text>
                                    <Text style={s.switchSub}>Happy to guide newcomers to fitness.</Text>
                                </View>
                                <Switch
                                    value={helpingBeginners}
                                    onValueChange={setHelpBeginners}
                                    trackColor={{ false: '#2a3a4a', true: C.accent }}
                                    thumbColor="#fff"
                                />
                            </View>

                            <View style={s.switchRow}>
                                <View style={s.flex}>
                                    <Text style={s.switchLabel}>Open to Mentor (+55 only)</Text>
                                    <Text style={s.switchSub}>Willing to mentor others on their fitness journey.</Text>
                                </View>
                                <Switch
                                    value={openToMentor}
                                    onValueChange={(val) => {
                                        setOpenToMentor(val);
                                        if (val) {
                                            setAgeGroups(new Set(['seniors']));
                                        }
                                    }}
                                    trackColor={{ false: '#2a3a4a', true: C.accent }}
                                    thumbColor="#fff"
                                />
                            </View>
                        </Card>

                        <SectionTitle text="Community Note" />
                        <Card>
                            <FieldLabel text="Community Note" />
                            <TextInput
                                style={[s.input, s.inputMultiSmall]}
                                value={communityNote}
                                onChangeText={setCommunityNote}
                                placeholder="Volunteer work, events, how you give back..."
                                placeholderTextColor={C.textDim}
                                multiline
                                numberOfLines={2}
                                maxLength={200}
                            />
                        </Card>
                    </>
                )}

                <TouchableOpacity
                    style={[s.bottomSave, saving && s.saveBtnBusy]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.86}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.bottomSaveText}>Save Profile</Text>}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },

    // Avatar Section
    avatarSection: { alignItems: 'center', paddingVertical: 12, gap: 12 },
    avatarWrap: { width: 110, height: 110, borderRadius: 55, position: 'relative' },
    avatarImg: { width: 110, height: 110, borderRadius: 55, overflow: 'hidden' },
    avatarPlaceholder: { backgroundColor: C.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.accentBorder },
    uploadOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 55, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    uploadText: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 4 },
    avatarActions: { flexDirection: 'row', gap: 10 },
    photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.bgCard, borderWidth: 1, borderColor: C.accentBorder },
    photoBtnDanger: { borderColor: 'rgba(239, 68, 68, 0.3)' },
    photoBtnText: { color: C.accent, fontSize: 13, fontWeight: '600' },
    photoBtnTextDanger: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
    emailText: { fontSize: 13, color: C.textDim, marginBottom: 8 },

    // Input variants
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgInput, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16, paddingLeft: 14 },
    inputPrefix: { color: C.accent, fontSize: 15, fontWeight: '700' },
    inputWithPrefix: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 12, paddingRight: 14 },

    genderRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    genderBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: C.bgInput, borderWidth: 1, borderColor: C.border },
    genderBtnActive: { borderColor: C.accent, backgroundColor: C.accentSoft },
    genderBtnText: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
    genderBtnTextActive: { color: C.accent },

    loading: {
        marginTop: 80,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
    },
    iconBtn: {
        padding: 6,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 17,
        fontWeight: '800',
        color: C.text,
    },
    saveBtn: {
        backgroundColor: C.accent,
        borderRadius: 11,
        paddingVertical: 8,
        paddingHorizontal: 16,
        minWidth: 60,
        alignItems: 'center',
    },
    saveBtnBusy: {
        opacity: 0.62,
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
    },
    scroll: {
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 68,
        gap: 11,
    },
    flex: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: C.textDim,
        textTransform: 'uppercase',
        letterSpacing: 0,
        marginTop: 7,
        marginBottom: 2,
    },
    card: {
        backgroundColor: C.bgCard,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
        boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
    },
    placesCard: {
        zIndex: 9999,
        overflow: 'visible',
        elevation: 9999,
    } as any,
    fieldLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: C.textDim,
        textTransform: 'uppercase',
        letterSpacing: 0,
        marginBottom: 8,
        marginTop: 12,
    },
    input: {
        backgroundColor: C.bgInput,
        borderRadius: 11,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: C.text,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 5,
    },
    inputMulti: {
        height: 82,
        textAlignVertical: 'top',
    },
    inputMultiSmall: {
        height: 70,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: 11,
        color: C.textDim,
        textAlign: 'right',
        marginBottom: 4,
    },
    placeWrap: {
        zIndex: 9999,
        marginTop: -4,
        marginBottom: 12,
        overflow: 'visible',
    } as any,
    placesContainer: {
        flex: 0,
        zIndex: 9999,
        overflow: 'visible',
    } as any,
    placesInputContainer: {
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        borderBottomWidth: 0,
        paddingHorizontal: 0,
    },
    placesInput: {
        backgroundColor: C.bgInput,
        borderRadius: 11,
        color: C.text,
        fontSize: 14,
        height: 46,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: C.border,
        outlineStyle: 'none',
    } as any,
    placesList: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        zIndex: 9999,
        elevation: 9999,
        boxShadow: '0 16px 30px rgba(0,0,0,0.5)',
    } as any,
    placesRow: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
        paddingHorizontal: 13,
    },
    placesDescription: {
        color: C.text,
        fontSize: 13,
    },
    placesSeparator: {
        height: 1,
        backgroundColor: C.border,
    },
    selectedPlace: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 9,
        backgroundColor: C.accentSoft,
        borderWidth: 1,
        borderColor: C.accentBorder,
        borderRadius: 12,
        paddingHorizontal: 11,
        paddingVertical: 10,
    },
    selectedIcon: {
        width: 30,
        height: 30,
        borderRadius: 9,
        backgroundColor: 'rgba(255,122,0,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedTextBlock: {
        flex: 1,
        minWidth: 0,
    },
    selectedTitle: {
        color: C.text,
        fontSize: 13,
        fontWeight: '800',
    },
    selectedSub: {
        color: C.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    presetToggle: {
        alignSelf: 'flex-start',
        marginBottom: 8,
        marginTop: 2,
    },
    presetToggleText: {
        color: C.accent,
        fontSize: 12,
        fontWeight: '800',
    },
    presetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    presetChip: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    presetChipActive: {
        backgroundColor: C.accentSoft,
        borderColor: C.accentBorder,
    },
    presetChipText: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '700',
    },
    presetChipTextActive: {
        color: C.accent,
    },
    pillRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    pill: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 11,
        backgroundColor: C.bgInput,
        borderWidth: 1,
        borderColor: C.border,
    },
    pillActive: {
        backgroundColor: C.accentSoft,
        borderColor: C.accentBorder,
    },
    pillText: {
        fontSize: 13,
        color: C.textMuted,
        fontWeight: '700',
    },
    pillTextActive: {
        color: C.accent,
        fontWeight: '800',
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: C.bgInput,
        borderWidth: 1,
        borderColor: C.border,
    },
    chipActive: {
        backgroundColor: C.accentSoft,
        borderColor: C.accentBorder,
    },
    chipCheck: {
        marginRight: 5,
    },
    chipText: {
        fontSize: 12,
        color: C.textMuted,
        fontWeight: '700',
    },
    chipTextActive: {
        color: C.accent,
        fontWeight: '800',
    },
    switchRowNoBorder: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 13,
        marginTop: 13,
        borderTopWidth: 1,
        borderTopColor: C.border,
        gap: 12,
    },
    switchLabel: {
        fontSize: 14,
        fontWeight: '800',
        color: C.text,
        marginBottom: 2,
    },
    switchSub: {
        fontSize: 12,
        color: C.textMuted,
        lineHeight: 16,
    },
    bottomSave: {
        backgroundColor: C.accent,
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 8,
        boxShadow: '0 12px 24px rgba(255,122,0,0.22)',
    },
    bottomSaveText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
    },
});
