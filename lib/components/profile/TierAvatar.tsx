import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebSafeAvatar } from '../WebSafeAvatar';
import { TierAvatarRing } from './TierAvatarRing';
import { useTier } from '../../providers/TierContext';

interface Props {
    uri?: string | null;
    size: number;
    /** Pass the tier directly if known. Otherwise pass `uid` to resolve it. */
    accessType?: string | null;
    /** Resolve the tier by user id (batched lookup) when accessType isn't given. */
    uid?: string | null;
    /** Used for the initials fallback when there is no image / it fails to load. */
    name?: string | null;
    /** Override the fallback node entirely (e.g. a custom icon). */
    fallback?: React.ReactNode;
    /** Avatar corner radius. Defaults to size * 0.22 (matches the rest of the app). */
    radius?: number;
    /** Force the numbered tier badge on/off. Defaults to on for size >= 64. */
    showBadge?: boolean;
    /** Background the badge border blends into. */
    badgeBorderColor?: string;
    /** Opt out of the tap-to-open-profile behaviour (e.g. own avatar in editors). */
    disableProfileLink?: boolean;
    /** Render just the picture — no tier ring dots and no corner number badge. */
    bare?: boolean;
    /** Show a black gradient + first name overlaid at the bottom of the picture.
     *  Defaults to true for size >= 40. Pass true/false to force on/off. */
    showNameOverlay?: boolean;
}

function initialsOf(name?: string | null): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Profile picture with the tier "breathing ring" treatment applied uniformly
 * across the app. Renders the four tier colours always, with an animated glow
 * on the segments the user has activated (via accessType).
 */
export function TierAvatar({
    uri, size, accessType, uid, name, fallback, radius, showBadge, badgeBorderColor, disableProfileLink, bare, showNameOverlay,
}: Props) {
    const navigation = useNavigation<any>();
    const r = radius ?? Math.round(size * 0.22);

    // Explicit accessType wins; otherwise resolve by uid via the batched cache.
    const resolved = useTier(accessType === undefined ? uid : null);
    const tier = accessType !== undefined ? accessType : resolved;

    const defaultFallback = (
        <View style={{
            width: size, height: size, borderRadius: r,
            backgroundColor: 'rgba(76,78,120,0.14)',
            alignItems: 'center', justifyContent: 'center',
        }}>
            {initialsOf(name) ? (
                <Text style={{ color: '#4C4E78', fontWeight: '800', fontSize: Math.round(size * 0.4) }}>
                    {initialsOf(name)}
                </Text>
            ) : (
                <Text style={{ fontSize: Math.round(size * 0.5) }}>👤</Text>
            )}
        </View>
    );

    const firstName = (name ?? '').trim().split(/\s+/)[0];
    const showOverlay = (showNameOverlay === true || (showNameOverlay !== false && size >= 40)) && !!firstName;

    const avatar = showOverlay ? (
        <View style={{ width: size, height: size, borderRadius: r, overflow: 'hidden' }}>
            <WebSafeAvatar uri={uri} size={size} borderRadius={r} fallback={fallback ?? defaultFallback} />
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.72)']}
                style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    height: Math.round(size * 0.42),
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    paddingBottom: Math.round(size * 0.06),
                }}
            >
                <Text numberOfLines={1} style={{ color: '#fff', fontSize: Math.max(8, Math.round(size * 0.13)), fontWeight: '800', letterSpacing: 0.4 }}>
                    {firstName}
                </Text>
            </LinearGradient>
        </View>
    ) : (
        <WebSafeAvatar
            uri={uri}
            size={size}
            borderRadius={r}
            fallback={fallback ?? defaultFallback}
        />
    );

    const content = bare ? avatar : (
        <TierAvatarRing
            accessType={tier}
            avatarSize={size}
            avatarRadius={r}
            showBadge={showBadge}
            badgeBorderColor={badgeBorderColor}
        >
            {avatar}
        </TierAvatarRing>
    );

    // Tapping any avatar with a known user id opens that user's profile.
    if (uid && !disableProfileLink) {
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('SocialProfileScreen', { uid })}
                // Web: stop the click from also triggering the parent row's handler
                // (so tapping the avatar opens the profile, not the row's action).
                {...(Platform.OS === 'web'
                    ? { onClick: (e: any) => { e?.stopPropagation?.(); } }
                    : {})}
            >
                {content}
            </TouchableOpacity>
        );
    }

    return content;
}
