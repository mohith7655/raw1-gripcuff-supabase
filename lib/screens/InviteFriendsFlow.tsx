import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    ActivityIndicator,
    SafeAreaView,
    Platform,
    Alert,
    KeyboardAvoidingView,
    Linking,
    PermissionsAndroid
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Search, Shield, ShieldAlert, ShieldCheck, User } from 'lucide-react-native';

/**
 * InviteFriendsFlow - 3 Screen Implementation
 * Matches EXACT design specs.
 */

// Theme Constants
const THEME = {
    bg: '#0d1520',
    card: '#162336', // Used optionally if needed, but keeping main bg #0d1520
    cardBorder: '#1e3a5a',
    primaryGradStart: '#C86830',
    primaryGradEnd: '#A04E1E',
    textMain: '#ffffff',
    textSub: '#607a94',
    inputBg: '#13202e',
    btnCancel: '#C15F2A',
    success: '#10b981',
    userIconBg: '#1a2a3e',
};

// --- Types ---
type ScreenState = 'MANUAL' | 'PERMISSION' | 'CONTACTS';

interface ContactItem {
    id: string;
    name: string;
    phone: string;
    invited: boolean;
    initials: string;
    color: string;
}

// Generate deterministic color from string
const getColorFromName = (name: string) => {
    const colors = ['#e11d48', '#d97706', '#059669', '#2563eb', '#7c3aed', '#db2777', '#0891b2'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length > 0) return parts[0][0].toUpperCase();
    return '?';
};

export const InviteFriendsFlow = ({ route, navigation }: any) => {
    // Determine initial registered users from route params if available
    const registeredPhones: string[] = route?.params?.registeredPhones || [];

    // --- State ---
    // Start at Screen 2: Permission Request (unless web)
    const [currentScreen, setCurrentScreen] = useState<ScreenState>('PERMISSION');

    // Contacts Data State
    const [contacts, setContacts] = useState<ContactItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Loading & Error States
    const [isLoading, setIsLoading] = useState(false);

    // Manual Entry State
    const [manualPhone, setManualPhone] = useState('');

    // --- Action Handlers ---

    const handleSendManualSMS = () => {
        if (!manualPhone.trim()) return;

        const message = encodeURIComponent("Hey, i have just started using raw1 for my fitness. self coaching ,personal coaching and workout coachig and self coaching all in one place. You should check it out: https://apps.apple.com");
        const smsUrl = `sms:${manualPhone}?body=${message}`;

        Linking.openURL(smsUrl).catch(() => {
            Alert.alert('Error', 'Could not open SMS app.');
        });

        // Navigate to Screen 2
        setCurrentScreen('PERMISSION');
        setManualPhone('');
    };

    const requestPermissionAndFetch = async () => {
        setIsLoading(true);
        const message = "Hey, i have just started using raw1 for my fitness. self coaching ,personal coaching and workout coachig and self coaching all in one place. Thought of you, give it a try! https://apps.apple.com";
        const smsUrl = `sms:?body=${encodeURIComponent(message)}`;

        try {
            if (Platform.OS === 'web') {
                window.open(smsUrl, '_blank');
            } else {
                await Linking.openURL(smsUrl);
            }
            // Close the flow after kicking them out to the native SMS app
            setTimeout(closeFlow, 500);
        } catch (error) {
            Alert.alert('Error', 'Could not open SMS app.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchContacts = async () => {
        setIsLoading(true);
        try {
            const validContacts: ContactItem[] = [];
            const normalizePhone = (p: string) => p.replace(/\D/g, '');
            const normalizedRegistered = registeredPhones.map(normalizePhone);

            // MOCK WEB DATA
            if (Platform.OS === 'web') {
                const mockData = [
                    { name: 'Sarah Jenkins', phone: '+1 415 555 1234' },
                    { name: 'Marcus Rodriguez', phone: '+1 512 555 9876' },
                    { name: 'Emma Wilson', phone: '+1 212 555 4567' },
                    { name: 'David Chen', phone: '+1 310 555 8888' },
                    { name: 'Jessica Patel', phone: '+1 206 555 3333' },
                    { name: 'Michael Thompson', phone: '+1 617 555 9999' },
                    { name: 'Alex Foster', phone: '+1 404 555 1111' },
                    { name: 'Jordan Lee', phone: '+1 305 555 2222' }
                ];

                mockData.forEach((c, idx) => {
                    const phoneNorm = normalizePhone(c.phone);
                    const isRegistered = normalizedRegistered.some(
                        rp => phoneNorm.includes(rp) || rp.includes(phoneNorm)
                    );
                    if (!isRegistered) {
                        validContacts.push({
                            id: `mock-${idx}`,
                            name: c.name,
                            phone: c.phone,
                            invited: false,
                            initials: getInitials(c.name),
                            color: getColorFromName(c.name)
                        });
                    }
                });

                setContacts(validContacts);
                setIsLoading(false);
                return;
            }

            // NATIVE DEVICE DATA
            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
                sort: Contacts.SortTypes.FirstName,
            });



            data.forEach(c => {
                if (c.phoneNumbers && c.phoneNumbers.length > 0 && c.name) {
                    const phoneRaw = c.phoneNumbers[0].number || '';
                    const phoneNorm = normalizePhone(phoneRaw);

                    // Filter: Only add if phone has 7+ digits AND isn't in registered list
                    if (phoneNorm.length >= 7) {
                        const isRegistered = normalizedRegistered.some(
                            rp => phoneNorm.includes(rp) || rp.includes(phoneNorm)
                        );

                        if (!isRegistered) {
                            validContacts.push({
                                id: c.id || Math.random().toString(),
                                name: c.name,
                                phone: phoneRaw,
                                invited: false,
                                initials: getInitials(c.name),
                                color: getColorFromName(c.name)
                            });
                        }
                    }
                }
            });

            // Remove duplicates by phone number
            const uniqueMap = new Map();
            validContacts.forEach(c => {
                const norm = normalizePhone(c.phone);
                if (!uniqueMap.has(norm)) {
                    uniqueMap.set(norm, c);
                }
            });

            setContacts(Array.from(uniqueMap.values()));
        } catch (error) {
            Alert.alert('Error', 'Failed to load contacts');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (id: string, isInvited: boolean) => {
        if (isInvited) return; // Already invited

        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const sendBulkInvites = () => {
        if (selectedIds.size === 0) return;

        const selectedContacts = contacts.filter(c => selectedIds.has(c.id));
        const phoneNumbers = selectedContacts.map(c => c.phone).join(',');

        const message = encodeURIComponent("Hey, i have just started using raw1 for my fitness. self coaching ,personal coaching and workout coachig and self coaching all in one place. Thought of you, give it a try! https://apps.apple.com");
        const smsUrl = Platform.OS === 'ios' ? `sms:/open?addresses=${phoneNumbers}&body=${message}` : `sms:${phoneNumbers}?body=${message}`;

        Linking.openURL(smsUrl).catch(() => {
            Alert.alert('Error', 'Could not open SMS app.');
        });

        // Mark as visibly invited
        setContacts(prev => prev.map(c =>
            selectedIds.has(c.id) ? { ...c, invited: true } : c
        ));
        setSelectedIds(new Set());
    };

    const closeFlow = () => {
        navigation.goBack();
    };

    // --- Render Helpers ---

    const filteredContacts = useMemo(() => {
        if (!searchQuery) return contacts;
        const lowerQ = searchQuery.toLowerCase();
        return contacts.filter(c =>
            c.name.toLowerCase().includes(lowerQ) ||
            String(c.phone ?? '').replace(/\D/g, '').includes(String(searchQuery ?? '').replace(/\D/g, ''))
        );
    }, [contacts, searchQuery]);

    // Split contacts into two sections: "NOT ON APP" and "INVITED"
    const notOnAppContacts = useMemo(() => filteredContacts.filter(c => !c.invited), [filteredContacts]);
    const invitedContacts = useMemo(() => filteredContacts.filter(c => c.invited), [filteredContacts]);

    const renderContactItem = useCallback(({ item }: { item: ContactItem }) => {
        const isSelected = selectedIds.has(item.id);

        return (
            <TouchableOpacity
                style={styles.contactRow}
                onPress={() => toggleSelection(item.id, item.invited)}
                activeOpacity={item.invited ? 1 : 0.7}
            >
                <View style={[styles.avatar, { backgroundColor: item.color }]}>
                    <Text style={styles.avatarText}>{item.initials}</Text>
                </View>

                <View style={styles.contactInfo}>
                    <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.contactPhone}>{item.phone}</Text>
                </View>

                <View style={styles.checkboxContainer}>
                    {item.invited ? (
                        <View style={[styles.statusBadge, { backgroundColor: THEME.success + '20', borderColor: THEME.success }]}>
                            <Text style={[styles.statusText, { color: THEME.success }]}>Invited ✓</Text>
                        </View>
                    ) : (
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                            {isSelected && <Check color="#fff" size={14} />}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    }, [selectedIds, toggleSelection]);

    const getItemLayout = useCallback((_: any, index: number) => ({
        length: 64, // Height of contactRow + margin
        offset: 64 * index,
        index,
    }), []);

    // --- SCREENS ---

    // SCREEN 1
    const renderManualScreen = () => (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex1}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Invite via SMS</Text>
                <TouchableOpacity onPress={closeFlow}>
                    <Text style={styles.headerCancel}>Cancel</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.divider} />

            <View style={styles.contentContainer}>
                <Text style={styles.subtitle}>
                    Know someone who'd crush their fitness goals?{'\n'}
                    Send them a text — they'll thank you later 💪
                </Text>

                <TextInput
                    style={styles.inputField}
                    placeholder="Phone number"
                    placeholderTextColor={THEME.textSub}
                    keyboardType="phone-pad"
                    value={manualPhone}
                    onChangeText={setManualPhone}
                    autoFocus
                />

                <TouchableOpacity
                    style={[styles.gradientBtnWrapper, !manualPhone.trim() && { opacity: 0.5 }]}
                    disabled={!manualPhone.trim()}
                    onPress={handleSendManualSMS}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[THEME.primaryGradStart, THEME.primaryGradEnd]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.gradientBtn}
                    >
                        <Text style={styles.gradientBtnText}>Send SMS Invite</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );

    // SCREEN 2
    const renderPermissionScreen = () => (
        <View style={styles.flex1}>
            {/* Header (Optional based on design, matching Screen 1 header for consistency or not) */}
            <View style={[styles.header, { borderBottomWidth: 0 }]}>
                <View />
                <TouchableOpacity onPress={closeFlow}>
                    <Text style={styles.headerCancel}>Cancel</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.contentContainer, { justifyContent: 'center', flex: 1, paddingBottom: 60 }]}>

                <View style={styles.iconCircle}>
                    <User color={THEME.textSub} size={48} />
                </View>

                <Text style={styles.titleCenter}>Access Your Contacts</Text>
                <Text style={styles.descCenter}>
                    To invite friends who aren't on the app yet, we need permission to view your phone contacts.{"\n\n"}We'll only use this to show who you can invite — we never store or share your contacts.
                </Text>

                {/* Badges */}
                <View style={styles.badgesRow}>
                    <View style={styles.badgePill}>
                        <Text style={styles.badgePillText}>🔒 Never stored</Text>
                    </View>
                    <View style={styles.badgePill}>
                        <Text style={styles.badgePillText}>🚫 Never sold</Text>
                    </View>
                    <View style={styles.badgePill}>
                        <Text style={styles.badgePillText}>✅ One-time use</Text>
                    </View>
                </View>

                {/* Primary Action */}
                <TouchableOpacity
                    style={styles.gradientBtnWrapper}
                    onPress={requestPermissionAndFetch}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={[THEME.primaryGradStart, THEME.primaryGradEnd]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.gradientBtn}
                    >
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.gradientBtnText}>Allow Contact Access</Text>}
                    </LinearGradient>
                </TouchableOpacity>

                {/* Secondary Action */}
                <TouchableOpacity
                    style={styles.outlineBtn}
                    onPress={() => setCurrentScreen('MANUAL')}
                >
                    <Text style={styles.outlineBtnText}>No thanks, enter number manually</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // SCREEN 3
    const renderContactsScreen = () => (
        <View style={styles.flex1}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Invite Friends</Text>
                <TouchableOpacity onPress={closeFlow}>
                    <Text style={styles.headerCancel}>Cancel</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.divider} />

            <View style={styles.searchContainer}>
                <Search color={THEME.textSub} size={20} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or number…"
                    placeholderTextColor={THEME.textSub}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {isLoading ? (
                <ActivityIndicator color={THEME.primaryGradStart} style={{ marginTop: 40 }} size="large" />
            ) : contacts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No contacts found.</Text>
                </View>
            ) : filteredContacts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No results match your search.</Text>
                </View>
            ) : (
                <FlatList
                    data={[{ isHeader: true, title: `NOT ON APP — ${notOnAppContacts.length} contacts` }, ...notOnAppContacts, ...(invitedContacts.length > 0 ? [{ isHeader: true, title: `INVITED — ${invitedContacts.length} contacts` }] : []), ...invitedContacts]}
                    keyExtractor={(item: any, index) => item.id || `header-${index}`}
                    renderItem={({ item }: { item: any }) => {
                        if (item.isHeader) return <Text style={styles.sectionLabel}>{item.title}</Text>;
                        return renderContactItem({ item });
                    }}
                    contentContainerStyle={styles.listContent}
                    initialNumToRender={15}
                    maxToRenderPerBatch={20}
                    windowSize={5}
                />
            )}

            {/* Sticky Bottom Bar */}
            {selectedIds.size > 0 && (
                <View style={styles.stickyBottomBar}>
                    <Text style={styles.selectedCountText}>{selectedIds.size} selected</Text>
                    <TouchableOpacity onPress={sendBulkInvites} activeOpacity={0.8}>
                        <LinearGradient
                            colors={[THEME.primaryGradStart, THEME.primaryGradEnd]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.smallGradientBtn}
                        >
                            <Text style={styles.smallGradientBtnText}>Send Invites</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            {currentScreen === 'MANUAL' && renderManualScreen()}
            {currentScreen === 'PERMISSION' && renderPermissionScreen()}
            {currentScreen === 'CONTACTS' && renderContactsScreen()}
        </SafeAreaView>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: THEME.bg },
    flex1: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.textMain },
    headerCancel: { color: THEME.btnCancel, fontSize: 16, fontWeight: '600' },
    divider: { height: 1, backgroundColor: THEME.cardBorder },

    contentContainer: { padding: 20 },

    // Generic Layout Components
    subtitle: { color: THEME.textSub, fontSize: 15, marginBottom: 24, lineHeight: 22 },

    // Inputs
    inputField: {
        width: '100%',
        backgroundColor: THEME.inputBg,
        borderRadius: 12,
        padding: 16,
        color: THEME.textMain,
        fontSize: 16,
        marginBottom: 24,
    },

    // Buttons
    gradientBtnWrapper: { width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
    gradientBtn: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    gradientBtnText: { color: THEME.textMain, fontSize: 16, fontWeight: 'bold' },

    outlineBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: THEME.cardBorder,
        alignItems: 'center',
    },
    outlineBtnText: { color: THEME.textSub, fontSize: 15, fontWeight: '600' },

    // Screen 2 specifics
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: THEME.userIconBg,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 24,
    },
    titleCenter: { fontSize: 22, fontWeight: 'bold', color: THEME.textMain, textAlign: 'center', marginBottom: 12 },
    descCenter: { fontSize: 15, color: THEME.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    badgesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 40 },
    badgePill: {
        backgroundColor: THEME.inputBg,
        borderWidth: 1,
        borderColor: THEME.cardBorder,
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    badgePillText: { color: THEME.textSub, fontSize: 13, fontWeight: '500' },

    // Screen 3 specifics
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.inputBg,
        marginHorizontal: 20,
        marginVertical: 16,
        borderRadius: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: THEME.cardBorder,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, paddingVertical: 12, color: THEME.textMain, fontSize: 16 },

    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    sectionLabel: { color: THEME.textSub, fontSize: 12, fontWeight: 'bold', marginTop: 16, marginBottom: 10, letterSpacing: 0.5 },

    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.03)',
    },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    contactInfo: { flex: 1, justifyContent: 'center' },
    contactName: { color: THEME.textMain, fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    contactPhone: { color: THEME.textSub, fontSize: 14 },

    checkboxContainer: { justifyContent: 'center', alignItems: 'flex-end', width: 80 },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: THEME.btnCancel,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: { backgroundColor: THEME.btnCancel },

    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
    statusText: { fontSize: 12, fontWeight: 'bold' },

    emptyContainer: { padding: 40, alignItems: 'center' },
    emptyText: { color: THEME.textSub, fontSize: 15 },

    // Sticky Bottom Bar
    stickyBottomBar: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        backgroundColor: THEME.bg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: THEME.cardBorder,
    },
    selectedCountText: { color: THEME.textMain, fontWeight: 'bold', fontSize: 16 },
    smallGradientBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 },
    smallGradientBtnText: { color: THEME.textMain, fontWeight: 'bold', fontSize: 14 },
});
