/**
 * TierBars — growing signal-strength bars representing a user's Gripcuff tier.
 *
 * Tiers:  1 starter (light blue)  2 lifter (dark blue)
 *         3 trainer (light orange) 4 influencer (dark orange)
 */
import React from 'react';
import { View } from 'react-native';

export const TIERS = [
    { key: 'starter',    color: '#60A5FA', level: 1 },
    { key: 'lifter',     color: '#1E40AF', level: 2 },
    { key: 'trainer',    color: '#F25912', level: 3 },
    { key: 'influencer', color: '#F25912', level: 4 },
] as const;

const TIER_ORDER = TIERS.map(t => t.key);
const HEIGHTS    = [5, 8, 11, 14];
const MAX_H      = 14;

/** Normalise raw DB / access-context value to a tier index (0–3), or -1 if none. */
export function tierIndex(accessType?: string | null): number {
    if (!accessType) return -1;
    const mapped =
        accessType === 'gripcuff'     ? 'starter' :
        accessType === 'subscription' ? 'lifter'  :
        accessType;
    return TIER_ORDER.indexOf(mapped as any);
}

/** Return the ring/glow color for an accessType, or null if no tier. */
export function tierColor(accessType?: string | null): string | null {
    const idx = tierIndex(accessType);
    return idx >= 0 ? TIERS[idx].color : null;
}

/** Return the tier level number (1–4), or null if no tier. */
export function tierLevel(accessType?: string | null): number | null {
    const idx = tierIndex(accessType);
    return idx >= 0 ? TIERS[idx].level : null;
}

interface Props {
    accessType?: string | null;
    width?: number;
}

export function TierBars({ accessType, width = 56 }: Props) {
    const userIdx = tierIndex(accessType);
    if (userIdx < 0) return null;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: MAX_H, width }}>
            {TIERS.map(({ key, color }, idx) => (
                <View
                    key={key}
                    style={{
                        flex: 1,
                        height: HEIGHTS[idx],
                        borderRadius: 2,
                        backgroundColor: userIdx >= idx ? color : 'rgba(33,24,50,0.12)',
                    }}
                />
            ))}
        </View>
    );
}
