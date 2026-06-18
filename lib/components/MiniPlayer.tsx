/**
 * MiniPlayer — floating bottom-right mini player (YouTube-mobile style).
 *
 * Rendered once, above the navigator (see App). Visible whenever the mini-player
 * context holds a payload. Plays the handed-off video at the saved position;
 * tapping it re-opens the full VideoPlayer screen (resuming at the live
 * position), the ✕ stops and closes it.
 */
import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { navigationRef } from '../core/navigation';
import { MiniPlayerPayload, useMiniPlayer } from '../providers/MiniPlayerContext';

export function MiniPlayer() {
  const { mini, closeMini } = useMiniPlayer();
  if (!mini) return null;
  // Key by URL so a new hand-off remounts the player with the new source.
  return <MiniPlayerInner key={mini.videoUrl} mini={mini} closeMini={closeMini} />;
}

function MiniPlayerInner({ mini, closeMini }: { mini: MiniPlayerPayload; closeMini: () => void }) {
  const startSec = Math.max(0, (mini.positionMs || 0) / 1000);

  const player = useVideoPlayer({ uri: mini.videoUrl }, (p) => {
    try { p.currentTime = startSec; } catch {}
    p.play();
  });

  const expand = useCallback(() => {
    let posMs = mini.positionMs;
    try { posMs = Math.round((player.currentTime || 0) * 1000); } catch {}
    closeMini();
    if (navigationRef.isReady()) {
      (navigationRef as any).navigate('VideoPlayer', { ...mini.expandParams, resumePositionMs: posMs });
    }
  }, [player, mini, closeMini]);

  const close = useCallback(() => {
    try { player.pause(); } catch {}
    closeMini();
  }, [player, closeMini]);

  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.card}>
        <TouchableOpacity activeOpacity={0.9} onPress={expand} style={s.videoTouch}>
          <VideoView player={player} style={s.video} contentFit="cover" nativeControls={false} />
          <View style={s.expandHint} pointerEvents="none">
            <Ionicons name="scan-outline" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={s.bar}>
          <Text style={s.title} numberOfLines={1}>{mini.title}</Text>
          <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const CARD_W = 210;
const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 12,
    bottom: 96, // clear the floating tab bar
    width: CARD_W,
    zIndex: 9999,
    elevation: 12,
  },
  card: {
    width: CARD_W,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  videoTouch: {
    width: CARD_W,
    height: Math.round((CARD_W * 9) / 16),
    backgroundColor: '#000',
  },
  video: { width: '100%', height: '100%' },
  expandHint: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    padding: 3,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#211832',
  },
  title: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '600' },
});
