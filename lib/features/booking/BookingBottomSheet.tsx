import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Animated,
    Dimensions,
    ActivityIndicator,
    Platform,
} from 'react-native';
import Modal from 'react-native-modal';
import { X, User as UserIcon, Search, Check } from 'lucide-react-native';
import { CoachingTheme, FontSizes, FontWeights } from '../../core/theme/app_theme';
import { useAuth } from '../../providers/AuthContext';
import { BookingService } from '../../services/booking.service';

/* ─── Static Data ─── */
const COACHES = [
    { id: '1', name: 'Coach Alex', specialization: 'Strength & Conditioning' },
    { id: '2', name: 'Coach Mike', specialization: 'HIIT & Cardio' },
    { id: '3', name: 'Coach Sara', specialization: 'Yoga & Flexibility' },
    { id: '4', name: 'Coach James', specialization: 'Powerlifting' },
    { id: '5', name: 'Coach Priya', specialization: 'Weight Loss & Nutrition' },
];

const TIME_SLOTS = [
    '9:00 AM',
    '10:00 AM',
    '11:00 AM',
    '2:00 PM',
    '3:00 PM',
    '4:00 PM',
];

const SESSION_TYPES: Array<'Online' | 'In-Person'> = ['Online', 'In-Person'];

/* ─── Helpers ─── */
const getNext7Days = (): { label: string; date: Date }[] => {
    const days: { label: string; date: Date }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        days.push({
            label: `${dayNames[d.getDay()]} ${d.getDate()}`,
            date: d,
        });
    }
    return days;
};

/* ─── Toast Component ─── */
const Toast = ({
    message,
    visible,
    onDismiss,
}: {
    message: string;
    visible: boolean;
    onDismiss: () => void;
}) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-30)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
            ]).start();

            const timer = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
                    Animated.timing(translateY, { toValue: -30, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
                ]).start(() => onDismiss());
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                toastStyles.container,
                { opacity, transform: [{ translateY }] },
            ]}
        >
            <Text style={toastStyles.text}>{message}</Text>
        </Animated.View>
    );
};

const toastStyles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 24,
        right: 24,
        backgroundColor: CoachingTheme.cardDark,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: CoachingTheme.primaryBorder,
        zIndex: 9999,
        elevation: 10,
        boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
    },
    text: {
        color: CoachingTheme.textWhite,
        fontSize: FontSizes.body,
        fontWeight: FontWeights.semibold as any,
        textAlign: 'center',
    },
});

/* ─── Props ─── */
interface BookingBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    userCredits: number;
    onBookingComplete: (coachName: string) => void;
}

/* ─── Main Component ─── */
export const BookingBottomSheet: React.FC<BookingBottomSheetProps> = ({
    visible,
    onClose,
    userCredits,
    onBookingComplete,
}) => {
    const { supabaseUserId } = useAuth();
    const dates = getNext7Days();

    const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<number | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [coachSearch, setCoachSearch] = useState('');
    const [coachDropdownOpen, setCoachDropdownOpen] = useState(false);
    const [coachInputFocused, setCoachInputFocused] = useState(false);

    const filteredCoaches = COACHES.filter(
        (c) =>
            c.name.toLowerCase().includes(coachSearch.toLowerCase()) ||
            c.specialization.toLowerCase().includes(coachSearch.toLowerCase())
    );

    const selectedCoachObj = COACHES.find((c) => c.id === selectedCoach);

    const resetForm = useCallback(() => {
        setSelectedCoach(null);
        setSelectedDate(null);
        setSelectedTime(null);
        setNotes('');
        setCoachSearch('');
        setCoachDropdownOpen(false);
    }, []);

    const handleConfirm = async () => {
        if (!selectedCoach || selectedDate === null || !selectedTime) {
            // Simple inline validation alert
            return;
        }

        if (!supabaseUserId) return;

        try {
            setSubmitting(true);

            const coach = COACHES.find((c) => c.id === selectedCoach);
            const bookingDate = dates[selectedDate].date;

            await BookingService.createBooking({
                userId: supabaseUserId,
                coach: coach!.name,
                date: bookingDate,
                timeSlot: selectedTime,
                sessionType: 'Online',
                notes,
                creditsUsed: 1,
            });

            await BookingService.decrementCredits(supabaseUserId);

            resetForm();
            onClose();
            onBookingComplete(coach!.name);
        } catch (error) {
            console.error('Booking failed:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const isFormValid = selectedCoach && selectedDate !== null && selectedTime;

    return (
        <Modal
            isVisible={visible}
            onBackdropPress={onClose}
            onSwipeComplete={onClose}
            swipeDirection={['down']}
            style={styles.modal}
            backdropOpacity={0.6}
            propagateSwipe
            useNativeDriverForBackdrop
        >
            <View style={styles.sheet}>
                {/* Drag Handle */}
                <View style={styles.handleBar} />

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Book a Session</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <X color={CoachingTheme.textWhite} size={22} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ─── Coach Selection (Searchable Dropdown) ─── */}
                    <Text style={styles.sectionLabel}>Select Coach</Text>
                    <View style={styles.coachDropdownWrapper}>
                        {/* Search Input */}
                        <View style={[
                            styles.coachSearchBox,
                            coachInputFocused && styles.coachSearchBoxFocused,
                        ]}>
                            <Search color={CoachingTheme.textGrey} size={18} />
                            <TextInput
                                style={styles.coachSearchInput}
                                placeholder="Search for a coach..."
                                placeholderTextColor={CoachingTheme.textMuted}
                                value={coachDropdownOpen ? coachSearch : (
                                    selectedCoachObj
                                        ? `${selectedCoachObj.name}  ·  ${selectedCoachObj.specialization}`
                                        : ''
                                )}
                                onChangeText={(text) => {
                                    setCoachSearch(text);
                                    if (!coachDropdownOpen) setCoachDropdownOpen(true);
                                }}
                                onFocus={() => {
                                    setCoachDropdownOpen(true);
                                    setCoachInputFocused(true);
                                    setCoachSearch('');
                                }}
                                onBlur={() => setCoachInputFocused(false)}
                            />
                        </View>

                        {/* Dropdown List */}
                        {coachDropdownOpen && (
                            <View style={styles.coachDropdownList}>
                                <ScrollView
                                    style={{ maxHeight: 220 }}
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                    nestedScrollEnabled
                                >
                                    {filteredCoaches.length > 0 ? (
                                        filteredCoaches.map((coach) => {
                                            const active = selectedCoach === coach.id;
                                            return (
                                                <TouchableOpacity
                                                    key={coach.id}
                                                    style={[styles.coachDropdownItem, active && styles.coachDropdownItemActive]}
                                                    onPress={() => {
                                                        setSelectedCoach(coach.id);
                                                        setCoachDropdownOpen(false);
                                                        setCoachSearch('');
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    {/* Avatar */}
                                                    <View style={[
                                                        styles.coachAvatar,
                                                        active && styles.coachAvatarActive,
                                                    ]}>
                                                        <UserIcon
                                                            color={active ? CoachingTheme.primaryColor : CoachingTheme.textGrey}
                                                            size={18}
                                                        />
                                                    </View>
                                                    {/* Name + Spec */}
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.coachDropdownName}>
                                                            {coach.name}
                                                        </Text>
                                                        <Text style={styles.coachDropdownSpec}>
                                                            {coach.specialization}
                                                        </Text>
                                                    </View>
                                                    {/* Checkmark */}
                                                    {active && (
                                                        <Check color={CoachingTheme.primaryColor} size={20} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })
                                    ) : (
                                        <Text style={styles.coachDropdownEmpty}>No coaches found</Text>
                                    )}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* ─── Date Picker ─── */}
                    <Text style={styles.sectionLabel}>Select Date</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipRow}
                    >
                        {dates.map((d, idx) => {
                            const active = selectedDate === idx;
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.dateChip, active && styles.chipActive]}
                                    onPress={() => setSelectedDate(idx)}
                                    activeOpacity={0.7}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            active && styles.chipTextActive,
                                        ]}
                                    >
                                        {d.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* ─── Time Slot Grid ─── */}
                    <Text style={styles.sectionLabel}>Select Time</Text>
                    <View style={styles.timeGrid}>
                        {TIME_SLOTS.map((slot) => {
                            const active = selectedTime === slot;
                            return (
                                <TouchableOpacity
                                    key={slot}
                                    style={[styles.timeSlot, active && styles.chipActive]}
                                    onPress={() => setSelectedTime(slot)}
                                    activeOpacity={0.7}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            active && styles.chipTextActive,
                                        ]}
                                    >
                                        {slot}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* ─── Notes ─── */}
                    <Text style={styles.sectionLabel}>Notes (optional)</Text>
                    <TextInput
                        style={styles.notesInput}
                        placeholder="Add notes (optional)"
                        placeholderTextColor={CoachingTheme.textMuted}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />

                    {/* ─── Credits ─── */}
                    <View style={styles.creditsContainer}>
                        <Text style={styles.creditsText}>
                            This session costs{' '}
                            <Text style={styles.creditsHighlight}>1 Credit</Text> — You have{' '}
                            <Text style={styles.creditsHighlight}>{userCredits} Credits</Text>
                        </Text>
                    </View>

                    {/* ─── Confirm Button ─── */}
                    <TouchableOpacity
                        style={[
                            styles.confirmButton,
                            !isFormValid && styles.confirmButtonDisabled,
                        ]}
                        onPress={handleConfirm}
                        disabled={!isFormValid || submitting}
                        activeOpacity={0.8}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
};

/* ─── Exported Toast wrapper ─── */
export { Toast };

/* ─── Styles ─── */
const styles = StyleSheet.create({
    modal: {
        justifyContent: 'flex-end',
        margin: 0,
    },
    sheet: {
        backgroundColor: CoachingTheme.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
        paddingBottom: 32,
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: CoachingTheme.textMuted,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    title: {
        fontSize: FontSizes.h3,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.textWhite,
    },
    closeBtn: {
        padding: 6,
        backgroundColor: CoachingTheme.primaryGlow,
        borderRadius: 20,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },

    /* ── Sections ── */
    sectionLabel: {
        fontSize: FontSizes.body,
        fontWeight: FontWeights.semibold as any,
        color: CoachingTheme.textGrey,
        marginTop: 20,
        marginBottom: 10,
    },

    /* ── Coach Searchable Dropdown ── */
    coachDropdownWrapper: {
        zIndex: 999,
        position: 'relative',
    },
    coachSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CoachingTheme.cardDark,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: CoachingTheme.border,
    },
    coachSearchBoxFocused: {
        borderColor: CoachingTheme.primaryColor,
    },
    coachSearchInput: {
        flex: 1,
        marginLeft: 10,
        color: CoachingTheme.textWhite,
        fontSize: FontSizes.body,
        padding: 0,
    },
    coachDropdownList: {
        backgroundColor: CoachingTheme.cardDark,
        borderRadius: 12,
        marginTop: 6,
        borderWidth: 1,
        borderColor: CoachingTheme.border,
        overflow: 'hidden',
        elevation: 8,
        boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
    },
    coachDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    coachDropdownItemActive: {
        backgroundColor: CoachingTheme.primaryGlow,
    },
    coachDropdownName: {
        fontSize: 15,
        fontWeight: FontWeights.bold as any,
        color: CoachingTheme.textWhite,
    },
    coachDropdownSpec: {
        fontSize: 12,
        color: CoachingTheme.primaryColor,
        marginTop: 2,
    },
    coachDropdownEmpty: {
        padding: 16,
        textAlign: 'center',
        color: CoachingTheme.textGrey,
        fontSize: FontSizes.body,
    },
    coachAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: CoachingTheme.cardDark,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    coachAvatarActive: {
        backgroundColor: CoachingTheme.primaryGlow,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 10,
    },
    chipActive: {
        backgroundColor: CoachingTheme.primaryColor,
        borderColor: CoachingTheme.primaryColor,
    },
    chipText: {
        fontSize: FontSizes.body,
        fontWeight: FontWeights.semibold as any,
        color: CoachingTheme.textGrey,
    },
    chipTextActive: {
        color: '#fff',
    },

    /* ── Date Chips ── */
    dateChip: {
        backgroundColor: CoachingTheme.cardDark,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: CoachingTheme.border,
    },

    /* ── Time Grid ── */
    timeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    timeSlot: {
        width: '48%' as any,
        backgroundColor: CoachingTheme.cardDark,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: CoachingTheme.border,
    },

    /* ── Notes ── */
    notesInput: {
        backgroundColor: CoachingTheme.cardDark,
        borderRadius: 14,
        padding: 14,
        color: CoachingTheme.textWhite,
        fontSize: FontSizes.body,
        minHeight: 80,
        borderWidth: 1,
        borderColor: CoachingTheme.border,
    },

    /* ── Credits ── */
    creditsContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    creditsText: {
        fontSize: FontSizes.body,
        color: CoachingTheme.textGrey,
    },
    creditsHighlight: {
        color: CoachingTheme.primaryColor,
        fontWeight: FontWeights.bold as any,
    },

    /* ── Confirm ── */
    confirmButton: {
        backgroundColor: CoachingTheme.primaryColor,
        borderRadius: 28,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 20,
    },
    confirmButtonDisabled: {
        opacity: 0.45,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: FontSizes.h5,
        fontWeight: FontWeights.bold as any,
    },
});
