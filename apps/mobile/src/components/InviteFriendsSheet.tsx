import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './ui/BottomSheet';
import { useTheme } from '../theme';
import { useToast } from './Toast';
import { useFriendsStore, type FriendProfile } from '../stores/friends-store';
import { shareInviteLink } from '../lib/share-utils';
import { successNotification } from '../lib/haptics';

interface InviteFriendsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InviteFriendsSheet({ visible, onClose }: InviteFriendsSheetProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Share invite link ──────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const shared = await shareInviteLink();
      if (shared) {
        successNotification();
        showToast('Invite link shared!', 'success');
      }
    } catch {
      showToast('Failed to share invite link', 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast]);

  // ── Search ─────────────────────────────────────────────────────────

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.trim().length < 2) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const users = await useFriendsStore.getState().searchUsers(text);
          setResults(users);
        } catch {
          showToast('Search failed', 'error');
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [showToast],
  );

  // ── Send request ───────────────────────────────────────────────────

  const handleSendRequest = useCallback(
    async (userId: string) => {
      setSendingId(userId);
      try {
        const { error } = await useFriendsStore.getState().sendRequest(userId);
        if (error) {
          showToast(error, 'error');
        } else {
          successNotification();
          showToast('Friend request sent!', 'success');
          setResults((prev) => prev.filter((u) => u.id !== userId));
        }
      } catch {
        showToast('Failed to send request', 'error');
      } finally {
        setSendingId(null);
      }
    },
    [showToast],
  );

  // ── Reset state on close ───────────────────────────────────────────

  const handleClose = useCallback(() => {
    setQuery('');
    setResults([]);
    onClose();
  }, [onClose]);

  // ── Render helpers ─────────────────────────────────────────────────

  const renderUserRow = useCallback(
    ({ item }: { item: FriendProfile }) => {
      const isSending = sendingId === item.id;
      const initial = (item.displayName?.[0] ?? '?').toUpperCase();

      return (
        <View style={[styles.userRow, { borderBottomColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryMuted }]}>
            <Text style={[typography.label, { color: colors.primary }]}>{initial}</Text>
          </View>
          <Text
            style={[typography.body, { color: colors.text, flex: 1 }]}
            numberOfLines={1}
          >
            {item.displayName}
          </Text>
          <TouchableOpacity
            onPress={() => handleSendRequest(item.id)}
            disabled={isSending}
            style={[styles.addButton, { backgroundColor: colors.primary, borderRadius: radius.md }]}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={[typography.label, { color: colors.textOnPrimary }]}>Add</Text>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [sendingId, handleSendRequest, colors, typography, radius],
  );

  // ── Main render ────────────────────────────────────────────────────

  return (
    <BottomSheet visible={visible} onClose={handleClose} maxHeight={0.75}>
      {/* Section 1 — Share Invite Link */}
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.md }]}>
        Invite Friends
      </Text>

      <TouchableOpacity
        onPress={handleShare}
        disabled={isSharing}
        activeOpacity={0.8}
        style={[
          styles.shareButton,
          {
            backgroundColor: colors.gold,
            borderRadius: radius.lg,
            paddingVertical: spacing.md,
            marginBottom: spacing.xs,
          },
        ]}
      >
        {isSharing ? (
          <ActivityIndicator size="small" color={colors.textOnPrimary} />
        ) : (
          <>
            <Ionicons name="share-outline" size={20} color={colors.textOnPrimary} />
            <Text
              style={[
                typography.label,
                { color: colors.textOnPrimary, marginLeft: spacing.sm },
              ]}
            >
              Share Invite Link
            </Text>
          </>
        )}
      </TouchableOpacity>
      <Text
        style={[
          typography.caption,
          {
            color: colors.textSecondary,
            textAlign: 'center',
            marginBottom: spacing.lg,
          },
        ]}
      >
        Send a link via text, email, or social media
      </Text>

      {/* Section 2 — Search by Username */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.md,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={[
            typography.body,
            {
              flex: 1,
              color: colors.text,
              marginLeft: spacing.sm,
              paddingVertical: spacing.md,
            },
          ]}
          placeholder="Search by username..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {isSearching && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderUserRow}
          scrollEnabled={false}
          style={{ marginBottom: spacing.md }}
        />
      )}

      {query.trim().length >= 2 && !isSearching && results.length === 0 && (
        <Text
          style={[
            typography.caption,
            {
              color: colors.textSecondary,
              textAlign: 'center',
              marginBottom: spacing.md,
            },
          ]}
        >
          No users found
        </Text>
      )}

      {/* Section 3 — Info footer */}
      <Text
        style={[
          typography.caption,
          {
            color: colors.textTertiary,
            textAlign: 'center',
            marginTop: spacing.sm,
          },
        ]}
      >
        Friends can see your workout activity and compete with you on the leaderboard.
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center',
  },
});
