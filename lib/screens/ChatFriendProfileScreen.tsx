import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, CircleUserRound } from 'lucide-react-native';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';

type RouteParams = {
    friendUid: string;
    friendName?: string;
    friendAvatar?: string;
};

export const ChatFriendProfileScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { friendUid, friendName, friendAvatar } = route.params as RouteParams;

    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        setUserData(null);
        setLoading(false);
    }, [friendUid]);

    const displayName =
        userData?.fullName ||
        userData?.username ||
        friendName ||
        'Friend';
    const displayUsername = userData?.username ? `@${userData.username}` : '-';
    const displayEmail = userData?.email || '-';
    const displayPhone = userData?.phone || '-';
    const displayGender = userData?.gender || '-';
    const displayDob =
        userData?.dateOfBirth ||
        (userData?.dob?.month && userData?.dob?.year
            ? `${userData.dob.day ? `${userData.dob.day}/` : ''}${userData.dob.month}/${userData.dob.year}`
            : '-');
    const displayLocation =
        userData?.locations?.gym?.address || userData?.locations?.home?.address || userData?.locations?.park?.address ||
        [userData?.city, userData?.state, userData?.country].filter(Boolean).join(', ') ||
        '-';
    const avatar = userData?.profileImageUrl || friendAvatar;

    const field = (label: string, value: string) => (
        <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.fieldValue}>{value}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Friend Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={AppTheme.primaryColor} size="large" />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.hero}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <CircleUserRound color={AppTheme.primaryColor} size={48} />
                            </View>
                        )}
                        <Text style={styles.name}>{displayName}</Text>
                        <Text style={styles.username}>{displayUsername}</Text>
                    </View>

                    <View style={styles.card}>
                        {field('Email', displayEmail)}
                        {field('Phone', displayPhone)}
                        {field('Location', displayLocation)}
                        {field('Gender', displayGender)}
                        {field('Date of Birth', displayDob)}
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppTheme.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20, paddingBottom: 40 },
    hero: { alignItems: 'center', marginBottom: 20 },
    avatar: { width: 92, height: 92, borderRadius: 46, marginBottom: 12 },
    avatarFallback: {
        width: 92,
        height: 92,
        borderRadius: 46,
        marginBottom: 12,
        backgroundColor: 'rgba(255,107,0,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: { color: '#fff', fontSize: FontSizes.h3, fontWeight: FontWeights.bold as any },
    username: { color: AppTheme.textGrey, fontSize: FontSizes.body, marginTop: 2 },
    card: {
        backgroundColor: AppTheme.cardColor,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
    },
    fieldRow: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    fieldLabel: {
        color: AppTheme.textGrey,
        fontSize: 12,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    fieldValue: { color: '#fff', fontSize: 14, fontWeight: '500' },
});
