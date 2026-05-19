import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Mic, MicOff, Pause, PhoneOff, Play, Square, Video, VideoOff } from 'lucide-react-native';
import { useCast } from '../../hooks/useCast';

// ── Shared ────────────────────────────────────────────────────────────────

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
};

interface StopCastButtonProps {
  onPress: () => void;
}
function StopCastButton({ onPress }: StopCastButtonProps) {
  return (
    <TouchableOpacity style={styles.stopCastBtn} onPress={onPress} activeOpacity={0.75}>
      <Square color="#4FC3F7" size={13} />
      <Text style={styles.stopCastText}>Stop Cast</Text>
    </TouchableOpacity>
  );
}

// ── Video mode ────────────────────────────────────────────────────────────

interface VideoRemoteProps {
  mode: 'video';
  isPlaying: boolean;
  positionSeconds: number;
  durationSeconds: number;
  onPlay: () => void;
  onPause: () => void;
  onSeekBack: () => void;
  onSeekForward: () => void;
  onStopCast?: () => void;
}

// ── Agora live-call mode ──────────────────────────────────────────────────

interface AgoraRemoteProps {
  mode: 'agora';
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onEndCall: () => void;
  onStopCast?: () => void;
}

export type RemoteControlBarProps = VideoRemoteProps | AgoraRemoteProps;

/**
 * Mobile-side control bar displayed when a cast session is active.
 * Shows different controls depending on whether the cast source is a
 * Firebase VOD video or an active Agora live call.
 *
 * Renders nothing on web.
 */
export function RemoteControlBar(props: RemoteControlBarProps) {
  const { endSession } = useCast();

  if (Platform.OS === 'web') return null;

  const handleStopCast = () => {
    if (props.onStopCast) {
      props.onStopCast();
    } else {
      endSession();
    }
  };

  if (props.mode === 'video') {
    const {
      isPlaying,
      positionSeconds,
      durationSeconds,
      onPlay,
      onPause,
      onSeekBack,
      onSeekForward,
    } = props;

    return (
      <View style={styles.container}>
        <Text style={styles.modeLabel}>Playing on TV</Text>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(positionSeconds)}</Text>
          <View style={styles.timeDivider} />
          <Text style={styles.timeText}>{formatTime(durationSeconds)}</Text>
        </View>

        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.skipBtn} onPress={onSeekBack} activeOpacity={0.75}>
            <Text style={styles.skipText}>-10s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playBtn}
            onPress={isPlaying ? onPause : onPlay}
            activeOpacity={0.85}
          >
            {isPlaying
              ? <Pause color="#000" size={28} />
              : <Play color="#000" size={28} style={{ marginLeft: 3 }} />
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={onSeekForward} activeOpacity={0.75}>
            <Text style={styles.skipText}>+10s</Text>
          </TouchableOpacity>
        </View>

        <StopCastButton onPress={handleStopCast} />
      </View>
    );
  }

  // ── Agora mode ──────────────────────────────────────────────────────────
  const { isMuted, isCameraOff, onToggleMic, onToggleCamera, onEndCall } = props;

  return (
    <View style={styles.container}>
      <Text style={styles.modeLabel}>Live call on TV</Text>

      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[styles.iconBtn, isMuted && styles.iconBtnDanger]}
          onPress={onToggleMic}
          activeOpacity={0.75}
        >
          {isMuted
            ? <MicOff color="#fff" size={24} />
            : <Mic color="#fff" size={24} />
          }
          <Text style={styles.iconBtnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endBtn} onPress={onEndCall} activeOpacity={0.8}>
          <PhoneOff color="#fff" size={26} />
          <Text style={styles.endBtnLabel}>End</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconBtn, isCameraOff && styles.iconBtnDanger]}
          onPress={onToggleCamera}
          activeOpacity={0.75}
        >
          {isCameraOff
            ? <VideoOff color="#fff" size={24} />
            : <Video color="#fff" size={24} />
          }
          <Text style={styles.iconBtnLabel}>{isCameraOff ? 'Show' : 'Camera'}</Text>
        </TouchableOpacity>
      </View>

      <StopCastButton onPress={handleStopCast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(8,18,32,0.97)',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: 'rgba(79,195,247,0.2)',
    alignItems: 'center',
    gap: 14,
  },
  modeLabel: {
    color: '#4FC3F7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'center',
  },
  timeDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 1,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  skipBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  playBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    // Subtle shadow (web)
    boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
    elevation: 4,
  },
  iconBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDanger: {
    backgroundColor: 'rgba(255,59,48,0.28)',
  },
  iconBtnLabel: {
    color: '#aaa',
    fontSize: 9,
    marginTop: 3,
  },
  endBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endBtnLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
  },
  stopCastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.4)',
  },
  stopCastText: {
    color: '#4FC3F7',
    fontSize: 12,
    fontWeight: '600',
  },
});
