import React, { useCallback, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useThemeStore } from '@/stores/useThemeStore'
import { getTheme } from '@/config/theme'
import { httpClient } from '@/services/httpClient'
import type { UsersStackParamList } from '@/types/navigation'

interface RawUser {
  id: string
  username: string
  avatarUrl?: string
  createdAt?: string
  isOnline?: boolean
  rank?: number
  stats?: {
    totalHours?: number
    totalPomodoros?: number
  }
}

type UserSearchResult = Omit<RawUser, 'stats'> & {
  stats: {
    totalHours: number
    totalPomodoros: number
  }
}

type UsersScreenNavigationProp = StackNavigationProp<UsersStackParamList, 'UsersList'>

const RANK_COLORS: Record<number, string> = {
  1: '#fbbf24', // gold
  2: '#94a3b8', // silver
  3: '#f97316', // bronze
}

let cachedUsers: UserSearchResult[] | null = null

export default function UsersScreen() {
  const theme = useThemeStore((state) => state.theme)
  const colors = getTheme(theme)
  const isDark = theme === 'dark'
  const skeletonBaseColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const navigation = useNavigation<UsersScreenNavigationProp>()

  const [searchQuery, setSearchQuery] = useState('')
  const searchValueRef = useRef('')
  const [users, setUsers] = useState<UserSearchResult[]>(() => cachedUsers ?? [])
  const [filteredUsers, setFilteredUsers] = useState<UserSearchResult[]>(() => cachedUsers ?? [])
  const [loading, setLoading] = useState(() => !cachedUsers)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const formatHours = useCallback((hours: number) => {
    if (!hours) return '0 h'
    if (hours >= 10) return `${Math.round(hours)} h`
    return `${hours.toFixed(1)} h`
  }, [])

  const formatPomodoros = useCallback((count: number) => {
    if (!count) return '0 pomodoros'
    return `${count} pomodoros`
  }, [])

  const normalizeUsers = (list: RawUser[]): UserSearchResult[] =>
    list.map((user) => ({
      ...user,
      username: user.username ?? 'Unknown',
      avatarUrl: user.avatarUrl ?? undefined,
      stats: {
        totalHours: Number(user.stats?.totalHours ?? 0),
        totalPomodoros: Number(user.stats?.totalPomodoros ?? 0),
      },
    }))

  const fetchUsers = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!force && cachedUsers) {
      const cachedList = cachedUsers
      setUsers(cachedList)
      const trimmed = searchValueRef.current.trim().toLowerCase()
      if (!trimmed.length) {
        setFilteredUsers(cachedList)
      } else {
        setFilteredUsers(
          cachedList.filter((user) => user.username.toLowerCase().includes(trimmed))
        )
      }
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setErrorMessage(null)
      const response = await httpClient.get('api/users/search?q=')
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const data = await response.json()
      const eligibleUsers = normalizeUsers(data.users || []).filter(
        (user) => user.stats.totalPomodoros > 0 || user.stats.totalHours > 0
      )
      cachedUsers = eligibleUsers
      setUsers(eligibleUsers)
      const trimmed = searchValueRef.current.trim().toLowerCase()
      if (!trimmed.length) {
        setFilteredUsers(eligibleUsers)
      } else {
        setFilteredUsers(
          eligibleUsers.filter((user) => user.username.toLowerCase().includes(trimmed))
        )
      }
    } catch (error) {
      console.error('[UsersScreen] Failed to load users:', error)
      setErrorMessage('Failed to load users')
      setUsers([])
      setFilteredUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void fetchUsers()
    }, [fetchUsers])
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchUsers({ force: true })
    setRefreshing(false)
  }, [fetchUsers])

  const applySearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      searchValueRef.current = query
      const trimmed = query.trim().toLowerCase()
      if (!trimmed.length) {
        setFilteredUsers(users)
        return
      }
      setFilteredUsers(
        users.filter((user) => user.username.toLowerCase().includes(trimmed))
      )
    },
    [users]
  )

  const handleSelectUser = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId })
    },
    [navigation]
  )

  const renderUserItem: ListRenderItem<UserSearchResult> = ({ item, index }) => {
    const place = item.rank ?? index + 1
    const accent = RANK_COLORS[place] ?? colors.borderLight

    return (
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => handleSelectUser(item.id)}
        style={[
          styles.userCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.userCardHeader}>
          <View
            style={[
              styles.userRankBadge,
              {
                borderColor: accent,
                backgroundColor: RANK_COLORS[place] ? accent + '1a' : colors.backgroundSecondary,
              },
            ]}
          >
            <Text style={[styles.userRankText, { color: accent }]}>#{place}</Text>
          </View>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.userAvatar} />
          ) : (
            <View
              style={[
                styles.userAvatar,
                styles.avatarFallback,
                { backgroundColor: colors.backgroundSecondary },
              ]}
            >
              <Text style={[styles.avatarFallbackText, { color: colors.text }]}>
                {item.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {item.username}
              </Text>
              {typeof item.isOnline === 'boolean' && (
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: item.isOnline ? colors.online : colors.offline },
                  ]}
                />
              )}
            </View>
            <Text style={[styles.memberSince, { color: colors.textTertiary }]}>
              Active since {item.createdAt ? new Date(item.createdAt).getFullYear() : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.userStatsRow}>
          <View
            style={[
              styles.statChip,
              { backgroundColor: colors.backgroundSecondary, marginRight: 8 },
            ]}
          >
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hours</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatHours(item.stats.totalHours)}</Text>
          </View>
          <View
            style={[
              styles.statChip,
              { backgroundColor: colors.backgroundSecondary, marginLeft: 8 },
            ]}
          >
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pomodoros</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{item.stats.totalPomodoros}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const SkeletonLine = ({
    width = '100%',
    height = 12,
    radius = 999,
  }: {
    width?: DimensionValue
    height?: number
    radius?: number
  }) => {
    const lineStyle: ViewStyle = {
      width,
      height,
      borderRadius: radius,
      backgroundColor: skeletonBaseColor,
    }

    return <View style={[styles.skeletonLine, lineStyle]} />
  }

  const SkeletonUserCard = () => (
    <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.userCardHeader}>
        <View style={[styles.skeletonRankBadge, { backgroundColor: skeletonBaseColor }]} />
        <View style={[styles.userAvatar, styles.skeletonAvatar, { backgroundColor: skeletonBaseColor }]} />
        <View style={styles.userDetails}>
          <SkeletonLine width="60%" height={16} />
          <SkeletonLine width="40%" height={12} />
        </View>
      </View>
      <View style={styles.userStatsRow}>
        <View
          style={[
            styles.statChip,
            { backgroundColor: colors.backgroundSecondary, marginRight: 8 },
          ]}
        >
          <SkeletonLine width="50%" />
          <SkeletonLine width="70%" height={12} />
        </View>
        <View
          style={[
            styles.statChip,
            { backgroundColor: colors.backgroundSecondary, marginLeft: 8 },
          ]}
        >
          <SkeletonLine width="50%" />
          <SkeletonLine width="70%" height={12} />
        </View>
      </View>
    </View>
  )

  const EmptyStatePlaceholder = () => {
    if (loading) {
      return (
        <View style={styles.skeletonList}>
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonUserCard key={index} />
          ))}
        </View>
      )
    }

    return (
      <View style={styles.emptyState}>
        {errorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorLight }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
          </View>
        ) : (
          <Text style={[styles.emptyLabel, { color: colors.textSecondary }]}>
            {searchQuery.trim().length ? 'No users match your search' : 'No users to display yet'}
          </Text>
        )}
      </View>
    )
  }

  const listHeader = (
    <View style={styles.listHeader}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>Community members</Text>
      <View
        style={[
          styles.searchWrapper,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.inputBorder,
          },
        ]}
      >
        <TextInput
          value={searchQuery}
          onChangeText={applySearch}
          placeholder="Search by username..."
          placeholderTextColor={colors.textPlaceholder}
          style={[styles.searchInput, { color: colors.text }]}
        />
      </View>
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={EmptyStatePlaceholder}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  searchWrapper: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    fontSize: 16,
    fontWeight: '500',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyLabel: {
    fontSize: 15,
    textAlign: 'center',
  },
  errorBox: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  userCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userRankBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 12,
  },
  userRankText: {
    fontSize: 13,
    fontWeight: '700',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  memberSince: {
    marginTop: 2,
    fontSize: 13,
  },
  userStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  skeletonList: {
    paddingTop: 8,
    paddingBottom: 24,
    gap: 0,
  },
  skeletonLine: {
    marginBottom: 8,
  },
  skeletonAvatar: {
    borderRadius: 25,
  },
  skeletonRankBadge: {
    width: 48,
    height: 28,
    borderRadius: 12,
    marginRight: 12,
  },
})
