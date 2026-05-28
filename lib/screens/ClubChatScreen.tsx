import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Send } from 'lucide-react-native';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';

const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const MY_BUBBLE = '#FF6B00';
const OTHER_BUBBLE = '#1A2332';

interface ClubMessage {
  id: string;
  club_id: string;
  user_id: string;
  text: string;
  created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ClubChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { clubId, clubName } = route.params as { clubId: string; clubName: string };
  const { supabaseUserId } = useAuth();

  const [messages, setMessages] = useState<ClubMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('club_messages')
      .select('id, club_id, user_id, text, created_at, profiles:user_id (full_name, avatar_url)')
      .eq('club_id', clubId)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages((data ?? []) as unknown as ClubMessage[]);
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    fetchMessages();

    // Realtime subscription for new messages
    const channel = supabase
      .channel(`club_chat_${clubId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'club_messages', filter: `club_id=eq.${clubId}` },
        async (payload) => {
          // Fetch the full row with profile join
          const { data } = await supabase
            .from('club_messages')
            .select('id, club_id, user_id, text, created_at, profiles:user_id (full_name, avatar_url)')
            .eq('id', payload.new.id)
            .single();
          if (data) {
            setMessages(prev => {
              // Deduplicate
              if (prev.find(m => m.id === (data as any).id)) return prev;
              return [...prev, data as unknown as ClubMessage];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clubId, fetchMessages]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !supabaseUserId) return;
    setSending(true);
    setText('');

    // Optimistic insert
    const optimistic: ClubMessage = {
      id: `opt_${Date.now()}`,
      club_id: clubId,
      user_id: supabaseUserId,
      text: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      await supabase.from('club_messages').insert({
        club_id: clubId,
        user_id: supabaseUserId,
        text: trimmed,
      });
      // Realtime will replace the optimistic message; remove it
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } catch {
      // Restore text on failure
      setText(trimmed);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: ClubMessage; index: number }) => {
    const isMe = item.user_id === supabaseUserId;
    const name = item.profiles?.full_name ?? 'Member';
    const avatar = item.profiles?.avatar_url;
    const prevItem = messages[index - 1];
    const showAvatar = !isMe && (!prevItem || prevItem.user_id !== item.user_id);
    const showName = !isMe && showAvatar;

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        {!isMe && (
          <View style={styles.msgAvatarSlot}>
            {showAvatar && (
              <View style={styles.msgAvatar}>
                {avatar
                  ? <Image source={{ uri: avatar }} style={styles.msgAvatarImg} />
                  : <Text style={styles.msgAvatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                }
              </View>
            )}
          </View>
        )}
        <View style={[styles.msgBubbleWrap, isMe && { alignItems: 'flex-end' }]}>
          {showName && <Text style={styles.msgName}>{name}</Text>}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
          </View>
          <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{clubName}</Text>
          <Text style={styles.headerSub}>Club Chat</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={ORANGE} /></View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Message the club…"
            placeholderTextColor={TEXT_SECONDARY}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Send size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerSub: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: 12, paddingBottom: 8 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14 },

  msgRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-end' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },

  msgAvatarSlot: { width: 32, marginRight: 6, alignItems: 'center', justifyContent: 'flex-end' },
  msgAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2a3a4a',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  msgAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarInitial: { color: '#fff', fontSize: 11, fontWeight: '700' },

  msgBubbleWrap: { maxWidth: '72%' },
  msgName: { color: TEXT_SECONDARY, fontSize: 11, marginBottom: 2, marginLeft: 4 },

  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMe: {
    backgroundColor: MY_BUBBLE,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: OTHER_BUBBLE,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bubbleText: { color: '#94A3B8', fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  msgTime: { color: 'rgba(148,163,184,0.5)', fontSize: 10, marginTop: 2, marginHorizontal: 4 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: BG,
  },
  input: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
