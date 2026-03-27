import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { ScreenContainer, EmptyState } from '../../src/components/ui';
import { crossPlatformAlert } from '../../src/lib/cross-platform-alert';
import { useFriendsStore, type Friendship, type FriendProfile } from '../../src/stores/friends-store';

export default function FriendsScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography } = useTheme();
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    isLoading,
    initialize,
    searchUsers,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  } = useFriendsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  useEffect(() => {
    initialize();
  }, []);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      searchTimerRef.current = setTimeout(async () => {
        const results = await searchUsers(query);
        const existingIds = new Set([
          ...friends.map((f) => f.friend.id),
          ...outgoingRequests.map((r) => r.friend.id),
          ...incomingRequests.map((r) => r.friend.id),
        ]);
        setSearchResults(results.filter((r) => !existingIds.has(r.id)));
        setIsSearching(false);
      }, 300);
    },
    [friends, outgoingRequests, incomingRequests, searchUsers],
  );

  const handleSendRequest = async (userId: string) => {
    const { error } = await sendRequest(userId);
    if (error) {
      crossPlatformAlert('Error', error);
    } else {
      setSearchResults((prev) => prev.filter((r) => r.id !== userId));
    }
  };

  const handleAccept = async (friendship: Friendship) => {
    await acceptRequest(friendship.id);
  };

  const handleDecline = async (friendship: Friendship) => {
    await declineRequest(friendship.id);
  };

  const handleRemove = (friendship: Friendship) => {
    crossPlatformAlert(
      'Remove Friend',
      `Remove ${friendship.friend.displayName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFriend(friendship.id),
        },
      ],
    );
  };

  const renderAvatar = (name: string) => (
    <View
      style={[
        styles.avatar,
        { backgroundColor: colors.primaryMuted, borderRadius: radius.full },
      ]}
    >
      <Text style={[typography.label, { color: colors.primary }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );

  const totalRequests = incomingRequests.length;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.h2, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
          Friends
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/social/leaderboard')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Leaderboard"
        >
          <Ionicons name="trophy-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs */}
      <View style={[styles.tabRow, { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.sm }]}>
        <TouchableOpacity
          style={[styles.tab, { minHeight: 44, justifyContent: 'center' }]}
          onPress={() => router.push('/social/feed')}
          accessibilityRole="tab"
          accessibilityLabel="Feed tab"
          accessibilityState={{ selected: false }}
        >
          <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, { minHeight: 44, justifyContent: 'center' }]}
          onPress={() => router.push('/social/leaderboard')}
          accessibilityRole="tab"
          accessibilityLabel="Leaderboard tab"
          accessibilityState={{ selected: false }}
        >
          <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, { minHeight: 44, justifyContent: 'center', borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          activeOpacity={1}
          accessibilityRole="tab"
          accessibilityLabel="Friends tab, selected"
          accessibilityState={{ selected: true }}
        >
          <Text style={[typography.labelLarge, { color: colors.primary }]}>Friends</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.base,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={[typography.body, { color: colors.text, flex: 1, marginLeft: spacing.sm, height: 44 }]}
          placeholder="Search by name or email"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => { setSearchQuery(''); setSearchResults([]); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.labelSmall, { color: colors.textTertiary, marginBottom: spacing.sm }]}>
            SEARCH RESULTS
          </Text>
          {searchResults.map((user) => (
            <View
              key={user.id}
              style={[
                styles.friendRow,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginBottom: spacing.xs,
                },
              ]}
            >
              {renderAvatar(user.displayName)}
              <Text style={[typography.label, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
                {user.displayName}
              </Text>
              <TouchableOpacity
                onPress={() => handleSendRequest(user.id)}
                style={[styles.actionBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${user.displayName}`}
              >
                <Ionicons name="person-add" size={16} color={colors.textInverse} />
                <Text style={[typography.labelSmall, { color: colors.textInverse, marginLeft: 4 }]}>Add</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {isSearching && (
        <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.base }} />
      )}

      {/* Tabs */}
      {searchQuery.length === 0 && (
        <>
          <View style={[styles.filterRow, { marginBottom: spacing.base, gap: spacing.sm }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('friends')}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeTab === 'friends' ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.base,
                  minHeight: 44,
                  justifyContent: 'center',
                },
              ]}
              accessibilityRole="tab"
              accessibilityLabel="Show friends list"
              accessibilityState={{ selected: activeTab === 'friends' }}
            >
              <Text
                style={[
                  typography.label,
                  { color: activeTab === 'friends' ? colors.textInverse : colors.textSecondary },
                ]}
              >
                Friends ({friends.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('requests')}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeTab === 'requests' ? colors.primary : colors.surfaceSecondary,
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.base,
                  minHeight: 44,
                  justifyContent: 'center',
                },
              ]}
              accessibilityRole="tab"
              accessibilityLabel="Show friend requests"
              accessibilityState={{ selected: activeTab === 'requests' }}
            >
              <Text
                style={[
                  typography.label,
                  { color: activeTab === 'requests' ? colors.textInverse : colors.textSecondary },
                ]}
              >
                Requests{totalRequests > 0 ? ` (${totalRequests})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : activeTab === 'friends' ? (
            friends.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No Friends Yet"
                description="Search for friends or share your invite link"
              />
            ) : (
              <FlatList
                data={friends}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.friendRow,
                      {
                        backgroundColor: colors.surface,
                        borderRadius: radius.md,
                        padding: spacing.md,
                        marginBottom: spacing.xs,
                      },
                    ]}
                  >
                    {renderAvatar(item.friend.displayName)}
                    <Text
                      style={[typography.label, { color: colors.text, flex: 1, marginLeft: spacing.md }]}
                    >
                      {item.friend.displayName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemove(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Remove friend"
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )
          ) : (
            <View>
              {/* Incoming Requests */}
              {incomingRequests.length > 0 && (
                <View style={{ marginBottom: spacing.lg }}>
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: colors.textTertiary, marginBottom: spacing.sm },
                    ]}
                  >
                    INCOMING
                  </Text>
                  {incomingRequests.map((req) => (
                    <View
                      key={req.id}
                      style={[
                        styles.friendRow,
                        {
                          backgroundColor: colors.surface,
                          borderRadius: radius.md,
                          padding: spacing.md,
                          marginBottom: spacing.xs,
                        },
                      ]}
                    >
                      {renderAvatar(req.friend.displayName)}
                      <Text
                        style={[
                          typography.label,
                          { color: colors.text, flex: 1, marginLeft: spacing.md },
                        ]}
                      >
                        {req.friend.displayName}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleAccept(req)}
                          style={[
                            styles.actionBtn,
                            { backgroundColor: colors.completed, borderRadius: radius.md },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Accept"
                        >
                          <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDecline(req)}
                          style={[
                            styles.actionBtn,
                            { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Decline"
                        >
                          <Ionicons name="close" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Outgoing Requests */}
              {outgoingRequests.length > 0 && (
                <View>
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: colors.textTertiary, marginBottom: spacing.sm },
                    ]}
                  >
                    SENT
                  </Text>
                  {outgoingRequests.map((req) => (
                    <View
                      key={req.id}
                      style={[
                        styles.friendRow,
                        {
                          backgroundColor: colors.surface,
                          borderRadius: radius.md,
                          padding: spacing.md,
                          marginBottom: spacing.xs,
                        },
                      ]}
                    >
                      {renderAvatar(req.friend.displayName)}
                      <View style={{ flex: 1, marginLeft: spacing.md }}>
                        <Text style={[typography.label, { color: colors.text }]}>
                          {req.friend.displayName}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textTertiary }]}>
                          Pending
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
                <EmptyState
                  icon="mail-outline"
                  title="No Requests"
                  description="When someone sends you a friend request, it will appear here"
                />
              )}
            </View>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 24,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterChip: {
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
});
