import { Platform } from 'react-native';
import { CastState, CAST_INITIAL_STATE } from './types';

type StateListener = (patch: Partial<CastState>) => void;

/**
 * Singleton service that owns cast state and provides the "show picker"
 * action for components that don't want to import react-native-google-cast
 * directly.
 *
 * react-native-google-cast v4.9.1 does NOT have a configure() method — the
 * SDK is configured at the native layer via the Expo config plugin (app.json).
 * Discovery starts automatically when the app launches and the first
 * CastButton renders.
 *
 * React components should use the useCast() hook (useCast.native.ts / useCast.ts)
 * which wires up the real react-native-google-cast hooks on top of this service.
 *
 * Platform coverage:
 *  - Android + iOS : Google Cast SDK via react-native-google-cast
 *  - iOS (AirPlay) : transparent — expo-video allowsExternalPlayback handles it
 *  - Web           : all methods are no-ops
 */
class CastManagerImpl {
  private listeners = new Set<StateListener>();
  private state: CastState = { ...CAST_INITIAL_STATE };
  private _initialized = false;

  /**
   * Call once at app startup (e.g. inside App.tsx useEffect).
   * Safe to call multiple times.
   *
   * In v4.9.1, CastContext has no configure() — we simply start discovery
   * (iOS only; Android starts automatically via GoogleCast.configure in
   * the native layer through the Expo plugin).
   */
  initialize(): void {
    if (this._initialized || Platform.OS === 'web') return;
    this._initialized = true;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const GoogleCast = require('react-native-google-cast').default;
      // iOS: explicitly start discovery so devices appear before the user
      // presses a CastButton for the first time.
      GoogleCast.getDiscoveryManager()
        ?.startDiscovery?.()
        ?.catch?.(() => {});
    } catch {
      // Safe to ignore — discovery starts automatically when CastButton renders
    }
  }

  /**
   * Open the native Cast device picker dialog.
   * Wraps CastContext.showCastDialog() (v4.9.1 API).
   */
  showPicker(): void {
    if (Platform.OS === 'web') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const GoogleCast = require('react-native-google-cast').default;
      GoogleCast.showCastDialog();
    } catch (err) {
      console.warn('[CastManager] showCastDialog failed:', err);
    }
  }

  // ─── State management (called by useCast hook only) ──────────────────────

  /** Internal — only useCast.native.ts should call this. */
  _setState(patch: Partial<CastState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(fn => fn(patch));
  }

  getState(): Readonly<CastState> {
    return { ...this.state };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isActive(): boolean {
    return this.state.isConnected && this.state.isCasting;
  }
}

export const CastManager = new CastManagerImpl();
