import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Check, MapPin } from 'lucide-react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useAuth } from '../providers/AuthContext';
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

const GOOGLE_PLACES_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

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
}: {
    label: string;
    placeholder: string;
    queryTypes?: string;
    value: ProfilePlace;
    onSelect: (place: ProfilePlace) => void;
}) {
    const selectedTitle = value.name || value.address;
    const selectedSubtitle = compactAddress(value.address, value.name);

    return (
        <View style={s.placeWrap}>
            <FieldLabel text={label} />
            <GooglePlacesAutocomplete
                placeholder={placeholder}
                fetchDetails
                minLength={2}
                debounce={280}
                query={{
                    key: GOOGLE_PLACES_KEY,
                    language: 'en',
                    types: queryTypes,
                }}
                requestUrl={
                    Platform.OS === 'web'
                        ? { useOnPlatform: 'web', url: 'https://maps.googleapis.com/maps/api' }
                        : undefined
                }
                onPress={(data, details) => {
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
                }}
                enablePoweredByContainer={false}
                keepResultsAfterBlur
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
    const { supabaseUserId } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bio, setBio] = useState('');
    const [whatIDo, setWhatIDo] = useState('');
    const [openToConnect, setOpenToConnect] = useState(false);
    const [lookingToMeet, setLookingToMeet] = useState<LookingToMeet | null>(null);
    const [connectionGoals, setGoals] = useState<Set<ConnectionGoal>>(new Set());
    const [gymPlace, setGymPlace] = useState<ProfilePlace>({});
    const [housePlace, setHousePlace] = useState<ProfilePlace>({});
    const [parkPlace, setParkPlace] = useState<ProfilePlace>({});
    const [hobbies, setHobbies] = useState<Set<Hobby>>(new Set());
    const [communityNote, setCommunityNote] = useState('');
    const [helpingBeginners, setHelpBeginners] = useState(false);
    const [openToMentor, setOpenToMentor] = useState(false);
    const [ageGroups, setAgeGroups] = useState<Set<AgeGroup>>(new Set());
    const [showPresets, setShowPresets] = useState(false);

    useEffect(() => {
        if (!supabaseUserId) return;
        SocialProfileService.get(supabaseUserId)
            .then(sp => {
                if (!sp) return;
                setBio(sp.bio ?? '');
                setWhatIDo(sp.whatIDo ?? '');
                setOpenToConnect(sp.openToConnect ?? false);
                setLookingToMeet(sp.lookingToMeet ?? null);
                setGoals(new Set(sp.connectionGoals ?? []));
                setGymPlace(placeFromSocial(sp, 'gym'));
                setHousePlace(placeFromSocial(sp, 'house'));
                setParkPlace(placeFromSocial(sp, 'park'));
                setHobbies(new Set(sp.hobbies ?? []));
                setCommunityNote(sp.communityNote ?? '');
                setHelpBeginners(sp.helpingBeginners ?? false);
                setOpenToMentor(sp.openToMentor ?? false);
                setAgeGroups(new Set((sp.openToTrainAgeGroups ?? []) as AgeGroup[]));
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
            const gymAddress = gymPlace.address?.trim() || null;
            await SocialProfileService.update(supabaseUserId, {
                bio: bio.trim() || null,
                whatIDo: whatIDo.trim() || null,
                openToConnect,
                lookingToMeet,
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
            navigation.goBack();
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not save changes.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <ActivityIndicator color={C.accent} style={s.loading} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
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
                <Card>
                    <View style={s.switchRowNoBorder}>
                        <View style={s.flex}>
                            <Text style={s.switchLabel}>Open to Connect</Text>
                            <Text style={s.switchSub}>Show a connection badge on your public fitness profile.</Text>
                        </View>
                        <Switch
                            value={openToConnect}
                            onValueChange={setOpenToConnect}
                            trackColor={{ false: '#2a3a4a', true: C.green }}
                            thumbColor="#fff"
                        />
                    </View>
                </Card>

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

                    <FieldLabel text="What I Do" />
                    <TextInput
                        style={s.input}
                        value={whatIDo}
                        onChangeText={setWhatIDo}
                        placeholder="e.g. Gym & Fitness, Software Engineer"
                        placeholderTextColor={C.textDim}
                        maxLength={80}
                    />
                    <TouchableOpacity style={s.presetToggle} onPress={() => setShowPresets(p => !p)}>
                        <Text style={s.presetToggleText}>{showPresets ? 'Hide presets' : 'Choose a preset'}</Text>
                    </TouchableOpacity>
                    {showPresets ? (
                        <View style={s.presetGrid}>
                            {WHAT_I_DO_PRESETS.map(preset => (
                                <TouchableOpacity
                                    key={preset}
                                    style={[s.presetChip, whatIDo === preset && s.presetChipActive]}
                                    onPress={() => {
                                        setWhatIDo(preset);
                                        setShowPresets(false);
                                    }}
                                    activeOpacity={0.74}
                                >
                                    <Text style={[s.presetChipText, whatIDo === preset && s.presetChipTextActive]}>
                                        {preset}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}
                </Card>

                <SectionTitle text="Connection Intent" />
                <Card>
                    <FieldLabel text="Looking to Meet" />
                    <View style={s.pillRow}>
                        {(['social', 'professional', 'both'] as LookingToMeet[]).map(opt => (
                            <TouchableOpacity
                                key={opt}
                                style={[s.pill, lookingToMeet === opt && s.pillActive]}
                                onPress={() => setLookingToMeet(lookingToMeet === opt ? null : opt)}
                                activeOpacity={0.74}
                            >
                                <Text style={[s.pillText, lookingToMeet === opt && s.pillTextActive]}>
                                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <FieldLabel text="I'm here for" />
                    <View style={s.chipWrap}>
                        {ALL_CONNECTION_GOALS.map(goal => {
                            const meta = CONNECTION_GOAL_META[goal];
                            return (
                                <ToggleChip
                                    key={goal}
                                    value={goal}
                                    selected={connectionGoals.has(goal)}
                                    onToggle={toggleGoal}
                                    label={metaLabel(meta)}
                                />
                            );
                        })}
                    </View>
                </Card>

                <SectionTitle text="Locations" />
                <Card style={s.placesCard}>
                    <GooglePlaceField
                        label="Gym Location"
                        placeholder="Search gym, club, or training studio"
                        queryTypes="establishment"
                        value={gymPlace}
                        onSelect={setGymPlace}
                    />
                    <GooglePlaceField
                        label="House Location"
                        placeholder="Search your home area or neighborhood"
                        queryTypes="geocode"
                        value={housePlace}
                        onSelect={setHousePlace}
                    />
                    <GooglePlaceField
                        label="Local Park"
                        placeholder="Search a park or outdoor training spot"
                        queryTypes="establishment"
                        value={parkPlace}
                        onSelect={setParkPlace}
                    />
                </Card>

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

                <SectionTitle text="Community" />
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
                            <Text style={s.switchLabel}>Open to Mentor</Text>
                            <Text style={s.switchSub}>Willing to mentor others on their fitness journey.</Text>
                        </View>
                        <Switch
                            value={openToMentor}
                            onValueChange={setOpenToMentor}
                            trackColor={{ false: '#2a3a4a', true: C.accent }}
                            thumbColor="#fff"
                        />
                    </View>

                    {(helpingBeginners || openToMentor) ? (
                        <>
                            <FieldLabel text="Age groups I train with" />
                            <View style={s.chipWrap}>
                                {ALL_AGE_GROUPS.map(ag => (
                                    <ToggleChip
                                        key={ag}
                                        value={ag}
                                        selected={ageGroups.has(ag)}
                                        onToggle={toggleAgeGroup}
                                        label={AGE_GROUP_META[ag]}
                                    />
                                ))}
                            </View>
                        </>
                    ) : null}
                </Card>

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
    safe: {
        flex: 1,
        backgroundColor: C.bg,
    },
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
        zIndex: 50,
        overflow: 'visible',
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
        zIndex: 999,
        marginTop: -4,
        marginBottom: 12,
    } as any,
    placesContainer: {
        flex: 0,
        zIndex: 999,
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
        backgroundColor: '#132231',
        borderRadius: 12,
        marginTop: 7,
        borderWidth: 1,
        borderColor: C.border,
        zIndex: 1000,
        boxShadow: '0 16px 30px rgba(0,0,0,0.24)',
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
