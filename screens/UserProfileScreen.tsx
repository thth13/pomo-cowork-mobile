import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  type ViewStyle,
  type DimensionValue,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CompositeNavigationProp, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Svg, Rect, Line, Text as SvgText, Circle, G } from 'react-native-svg'
import { Feather } from '@expo/vector-icons'
import { useThemeStore } from '@/stores/useThemeStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTimerStore } from '@/stores/useTimerStore'
import { getTheme } from '@/config/theme'
import { httpClient } from '@/services/httpClient'
import type { ProfileStackParamList, UsersStackParamList } from '@/types/navigation'
import { SessionStatus, SessionType } from '@/types'

type UserProfileNavigationProp = CompositeNavigationProp<
  StackNavigationProp<ProfileStackParamList, 'UserProfile'>,
  StackNavigationProp<UsersStackParamList>
>

type UserProfileRouteProp = RouteProp<UsersStackParamList, 'UserProfile'>

type Props = {
  navigation: UserProfileNavigationProp
  route: UserProfileRouteProp
}

interface UserProfileResponse {
  user: {
    id: string
    username: string
    avatarUrl?: string
    description?: string
    createdAt: string
    totalSessions?: number
  }
  stats?: {
    totalSessions?: number
    completedSessions?: number
    totalWorkHours?: number
    completionRate?: number
  }
  activeSession?: {
    id: string
    task: string
    type: SessionType | string
    startedAt: string
    duration: number
  }
  recentSessions: ProfileSession[]
}

interface ProfileSession {
  id: string
  task: string
  type: SessionType | string
  status: SessionStatus | string
  duration: number
  createdAt: string
  completedAt?: string
}

interface UserStats {
  totalPomodoros: number
  totalFocusMinutes: number
  avgPomodorosPerDay: number
  activeDays: number
  focusTimeThisMonth: number
  currentStreak: number
  yearlyHeatmap: Array<{
    week: number
    dayOfWeek: number
    pomodoros: number
    date: string
  }>
  weeklyActivity: Array<{
    date: string
    pomodoros: number
  }>
}

const HEATMAP_DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const { width } = Dimensions.get('window')
const chartWidth = width - 64

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params
  const theme = useThemeStore((state) => state.theme)
  const colors = getTheme(theme)
  const isDark = theme === 'dark'
  const { user: currentUser, logout } = useAuthStore()
  const activeSessions = useTimerStore((state) => state.activeSessions)
  const skeletonBaseColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isOwnProfile = currentUser?.id === userId

  const fetchProfile = useCallback(
    async (options?: { skipLoader?: boolean }) => {
      if (!userId) {
        setErrorMessage('User not found')
        setProfile(null)
        setUserStats(null)
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (options?.skipLoader) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      try {
        const [profileResponse, statsResponse] = await Promise.all([
          httpClient.get(`api/users/${userId}`),
          httpClient.get(`api/users/${userId}/stats`),
        ])

        if (!profileResponse.ok) {
          throw new Error(profileResponse.status === 404 ? 'User not found' : 'Failed to load profile')
        }

        const profileData = (await profileResponse.json()) as UserProfileResponse
        setProfile({
          ...profileData,
          recentSessions: profileData.recentSessions ?? [],
        })

        if (statsResponse.ok) {
          const statsData = (await statsResponse.json()) as UserStats
          setUserStats(statsData)
        } else {
          setUserStats(null)
        }
        setErrorMessage(null)
      } catch (error) {
        console.error('[UserProfile] Failed to load data:', error)
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load profile')
        setProfile(null)
        setUserStats(null)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [userId]
  )

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

  const onRefresh = useCallback(() => {
    void fetchProfile({ skipLoader: true })
  }, [fetchProfile])

  const handleLogout = useCallback(async () => {
    await logout()
    navigation.getParent()?.navigate('Profile')
  }, [logout, navigation])

  const handleEditProfile = useCallback(() => {
    const stackState = navigation.getState?.()
    const routeNames = stackState?.routeNames
    const canNavigateInsideStack = Array.isArray(routeNames)
      ? routeNames.includes('ProfileSettings')
      : false

    if (canNavigateInsideStack) {
      navigation.navigate('ProfileSettings' as never)
      return
    }

    navigation.getParent()?.navigate(
      'Profile',
      {
        screen: 'ProfileSettings',
      } as never
    )
  }, [navigation])

  const isUserOnline =
    activeSessions.some((session) => session.userId === userId) || Boolean(profile?.activeSession)
  const isUserWorking = Boolean(profile?.activeSession)

  const totalPomodoros = userStats?.totalPomodoros ?? 0
  const totalFocusMinutes = userStats?.totalFocusMinutes ?? 0
  const focusHours = Math.floor(totalFocusMinutes / 60)
  const focusMinutesRemainder = totalFocusMinutes % 60
  const totalFocusDisplay = `${focusHours}h ${focusMinutesRemainder}m`
  const avgPerDayRaw = userStats?.avgPomodorosPerDay ?? 0
  const avgPomodorosDisplay =
    avgPerDayRaw > 0 ? (avgPerDayRaw >= 10 ? avgPerDayRaw.toFixed(0) : avgPerDayRaw.toFixed(1)) : '0'
  const currentStreak = userStats?.currentStreak ?? 0
  const focusTimeThisMonth = userStats?.focusTimeThisMonth ?? 0
  const focusThisMonthHours = Math.floor(focusTimeThisMonth / 60)
  const focusThisMonthMinutes = focusTimeThisMonth % 60
  const activeDays = userStats?.activeDays ?? 0

  const weeklyActivityData = useMemo(() => {
    if (userStats?.weeklyActivity?.length) {
      return userStats.weeklyActivity
    }

    const now = new Date()
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(now)
      date.setDate(now.getDate() - (6 - index))
      return {
        date: date.toISOString().slice(0, 10),
        pomodoros: 0,
      }
    })
  }, [userStats?.weeklyActivity])

  const hasWeeklyActivity = userStats?.weeklyActivity?.some((item) => item.pomodoros > 0)

  const heatmapData = userStats?.yearlyHeatmap ?? []
  const heatmapMaxValue = heatmapData.length ? Math.max(...heatmapData.map((item) => item.pomodoros)) : 1

  const heatmapLegendColors = useMemo(
    () =>
      isDark
        ? ['#1f2937', '#14532d', '#166534', '#15803d', '#22c55e']
        : ['#e2e8f0', '#bbf7d0', '#86efac', '#4ade80', '#22c55e'],
    [isDark]
  )

  const getHeatmapColor = useCallback(
    (value: number) => {
      if (value <= 0) return heatmapLegendColors[0]
      if (heatmapMaxValue <= 1) {
        return heatmapLegendColors[heatmapLegendColors.length - 1]
      }
      const intensity = Math.min(value / heatmapMaxValue, 1)
      if (intensity < 0.25) return heatmapLegendColors[1] || heatmapLegendColors[0]
      if (intensity < 0.5) return heatmapLegendColors[2] || heatmapLegendColors[heatmapLegendColors.length - 1]
      if (intensity < 0.75) return heatmapLegendColors[3] || heatmapLegendColors[heatmapLegendColors.length - 1]
      return heatmapLegendColors[4] || heatmapLegendColors[heatmapLegendColors.length - 1]
    },
    [heatmapLegendColors, heatmapMaxValue]
  )

  const getTimeRemaining = () => {
    if (!profile?.activeSession) return null
    const startTime = new Date(profile.activeSession.startedAt).getTime()
    const now = Date.now()
    const elapsed = Math.floor((now - startTime) / 1000)
    const totalDuration = profile.activeSession.duration * 60
    const remaining = Math.max(0, totalDuration - elapsed)
    const mins = Math.floor(remaining / 60)
    const secs = remaining % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getSessionProgress = () => {
    if (!profile?.activeSession) return 0
    const startTime = new Date(profile.activeSession.startedAt).getTime()
    const now = Date.now()
    const elapsed = Math.max(0, now - startTime)
    const totalDuration = Math.max(profile.activeSession.duration, 1) * 60 * 1000
    return Math.min(1, elapsed / totalDuration)
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getSessionTypeLabel = (type: string) => {
    switch (type) {
      case SessionType.WORK:
        return 'Work'
      case SessionType.SHORT_BREAK:
        return 'Short Break'
      case SessionType.LONG_BREAK:
        return 'Long Break'
      default:
        return type
    }
  }

  const getSessionBadgeColors = (type: string) => {
    switch (type) {
      case SessionType.WORK:
        return { bg: '#fee2e2', text: '#b91c1c' }
      case SessionType.SHORT_BREAK:
        return { bg: '#dcfce7', text: '#15803d' }
      case SessionType.LONG_BREAK:
        return { bg: '#dbeafe', text: '#1d4ed8' }
      default:
        return { bg: colors.backgroundSecondary, text: colors.textSecondary }
    }
  }

  const statCards = [
    {
      title: 'Pomodoros',
      value: totalPomodoros.toLocaleString(),
      subtitle: 'Completed',
      gradient: ['#fee2e2', '#fecaca'],
      icon: '🍅',
    },
    {
      title: 'Current streak',
      value: currentStreak.toString(),
      subtitle: 'Days in a row',
      gradient: ['#d1fae5', '#a7f3d0'],
      icon: '🔥',
    },
    {
      title: 'Avg per day',
      value: avgPomodorosDisplay,
      subtitle: 'Pomodoros',
      gradient: ['#ede9fe', '#c4b5fd'],
      icon: '📈',
    },
    {
      title: 'Focus time',
      value: totalFocusDisplay,
      subtitle: 'All time',
      gradient: ['#dbeafe', '#bfdbfe'],
      icon: '⏱️',
    },
  ]

  const SkeletonLine = ({
    width = '100%',
    height = 14,
    radius = 10,
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

  const HeatmapChart = ({ data }: { data: UserStats['yearlyHeatmap'] }) => {
    if (!data || data.length === 0) {
      return (
        <View style={styles.emptyHeatmap}>
          <Text style={[styles.chartEmptyStateText, { color: colors.textTertiary }]}>No yearly activity yet</Text>
        </View>
      )
    }

    const weeksCount = Math.max(...data.map((item) => item.week), 0) + 1
    const scrollRef = useRef<ScrollView | null>(null)
    const heatmapLookup = useMemo(() => {
      const map = new Map<string, number>()
      data.forEach((item) => {
        map.set(`${item.week}-${item.dayOfWeek}`, item.pomodoros)
      })
      return map
    }, [data])

    return (
      <View style={styles.heatmapWrapper}>
        <View style={styles.heatmapDayLabels}>
          {HEATMAP_DAY_LABELS.map((day) => (
            <Text key={day} style={[styles.heatmapDayLabel, { color: colors.textTertiary }]}>
              {day}
            </Text>
          ))}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.heatmapScroll}
          contentContainerStyle={styles.heatmapScrollContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View style={styles.heatmapColumns}>
            {Array.from({ length: weeksCount }).map((_, weekIndex) => (
              <View key={weekIndex} style={styles.heatmapWeekColumn}>
                {HEATMAP_DAY_LABELS.map((_, dayIndex) => {
                  const cellValue = heatmapLookup.get(`${weekIndex}-${dayIndex}`) || 0
                  return (
                    <View
                      key={`${weekIndex}-${dayIndex}`}
                      style={[styles.heatmapCell, { backgroundColor: getHeatmapColor(cellValue) }]}
                    />
                  )
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    )
  }

  const WeeklyChart = ({ data }: { data: Array<{ date: string; pomodoros: number }> }) => {
    if (!data || data.length === 0) {
      return null
    }

    const maxValue = Math.max(...data.map((d) => d.pomodoros), 1)
    const chartHeight = 220
    const barWidth = (chartWidth - 40) / data.length - 8
    const padding = 40
    const minBarHeight = 6

    return (
      <View style={[styles.chartContainer, { width: chartWidth }]}>
        <Svg width={chartWidth} height={chartHeight + padding}>
          {[0, maxValue / 2, maxValue].map((value, i) => (
            <SvgText key={i} x="5" y={chartHeight - (i * chartHeight) / 2} fontSize="10" fill={colors.textTertiary}>
              {Math.round(value)}
            </SvgText>
          ))}

          {[0, 1, 2].map((i) => (
            <Line
              key={i}
              x1="30"
              y1={chartHeight - (i * chartHeight) / 2}
              x2={chartWidth - 10}
              y2={chartHeight - (i * chartHeight) / 2}
              stroke={colors.border}
              strokeWidth="1"
              opacity="0.3"
            />
          ))}

          {data.map((item, index) => {
            const normalizedHeight = (item.pomodoros / maxValue) * chartHeight
            const barHeight = item.pomodoros > 0 ? Math.max(normalizedHeight, minBarHeight) : minBarHeight
            const x = 40 + index * (barWidth + 8)
            const y = chartHeight - barHeight

            return (
              <G key={`${item.date}-${index}`}>
                <Rect x={x} y={y} width={barWidth} height={barHeight} fill="#3b82f6" rx="4" />
                <SvgText x={x + barWidth / 2} y={chartHeight + 20} fontSize="10" fill={colors.textTertiary} textAnchor="middle">
                  {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </SvgText>
              </G>
            )
          })}
        </Svg>
        {!hasWeeklyActivity && (
          <View pointerEvents="none" style={styles.chartEmptyState}>
            <Text style={[styles.chartEmptyStateText, { color: colors.textTertiary }]}>
              No sessions in the past week
            </Text>
          </View>
        )}
      </View>
    )
  }

  if (loading) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topBar}>
          <View style={[styles.skeletonCircle, { backgroundColor: skeletonBaseColor }]} />
          <View style={styles.topActions}>
            <View style={[styles.skeletonCircle, { backgroundColor: skeletonBaseColor }]} />
            <View style={[styles.skeletonCircle, { backgroundColor: skeletonBaseColor }]} />
          </View>
        </View>

        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.profileRow}>
            <View style={[styles.skeletonAvatar, { backgroundColor: skeletonBaseColor }]} />
            <View style={{ flex: 1 }}>
              <SkeletonLine width="60%" height={24} />
              <SkeletonLine width="90%" />
              <SkeletonLine width="40%" />
            </View>
          </View>
          <View style={[styles.profileStats, { borderColor: colors.border }]}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={{ flex: 1 }}>
                <SkeletonLine width="50%" height={20} />
                <SkeletonLine width="70%" height={12} radius={8} />
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SkeletonLine width="40%" height={18} />
          <SkeletonLine width="60%" />
          <View style={[styles.skeletonBar, { backgroundColor: skeletonBaseColor }]} />
        </View>

        <View style={styles.statsGrid}>
          {Array.from({ length: statCards.length }).map((_, index) => (
            <View
              key={index}
              style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, justifyContent: 'center' }]}
            >
              <View style={[styles.statIcon, { backgroundColor: skeletonBaseColor }]} />
              <SkeletonLine width="70%" />
              <SkeletonLine width="40%" height={12} radius={8} />
            </View>
          ))}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SkeletonLine width="40%" height={20} />
          <View style={[styles.skeletonBar, { height: 140, backgroundColor: skeletonBaseColor, marginTop: 16 }]} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SkeletonLine width="55%" height={20} />
          <View style={[styles.skeletonBar, { height: 220, backgroundColor: skeletonBaseColor, marginTop: 16 }]} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SkeletonLine width="50%" height={20} />
          <View style={styles.sessionsList}>
            {Array.from({ length: 3 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.skeletonSessionRow,
                  { borderColor: colors.border },
                ]}
              >
                <View style={styles.skeletonSessionLeft}>
                  <View style={[styles.skeletonSessionBadge, { backgroundColor: skeletonBaseColor }]} />
                  <View style={styles.skeletonSessionText}>
                    <SkeletonLine width="80%" />
                    <SkeletonLine width="50%" height={12} radius={8} />
                  </View>
                </View>
                <SkeletonLine width={40} height={16} radius={8} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    )
  }

  if (errorMessage || !profile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorEmoji]}>😞</Text>
        <Text style={[styles.errorTitle, { color: colors.text }]}>{errorMessage || 'User not found'}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={() => fetchProfile()}
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.retryButton, styles.retrySecondary, { borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.retrySecondaryText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <Feather name="arrow-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.topActions}>
            {isOwnProfile && (
              <TouchableOpacity
                onPress={handleEditProfile}
                style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                accessibilityLabel="Edit profile"
              >
                <Feather name="edit-3" size={18} color={colors.text} />
              </TouchableOpacity>
            )}
            {isOwnProfile && (
              <TouchableOpacity
                onPress={handleLogout}
                style={[styles.iconButton, { borderColor: colors.error, backgroundColor: colors.errorLight }]}
                accessibilityLabel="Logout"
              >
                <Feather name="log-out" size={18} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.profileRow}>
            {profile.user.avatarUrl ? (
              <Image source={{ uri: profile.user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarFallbackText}>
                  {profile.user.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]}>{profile.user.username}</Text>
              {profile.user.description ? (
                <Text style={[styles.profileBio, { color: colors.textSecondary }]} numberOfLines={3}>
                  {profile.user.description}
                </Text>
              ) : null}
              <Text style={[styles.profileMeta, { color: colors.textTertiary }]}>
                Joined {formatDate(profile.user.createdAt)}
              </Text>
            </View>
          </View>
          {profile.stats?.totalSessions ? (
            <View style={[styles.profileStats, { borderColor: colors.border }]}>
              <View>
                <Text style={[styles.profileStatsValue, { color: colors.text }]}>
                  {totalPomodoros.toLocaleString()}
                </Text>
                <Text style={[styles.profileStatsLabel, { color: colors.textTertiary }]}>Pomodoros</Text>
              </View>
              <View>
                <Text style={[styles.profileStatsValue, { color: colors.text }]}>
                  {currentStreak}
                </Text>
                <Text style={[styles.profileStatsLabel, { color: colors.textTertiary }]}>Streak</Text>
              </View>
              <View>
                <Text style={[styles.profileStatsValue, { color: colors.text }]}>
                  {totalFocusDisplay}
                </Text>
                <Text style={[styles.profileStatsLabel, { color: colors.textTertiary }]}>Focus time</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.statusHeader}>
            <View style={styles.statusLeft}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isUserOnline ? colors.online : colors.offline },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isUserOnline ? colors.online : colors.textSecondary },
                ]}
              >
                {isUserOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <Text style={[styles.statusMeta, { color: colors.textTertiary }]}>
              {isUserWorking ? 'In session' : 'Not working'}
            </Text>
          </View>

          {isUserWorking && profile.activeSession ? (
            <View style={[styles.activeSessionBox, { borderColor: colors.border }]}>
              <View style={styles.activeSessionHeader}>
                <Text style={[styles.activeSessionTask, { color: colors.text }]}>
                  {profile.activeSession.task}
                </Text>
                <Text style={[styles.activeSessionTimer, { color: colors.primary }]}>
                  {getTimeRemaining()}
                </Text>
              </View>
              <Text style={[styles.activeSessionType, { color: colors.textSecondary }]}>
                {getSessionTypeLabel(profile.activeSession.type)}
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.primary, width: `${getSessionProgress() * 100}%` },
                  ]}
                />
              </View>
            </View>
          ) : (
            <Text style={[styles.inactiveText, { color: colors.textSecondary }]}>
              Not currently in a session
            </Text>
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Yearly heatmap</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Active days: {activeDays}
            </Text>
          </View>
          <HeatmapChart data={heatmapData} />
          <View style={styles.heatmapLegend}>
            <Text style={[styles.legendLabel, { color: colors.textTertiary }]}>Less</Text>
            <View style={styles.legendSwatches}>
              {heatmapLegendColors.map((color, index) => (
                <View key={color + index} style={[styles.legendSwatch, { backgroundColor: color }]} />
              ))}
            </View>
            <Text style={[styles.legendLabel, { color: colors.textTertiary }]}>More</Text>
          </View>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly activity</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {focusThisMonthHours}h {focusThisMonthMinutes}m this month
            </Text>
          </View>
          <WeeklyChart data={weeklyActivityData} />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent sessions</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              Last {profile.recentSessions?.length || 0}
            </Text>
          </View>
          {profile.recentSessions?.length ? (
            <View style={styles.sessionsList}>
              {profile.recentSessions.map((session) => {
                const colorsForType = getSessionBadgeColors(session.type as SessionType)
                return (
                  <View
                    key={session.id}
                    style={[styles.sessionCard, { backgroundColor: colors.backgroundSecondary }]}
                  >
                    <View style={styles.sessionLeft}>
                      <View
                        style={[
                          styles.sessionBadge,
                          { backgroundColor: colorsForType.bg },
                        ]}
                      >
                        <Text style={[styles.sessionBadgeText, { color: colorsForType.text }]}>
                          {getSessionTypeLabel(session.type as SessionType)}
                        </Text>
                      </View>
                      <View>
                        <Text style={[styles.sessionTask, { color: colors.text }]} numberOfLines={1}>
                          {session.task || 'Unnamed task'}
                        </Text>
                        <Text style={[styles.sessionMeta, { color: colors.textTertiary }]}>
                          {formatDate(session.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sessionRight}>
                      <Text style={[styles.sessionDuration, { color: colors.text }]}>
                        {session.duration}m
                      </Text>
                      <Text style={[styles.sessionMeta, { color: colors.textTertiary }]}>
                        {formatTime(session.createdAt)}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            <View style={styles.emptySessions}>
              <Feather name="calendar" size={32} color={colors.textTertiary} />
              <Text style={[styles.chartEmptyStateText, { color: colors.textTertiary }]}>
                No sessions yet
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const StatCard = ({
  title,
  value,
  subtitle,
  gradientColors,
  icon,
  colors,
}: {
  title: string
  value: string
  subtitle: string
  gradientColors: [string, string]
  icon: string
  colors: ReturnType<typeof getTheme>
}) => (
  <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIcon}>
      <Text style={styles.statIconText}>{icon}</Text>
    </LinearGradient>
    <Text style={[styles.statTitle, { color: colors.textSecondary }]}>{title}</Text>
    <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    <Text style={[styles.statSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
  </View>
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  profileCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  profileBio: {
    fontSize: 14,
    marginBottom: 6,
  },
  profileMeta: {
    fontSize: 13,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  profileStatsValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  profileStatsLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statusCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontWeight: '600',
  },
  statusMeta: {
    fontSize: 13,
  },
  activeSessionBox: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeSessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  activeSessionTask: {
    fontSize: 16,
    fontWeight: '700',
  },
  activeSessionTimer: {
    fontSize: 20,
    fontWeight: '700',
  },
  activeSessionType: {
    fontSize: 13,
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  inactiveText: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 16 * 2 - 12) / 2,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconText: {
    fontSize: 22,
  },
  statTitle: {
    fontSize: 13,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  heatmapWrapper: {
    flexDirection: 'row',
    width: '100%',
  },
  heatmapDayLabels: {
    marginRight: 12,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  heatmapDayLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  heatmapScroll: {
    flex: 1,
  },
  heatmapScrollContent: {
    paddingBottom: 4,
  },
  heatmapColumns: {
    flexDirection: 'row',
    gap: 4,
  },
  heatmapWeekColumn: {
    gap: 4,
  },
  heatmapCell: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  emptyHeatmap: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  legendLabel: {
    fontSize: 12,
  },
  legendSwatches: {
    flexDirection: 'row',
    gap: 4,
  },
  legendSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  chartContainer: {
    alignSelf: 'center',
  },
  chartEmptyState: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartEmptyStateText: {
    fontSize: 13,
    textAlign: 'center',
  },
  sessionsList: {
    gap: 12,
  },
  sessionCard: {
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionLeft: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    flex: 1,
  },
  sessionBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  sessionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sessionTask: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  sessionRight: {
    alignItems: 'flex-end',
  },
  sessionDuration: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySessions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  skeletonLine: {
    marginBottom: 10,
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  skeletonAvatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
  },
  skeletonBar: {
    width: '100%',
    height: 20,
    borderRadius: 12,
  },
  skeletonSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  skeletonSessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  skeletonSessionBadge: {
    width: 60,
    height: 24,
    borderRadius: 999,
  },
  skeletonSessionText: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorEmoji: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  retrySecondary: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  retrySecondaryText: {
    fontWeight: '700',
  },
})
