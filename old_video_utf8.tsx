import React, { useRef, useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, TouchableWithoutFeedback,
    StyleSheet, Dimensions, StatusBar,
    ActivityIndicator, PanResponder, TextInput, Alert, ScrollView
} from 'react-native';
import {
    collection, addDoc, query,
    orderBy, onSnapshot,
    updateDoc, doc, arrayUnion,
    arrayRemove, serverTimestamp
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../core/config/firebase';
import { Video, ResizeMode, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { AppTheme } from '../core/theme/app_theme';

const VIDEO_URL = "https://firebasestorage.googleapis.com/v0/b/wazy-6c4a9.firebasestorage.app/o/Gripcuff%201%20st%20video.mp4?alt=media&token=e4f9796e-5898-4756-9e10-914c228f34d3";

const { width } = Dimensions.get('window');
const VIDEO_HEIGHT = width * 0.56;

export default function VideoPlayerScreen({ route, navigation }: any) {
    const videoRef = useRef<Video>(null);
    const hideTimer = useRef<NodeJS.Timeout | null>(null);
    const title = route?.params?.title ?? 'Video';

    const [status, setStatus] = useState<AVPlaybackStatus | {}>({});
    const [showControls, setShowControls] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    // Volume state
    const [volume, setVolume] = useState(1.0);

    const [isFullscreen, setIsFullscreen] = useState(false);

    // --- COMMENTS STATE ---
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentsLoading, setCommentsLoading] = useState(true);
    const videoId = (route?.params?.videoId ?? route?.params?.title ?? 'default-video')
        .toString()
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .toLowerCase();

    console.log('VideoID for comments:', videoId);

    // FETCH comments realtime
    useEffect(() => {
        const q = query(
            collection(db, 'videoComments', videoId, 'comments'),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setComments(data);
            setCommentsLoading(false);
        });
        return () => unsub();
    }, [videoId]);

    // POST comment
    const postComment = async () => {
        console.log('=== POST COMMENT DEBUG ===');
        console.log('currentUser:', currentUser?.uid);
        console.log('videoId:', videoId);
        console.log('comment text:', newComment);
        console.log('db:', db);

        if (!newComment.trim()) {
            console.log('FAIL: empty comment');
            return;
        }
        if (!currentUser) {
            console.log('FAIL: no user logged in');
            Alert.alert('Login required', 'Please login to comment');
            return;
        }
        if (!videoId) {
            console.log('FAIL: videoId is undefined');
            return;
        }

        try {
            const docRef = await addDoc(
                collection(db, 'videoComments', videoId, 'comments'),
                {
                    userId: currentUser.uid,
                    username: currentUser.displayName ?? currentUser.email?.split('@')[0] ?? 'User',
                    userAvatar: (currentUser.displayName ?? currentUser.email ?? 'U')[0].toUpperCase(),
                    text: newComment.trim(),
                    createdAt: serverTimestamp(),
                    likes: 0,
                    likedBy: [],
                }
            );
            console.log('SUCCESS: comment posted', docRef.id);
            setNewComment('');
        } catch (e: any) {
            console.error('FAIL: Firestore error:', e.message);
            Alert.alert('Error', e.message);
        }
    };

    // LIKE comment
    const toggleLike = async (commentId: string, likedBy: string[], likes: number) => {
        if (!currentUser) return;
        const ref = doc(db, 'videoComments', videoId, 'comments', commentId);
        const alreadyLiked = likedBy?.includes(currentUser.uid);
        await updateDoc(ref, {
            likes: alreadyLiked ? likes - 1 : likes + 1,
            likedBy: alreadyLiked
                ? arrayRemove(currentUser.uid)
                : arrayUnion(currentUser.uid),
        });
    };

    const formatTimeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const getAvatarColor = (name: string) => {
        const colors = ['#D4622A', '#8B5CF6', '#10B981', '#3B82F6', '#E8732A'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };
    // ----------------------

    // SAFE progress calculation
    const duration = (status as AVPlaybackStatusSuccess)?.durationMillis ?? 0;
    const position = (status as AVPlaybackStatusSuccess)?.positionMillis ?? 0;
    const progress = (duration > 0 && isFinite(duration) && isFinite(position))
        ? position / duration
        : 0;
    const isPlaying = (status as AVPlaybackStatusSuccess)?.isPlaying ?? false;

    const formatTime = (ms: number) => {
        if (!ms || !isFinite(ms) || ms < 0) return '0:00';
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const resetHideTimer = () => {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setShowControls(true);
        hideTimer.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    };

    useEffect(() => {
        resetHideTimer();
        return () => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
        };
    }, [isPlaying]);

    const togglePlayPause = async () => {
        if (isPlaying) {
            await videoRef.current?.pauseAsync();
        } else {
            await videoRef.current?.playAsync();
        }
        resetHideTimer();
    };

    // REFS for blocking status overwrites
    const isSeekingRef = useRef(false);
    const isVolSeekingRef = useRef(false);

    const applyVolume = async (val: number) => {
        const v = Math.max(0, Math.min(1, val));
        setVolume(v);
        try {
            await videoRef.current?.setStatusAsync({
                volume: v,
                isMuted: v === 0,
            });
        } catch (e) {
            console.warn('volume error', e);
        }
    };

    const skipBack = async () => {
        if (!isFinite(position)) return;
        isSeekingRef.current = true;
        const newPos = Math.max(0, position - 10000);
        try {
            await videoRef.current?.setPositionAsync(newPos);
        } catch (e) { }
        setTimeout(() => {
            isSeekingRef.current = false;
        }, 300);
        resetHideTimer();
    };

    const skipForward = async () => {
        if (!isFinite(position) || !isFinite(duration)) return;
        isSeekingRef.current = true;
        const newPos = Math.min(duration, position + 10000);
        try {
            await videoRef.current?.setPositionAsync(newPos);
        } catch (e) { }
        setTimeout(() => {
            isSeekingRef.current = false;
        }, 300);
        resetHideTimer();
    };

    const toggleFullscreen = async () => {
        if (isFullscreen) {
            await ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.PORTRAIT_UP
            );
        } else {
            await ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
            );
        }
        setIsFullscreen(!isFullscreen);
    };

    useEffect(() => {
        return () => {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        };
    }, []);

    // DRAGGABLE seek using PanResponder
    const seekBarRef = useRef(null);
    const seekBarWidth = useRef(width - 80);
    const [isSeeking, setIsSeeking] = useState(false);
    const [seekProgress, setSeekProgress] = useState(0);

    const seekPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,

            onPanResponderGrant: (e) => {
                isSeekingRef.current = true;
                setIsSeeking(true);
                resetHideTimer();
                const ratio = Math.max(0, Math.min(1,
                    e.nativeEvent.locationX / seekBarWidth.current
                ));
                setSeekProgress(ratio);
            },

            onPanResponderMove: (e) => {
                resetHideTimer();
                const ratio = Math.max(0, Math.min(1,
                    e.nativeEvent.locationX / seekBarWidth.current
                ));
                setSeekProgress(ratio);
            },

            onPanResponderRelease: async (e) => {
                const ratio = Math.max(0, Math.min(1,
                    e.nativeEvent.locationX / seekBarWidth.current
                ));
                setSeekProgress(ratio);
                setIsSeeking(false);
                if (duration > 0 && isFinite(duration)) {
                    const newPos = ratio * duration;
                    if (isFinite(newPos)) {
                        try {
                            await videoRef.current?.setPositionAsync(newPos);
                        } catch (err) {
                            console.warn('seek error', err);
                        }
                    }
                }
                setTimeout(() => {
                    isSeekingRef.current = false;
                }, 300);
                resetHideTimer();
            },
        })
    ).current;

    // Display progress = dragging preview OR actual
    const displayProgress = isSeeking ? seekProgress : progress;

    // VOLUME PanResponder
    const volumePanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e) => {
                isVolSeekingRef.current = true;
                resetHideTimer();
                const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / 100));
                applyVolume(ratio);
            },
            onPanResponderMove: (e) => {
                resetHideTimer();
                const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / 100));
                applyVolume(ratio);
            },
            onPanResponderRelease: (e) => {
                const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / 100));
                applyVolume(ratio);
                setTimeout(() => {
                    isVolSeekingRef.current = false;
                }, 200);
                resetHideTimer();
            },
        })
    ).current;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* VIDEO + CONTROLS */}
            <TouchableWithoutFeedback onPress={() => {
                setShowControls(prev => !prev);
                resetHideTimer();
            }}>
                <View style={[styles.videoWrapper,
                isFullscreen && styles.videoFullscreen]}>

                    {/* VIDEO */}
                    <Video
                        ref={videoRef}
                        source={{ uri: VIDEO_URL }}
                        style={styles.video}
                        resizeMode={ResizeMode.CONTAIN}
                        useNativeControls={false}
                        shouldPlay={true}
                        volume={volume}
                        isMuted={volume === 0}
                        onPlaybackStatusUpdate={s => {
                            if (!isSeekingRef.current) {
                                setStatus(s);
                                if ('isLoaded' in s && s.isLoaded) setIsLoading(false);
                            }
                        }}
                        onLoad={() => setIsLoading(false)}
                    />

                    {/* LOADING */}
                    {isLoading && (
                        <View style={styles.overlayCentered}>
                            <ActivityIndicator color="#D4622A" size="large" />
                        </View>
                    )}

                    {/* CONTROLS OVERLAY */}
                    {showControls && !isLoading && (
                        <View style={styles.overlay}>

                            {/* TOP BAR */}
                            <View style={styles.topBar}>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (isFullscreen) {
                                            toggleFullscreen();
                                        } else {
                                            navigation.goBack();
                                        }
                                    }}
                                    style={styles.backBtn}
                                >
                                    <Text style={styles.backIcon}>ΓåÉ</Text>
                                </TouchableOpacity>
                                <Text style={styles.overlayTitle} numberOfLines={1}>
                                    {title}
                                </Text>
                                <TouchableOpacity style={styles.moreBtn}>
                                    <Text style={styles.moreIcon}>Γï«</Text>
                                </TouchableOpacity>
                            </View>

                            {/* CENTER CONTROLS */}
                            <View style={styles.centerControls}>
                                <TouchableOpacity
                                    onPress={skipBack}
                                    style={styles.skipBtn}
                                >
                                    <Text style={styles.skipIcon}>ΓÅ«</Text>
                                    <Text style={styles.skipLabel}>10s</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={togglePlayPause}
                                    style={styles.playBtn}
                                >
                                    <Text style={styles.playIcon}>
                                        {isPlaying ? 'ΓÅ╕' : 'Γû╢'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={skipForward}
                                    style={styles.skipBtn}
                                >
                                    <Text style={styles.skipIcon}>ΓÅ¡</Text>
                                    <Text style={styles.skipLabel}>10s</Text>
                                </TouchableOpacity>
                            </View>

                            {/* BOTTOM BAR */}
                            <View style={styles.bottomBar}>

                                {/* Time + Seek Bar */}
                                <View style={styles.seekRow}>
                                    <Text style={styles.timeText}>
                                        {formatTime(isSeeking ? displayProgress * duration : position)}
                                    </Text>
                                    <View
                                        ref={seekBarRef}
                                        style={styles.seekBarBg}
                                        onLayout={(e) => {
                                            seekBarWidth.current = e.nativeEvent.layout.width;
                                        }}
                                        {...seekPanResponder.panHandlers}
                                    >
                                        {/* Background track */}
                                        <View style={styles.seekTrack} />

                                        {/* Filled portion */}
                                        <View style={[styles.seekFill, {
                                            width: `${displayProgress * 100}%`
                                        }]} />

                                        {/* Draggable thumb */}
                                        <View style={[styles.seekThumb, {
                                            left: `${displayProgress * 100}%`
                                        }]} />
                                    </View>
                                    <Text style={styles.timeText}>
                                        {formatTime(duration)}
                                    </Text>
                                </View>

                                {/* Volume + Fullscreen */}
                                <View style={styles.bottomIcons}>

                                    {/* Volume Slider Row */}
                                    <View style={styles.volumeRow}>
                                        <Text style={styles.controlIcon}>
                                            {volume === 0 ? '≡ƒöç' : volume < 0.5 ? '≡ƒöë' : '≡ƒöè'}
                                        </Text>
                                        <View
                                            style={styles.volBarBg}
                                            {...volumePanResponder.panHandlers}
                                        >
                                            <View style={[styles.volFill, { width: `${volume * 100}%` }]} />
                                            <View style={[styles.volThumb, { left: `${volume * 100}%` }]} />
                                        </View>
                                        <Text style={styles.volPct}>{Math.round(volume * 100)}%</Text>
                                    </View>

                                    <View style={{ flex: 1 }} />

                                    <TouchableOpacity onPress={toggleFullscreen}>
                                        <Text style={styles.controlIcon}>
                                            {isFullscreen ? 'Γèí' : 'Γ¢╢'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                        </View>
                    )}
                </View>
            </TouchableWithoutFeedback>

            {/* VIDEO INFO & COMMENTS BELOW */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.info}>
                    <Text style={styles.infoTitle}>{title}</Text>
                    <Text style={styles.infoSub}>GripCuff Training ┬╖ Beginner</Text>

                    {/* Progress indicator */}
                    <View style={styles.progressRow}>
                        <View style={styles.progressBg}>
                            <View style={[styles.progressFill,
                            { width: `${progress * 100}%` }]} />
                        </View>
                        <Text style={styles.progressPct}>
                            {Math.round(progress * 100)}%
                        </Text>
                    </View>
                </View>

                {/* Comment Section */}
                <View style={commentStyles.section}>
                    {/* Header */}
                    <Text style={commentStyles.heading}>
                        ≡ƒÆ¼ Comments ({comments.length})
                    </Text>

                    {/* Input box */}
                    <View style={commentStyles.inputRow}>
                        <View style={commentStyles.myAvatar}>
                            <Text style={commentStyles.myAvatarText}>
                                {(currentUser?.displayName ?? 'U')[0].toUpperCase()}
                            </Text>
                        </View>
                        <TextInput
                            style={commentStyles.input}
                            placeholder="Add a comment..."
                            placeholderTextColor="#3a5a7a"
                            value={newComment}
                            onChangeText={setNewComment}
                            multiline
                            maxLength={300}
                        />
                        <TouchableOpacity
                            style={[commentStyles.postBtn,
                            !newComment.trim() && { opacity: 0.4 }]}
                            onPress={postComment}
                            disabled={!newComment.trim()}
                        >
                            <Text style={commentStyles.postBtnText}>Post</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Comment list */}
                    {commentsLoading ? (
                        <ActivityIndicator color="#D4622A" style={{ marginTop: 20 }} />
                    ) : comments.length === 0 ? (
                        <Text style={commentStyles.empty}>
                            No comments yet. Be the first! ≡ƒÆ¬
                        </Text>
                    ) : (
                        comments.map((c) => (
                            <View key={c.id} style={commentStyles.commentCard}>
                                {/* Avatar */}
                                <View style={[commentStyles.avatar,
                                { backgroundColor: getAvatarColor(c.username) }]}>
                                    <Text style={commentStyles.avatarText}>
                                        {c.userAvatar}
                                    </Text>
                                </View>
                                {/* Content */}
                                <View style={commentStyles.commentContent}>
                                    <View style={commentStyles.commentHeader}>
                                        <Text style={commentStyles.username}>
                                            {c.username}
                                        </Text>
                                        <Text style={commentStyles.timestamp}>
                                            {c.createdAt?.toDate
                                                ? formatTimeAgo(c.createdAt.toDate())
                                                : 'just now'}
                                        </Text>
                                    </View>
                                    <Text style={commentStyles.commentText}>
                                        {c.text}
                                    </Text>
                                    {/* Like button */}
                                    <TouchableOpacity
                                        style={commentStyles.likeRow}
                                        onPress={() => toggleLike(c.id, c.likedBy, c.likes ?? 0)}
                                    >
                                        <Text style={{
                                            color: c.likedBy?.includes(currentUser?.uid)
                                                ? '#D4622A' : '#607a94',
                                            fontSize: 13,
                                        }}>
                                            {c.likedBy?.includes(currentUser?.uid) ? 'Γ¥ñ∩╕Å' : '≡ƒñì'}
                                            {' '}{(c.likes ?? 0) > 0 ? c.likes : ''}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: AppTheme.background },

    videoWrapper: {
        width: width,
        height: VIDEO_HEIGHT,
        backgroundColor: '#000',
        marginTop: 48,
    },
    videoFullscreen: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        width: '100%', height: '100%',
        zIndex: 100,
        marginTop: 0,
    },
    video: { width: '100%', height: '100%' },

    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'space-between',
    },
    overlayCentered: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Top
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 12,
    },
    backBtn: { padding: 6 },
    backIcon: { color: '#fff', fontSize: 20 },
    overlayTitle: {
        flex: 1, color: '#fff',
        fontSize: 14, fontWeight: '700',
        textAlign: 'center', paddingHorizontal: 8,
    },
    moreBtn: { padding: 6 },
    moreIcon: { color: '#fff', fontSize: 20 },

    // Center
    centerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
    },
    skipBtn: { alignItems: 'center' },
    skipIcon: { fontSize: 28, color: '#fff' },
    skipLabel: {
        color: '#fff', fontSize: 10,
        marginTop: 2, fontWeight: '600',
    },
    playBtn: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: 'rgba(212,98,42,0.9)',
        alignItems: 'center', justifyContent: 'center',
    },
    playIcon: { fontSize: 28, color: '#fff' },

    // Bottom
    bottomBar: {
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    seekRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    timeText: {
        color: '#fff', fontSize: 11,
        fontWeight: '600', minWidth: 36,
    },
    seekBarBg: {
        flex: 1,
        height: 28,
        justifyContent: 'center',
        position: 'relative',
    },
    seekTrack: {
        position: 'absolute',
        left: 0, right: 0,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
    },
    seekFill: {
        position: 'absolute',
        left: 0,
        height: 4,
        backgroundColor: '#D4622A',
        borderRadius: 2,
    },
    seekThumb: {
        position: 'absolute',
        width: 16, height: 16,
        borderRadius: 8,
        backgroundColor: '#D4622A',
        marginLeft: -8,
        top: 6,
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 3,
    },
    bottomIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    controlIcon: { fontSize: 18, color: '#fff', paddingRight: 4 },

    volumeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    volBarBg: {
        width: 100,
        height: 20,
        justifyContent: 'center',
        position: 'relative',
    },
    volFill: {
        position: 'absolute',
        left: 0,
        height: 4,
        backgroundColor: '#D4622A',
        borderRadius: 2,
    },
    volThumb: {
        position: 'absolute',
        width: 12, height: 12,
        borderRadius: 6,
        backgroundColor: '#fff',
        marginLeft: -6,
        top: 4,
    },
    volPct: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        minWidth: 32,
    },

    // Info
    info: { padding: 20 },
    infoTitle: {
        color: '#fff', fontSize: 17,
        fontWeight: '700', marginBottom: 4,
    },
    infoSub: {
        color: '#607a94', fontSize: 13,
        marginBottom: 16,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center', gap: 10,
    },
    progressBg: {
        flex: 1, height: 4,
        backgroundColor: '#1c3a56',
        borderRadius: 2,
    },
    progressFill: {
        height: 4,
        backgroundColor: '#D4622A',
        borderRadius: 2,
    },
    progressPct: {
        color: '#D4622A', fontSize: 13, fontWeight: '700'
    },
});

const commentStyles = StyleSheet.create({
    section: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#1c3a56',
        marginTop: 8,
    },
    heading: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 20,
    },
    myAvatar: {
        width: 36, height: 36,
        borderRadius: 18,
        backgroundColor: '#D4622A',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    myAvatarText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    input: {
        flex: 1,
        backgroundColor: '#131f2e',
        borderWidth: 1.5,
        borderColor: '#1c3a56',
        borderRadius: 10,
        padding: 10,
        color: '#c8dff2',
        fontSize: 14,
        minHeight: 40,
        maxHeight: 100,
    },
    postBtn: {
        backgroundColor: '#D4622A',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        justifyContent: 'center',
    },
    postBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    empty: {
        color: '#3a5a7a',
        textAlign: 'center',
        marginTop: 24,
        fontSize: 14,
    },
    commentCard: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    avatar: {
        width: 36, height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    avatarText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    commentContent: { flex: 1 },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    username: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    timestamp: {
        color: '#3a5a7a',
        fontSize: 11,
    },
    commentText: {
        color: '#c8dff2',
        fontSize: 14,
        lineHeight: 20,
    },
    likeRow: {
        marginTop: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
});
