export function trackEvent(name: string, payload?: any) {
    try {
        console.log('[analytics]', name, payload ?? {});
        // TODO: wire to real analytics provider (Segment, Amplitude, etc.)
    } catch (e) {
        console.warn('[analytics] trackEvent failed', e);
    }
}
