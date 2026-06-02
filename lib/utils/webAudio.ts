// Shared AudioContext — must be created/resumed after a user gesture.
// Call unlockAudio() on any user interaction to satisfy the browser autoplay policy.

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
        if (!_ctx || _ctx.state === 'closed') {
            _ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
        }
        return _ctx;
    } catch {
        return null;
    }
}

/** Call once on the first user tap/click to unlock audio on web. */
export function unlockAudio() {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** Triple beep at 880 Hz — mirrors the original WorkoutReminderModal sound. */
export function playReminderBeep() {
    const ctx = getCtx();
    if (!ctx) return;

    const play = () => {
        [0, 0.3, 0.6].forEach((delay) => {
            try {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.2);
            } catch {}
        });
    };

    if (ctx.state === 'suspended') {
        ctx.resume().then(play).catch(() => {});
    } else {
        play();
    }
}
