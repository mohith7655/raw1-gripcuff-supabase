/**
 * AccountSettingsScreen
 *
 * All editable account settings:
 *   • Profile photo (change / remove)
 *   • Full name, username, age, phone, date of birth, gender
 *   • Workout spot locations (gym / home / park)
 *   • Access / subscription status
 *   • Sign out
 *
 * Social profile editing (bio, hobbies, gym, connection goals, etc.)
 * lives in EditSocialProfileScreen.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Camera, CircleUserRound, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { WebSafeAvatar } from '../components/WebSafeAvatar';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { useAccess } from '../providers/AccessContext';
import { StorageService } from '../services/storage.service';
import { TimezoneService } from '../services/timezone.service';
import { reminderWatcherService } from '../services/reminderWatcher.service';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { SCREEN_PADDING } from '../constants/theme';
import { LocationPickerField, LocationValue } from '../components/profile/LocationPickerField';
import { LocationMapPreview } from '../components/profile/LocationMapPreview';
import { UserLocationData } from '../models';

const BASE_SPOTS = ['gym', 'home', 'park'];

export const AccountSettingsScreen = () => {
    const navigation = useNavigation<any>();
    const { supabaseUserId, email, logout } = useAuth();
    const { profile, updateProfile, clearProfile } = useUser();
    const { accessType, gripcuffStatus, showPaywall } = useAccess();

    const displayEmail = profile?.email || email || '';

    const [fullName,   setFullName]   = useState(profile?.fullName || '');
    const [username,   setUsername]   = useState(profile?.username || '');
    const [age,        setAge]        = useState(profile?.age != null ? String(profile.age) : '');
    const [phone,      setPhone]      = useState(profile?.phone ?? '');
    const [dob,        setDob]        = useState(profile?.dateOfBirth ?? '');
    const [gender,     setGender]     = useState<string | null>(profile?.gender ?? null);
    const [locations,  setLocations]  = useState<Record<string, LocationValue>>({});
    const [activeSpot, setActiveSpot] = useState<string>('gym');
    const [uploading,  setUploading]  = useState(false);
    const [uploadPct,  setUploadPct]  = useState(0);
    const [saving,     setSaving]     = useState(false);
    const [photoUri,   setPhotoUri]   = useState<string | null>(
        profile?.profileImageUrl ? `${profile.profileImageUrl}?t=${Date.now()}` : null
    );

    // ── Sync profile into form state ───────────────────────────────────────────

    useEffect(() => {
        if (!profile) return;
        setFullName(profile.fullName || '');
        setUsername(profile.username || '');
        setAge(profile.age != null ? String(profile.age) : '');
        setPhone(profile.phone || '');
        setDob(profile.dateOfBirth || '');
        if (profile.profileImageUrl) {
            setPhotoUri(`${profile.profileImageUrl}?t=${Date.now()}`);
        }
        if (profile.gender) setGender(profile.gender);
        if (profile.locations) {
            const locState: Record<string, LocationValue> = {};
            for (const [spot, locData] of Object.entries(profile.locations)) {
                if (locData) locState[spot] = { address: locData.address, lat: locData.lat, lng: locData.lng };
            }
            setLocations(locState);
        }
    }, [profile]);

    // ── Geocode addresses that have no coords ──────────────────────────────────

    const geocodedRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const toGeocode = Object.entries(locations).filter(
            ([, v]) => v && v.lat === 0 && v.lng === 0 && v.address && !geocodedRef.current.has(v.address)
        );
        if (toGeocode.length === 0) return;
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
        if (!apiKey) return;
        let cancelled = false;
        (async () => {
            for (const [spot, locVal] of toGeocode) {
                geocodedRef.current.add(locVal!.address);
                try {
                    const resp = await fetch(
                        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locVal!.address)}&key=${apiKey}`
                    );
                    const json = await resp.json();
                    if (cancelled) return;
                    if (json.status === 'OK' && json.results?.[0]?.geometry?.location) {
                        const { lat, lng } = json.results[0].geometry.location;
                        setLocations(prev => ({ ...prev, [spot]: { ...prev[spot]!, lat, lng } }));
                    }
                } catch {}
            }
        })();
        return () => { cancelled = true; };
    }, [locations]);

    // ── Photo helpers ──────────────────────────────────────────────────────────

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

    // ── Save ───────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        const uid = supabaseUserId;
        if (!uid) return;
        setSaving(true);
        try {
            const locationPayload: { gym?: UserLocationData; home?: UserLocationData; park?: UserLocationData } = {};
            for (const spot of ['gym', 'home', 'park'] as const) {
                const loc = locations[spot];
                if (loc?.address) locationPayload[spot] = { address: loc.address, lat: loc.lat ?? 0, lng: loc.lng ?? 0 };
            }
            await updateProfile(uid, {
                fullName: fullName.trim(),
                username: username.trim().toLowerCase(),
                ...(age.trim() ? { age: parseInt(age.trim(), 10) } : {}),
                phone: phone.trim(),
                dateOfBirth: dob.trim(),
                gender: gender ?? undefined,
                locations: locationPayload,
            });
            Alert.alert('Saved', 'Account updated successfully!');
            TimezoneService.resolveAndSave(uid).catch(() => {});
            reminderWatcherService.reloadTimezone().catch(() => {});
        } catch {
            Alert.alert('Error', 'Could not save changes.');
        } finally { setSaving(false); }
    };

    // ── Sign out ───────────────────────────────────────────────────────────────

    const handleLogout = async () => {
        const doLogout = async () => {
            try {
                clearProfile();
                await logout();
                navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
            } catch (e) {
                console.error('Logout error:', e);
            }
        };
        if (typeof window !== 'undefined' && (window as any).confirm) {
            if ((window as any).confirm('Sign out?')) await doLogout();
        } else {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', onPress: doLogout, style: 'destructive' },
            ]);
        }
    };

    const hasPhoto = !!photoUri;

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={AppTheme.primaryColor} size={22} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account Settings</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── Avatar ── */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatarContainer}>
                        <WebSafeAvatar
                            uri={photoUri}
                            size={100}
                            fallback={
                                <View style={styles.avatarPlaceholder}>
                                    <CircleUserRound color={AppTheme.primaryColor} size={50} />
                                </View>
                            }
                        />
                        {uploading && (
                            <View style={styles.avatarOverlay}>
                                <Text style={styles.progressText}>{uploadPct}%</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.avatarActions}>
                        <TouchableOpacity style={styles.avatarBtn} onPress={pickAndUpload} disabled={uploading}>
                            <Camera color={AppTheme.primaryColor} size={15} />
                            <Text style={styles.avatarBtnText}>{hasPhoto ? 'Change Photo' : 'Upload Photo'}</Text>
                        </TouchableOpacity>
                        {hasPhoto && (
                            <TouchableOpacity style={[styles.avatarBtn, styles.avatarBtnDanger]} onPress={removePhoto} disabled={uploading}>
                                <Trash2 color="#ff5252" size={15} />
                                <Text style={[styles.avatarBtnText, { color: '#ff5252' }]}>Remove</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={styles.emailText}>{displayEmail}</Text>
                </View>

                {/* ── Profile Details ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Profile Details</Text>

                    <Text style={styles.fieldLabel}>Username</Text>
                    <View style={styles.usernameRow}>
                        <Text style={styles.atPrefix}>@</Text>
                        <TextInput
                            style={styles.usernameInner}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="e.g. irongrip_99"
                            placeholderTextColor={AppTheme.textGrey}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <Text style={styles.fieldLabel}>Full Name</Text>
                    <TextInput
                        style={styles.fieldInput}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Enter your full name"
                        placeholderTextColor={AppTheme.textGrey}
                    />

                    <Text style={styles.fieldLabel}>Age</Text>
                    <TextInput
                        style={styles.fieldInput}
                        value={age}
                        onChangeText={setAge}
                        placeholder="Enter your age"
                        placeholderTextColor={AppTheme.textGrey}
                        keyboardType="number-pad"
                    />

                    <Text style={styles.fieldLabel}>Phone</Text>
                    <TextInput
                        style={styles.fieldInput}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Enter your phone number"
                        placeholderTextColor={AppTheme.textGrey}
                        keyboardType="phone-pad"
                    />

                    <Text style={styles.fieldLabel}>Date of Birth</Text>
                    <TextInput
                        style={styles.fieldInput}
                        value={dob}
                        onChangeText={setDob}
                        placeholder="DD / MM / YYYY"
                        placeholderTextColor={AppTheme.textGrey}
                    />

                    <Text style={styles.fieldLabel}>Gender</Text>
                    <View style={styles.genderRow}>
                        {([
                            { value: 'male', label: '👦 Male' },
                            { value: 'female', label: '👧 Female' },
                        ] as { value: string; label: string }[]).map(({ value, label }) => (
                            <TouchableOpacity
                                key={value}
                                style={[styles.genderBtn, gender === value && styles.genderBtnSelected]}
                                onPress={() => setGender(gender === value ? null : value)}
                                activeOpacity={0.75}
                            >
                                <Text style={[styles.genderBtnText, gender === value && styles.genderBtnTextSelected]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Access Status ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Access Status</Text>
                    {accessType === 'subscription' && (
                        <TouchableOpacity style={styles.accessCard} activeOpacity={1}>
                            <View style={styles.subscriberBadge}>
                                <Text style={styles.subscriberText}>⭐ Subscriber</Text>
                            </View>
                            <Text style={styles.accessDesc}>Full access to all Raw1 features</Text>
                        </TouchableOpacity>
                    )}
                    {accessType === 'gripcuff' && (
                        <TouchableOpacity style={styles.accessCard} activeOpacity={1}>
                            <View style={styles.gripcuffBadge}>
                                <Text style={styles.gripcuffText}>🔗 GripCuff Activated</Text>
                            </View>
                            <Text style={styles.accessDesc}>Access granted via GripCuff order</Text>
                        </TouchableOpacity>
                    )}
                    {!accessType && (
                        <TouchableOpacity style={styles.accessCard} onPress={showPaywall} activeOpacity={0.75}>
                            <View style={styles.inactiveBadge}>
                                <Text style={styles.inactiveText}>🔒 Not Activated</Text>
                            </View>
                            <Text style={styles.accessDesc}>Tap to subscribe or enter GripCuff order</Text>
                        </TouchableOpacity>
                    )}
                    {!!gripcuffStatus && (
                        <View style={styles.gcStatusCard}>
                            <Text style={styles.gcStatusText}>
                                {gripcuffStatus === 'has_gripcuff'   && '🔗 I have the Gripcuff'}
                                {gripcuffStatus === 'using_at_gym'   && '🏋️ I am using the Gripcuff at gym'}
                                {gripcuffStatus === 'no_gripcuff'    && '📦 I don\'t have the Gripcuff'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── Workout Spots ── */}
                <View style={[styles.card, styles.locationCard as any]}>
                    <Text style={styles.cardTitle}>Workout Spots</Text>
                    <Text style={styles.spotSubLabel}>Add your spots to connect with your communities</Text>

                    <View style={styles.locationTabsRow}>
                        {BASE_SPOTS.map(spot => {
                            const isActive    = activeSpot === spot;
                            const hasLocation = !!locations[spot]?.address;
                            const label       = spot.charAt(0).toUpperCase() + spot.slice(1);
                            const sub         = spot === 'gym' ? 'Gym partners' : spot === 'home' ? 'Local' : 'Outdoor';
                            return (
                                <Pressable
                                    key={spot}
                                    style={({ pressed }) => [
                                        styles.locTab,
                                        isActive && styles.locTabActive,
                                        !isActive && hasLocation && styles.locTabHasData,
                                        pressed && { transform: [{ scale: 0.97 }] },
                                    ]}
                                    onPress={() => setActiveSpot(spot)}
                                >
                                    <Text style={[
                                        styles.locTabText,
                                        isActive && styles.locTabTextActive,
                                        !isActive && hasLocation && styles.locTabTextHasData,
                                    ]}>
                                        {isActive || hasLocation ? `✓ ${label}` : `+ ${label}`}
                                    </Text>
                                    <Text style={[styles.locTabSub, isActive && styles.locTabSubActive]}>
                                        {sub}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <LocationPickerField
                        value={locations[activeSpot] || null}
                        onChange={loc => setLocations(prev => ({ ...prev, [activeSpot]: loc as LocationValue }))}
                    />

                    {!!locations[activeSpot]?.address && (
                        locations[activeSpot]!.lat ? (
                            <LocationMapPreview
                                lat={locations[activeSpot]!.lat}
                                lng={locations[activeSpot]!.lng}
                                address={locations[activeSpot]!.address}
                                label={locations[activeSpot]!.placeName ?? ''}
                                isGym={activeSpot === 'gym'}
                            />
                        ) : (
                            <View style={styles.mapPlaceholder} />
                        )
                    )}
                </View>

                {/* ── Save ── */}
                <View style={styles.saveArea}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.saveButtonText}>Save Changes</Text>
                        }
                    </TouchableOpacity>
                </View>

                {/* ── Sign Out ── */}
                <View style={styles.signOutArea}>
                    <TouchableOpacity style={styles.signOutButton} onPress={handleLogout} activeOpacity={0.8}>
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const ACCENT = '#FF6B00';

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: AppTheme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SCREEN_PADDING,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    backButton: {
        width: 40,
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 17,
        fontWeight: FontWeights.bold as any,
        color: AppTheme.textWhite,
    },
    scrollContent: {
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: 56,
    },

    // Avatar
    avatarSection: {
        alignItems: 'center',
        paddingVertical: 24,
        gap: 12,
    },
    avatarContainer: {
        width: 100, height: 100,
        borderRadius: 50,
        position: 'relative',
    },
    avatarPlaceholder: {
        width: 100, height: 100,
        borderRadius: 50,
        backgroundColor: AppTheme.cardColor,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'rgba(228,102,0,0.3)',
    },
    avatarOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 50,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center', justifyContent: 'center',
    },
    progressText: {
        color: '#fff', fontSize: 14, fontWeight: '700',
    },
    avatarActions: {
        flexDirection: 'row',
        gap: 10,
    },
    avatarBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8, paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: AppTheme.cardColor,
        borderWidth: 1, borderColor: 'rgba(228,102,0,0.3)',
    },
    avatarBtnDanger: {
        borderColor: 'rgba(255,82,82,0.3)',
    },
    avatarBtnText: {
        color: AppTheme.primaryColor, fontSize: 12, fontWeight: '600',
    },
    emailText: {
        fontSize: FontSizes.small, color: AppTheme.textGrey,
    },

    // Card
    card: {
        backgroundColor: AppTheme.cardColor,
        borderRadius: 16,
        padding: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    } as any,
    locationCard: {
        zIndex: 9999,
        overflow: 'visible',
    },
    cardTitle: {
        fontSize: FontSizes.h3,
        fontWeight: FontWeights.bold as any,
        color: AppTheme.textWhite,
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: AppTheme.textGrey,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    fieldInput: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 11,
        fontSize: FontSizes.body,
        color: AppTheme.textWhite,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    usernameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 14, paddingLeft: 14,
    },
    atPrefix: {
        color: AppTheme.primaryColor, fontSize: 16, fontWeight: '700', marginRight: 2,
    },
    usernameInner: {
        flex: 1,
        paddingVertical: 11, paddingRight: 14,
        fontSize: FontSizes.body,
        color: AppTheme.textWhite,
    },
    genderRow: {
        flexDirection: 'row', gap: 10, marginBottom: 4,
    },
    genderBtn: {
        paddingVertical: 9, paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    },
    genderBtnSelected: {
        borderColor: AppTheme.primaryColor,
        backgroundColor: 'rgba(249,115,22,0.12)',
    },
    genderBtnText: {
        fontSize: 13, color: '#9CA3AF', fontWeight: '600',
    },
    genderBtnTextSelected: {
        color: AppTheme.primaryColor,
    },

    // Access status
    accessCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    subscriberBadge: {
        backgroundColor: '#FF6B00', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
    },
    subscriberText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    gripcuffBadge: {
        backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
        borderWidth: 1, borderColor: '#FF6B00',
    },
    gripcuffText: { color: '#FF6B00', fontSize: 11, fontWeight: '600' },
    inactiveBadge: {
        backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
        borderWidth: 1, borderColor: '#666',
    },
    inactiveText: { color: '#888', fontSize: 11 },
    accessDesc: { fontSize: 12, color: '#888', flex: 1 },
    gcStatusCard: {
        backgroundColor: '#242424', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 11,
        borderWidth: 1.5, borderColor: '#FF6B00',
        marginTop: 4,
    },
    gcStatusText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    // Location tabs
    spotSubLabel: {
        fontSize: 11, color: AppTheme.textGrey, marginTop: -8, marginBottom: 12,
    },
    locationTabsRow: {
        flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12,
    },
    locTab: {
        flex: 0, minWidth: 88,
        paddingVertical: 9, paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#0f1923',
        borderWidth: 1.5, borderColor: '#2a3a4a',
        alignItems: 'center',
    },
    locTabActive:   { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
    locTabHasData:  { backgroundColor: 'rgba(255,107,0,0.1)', borderColor: 'rgba(255,107,0,0.5)' },
    locTabText:     { color: '#8899aa', fontSize: 12, fontWeight: '600', textAlign: 'center' },
    locTabTextActive:   { color: '#ffffff', fontWeight: '700' },
    locTabTextHasData:  { color: '#FF6B00', fontWeight: '600' },
    locTabSub:          { fontSize: 9, color: '#8899aa', textAlign: 'center', marginTop: 2 },
    locTabSubActive:    { color: 'rgba(255,255,255,0.75)' },
    mapPlaceholder: {
        marginTop: 12, height: 160, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
    },

    // Save / Sign out
    saveArea:     { zIndex: 1, marginBottom: 10 },
    signOutArea:  { zIndex: 1, marginBottom: 10 },
    saveButton: {
        backgroundColor: AppTheme.primaryColor,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff', fontSize: FontSizes.body, fontWeight: FontWeights.bold as any,
    },
    signOutButton: {
        borderRadius: 12, paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: '#000',
    },
    signOutText: {
        color: AppTheme.textWhite, fontSize: FontSizes.body, fontWeight: FontWeights.semibold as any,
    },
});
