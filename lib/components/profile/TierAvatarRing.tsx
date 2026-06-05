import React from 'react';
import { View, Text } from 'react-native';
import { tierLevel } from './TierBars';

// Tier colours, in level order. Dots light up in this order as the level rises.
const SIDES = [
    { color: '#60A5FA', level: 1 },  // Starter
    { color: '#1E40AF', level: 2 },  // Lifter
    { color: '#FB923C', level: 3 },  // Trainer
    { color: '#C26A2D', level: 4 },  // Influencer
] as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Props {
    accessType?: string | null;
    avatarSize: number;
    avatarRadius: number;
    /** Kept for API compatibility — the dots/badge now show on every avatar. */
    showBadge?: boolean;
    /** Background color the number badge border blends into. */
    badgeBorderColor?: string;
    children: React.ReactNode;
}

/**
 * Profile picture tier treatment, applied uniformly to every avatar in the app.
 * The old gripcuff colour ring is gone; the level is shown as a row of 4 dots
 * right below the picture (filling with their tier colour up to the user's
 * level), plus the numbered tier badge on the corner.
 */
export function TierAvatarRing({
    accessType, avatarSize, showBadge, badgeBorderColor = '#0d1825', children,
}: Props) {
    const userLevel = tierLevel(accessType) ?? 0;

    // Preserve the original footprint (avatar + a little padding) so avatars
    // don't reflow now that the ring is gone.
    const STROKE = clamp(Math.round(avatarSize * 0.042), 2, 5);
    const GAP    = clamp(Math.round(avatarSize * 0.052), 2, 6);
    const pad    = GAP + STROKE;
    const outer  = avatarSize + pad * 2;

    // Dots — shown on every avatar. Forced on so the treatment is uniform even
    // where callers previously hid the badge. Sizing scales with the avatar so
    // tiny list avatars (e.g. 32px leaderboard) get small dots while the large
    // profile picture keeps big ones.
    const wantDots = true;
    void showBadge;
    const dotSize  = clamp(Math.round(avatarSize * 0.1), 4, 14);
    const dotGap   = clamp(Math.round(avatarSize * 0.05), 2, 9);
    const INACTIVE = 'rgba(255,255,255,0.16)';

    // Numbered tier badge (corner).
    const badgeSize   = clamp(Math.round(avatarSize * 0.2), 14, 24);
    const badgeFont   = clamp(Math.round(avatarSize * 0.1), 9, 13);
    const badgeOffset = -Math.round(badgeSize * 0.2);

    return (
        <View style={{ alignItems: 'center' }}>
            <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'relative' }}>
                    {children}

                    {userLevel > 0 && (
                        <View style={{
                            position: 'absolute',
                            bottom: badgeOffset, right: badgeOffset,
                            width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2,
                            backgroundColor: '#000000',
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 2, borderColor: badgeBorderColor,
                            zIndex: 10,
                        }}>
                            <Text style={{ color: '#fff', fontSize: badgeFont, fontWeight: '800' }}>
                                {userLevel}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {wantDots && (
                <View style={{ flexDirection: 'row', gap: dotGap, marginTop: -pad + 2 }}>
                    {SIDES.map(({ color, level }) => (
                        <View
                            key={level}
                            style={{
                                width: dotSize,
                                height: dotSize,
                                borderRadius: dotSize / 2,
                                backgroundColor: userLevel >= level ? color : INACTIVE,
                            }}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}
