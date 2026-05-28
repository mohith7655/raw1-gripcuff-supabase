import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { supabase } from '../../core/config/supabase';

const ORANGE = '#FF6B00';
const CARD_BG = '#1A2332';
const DROPDOWN_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const ROW_HEIGHT = 60;
const MAX_RESULTS = 8;

interface MentionUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface MentionTextInputProps {
  value: string;
  onChange: (text: string) => void;
  onMentionsChange: (mentionedUserIds: string[]) => void;
  placeholder: string;
  maxLength: number;
  style?: any;
  autoFocus?: boolean;
  inputStyle?: any;
}

// ── Debounce helper ────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Detect active @query at end of current text ────────────────────────────
function getActiveMentionQuery(text: string): string | null {
  const match = text.match(/(?:^|\s)@(\w*)$/);
  return match ? match[1] : null;
}

// ── Skeleton row ───────────────────────────────────────────────────────────
function SkeletonRow() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: false }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={styles.skeletonAvatar} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '55%' }]} />
      </View>
    </Animated.View>
  );
}

export function MentionTextInput({
  value,
  onChange,
  onMentionsChange,
  placeholder,
  maxLength,
  style,
  autoFocus,
  inputStyle,
}: MentionTextInputProps) {
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Confirmed mentions: username → user_id
  const confirmedRef = useRef<Map<string, string>>(new Map());

  const debouncedQuery = useDebounce(query, 200);

  // Search Supabase when debounced query changes
  useEffect(() => {
    if (debouncedQuery === null) {
      setResults([]);
      return;
    }
    setLoading(true);

    const controller = { cancelled: false };
    Promise.resolve(
      supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', `${debouncedQuery}%`)
        .order('username', { ascending: true })
        .limit(MAX_RESULTS)
    ).then(({ data }) => {
      if (controller.cancelled) return;
      setResults((data as MentionUser[]) ?? []);
      setLoading(false);
    }).catch(() => {
      if (!controller.cancelled) setLoading(false);
    });

    return () => { controller.cancelled = true; };
  }, [debouncedQuery]);

  const handleChangeText = useCallback((text: string) => {
    onChange(text);
    const q = getActiveMentionQuery(text);
    setQuery(q);
    if (q === null) setResults([]);
  }, [onChange]);

  const handleSelect = useCallback((user: MentionUser) => {
    // Replace trailing @partial with @username
    const replaced = value.replace(/(?:^|\s)@(\w*)$/, (match) => {
      // Preserve leading space if it was there
      const hasLeadingSpace = match.startsWith(' ') || match.startsWith('\n');
      return `${hasLeadingSpace ? match[0] : ''}@${user.username} `;
    });
    onChange(replaced);
    setQuery(null);
    setResults([]);

    // Record confirmed mention
    confirmedRef.current.set(user.username, user.id);

    // Recompute all mentioned user IDs from current text + new replacement
    const allMentioned = extractMentionedIds(replaced, confirmedRef.current);
    onMentionsChange(allMentioned);
  }, [value, onChange, onMentionsChange]);

  // Recompute mentions whenever text changes (handles deletions)
  useEffect(() => {
    const allMentioned = extractMentionedIds(value, confirmedRef.current);
    onMentionsChange(allMentioned);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const showDropdown = query !== null && (loading || results.length > 0 || query.length > 0);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        style={[styles.input, inputStyle]}
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={TEXT_SECONDARY}
        multiline
        maxLength={maxLength}
        autoFocus={autoFocus}
        textAlignVertical="top"
      />

      {showDropdown && (
        <View style={styles.dropdown}>
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : results.length === 0 && query !== null && query.length > 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={results.length > 4}
              style={{ maxHeight: ROW_HEIGHT * Math.min(results.length, 4) }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.resultRow,
                    hoveredId === item.id && styles.resultRowHovered,
                  ]}
                  onPress={() => handleSelect(item)}
                  onPressIn={() => setHoveredId(item.id)}
                  onPressOut={() => setHoveredId(null)}
                  activeOpacity={0.85}
                >
                  <View style={styles.resultAvatar}>
                    {item.avatar_url
                      ? <Image source={{ uri: item.avatar_url }} style={styles.resultAvatarImg} />
                      : <Text style={styles.resultAvatarInitial}>
                          {(item.full_name ?? item.username).charAt(0).toUpperCase()}
                        </Text>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.full_name ?? item.username}
                    </Text>
                    <Text style={styles.resultUsername} numberOfLines={1}>
                      @{item.username}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

function extractMentionedIds(text: string, confirmed: Map<string, string>): string[] {
  const matches = text.match(/@(\w+)/g) ?? [];
  const ids = new Set<string>();
  for (const m of matches) {
    const username = m.slice(1);
    const id = confirmed.get(username);
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  input: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    paddingTop: 0,
  },
  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: DROPDOWN_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
      web: { boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' } as any,
    }),
    zIndex: 999,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingHorizontal: 12,
    gap: 10,
  },
  resultRowHovered: {
    backgroundColor: 'rgba(255,107,0,0.1)',
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2a3a4a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  resultAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  resultAvatarInitial: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resultName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resultUsername: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 1 },
  emptyRow: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: TEXT_SECONDARY, fontSize: 14 },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingHorizontal: 12,
    gap: 10,
  },
  skeletonAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  skeletonLine: {
    height: 10,
    width: '70%',
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
