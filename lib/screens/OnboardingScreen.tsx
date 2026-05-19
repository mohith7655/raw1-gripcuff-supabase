import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, doc, getDocs, getDoc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { LocationPickerField, LocationValue } from '../components/profile/LocationPickerField';
import { CityPickerField, CityValue } from '../components/profile/CityPickerField';
import { useAuth } from '../providers/AuthContext';

const BASE_SPOTS = ['gym', 'home', 'park'];

const ORANGE = '#F97316';
const BG = '#0d1520';
const CARD = '#131f2e';

const MIN_AGE = 13;
const MAX_AGE = 100;

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const GENDER_OPTIONS = [
    { value: 'male',   label: '👦 Male'   },
    { value: 'female', label: '👧 Female' },
] as const;

type Gender = typeof GENDER_OPTIONS[number]['value'];

const TOTAL_STEPS = 4;

// ── Age calculation (timezone-safe, local dates only) ─────────────────────────
function calcAge(year: number, month: number, day: number | null): number {
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth() + 1; // 1-indexed
    const todayD = today.getDate();

    const useDay = day ?? 1;
    let age = todayY - year;
    // Subtract 1 if we haven't reached the birth month/day yet this year
    if (todayM < month || (todayM === month && todayD < useDay)) {
        age -= 1;
    }
    return age;
}

// ── DOB Picker ────────────────────────────────────────────────────────────────

interface DOBPickerProps {
    label: string;
    placeholder: string;
    options: { label: string; value: number }[];
    value: number | null;
    onChange: (v: number | null) => void;
    flex?: number;
    required?: boolean;
}

function DOBPicker({ label, placeholder, options, value, onChange, flex = 1, required }: DOBPickerProps) {
    const [open, setOpen] = useState(false);
    const displayLabel = value !== null
        ? options.find(o => o.value === value)?.label ?? String(value)
        : '';

    return (
        <View style={{ flex }}>
            <Text style={pickerStyles.fieldLabel}>
                {label}{required ? <Text style={{ color: ORANGE }}>*</Text> : ''}
            </Text>
            <TouchableOpacity
                style={[pickerStyles.trigger, value === null && pickerStyles.triggerEmpty]}
                onPress={() => setOpen(true)}
                activeOpacity={0.8}
            >
                <Text style={value !== null ? pickerStyles.triggerText : pickerStyles.placeholderText} numberOfLines={1}>
                    {displayLabel || placeholder}
                </Text>
                <Text style={pickerStyles.chevron}>▾</Text>
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={() => setOpen(false)} />
                <View style={pickerStyles.sheet}>
                    <View style={pickerStyles.sheetHandle} />
                    <Text style={pickerStyles.sheetTitle}>{label}</Text>
                    {!required && (
                        <TouchableOpacity
                            style={[pickerStyles.option, value === null && pickerStyles.optionSelected]}
                            onPress={() => { onChange(null); setOpen(false); }}
                        >
                            <Text style={[pickerStyles.optionText, value === null && pickerStyles.optionTextSelected]}>
                                — Not specified —
                            </Text>
                        </TouchableOpacity>
                    )}
                    <FlatList
                        data={options}
                        keyExtractor={item => String(item.value)}
                        showsVerticalScrollIndicator={false}
                        style={{ maxHeight: 300 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[pickerStyles.option, value === item.value && pickerStyles.optionSelected]}
                                onPress={() => { onChange(item.value); setOpen(false); }}
                            >
                                <Text style={[pickerStyles.optionText, value === item.value && pickerStyles.optionTextSelected]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </Modal>
        </View>
    );
}

const pickerStyles = StyleSheet.create({
    fieldLabel: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 6,
    },
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: CARD,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 12,
        paddingVertical: 13,
    },
    triggerEmpty: {
        borderColor: 'rgba(255,255,255,0.07)',
    },
    triggerText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    placeholderText: {
        color: '#4B5563',
        fontSize: 14,
        flex: 1,
    },
    chevron: {
        color: '#6B7280',
        fontSize: 12,
        marginLeft: 4,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1a2535',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingBottom: 40,
        paddingTop: 8,
    },
    sheetHandle: {
        width: 36, height: 4, borderRadius: 2,
        backgroundColor: '#374151',
        alignSelf: 'center', marginBottom: 12,
    },
    sheetTitle: {
        color: '#fff', fontSize: 16, fontWeight: '700',
        marginBottom: 10, paddingHorizontal: 4,
    },
    option: {
        paddingVertical: 13,
        paddingHorizontal: 14,
        borderRadius: 10,
        marginBottom: 4,
    },
    optionSelected: {
        backgroundColor: 'rgba(249,115,22,0.15)',
    },
    optionText: {
        color: '#9CA3AF',
        fontSize: 15,
        fontWeight: '500',
    },
    optionTextSelected: {
        color: ORANGE,
        fontWeight: '700',
    },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export function OnboardingScreen({ navigation }: any) {
    const { firebaseUid } = useAuth();
    const [step, setStep] = useState(1);

    // Step 1 — username
    const [username, setUsername] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [checkingUsername, setCheckingUsername] = useState(false);

    // Step 2 — DOB (structured) + gender
    const [birthMonth, setBirthMonth] = useState<number | null>(null); // 1–12
    const [birthDay,   setBirthDay]   = useState<number | null>(null); // 1–31, optional
    const [birthYear,  setBirthYear]  = useState<number | null>(null); // e.g. 2001

    const [gender, setGender] = useState<Gender | null>(null);

    // Step 3 — location
    const [cityValue,     setCityValue]     = useState<CityValue | null>(null);
    const [country,       setCountry]       = useState('');
    const [regionState,   setRegionState]   = useState('');
    const [city,          setCity]          = useState('');

    // Step 4 — workout location
    const [locations,       setLocations]       = useState<Record<string, LocationValue>>({});
    const [activeLocationSpot, setActiveLocationSpot] = useState<string>('gym');

    const [saving, setSaving] = useState(false);
    const [initializing, setInitializing] = useState(true);

    const uid = firebaseUid;

    // Load existing profile data and jump to first incomplete step
    useEffect(() => {
        if (!uid) { setInitializing(false); return; }
        getDoc(doc(db, 'users', uid)).then((snap) => {
            const data = snap.data();
            if (!data) { setInitializing(false); return; }

            if (data.username) setUsername(data.username);
            if (data.dob?.month) setBirthMonth(data.dob.month);
            if (data.dob?.day)   setBirthDay(data.dob.day);
            if (data.dob?.year)  setBirthYear(data.dob.year);
            if (data.gender)     setGender(data.gender as Gender);
            if (data.city) {
                setCity(data.city);
                setCountry(data.country || '');
                setRegionState(data.state || '');
                setCityValue({ city: data.city, state: data.state || '', country: data.country || '' } as CityValue);
            }
            if (data.locations) setLocations(data.locations);

            const hasUsername  = !!data.username;
            const hasDobGender = !!(data.dob?.month && data.dob?.year && data.gender);
            const hasCity      = !!(data.city || data.country);
            const hasLocation  = !!(data.locations && Object.values(data.locations as Record<string, any>).some(l => l?.address));

            if (!hasUsername)       setStep(1);
            else if (!hasDobGender) setStep(2);
            else if (!hasCity)      setStep(3);
            else if (!hasLocation)  setStep(4);
            else {
                // All fields already saved — just mark complete and go home
                setDoc(doc(db, 'users', uid), {
                    onboardingCompleted: true,
                    onboardingCompletedAt: serverTimestamp(),
                }, { merge: true }).catch(() => {});
                try { localStorage.setItem('onboarding_complete_' + uid, '1'); } catch {}
                navigation.reset({ index: 0, routes: [{ name: 'HomeTabs' }] });
                return;
            }
        }).catch(() => {}).finally(() => setInitializing(false));
    }, [uid]);

    // ── Picker option lists ────────────────────────────────────────────────────

    const monthOptions = MONTH_NAMES.map((name, i) => ({ label: name, value: i + 1 }));

    const dayOptions = useMemo(() => {
        if (!birthMonth || !birthYear) {
            return Array.from({ length: 31 }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
        }
        const daysInMonth = new Date(birthYear, birthMonth, 0).getDate(); // day=0 of next month = last day of this month
        return Array.from({ length: daysInMonth }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
    }, [birthMonth, birthYear]);

    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(() =>
        Array.from(
            { length: MAX_AGE - MIN_AGE + 1 },
            (_, i) => {
                const y = currentYear - MIN_AGE - i;
                return { label: String(y), value: y };
            }
        )
    , [currentYear]);

    // ── Real-time age calculation ──────────────────────────────────────────────

    const calculatedAge = useMemo(() => {
        if (!birthMonth || !birthYear) return null;
        return calcAge(birthYear, birthMonth, birthDay);
    }, [birthMonth, birthDay, birthYear]);

    const ageIsValid = calculatedAge !== null && calculatedAge >= MIN_AGE && calculatedAge <= MAX_AGE;
    const isDobMissing = !birthMonth || !birthYear;

    // ── Validation ─────────────────────────────────────────────────────────────

    const checkUsernameUnique = async (val: string): Promise<boolean> => {
        const snap = await getDocs(query(collection(db, 'users'), where('username', '==', val)));
        return snap.docs.every(d => d.id === uid);
    };

    const validateStep1 = async (): Promise<boolean> => {
        const clean = username.trim().toLowerCase();
        if (clean.length < 3) {
            setUsernameError('Username must be at least 3 characters');
            return false;
        }
        if (!/^[a-z0-9_]+$/.test(clean)) {
            setUsernameError('Only letters, numbers, and underscores are allowed');
            return false;
        }
        setCheckingUsername(true);
        try {
            const unique = await checkUsernameUnique(clean);
            if (!unique) {
                setUsernameError('This username is already taken');
                return false;
            }
        } catch {
            // network error — allow through optimistically
        } finally {
            setCheckingUsername(false);
        }
        setUsernameError('');
        return true;
    };

    const validateStep2 = (): boolean => {
        if (isDobMissing) {
            return false;
        }
        if (!ageIsValid) {
            if (calculatedAge !== null && calculatedAge < MIN_AGE) {
                Alert.alert('Age Restriction', `You must be at least ${MIN_AGE} years old.`);
            } else if (calculatedAge !== null && calculatedAge > MAX_AGE) {
                Alert.alert('Invalid Year', 'Please enter a valid birth year.');
            } else {
                Alert.alert('Invalid Date', 'The date of birth you entered appears invalid.');
            }
            return false;
        }
        if (!gender) {
            Alert.alert('Gender Required', 'Please select your gender to continue.');
            return false;
        }
        return true;
    };

    const validateStep3 = (): boolean => {
        if (!cityValue) {
            Alert.alert('City Required', 'Please search and select your city to continue.');
            return false;
        }
        return true;
    };

    const handleNext = async () => {
        if (step === 1) { if (!(await validateStep1())) return; }
        if (step === 2) {
            if (isDobMissing) {
                Alert.alert(
                    'Date of Birth',
                    'It helps tailor best workout.',
                    [
                        { text: 'Add DOB', style: 'cancel' },
                        {
                            text: 'Continue',
                            onPress: () => setStep((s) => (s < TOTAL_STEPS ? s + 1 : s)),
                        },
                    ]
                );
                return;
            }
            if (!validateStep2()) return;
        }
        if (step === 3) { if (!validateStep3()) return; }
        if (step < TOTAL_STEPS) {
            setStep(s => s + 1);
        } else {
            await handleFinish();
        }
    };

    const handleFinish = async () => {
        if (!uid) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'users', uid), {
                username: username.trim().toLowerCase(),
                dob: {
                    month: birthMonth,
                    day:   birthDay ?? null,
                    year:  birthYear,
                },
                age: calculatedAge ?? null,
                gender,
                country:         country.trim(),
                state:           regionState.trim(),
                city:            city.trim(),
                workoutLocation: Object.keys(locations).filter(k => locations[k]?.address)[0] ?? null, // legacy compatibility
                workoutLocations: Object.keys(locations).filter(k => locations[k]?.address),
                locations,
                location: locations['gym'] || Object.values(locations)[0] || null, // legacy compatibility
                onboardingCompleted:   true,
                onboardingCompletedAt: serverTimestamp(),
            }, { merge: true });
            try { localStorage.setItem('onboarding_complete_' + uid, '1'); } catch {}
            navigation.reset({ index: 0, routes: [{ name: 'HomeTabs' }] });
        } catch {
            Alert.alert('Error', 'Could not save your info. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = async () => {
        if (isDobMissing) {
            Alert.alert('Date of Birth', 'It helps tailor best workout.');
        }
        if (!uid) {
            navigation.reset({ index: 0, routes: [{ name: 'HomeTabs' }] });
            return;
        }
        try {
            await setDoc(doc(db, 'users', uid), {
                onboardingCompleted:   true,
                onboardingCompletedAt: serverTimestamp(),
            }, { merge: true });
        } catch {}
        try { localStorage.setItem('onboarding_complete_' + uid, '1'); } catch {}
        navigation.reset({ index: 0, routes: [{ name: 'HomeTabs' }] });
    };

    const progressPct = `${(step / TOTAL_STEPS) * 100}%`;

    if (initializing) {
        return (
            <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
                <ActivityIndicator color={ORANGE} size="large" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                {/* Progress bar */}
                <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: progressPct as any }]} />
                    </View>
                    <Text style={styles.stepLabel}>{step}/{TOTAL_STEPS}</Text>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Step 1: Username ────────────────────────────────── */}
                    {step === 1 && (
                        <View>
                            <Text style={styles.stepTitle}>Choose a Username</Text>
                            <Text style={styles.stepSubtitle}>
                                This is how others find you on Raw1. You can change it later.
                            </Text>
                            <Text style={styles.inputLabel}>Username</Text>
                            <View style={styles.usernameRow}>
                                <Text style={styles.atSign}>@</Text>
                                <TextInput
                                    style={[styles.usernameInput, !!usernameError && styles.inputError]}
                                    placeholder="e.g. irongrip_99"
                                    placeholderTextColor="#4B5563"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={username}
                                    onChangeText={(t) => { setUsername(t); setUsernameError(''); }}
                                />
                            </View>
                            {!!usernameError && <Text style={styles.errorText}>{usernameError}</Text>}
                            {checkingUsername && (
                                <View style={styles.checkingRow}>
                                    <ActivityIndicator color={ORANGE} size="small" />
                                    <Text style={styles.checkingText}>Checking availability…</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* ── Step 2: Personal Info ───────────────────────────── */}
                    {step === 2 && (
                        <View>
                            <Text style={styles.stepTitle}>About You</Text>
                            <Text style={styles.stepSubtitle}>
                                We use this to personalise your training experience.
                            </Text>

                            {/* DOB label row */}
                            <View style={styles.labelRow}>
                                <Text style={[styles.inputLabel, { marginBottom: 0 }]}>Date of Birth</Text>
                                <View style={styles.requiredBadge}>
                                    <Text style={styles.requiredBadgeText}>Month + Year required</Text>
                                </View>
                            </View>

                            {/* Three pickers in a row */}
                            <View style={styles.dobRow}>
                                <DOBPicker
                                    label="Month"
                                    placeholder="Month"
                                    options={monthOptions}
                                    value={birthMonth}
                                    onChange={setBirthMonth}
                                    flex={2.2}
                                    required
                                />
                                <View style={{ width: 8 }} />
                                <DOBPicker
                                    label="Day"
                                    placeholder="Day"
                                    options={dayOptions}
                                    value={birthDay}
                                    onChange={setBirthDay}
                                    flex={1.4}
                                />
                                <View style={{ width: 8 }} />
                                <DOBPicker
                                    label="Year"
                                    placeholder="Year"
                                    options={yearOptions}
                                    value={birthYear}
                                    onChange={setBirthYear}
                                    flex={1.6}
                                    required
                                />
                            </View>

                            {/* Real-time age preview */}
                            {calculatedAge !== null && (
                                <View style={[
                                    styles.agePill,
                                    !ageIsValid && styles.agePillError,
                                ]}>
                                    <Text style={[
                                        styles.agePillText,
                                        !ageIsValid && styles.agePillTextError,
                                    ]}>
                                        {ageIsValid
                                            ? `You are ${calculatedAge} years old`
                                            : calculatedAge < MIN_AGE
                                                ? `Must be at least ${MIN_AGE} years old`
                                                : 'Please enter a valid birth year'}
                                    </Text>
                                </View>
                            )}

                            <Text style={[styles.inputLabel, { marginTop: 24 }]}>Gender</Text>
                            <View style={styles.genderGrid}>
                                {GENDER_OPTIONS.map(({ value, label }) => (
                                    <TouchableOpacity
                                        key={value}
                                        style={[
                                            styles.genderPill,
                                            gender === value && styles.genderPillSelected,
                                        ]}
                                        onPress={() => setGender(value)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[
                                            styles.genderPillText,
                                            gender === value && styles.genderPillTextSelected,
                                        ]}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ── Step 3: Location ────────────────────────────────── */}
                    {step === 3 && (
                        <View style={{ zIndex: 9999 }}>
                            <Text style={styles.stepTitle}>Pick Your Community</Text>
                            <Text style={styles.stepSubtitle}>
                                Every rep feels lighter when someone nearby is grinding with you.
                            </Text>
                            <Text style={styles.inputLabel}>City</Text>
                            <CityPickerField
                                value={cityValue}
                                onChange={(val) => {
                                    setCityValue(val);
                                    setCity(val.city);
                                    setRegionState(val.state);
                                    setCountry(val.country);
                                }}
                            />
                        </View>
                    )}

                    {/* ── Step 4: Workout Spot ─────────────────────────────── */}
                    {step === 4 && (
                        <View>
                            <Text style={styles.stepTitle}>Your Workout Spot</Text>
                            <Text style={styles.stepSubtitle}>Tell us where you train most.</Text>
                            <View style={styles.locationWrap}>
                                <Text style={styles.inputLabel}>Workout Spots & Locations</Text>
                                
                                <View style={styles.locationTabsRow}>
                                    {BASE_SPOTS.map(spot => {
                                        const hasLocation = !!locations[spot]?.address;
                                        return (
                                            <TouchableOpacity 
                                                key={spot}
                                                style={[
                                                    styles.locTab, 
                                                    activeLocationSpot === spot && styles.locTabActive,
                                                    hasLocation && activeLocationSpot !== spot && styles.locTabHasData
                                                ]}
                                                onPress={() => setActiveLocationSpot(spot)}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={[
                                                    styles.locTabText, 
                                                    activeLocationSpot === spot && styles.locTabTextActive,
                                                    hasLocation && activeLocationSpot !== spot && styles.locTabTextHasData
                                                ]}>
                                                    {spot.charAt(0).toUpperCase() + spot.slice(1)} {hasLocation ? '✓' : ''}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                <LocationPickerField 
                                    value={locations[activeLocationSpot] || null} 
                                    onChange={(loc) => setLocations(prev => ({ ...prev, [activeLocationSpot]: loc as LocationValue }))} 
                                />
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.nextBtn, (saving || checkingUsername) && styles.nextBtnDisabled]}
                        onPress={handleNext}
                        disabled={saving || checkingUsername}
                        activeOpacity={0.85}
                    >
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.nextBtnText}>
                                {step === TOTAL_STEPS ? 'Finish' : 'Continue'}
                              </Text>
                        }
                    </TouchableOpacity>

                    {step !== 3 && (
                        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.7}>
                            <Text style={styles.skipText}>Skip for now</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: BG,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 8,
        gap: 12,
    },
    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        backgroundColor: ORANGE,
    },
    stepLabel: {
        color: '#6B7280',
        fontSize: 12,
        fontWeight: '600',
        minWidth: 28,
        textAlign: 'right',
    },
    scroll: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 24,
    },
    stepTitle: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '700',
        marginBottom: 8,
    },
    stepSubtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 32,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    requiredBadge: {
        backgroundColor: 'rgba(249,115,22,0.12)',
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    requiredBadgeText: {
        color: '#F97316',
        fontSize: 10,
        fontWeight: '600',
    },
    dobRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    agePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(249,115,22,0.1)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.25)',
        marginBottom: 4,
    },
    agePillError: {
        backgroundColor: 'rgba(239,68,68,0.1)',
        borderColor: 'rgba(239,68,68,0.3)',
    },
    agePillText: {
        color: ORANGE,
        fontSize: 14,
        fontWeight: '600',
    },
    agePillTextError: {
        color: '#EF4444',
    },
    inputLabel: {
        color: '#9CA3AF',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    input: {
        backgroundColor: CARD,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#fff',
        fontSize: 15,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    inputError: {
        borderColor: '#EF4444',
    },
    usernameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CARD,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 8,
        paddingLeft: 14,
    },
    atSign: {
        color: ORANGE,
        fontSize: 18,
        fontWeight: '700',
        marginRight: 4,
    },
    usernameInput: {
        flex: 1,
        paddingVertical: 14,
        paddingRight: 16,
        color: '#fff',
        fontSize: 15,
        borderWidth: 0,
    },
    errorText: {
        color: '#EF4444',
        fontSize: 13,
        marginBottom: 12,
    },
    checkingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    checkingText: {
        color: '#9CA3AF',
        fontSize: 13,
    },
    genderGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    genderPill: {
        paddingVertical: 11,
        paddingHorizontal: 18,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: CARD,
    },
    genderPillSelected: {
        borderColor: ORANGE,
        backgroundColor: 'rgba(249,115,22,0.12)',
    },
    genderPillText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },
    genderPillTextSelected: {
        color: ORANGE,
    },
    locationWrap: {
        zIndex: 9999,
    },
    locationTabsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    locTab: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    locTabActive: {
        backgroundColor: 'rgba(249,115,22,0.15)',
        borderColor: '#F97316',
    },
    locTabHasData: {
        borderColor: 'rgba(249,115,22,0.5)',
    },
    locTabText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
    },
    locTabTextActive: {
        color: '#F97316',
    },
    locTabTextHasData: {
        color: 'rgba(249,115,22,0.8)',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 16,
        paddingTop: 12,
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    nextBtn: {
        backgroundColor: ORANGE,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    nextBtnDisabled: {
        opacity: 0.55,
    },
    nextBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    skipBtn: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    skipText: {
        color: '#6B7280',
        fontSize: 14,
    },
});
