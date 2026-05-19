import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Vibration } from 'react-native';

export type TimerMode = 'countdown' | 'rest';

export interface TimerConfig {
    mode: TimerMode;
    durationSeconds: number;
    autoNext: boolean;
    notifyOnEnd: boolean;
}

export interface UseWorkoutTimerReturn {
    secondsLeft: number;
    isRunning: boolean;
    progress: number; // 0–1, how much has elapsed
    fmt: string;      // "MM:SS"
    start: () => void;
    pause: () => void;
    reset: () => void;
}

// ── Web Audio beep ──────────────────────────────────────────────────────────
function playBeep(frequency = 880, duration = 0.35, gain = 0.28) {
    if (Platform.OS !== 'web') return;
    try {
        const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g);
        g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = frequency;
        g.gain.setValueAtTime(gain, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (_) {}
}

function buzz(pattern: number | number[]) {
    try {
        if (Platform.OS === 'web') {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        } else {
            // React Native Vibration
            if (Array.isArray(pattern)) {
                Vibration.vibrate(pattern);
            } else {
                Vibration.vibrate(pattern);
            }
        }
    } catch (_) {}
}

function playEndSequence() {
    // Three rising beeps + vibration burst
    playBeep(660, 0.15);
    setTimeout(() => playBeep(770, 0.15), 200);
    setTimeout(() => playBeep(880, 0.35), 400);
    buzz([0, 200, 100, 200, 100, 300]);
}

function playWarningBeep() {
    playBeep(660, 0.1, 0.18);
    buzz(80);
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useWorkoutTimer(
    config: TimerConfig,
    onEnd?: () => void,
): UseWorkoutTimerReturn {
    const [secondsLeft, setSecondsLeft] = useState(config.durationSeconds);
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const firedRef = useRef(false);

    const clearTick = () => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    // Reset when duration changes (e.g., user picks a new preset)
    useEffect(() => {
        clearTick();
        setIsRunning(false);
        setSecondsLeft(config.durationSeconds);
        firedRef.current = false;
    }, [config.durationSeconds]);

    const handleEnd = useCallback(() => {
        if (firedRef.current) return;
        firedRef.current = true;
        clearTick();
        setIsRunning(false);
        playEndSequence();

        if (config.notifyOnEnd && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('workoutTimerEnd', {
                detail: { mode: config.mode },
            }));
        }
        onEnd?.();
    }, [config.notifyOnEnd, config.mode, onEnd]);

    useEffect(() => {
        if (!isRunning) return;

        intervalRef.current = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    handleEnd();
                    return 0;
                }
                // Warning beeps at 3 s remaining
                if (prev === 4 || prev === 3) playWarningBeep();
                return prev - 1;
            });
        }, 1000);

        return clearTick;
    }, [isRunning, handleEnd]);

    const start = useCallback(() => {
        if (secondsLeft === 0) {
            setSecondsLeft(config.durationSeconds);
            firedRef.current = false;
        }
        setIsRunning(true);
    }, [secondsLeft, config.durationSeconds]);

    const pause = useCallback(() => {
        setIsRunning(false);
    }, []);

    const reset = useCallback(() => {
        clearTick();
        setIsRunning(false);
        setSecondsLeft(config.durationSeconds);
        firedRef.current = false;
    }, [config.durationSeconds]);

    const progress = config.durationSeconds > 0
        ? 1 - secondsLeft / config.durationSeconds
        : 0;

    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    const fmt = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    return { secondsLeft, isRunning, progress, fmt, start, pause, reset };
}
