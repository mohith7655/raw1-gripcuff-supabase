/**
 * TierBars — growing signal-strength bars representing a user's Gripcuff tier.
 * Bars increase in height left-to-right; segments up to the user's tier are
 * filled with that tier's colour, remaining segments are dim.
 *
 * Tiers:  1 starter (light blue)  2 lifter (dark blue)
 *         3 trainer (light orange) 4 influencer (dark orange)
 */
import React from 'react';
import { View } from 'react-native';

const TIERS = [
    { key: 'starter',    color: '#60A5FA' },
    { key: 'lifter',     color: '#1E40AF' },
    { key: 'trainer',    color: '#FB923C' },
    { key: 'influencer', color: '#C26A2D' },
] as const;

const TIER_ORDER = TIERS.map(t => t.key);
const HEIGHTS    = [5, 8, 11, 14];  // px — bar height grows per tier
const MAX_H      = 14;

/** Normalise raw DB / access-context value to a tier index (0-3), or -1 if none. */
export function tierIndex(accessType?: string | null): number {
    if (!accessType) return -1;
    // Legacy aliases
    const mapped =
        accessType === 'gripcuff'     ? 'starter' :
        accessType === 'subscription' ? 'lifter'  :
        accessType;
    return TIER_ORDER.indexOf(mapped as any);
}

interface Props {
    accessType?: string | null;
    /** Total width — bars stretch to fill it. Default 56 */
    width?: number;
}

export function TierBars({ accessType, width = 56 }: Props) {
    const userIdx = tierIndex(accessType);
    if (userIdx < 0) return null; // no tier — hide entirely

    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: MAX_H, width }}>
            {TIERS.map(({ key, color }, idx) => (
                <View
                    key={key}
                    style={{
                        flex: 1,
                        height: HEIGHTS[idx],
                        borderRadius: 2,
                        backgroundColor: userIdx >= idx ? color : 'rgba(255,255,255,0.12)',
                    }}
                />
            ))}
        </View>
    );
}
