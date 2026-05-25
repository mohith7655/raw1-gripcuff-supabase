import { supabase } from '../core/config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// PlaybackSyncService
//
// Host-authoritative realtime playback sync via Supabase Realtime.
//
// Usage:
//   Host:  call emit() on play, pause, seek, replay.
//   Guest: call subscribe() and mirror received state on the local player.
// ─────────────────────────────────────────────────────────────────────────────

export interface PlaybackState {
  session_id: string;
  is_playing: boolean;
  current_time_seconds: number;
  video_duration: number;
  updated_by: string | null;
  updated_at: string;
}

export class PlaybackSyncService {
  private static channel: RealtimeChannel | null = null;

  // ── Host: write current playback state to DB ────────────────────────────
  static async emit(
    sessionId: string,
    isPlaying: boolean,
    currentTimeSec: number,
    videoDurationSec: number,
    updatedBy: string
  ): Promise<void> {
    const { error } = await supabase
      .from('session_playback_state')
      .upsert(
        {
          session_id: sessionId,
          is_playing: isPlaying,
          current_time_seconds: currentTimeSec,
          video_duration: videoDurationSec,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id' }
      );

    if (error) {
      console.warn('[PlaybackSync] emit error:', error.message);
    } else {
      console.log('[PlaybackSync] emitted', {
        isPlaying,
        currentTimeSec: currentTimeSec.toFixed(2),
      });
    }
  }

  // ── Guest: subscribe to host playback state via Realtime ────────────────
  // Returns an unsubscribe function — call it on unmount.
  // Also fetches the current row immediately so a late-joining guest syncs right away.
  static subscribe(
    sessionId: string,
    onState: (state: PlaybackState) => void
  ): () => void {
    // Remove any stale subscription before creating a new one
    PlaybackSyncService.unsubscribe();

    const channel = supabase
      .channel(`playback_sync:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_playback_state',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[PlaybackSync] received', {
            isPlaying: (payload.new as any)?.is_playing,
            timeSec: (payload.new as any)?.current_time_seconds,
          });
          onState(payload.new as PlaybackState);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Fetch current state so a late-joining guest syncs immediately
          supabase
            .from('session_playback_state')
            .select('*')
            .eq('session_id', sessionId)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                console.log('[PlaybackSync] initial state loaded', {
                  isPlaying: data.is_playing,
                  timeSec: data.current_time_seconds,
                });
                onState(data as PlaybackState);
              }
            });
        }
      });

    PlaybackSyncService.channel = channel;

    return () => PlaybackSyncService.unsubscribe();
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  static unsubscribe(): void {
    if (PlaybackSyncService.channel) {
      supabase.removeChannel(PlaybackSyncService.channel);
      PlaybackSyncService.channel = null;
    }
  }
}
