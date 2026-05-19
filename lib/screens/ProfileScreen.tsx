import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, CircleUserRound, Camera, Trash2, Users, ChevronRight } from 'lucide-react-native';
import { WebSafeAvatar } from '../components/WebSafeAvatar';
import * as ImagePicker from 'expo-image-picker';
import { getDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { useFriend } from '../providers/FriendContext';
import { useAccess } from '../providers/AccessContext';
import { StorageService } from '../services/storage.service';
import { db, storage } from '../core/config/firebase';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { SCREEN_PADDING } from '../constants/theme';
import { LocationPickerField, LocationValue } from '../components/profile/LocationPickerField';
import { LocationMapPreview } from '../components/profile/LocationMapPreview';
import { StreakService, StreakData } from '../services/streak.service';
import { TimezoneService } from '../services/timezone.service';
import { reminderWatcherService } from '../services/reminderWatcher.service';
import { ALL_BADGES, RewardsService } from '../services/rewards.service';

const BASE_SPOTS = ['gym', 'home', 'park'];

export const ProfileScreen = () => {
    const navigation = useNavigation<any>();
    const { firebaseUser, logout } = useAuth();
    const { profile, updateProfile, clearProfile } = useUser();
    const { friends } = useFriend();
    const { accessType, gripcuffStatus, showPaywall } = useAccess();

    const displayName = profile?.fullName || firebaseUser?.displayName || '';
    const displayEmail = profile?.email || firebaseUser?.email || '';
    const displayUsername = profile?.username || firebaseUser?.email?.split('@')[0] || '';

    const [fullName, setFullName] = useState(displayName);
    const [username, setUsername] = useState('');
    const [age, setAge] = useState('');
    const [phone, setPhone] = useState(profile?.phone ?? '');
    const [dob, setDob] = useState(profile?.dateOfBirth ?? '');
    const [gender, setGender] = useState<string | null>(null);
    const [locations, setLocations] = useState<Record<string, LocationValue>>({});
    const [activeLocationSpot, setActiveLocationSpot] = useState<string>('gym');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [saving, setSaving] = useState(false);
    // Local photo URI with cache-busting so Image re-renders immediately after upload
    const [photoUri, setPhotoUri] = useState<string | null>(
        profile?.profileImageUrl ? `${profile.profileImageUrl}?t=${Date.now()}` : null
    );

    // Read all profile fields directly from Firestore on mount.
    // Bypasses the UserContext race condition — profile may still be null
    // when this screen mounts (fetchProfile fires in background at app start).
    useEffect(() => {
        const uid = firebaseUser?.uid;
        if (!uid) return;
        getDoc(doc(db, 'users', uid)).then((snap) => {
            const data = snap.data();
            if (!data) return;
            setFullName(data.fullName || '');
            setUsername(data.username || '');
            setAge(data.age != null ? String(data.age) : '');
            setPhone(data.phone || '');
            setDob(data.dateOfBirth || '');
            if (data.profileImageUrl) {
                setPhotoUri(`${data.profileImageUrl}?t=${Date.now()}`);
            }
            if (data.gender) {
                setGender(data.gender);
            }
            if (data.locations) {
                setLocations(data.locations);
            } else if (data.location?.address) {
                const loc = data.location as LocationValue;
                const firstSpot = (Array.isArray(data.workoutLocations) && data.workoutLocations.length > 0) 
                    ? data.workoutLocations[0] 
                    : 'gym';
                setLocations({ [firstSpot]: loc });
            }
        }).catch((e) => console.error('ProfileScreen: failed to read profile from Firestore', e));
    }, [firebaseUser?.uid]);

    // ── Photo helpers ──────────────────────────────────────────────

    const pickAndUpload = async () => {
        const uid = firebaseUser?.uid;
        if (!uid) return;

        if (Platform.OS === 'web') {
            // expo-image-picker is unreliable on web — use a hidden file input instead
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e: any) => {
                const file: File | undefined = e.target?.files?.[0];
                if (!file) return;
                setUploading(true);
                setUploadProgress(0);
                try {
                    // Delete previous avatars first (best-effort)
                    try {
                        await StorageService.deleteProfilePicture(uid);
                    } catch {}
                    const storageRef = ref(storage, `avatars/${uid}/${Date.now()}.jpg`);
                    await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' });
                    const downloadUrl = await getDownloadURL(storageRef);
                    const cacheBustedUrl = `${downloadUrl}&t=${Date.now()}`;
                    await updateDoc(doc(db, 'users', uid), {
                        profileImageUrl: cacheBustedUrl,
                        updatedAt: serverTimestamp(),
                    });
                    setPhotoUri(cacheBustedUrl);
                    Alert.alert('Success', 'Profile picture updated!');
                } catch (e: any) {
                    console.error('Web upload error:', e);
                    Alert.alert('Upload failed', e?.message ?? 'Could not upload photo.');
                } finally {
                    setUploading(false);
                    setUploadProgress(0);
                }
            };
            input.click();
            return;
        }

        // Native (iOS / Android)
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
        try {
            setUploading(true);
            setUploadProgress(0);
            const url = await StorageService.uploadProfilePicture(uid, result.assets[0].uri, (pct) => {
                setUploadProgress(pct);
            });
            const cacheBustedUrl = `${url}?t=${Date.now()}`;
            setPhotoUri(cacheBustedUrl);
            await updateProfile(uid, { profileImageUrl: cacheBustedUrl });
        } catch (e: any) {
            console.error('Profile picture upload error:', e);
            Alert.alert('Upload failed', e?.message ?? 'Could not upload photo. Check Firebase Storage rules.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const removePhoto = async () => {
        const uid = firebaseUser?.uid;
        if (!uid) return;
        Alert.alert('Remove Photo', 'Are you sure you want to remove your profile picture?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        setUploading(true);
                        await StorageService.deleteProfilePicture(uid); // silently ignores 'object-not-found'
                        await updateProfile(uid, { profileImageUrl: null as any }); // null clears Firestore field
                        setPhotoUri(null);
                        Alert.alert('Done', 'Profile picture removed.');
                    } catch (e: any) {
                        console.error('Remove photo error:', e);
                        Alert.alert('Error', e?.message ?? 'Could not remove photo.');
                    } finally {
                        setUploading(false);
                    }
                },
            },
        ]);
    };

    // ── Save changes ───────────────────────────────────────────────

    const handleSave = async () => {
        const uid = firebaseUser?.uid;
        if (!uid) return;
        try {
            setSaving(true);
            await updateProfile(uid, {
                fullName: fullName.trim(),
                username: username.trim().toLowerCase(),
                ...(age.trim() ? { age: parseInt(age.trim(), 10) } : {}),
                phone: phone.trim(),
                dateOfBirth: dob.trim(),
                gender,
                workoutLocation: Object.keys(locations).filter(k => locations[k]?.address)[0] ?? null, // legacy compatibility
                workoutLocations: Object.keys(locations).filter(k => locations[k]?.address),
                locations,
                location: locations['gym'] || Object.values(locations)[0] || null, // legacy compatibility
            });
            Alert.alert('Saved', 'Profile updated successfully!');
            // Re-resolve timezone from the newly saved workout location
            TimezoneService.resolveAndSave(uid).catch(() => {});
            reminderWatcherService.reloadTimezone().catch(() => {});
        } catch {
            Alert.alert('Error', 'Could not save changes.');
        } finally {
            setSaving(false);
        }
    };

    // ── Sign out ──────────────────────────────────────────────────

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
            if ((window as any).confirm('Are you sure you want to sign out?')) await doLogout();
        } else {
            Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', onPress: doLogout, style: 'destructive' },
            ]);
        }
    };

    const hasPhoto = !!photoUri;

    // Streak data for profile section
    const [streakData, setStreakData] = useState<StreakData | null>(null);
    useEffect(() => {
        const uid = firebaseUser?.uid;
        if (!uid) return;
        StreakService.getStreakData(uid).then(setStreakData).catch(() => {});
    }, [firebaseUser?.uid]);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={AppTheme.primaryColor} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── Avatar Section ── */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatarContainer}>
                        <WebSafeAvatar
                            uri={photoUri}
                            size={120}
                            fallback={
                                <View style={styles.avatarPlaceholder}>
                                    <CircleUserRound color={AppTheme.primaryColor} size={60} />
                                </View>
                            }
                        />
                        {uploading && (
                            <View style={styles.avatarOverlay}>
                                <Text style={styles.progressText}>{uploadProgress}%</Text>
                            </View>
                        )}
                    </View>

                    {/* Avatar action buttons */}
                    <View style={styles.avatarActions}>
                        <TouchableOpacity style={styles.avatarActionBtn} onPress={pickAndUpload} disabled={uploading}>
                            <Camera color={AppTheme.primaryColor} size={16} />
                            <Text style={styles.avatarActionText}>{hasPhoto ? 'Change' : 'Upload'}</Text>
                        </TouchableOpacity>
                        {hasPhoto && (
                            <TouchableOpacity style={[styles.avatarActionBtn, styles.avatarActionBtnDanger]} onPress={removePhoto} disabled={uploading}>
                                <Trash2 color="#ff5252" size={16} />
                                <Text style={[styles.avatarActionText, { color: '#ff5252' }]}>Remove</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.usernameText}>@{displayUsername}</Text>
                    <Text style={styles.emailText}>{displayEmail}</Text>
                </View>

                {/* ── Streak & Stats Overview ── */}
                {streakData && (
                    <View style={profileStreakStyles.card}>
                        <Text style={profileStreakStyles.sectionTitle}>My Progress</Text>

                        {/* 2x2 stats grid */}
                        <View style={profileStreakStyles.statsGrid}>
                            <View style={profileStreakStyles.statCell}>
                                <Text style={profileStreakStyles.statValue}>🔥 {streakData.currentStreak}</Text>
                                <Text style={profileStreakStyles.statLabel}>Current Streak</Text>
                            </View>
                            <View style={profileStreakStyles.statCell}>
                                <Text style={profileStreakStyles.statValue}>⚡ {streakData.bestStreak}</Text>
                                <Text style={profileStreakStyles.statLabel}>Best Streak</Text>
                            </View>
                            <View style={profileStreakStyles.statCell}>
                                <Text style={profileStreakStyles.statValue}>💪 {streakData.totalWorkouts}</Text>
                                <Text style={profileStreakStyles.statLabel}>Workouts</Text>
                            </View>
                            <View style={profileStreakStyles.statCell}>
                                <Text style={profileStreakStyles.statValue}>🪙 {streakData.credits}</Text>
                                <Text style={profileStreakStyles.statLabel}>Credits</Text>
                            </View>
                        </View>

                        {/* Weekly activity dots */}
                        <Text style={profileStreakStyles.weekLabel}>This Week</Text>
                        <View style={profileStreakStyles.weekRow}>
                            {['M','T','W','T','F','S','S'].map((day, i) => {
                                const d = new Date();
                                const todayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
                                const offset = i - todayIdx;
                                const date = new Date(d);
                                date.setDate(date.getDate() + offset);
                                const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
                                const active = !!streakData.weeklyActivity[key];
                                return (
                                    <View key={i} style={profileStreakStyles.dayCol}>
                                        <View style={[profileStreakStyles.dayDot, active && profileStreakStyles.dayDotActive, i === todayIdx && !active && profileStreakStyles.dayDotToday]} />
                                        <Text style={[profileStreakStyles.dayLabel, active && profileStreakStyles.dayLabelActive]}>{day}</Text>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Reward tier progress */}
                        {(() => {
                            const next = RewardsService.getNextMilestone(streakData.totalWorkouts);
                            if (!next) return null;
                            const prev = [1,7,14,30,50,100].reverse().find(m => m <= streakData.totalWorkouts) ?? 0;
                            const range = next.workoutsLeft + (streakData.totalWorkouts - prev);
                            const pct = range > 0 ? Math.max(0, Math.min(1, (streakData.totalWorkouts - prev) / range)) : 0;
                            return (
                                <View style={profileStreakStyles.milestoneBlock}>
                                    <View style={profileStreakStyles.milestoneHeader}>
                                        <Text style={profileStreakStyles.milestoneLabel}>Next: {next.label}</Text>
                                        <Text style={profileStreakStyles.milestoneCount}>{next.workoutsLeft} workouts away</Text>
                                    </View>
                                    <View style={profileStreakStyles.progressBar}>
                                        <View style={[profileStreakStyles.progressFill, { width: `${pct * 100}%` as any }]} />
                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                )}

                {/* ── Badges ── */}
                {streakData && (
                    <View style={profileStreakStyles.card}>
                        <Text style={profileStreakStyles.sectionTitle}>Badges</Text>
                        <View style={profileStreakStyles.badgesGrid}>
                            {ALL_BADGES.map(badge => {
                                const earned = streakData.badges.includes(badge.id);
                                return (
                                    <View
                                        key={badge.id}
                                        style={[profileStreakStyles.badgeChip, !earned && profileStreakStyles.badgeChipLocked]}
                                    >
                                        <Text style={[profileStreakStyles.badgeEmoji, !earned && profileStreakStyles.badgeEmojiLocked]}>
                                            {earned ? badge.emoji : '🔒'}
                                        </Text>
                                        <Text style={[profileStreakStyles.badgeLabel, !earned && profileStreakStyles.badgeLabelLocked]}>
                                            {badge.label}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ── Profile Details Card ── */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Profile Details</Text>

                    <Text style={styles.fieldLabel}>Username</Text>
                    <View style={styles.usernameInputRow}>
                        <Text style={styles.atPrefix}>@</Text>
                        <TextInput
                            style={styles.usernameInnerInput}
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

                    <Text style={styles.fieldLabel}>Access Status</Text>
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
                        <>
                            <Text style={styles.fieldLabel}>Gripcuff Status</Text>
                            <View style={styles.gcStatusCard}>
                                <Text style={styles.gcStatusText}>
                                    {gripcuffStatus === 'has_gripcuff' && '🔗 I have the Gripcuff'}
                                    {gripcuffStatus === 'using_at_gym' && '🏋️ I am using the Gripcuff at gym'}
                                    {gripcuffStatus === 'no_gripcuff' && '📦 I don\'t have the Gripcuff'}
                                </Text>
                            </View>
                        </>
                    )}

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
                                <Text style={[styles.genderIcon, gender === value && styles.genderIconSelected]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* zIndex isolation so dropdown floats above Save/Sign Out */}
                    <View style={styles.locationPickerContainer}>
                        <Text style={styles.fieldLabel}>Workout Spots & Locations</Text>
                        <Text style={styles.spotSubLabel}>Add your spots to connect with your communities</Text>

                        <View style={styles.locationTabsRow}>
                            {BASE_SPOTS.map(spot => {
                                const isActive = activeLocationSpot === spot;
                                const hasLocation = !!locations[spot]?.address;
                                const label = spot.charAt(0).toUpperCase() + spot.slice(1);
                                const subText = spot === 'gym' ? 'Find gym partners' : spot === 'home' ? 'Connect locally' : 'Outdoor community';
                                return (
                                    <Pressable
                                        key={spot}
                                        style={({ pressed }) => [
                                            styles.locTab,
                                            isActive && styles.locTabActive,
                                            !isActive && hasLocation && styles.locTabHasData,
                                            pressed && { transform: [{ scale: 0.97 }] },
                                        ]}
                                        onPress={() => setActiveLocationSpot(spot)}
                                    >
                                        <Text style={[
                                            styles.locTabText,
                                            isActive && styles.locTabTextActive,
                                            !isActive && hasLocation && styles.locTabTextHasData,
                                        ]}>
                                            {isActive || hasLocation ? `✓ ${label}` : `+ ${label}`}
                                        </Text>
                                        <Text style={[
                                            styles.locTabSub,
                                            isActive && styles.locTabSubActive,
                                        ]}>
                                            {subText}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <LocationPickerField 
                            value={locations[activeLocationSpot] || null} 
                            onChange={(loc) => setLocations(prev => ({ ...prev, [activeLocationSpot]: loc as LocationValue }))} 
                        />

                        {locations[activeLocationSpot]?.lat && locations[activeLocationSpot]?.address && (
                            <LocationMapPreview
                                lat={locations[activeLocationSpot].lat!}
                                lng={locations[activeLocationSpot].lng!}
                                address={locations[activeLocationSpot].address!}
                                label={locations[activeLocationSpot].placeName ?? ''}
                                isGym={activeLocationSpot === 'gym'}
                            />
                        )}
                    </View>

                    <View style={styles.saveArea}>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving} activeOpacity={0.8}>
                            {saving
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.saveButtonText}>Save Changes</Text>
                            }
                        </TouchableOpacity>
                    </View>
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
    },
    backButton: {
        width: 40,
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: FontWeights.bold as any,
        color: AppTheme.textWhite,
    },
    scrollContent: {
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: 48,
    },

    // Avatar
    avatarSection: {
        alignItems: 'center',
        paddingVertical: 28,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 16,
        position: 'relative',
    },
    avatarImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: AppTheme.cardColor,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(228,102,0,0.3)',
    },
    avatarOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 60,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    avatarActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    avatarActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: AppTheme.cardColor,
        borderWidth: 1,
        borderColor: 'rgba(228,102,0,0.3)',
    },
    avatarActionBtnDanger: {
        borderColor: 'rgba(255,82,82,0.3)',
    },
    avatarActionText: {
        color: AppTheme.primaryColor,
        fontSize: 13,
        fontWeight: '600',
    },
    usernameText: {
        fontSize: FontSizes.body,
        fontWeight: FontWeights.semibold as any,
        color: AppTheme.textWhite,
        marginBottom: 4,
    },
    emailText: {
        fontSize: FontSizes.small,
        color: AppTheme.textGrey,
    },

    // Card
    card: {
        backgroundColor: AppTheme.cardColor,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        overflow: 'visible',
    } as any,
    cardTitle: {
        fontSize: FontSizes.h3,
        fontWeight: FontWeights.bold as any,
        color: AppTheme.textWhite,
        marginBottom: 20,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: AppTheme.textGrey,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    fieldInput: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: FontSizes.body,
        color: AppTheme.textWhite,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    fieldInputReadOnly: {
        opacity: 0.5,
    },
    usernameInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
        paddingLeft: 14,
    },
    atPrefix: {
        color: AppTheme.primaryColor,
        fontSize: 16,
        fontWeight: '700',
        marginRight: 2,
    },
    usernameInnerInput: {
        flex: 1,
        paddingVertical: 12,
        paddingRight: 14,
        fontSize: FontSizes.body,
        color: AppTheme.textWhite,
    },
    genderRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    genderBtn: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    genderBtnSelected: {
        borderColor: AppTheme.primaryColor,
        backgroundColor: 'rgba(249,115,22,0.12)',
    },
    genderIcon: {
        fontSize: 13,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    genderIconSelected: {
        color: AppTheme.primaryColor,
    },
    saveButton: {
        backgroundColor: AppTheme.primaryColor,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: FontSizes.body,
        fontWeight: FontWeights.bold as any,
    },

    // Access status card
    accessCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
    },
    subscriberBadge: {
        backgroundColor: '#FF6B00',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    subscriberText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600' as any,
    },
    gripcuffBadge: {
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#FF6B00',
    },
    gripcuffText: {
        color: '#FF6B00',
        fontSize: 11,
        fontWeight: '600' as any,
    },
    inactiveBadge: {
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#666',
    },
    inactiveText: {
        color: '#888',
        fontSize: 11,
    },
    accessDesc: {
        fontSize: 12,
        color: '#888',
        flex: 1,
    },
    gcStatusCard: {
        backgroundColor: '#242424',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderColor: '#FF6B00',
        marginBottom: 6,
    },
    gcStatusText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    // Friends row
    friendsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: AppTheme.cardColor,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
    },
    friendsRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    friendsIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(249,115,22,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    friendsLabel: {
        fontSize: FontSizes.body,
        fontWeight: FontWeights.semibold as any,
        color: AppTheme.textWhite,
    },
    friendsCount: {
        fontSize: FontSizes.small,
        color: AppTheme.textGrey,
        marginTop: 2,
    },

    // Location picker container — high zIndex so dropdown floats above buttons
    locationPickerContainer: {
        zIndex: 9999,
        position: 'relative',
    } as any,
    spotSubLabel: {
        fontSize: 11,
        color: AppTheme.textGrey,
        marginTop: -2,
        marginBottom: 10,
    },
    locationTabsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    locTab: {
        flex: 0,
        minWidth: 90,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#0f1923',
        borderWidth: 1.5,
        borderColor: '#2a3a4a',
        alignItems: 'center',
    },
    locTabActive: {
        backgroundColor: '#FF6B00',
        borderColor: '#FF6B00',
    },
    locTabHasData: {
        backgroundColor: 'rgba(255,107,0,0.1)',
        borderColor: 'rgba(255,107,0,0.5)',
    },
    locTabText: {
        color: '#8899aa',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    locTabTextActive: {
        color: '#ffffff',
        fontWeight: '700' as any,
    },
    locTabTextHasData: {
        color: '#FF6B00',
        fontWeight: '600' as any,
    },
    locTabSub: {
        fontSize: 9,
        color: '#8899aa',
        textAlign: 'center',
        marginTop: 3,
    },
    locTabSubActive: {
        color: 'rgba(255,255,255,0.75)',
    },

    // Save and sign out wrappers — low zIndex so they go behind open dropdown
    saveArea: {
        zIndex: 1,
    },
    signOutArea: {
        zIndex: 1,
    },

    // Sign out
    signOutButton: {
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: '#000',
    },
    signOutText: {
        color: AppTheme.textWhite,
        fontSize: FontSizes.body,
        fontWeight: FontWeights.semibold as any,
    },
});

const ACCENT = '#FF6B00';

const profileStreakStyles = StyleSheet.create({
    card: {
        backgroundColor: AppTheme.cardColor,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: SCREEN_PADDING,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.14)',
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 14,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
    },
    statCell: {
        width: '47%',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        padding: 12,
    },
    statValue: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 3,
    },
    statLabel: {
        color: '#4a6480',
        fontSize: 11,
        fontWeight: '600',
    },
    weekLabel: {
        color: '#4a6480',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    dayCol: { alignItems: 'center', gap: 4 },
    dayDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    dayDotActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    dayDotToday: { borderColor: ACCENT, borderWidth: 2 },
    dayLabel: { color: '#3a5470', fontSize: 10, fontWeight: '600' },
    dayLabelActive: { color: ACCENT },
    milestoneBlock: { gap: 6 },
    milestoneHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    milestoneLabel: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
    milestoneCount: { color: '#4a6480', fontSize: 11 },
    progressBar: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: ACCENT,
        borderRadius: 3,
    },
    badgesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    badgeChip: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,107,0,0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.35)',
        paddingVertical: 10,
        paddingHorizontal: 12,
        width: '30%',
    },
    badgeChipLocked: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.07)',
    },
    badgeEmoji: { fontSize: 24, marginBottom: 4 },
    badgeEmojiLocked: { opacity: 0.4 },
    badgeLabel: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: '600',
        textAlign: 'center',
    },
    badgeLabelLocked: { color: '#3a5470' },
});
