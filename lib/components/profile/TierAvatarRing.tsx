import React, { useRef, useEffect, useId } from 'react';
import { View, Text, Animated } from 'react-native';
import Svg, { Path, G, Defs, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from 'react-native-svg';
import { tierLevel } from './TierBars';

const SIDES = [
    { color: '#60A5FA', level: 1 },  // top    — Starter
    { color: '#1E40AF', level: 2 },  // right  — Lifter
    { color: '#FB923C', level: 3 },  // bottom — Trainer
    { color: '#C26A2D', level: 4 },  // left   — Influencer
] as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function rrectPath(x: number, y: number, w: number, h: number, r: number) {
    return [
        `M ${x + r} ${y}`,
        `L ${x + w - r} ${y}`,
        `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
        `L ${x + w} ${y + h - r}`,
        `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
        `L ${x + r} ${y + h}`,
        `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
        `L ${x} ${y + r}`,
        `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
        'Z',
    ].join(' ');
}

function rrectPerimeter(w: number, h: number, r: number) {
    return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r;
}

interface Props {
    accessType?: string | null;
    avatarSize: number;
    avatarRadius: number;
    /** Show the numbered tier badge. Defaults to true for avatars >= 64px. */
    showBadge?: boolean;
    /** Background color the badge border blends into. */
    badgeBorderColor?: string;
    children: React.ReactNode;
}

export function TierAvatarRing({
    accessType, avatarSize, avatarRadius, showBadge, badgeBorderColor = '#0d1825', children,
}: Props) {
    const userLevel = tierLevel(accessType) ?? 0;

    // Unique per instance — SVG filter ids are document-global on web, so a
    // shared id would make every ring on screen use the first one's blur radius.
    const rawId = useId();
    const glowId = `glow-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

    // Breathing animation for the glow layer
    const breathAnim = useRef(new Animated.Value(0.25)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(breathAnim, { toValue: 0.7,  duration: 1800, useNativeDriver: true }),
                Animated.timing(breathAnim, { toValue: 0.15, duration: 1800, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    // ── Size-aware geometry (anchored so a 96px avatar matches the original look) ──
    const STROKE = clamp(Math.round(avatarSize * 0.042), 2, 5);
    const GAP    = clamp(Math.round(avatarSize * 0.052), 2, 6);

    const pad   = GAP + STROKE;
    const outer = avatarSize + pad * 2;

    const strokeCentre = pad - STROKE / 2;
    const rectW = outer - strokeCentre * 2;
    const rectH = rectW;
    const rectR = avatarRadius + GAP + STROKE / 2;

    const d         = rrectPath(strokeCentre, strokeCentre, rectW, rectH, rectR);
    const perimeter = rrectPerimeter(rectW, rectH, rectR);
    const seg       = perimeter / 4;
    const dash      = [seg - 0.5, perimeter - seg + 0.5] as any;

    const svgProps = { width: outer, height: outer };
    const svgStyle = { position: 'absolute', top: 0, left: 0 } as any;

    // Glow blur + margin scale with size so the bloom fades fully inside the
    // canvas (no hard square edge) at any avatar size.
    const blur        = clamp(avatarSize * 0.11, 3, 16);
    const glowStroke  = STROKE + clamp(Math.round(avatarSize * 0.06), 2, 8);
    const GLOW_MARGIN = Math.ceil(blur * 3.5);
    const glowSize    = outer + GLOW_MARGIN * 2;

    // Badge: auto-hide on small avatars unless explicitly forced on.
    const wantBadge   = showBadge ?? avatarSize >= 64;
    const badgeSize   = clamp(Math.round(avatarSize * 0.2), 14, 24);
    const badgeFont   = clamp(Math.round(avatarSize * 0.1), 9, 13);
    const badgeOffset = -Math.round(badgeSize * 0.2);

    return (
        <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>

            {/* Layer 1 — base: all 4 colours always at full opacity */}
            <Svg {...svgProps} style={svgStyle}>
                {SIDES.map(({ color }, i) => (
                    <Path
                        key={i}
                        d={d} fill="none"
                        stroke={color} strokeWidth={STROKE}
                        strokeLinecap="butt"
                        strokeDasharray={dash}
                        strokeDashoffset={-(i * seg)}
                        opacity={1}
                    />
                ))}
            </Svg>

            {/* Layer 2 — soft breathing glow via blur filter, active levels only */}
            <Animated.View style={[svgStyle, { top: -GLOW_MARGIN, left: -GLOW_MARGIN, width: glowSize, height: glowSize, opacity: breathAnim }]}>
                <Svg width={glowSize} height={glowSize}>
                    <Defs>
                        <Filter id={glowId} x="-150%" y="-150%" width="400%" height="400%">
                            <FeGaussianBlur stdDeviation={blur} result="coloredBlur" />
                            <FeMerge>
                                <FeMergeNode in="coloredBlur" />
                                <FeMergeNode in="SourceGraphic" />
                            </FeMerge>
                        </Filter>
                    </Defs>
                    <G transform={`translate(${GLOW_MARGIN}, ${GLOW_MARGIN})`}>
                        {SIDES.map(({ color, level }, i) => {
                            if (userLevel < level) return null;
                            return (
                                <Path
                                    key={i}
                                    d={d} fill="none"
                                    stroke={color} strokeWidth={glowStroke}
                                    strokeLinecap="butt"
                                    strokeDasharray={dash}
                                    strokeDashoffset={-(i * seg)}
                                    opacity={1}
                                    filter={`url(#${glowId})`}
                                />
                            );
                        })}
                    </G>
                </Svg>
            </Animated.View>

            {/* Avatar centred */}
            <View style={{ position: 'relative' }}>
                {children}

                {wantBadge && userLevel > 0 && (
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
    );
}
