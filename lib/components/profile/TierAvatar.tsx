import React from 'react';
import { View, Text } from 'react-native';
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
    uri, size, accessType, uid, name, fallback, radius, showBadge, badgeBorderColor,
}: Props) {
    const r = radius ?? Math.round(size * 0.22);

    // Explicit accessType wins; otherwise resolve by uid via the batched cache.
    const resolved = useTier(accessType === undefined ? uid : null);
    const tier = accessType !== undefined ? accessType : resolved;

    const defaultFallback = (
        <View style={{
            width: size, height: size, borderRadius: r,
            backgroundColor: 'rgba(232,153,81,0.16)',
            alignItems: 'center', justifyContent: 'center',
        }}>
            {initialsOf(name) ? (
                <Text style={{ color: '#E89951', fontWeight: '800', fontSize: Math.round(size * 0.4) }}>
                    {initialsOf(name)}
                </Text>
            ) : (
                <Text style={{ fontSize: Math.round(size * 0.5) }}>👤</Text>
            )}
        </View>
    );

    return (
        <TierAvatarRing
            accessType={tier}
            avatarSize={size}
            avatarRadius={r}
            showBadge={showBadge}
            badgeBorderColor={badgeBorderColor}
        >
            <WebSafeAvatar
                uri={uri}
                size={size}
                borderRadius={r}
                fallback={fallback ?? defaultFallback}
            />
        </TierAvatarRing>
    );
}
