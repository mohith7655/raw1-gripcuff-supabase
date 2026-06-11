import React from 'react';
import { View, Text } from 'react-native';
import { tierLevel } from './TierBars';

const TIER_LEVELS = [1, 2, 3, 4] as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Props {
    accessType?: string | null;
    avatarSize: number;
    avatarRadius: number;
    /** Kept for API compatibility. */
    showBadge?: boolean;
    /** Kept for API compatibility. */
    badgeBorderColor?: string;
    children: React.ReactNode;
}

export function TierAvatarRing({
    accessType, avatarSize, showBadge, children,
}: Props) {
    void showBadge;
    const userLevel = tierLevel(accessType) ?? 0;

    const STROKE = clamp(Math.round(avatarSize * 0.042), 2, 5);
    const GAP    = clamp(Math.round(avatarSize * 0.052), 2, 6);
    const pad    = GAP + STROKE;
    const outer  = avatarSize + pad * 2;

    const dotSize     = clamp(Math.round(avatarSize * 0.1), 4, 14);
    const dotGap      = clamp(Math.round(avatarSize * 0.05), 2, 9);
    // Current-level dot needs to be large enough to hold the number inside.
    const currentSize = clamp(Math.round(avatarSize * 0.2), 18, 28);
    const currentFont = clamp(Math.round(currentSize * 0.52), 9, 14);

    const LIGHT_ORANGE = 'rgba(242,89,18,0.35)';
    const DARK_ORANGE  = '#F25912';
    const INACTIVE     = 'rgba(33,24,50,0.14)';

    return (
        <View style={{ alignItems: 'center' }}>
            <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'relative' }}>
                    {children}
                </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: dotGap, marginTop: -pad + 2 }}>
                {TIER_LEVELS.map((level) => {
                    const isCurrent = level === userLevel;
                    const isPast    = level < userLevel;
                    const isActive  = level <= userLevel;

                    const size = isCurrent ? currentSize : dotSize;
                    const bg   = isCurrent ? DARK_ORANGE : isPast ? LIGHT_ORANGE : INACTIVE;

                    return (
                        <View
                            key={level}
                            style={{
                                width: size,
                                height: size,
                                borderRadius: size / 2,
                                backgroundColor: isActive ? bg : INACTIVE,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {isCurrent && userLevel > 0 && (
                                <Text style={{
                                    color: '#fff',
                                    fontSize: currentFont,
                                    fontWeight: '800',
                                    lineHeight: currentFont + 2,
                                }}>
                                    {userLevel}
                                </Text>
                            )}
                        </View>
                    );
                })}
            </View>
        </View>
    );
}
