import { useState, useEffect } from 'react';

export interface GlobalVideoCounts {
    totalLikes: number;
    totalDislikes: number;
}

export function formatCount(n: number): string {
    if (n >= 10000) return `${Math.round(n / 1000)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

export async function updateGlobalEngagement(
    videoId: string,
    delta: { likes?: number; dislikes?: number },
): Promise<void> {}

export function useVideoGlobalCounts(videoId: string | null): GlobalVideoCounts {
    return { totalLikes: 0, totalDislikes: 0 };
}

export async function getGlobalEngagementBoosts(
    videoIds: string[],
): Promise<Record<string, number>> {
    return {};
}
