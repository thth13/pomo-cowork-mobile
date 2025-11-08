import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { useThemeStore } from '@/stores/useThemeStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { getTheme } from '@/config/theme'
import { API_URL } from '@/config/constants'
import { Svg, Rect, Line, Text as SvgText, Circle, Path, G } from 'react-native-svg'

interface Stats {
  totalPomodoros: number
  totalFocusMinutes: number
  currentStreak: number
  avgMinutesPerDay: number
  focusTimeThisMonth: number
  weeklyActivity: Array<{ date: string; pomodoros: number }>
  yearlyHeatmap: Array<{ week: number; dayOfWeek: number; pomodoros: number; date: string }>
  monthlyBreakdown: Array<{ month: string; monthIndex: number; pomodoros: number }>
  productivityTrends: {
    bestTime: { start: string; end: string; efficiency: number }
    bestDay: { name: string; avgPomodoros: string }
    avgSessionDuration: number
    weeklyTasks: { completed: number; total: number }
  }
}

type ActivityPeriod = '7' | '30' | '365'

const { width } = Dimensions.get('window')
const chartWidth = width - 64
const HEATMAP_DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function StatsScreen() {
  const { theme } = useThemeStore()
  const { token, isAuthenticated } = useAuthStore()
  const colors = getTheme(theme)
  const isDark = theme === 'dark'

  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>('7')
  const [chartLoading, setChartLoading] = useState(false)
  const isInitialLoad = useRef(true)

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      setChartLoading(false)
      setStats(null)
      isInitialLoad.current = true
      return
    }

    const shouldShowSkeleton = isInitialLoad.current
    if (shouldShowSkeleton) {
      setLoading(true)
    } else {
      setChartLoading(true)
    }

    try {
      const resolvedToken = token ?? (await AsyncStorage.getItem('auth_token'))
      if (!resolvedToken) {
        setStats(null)
        return
      }

      const response = await fetch(`${API_URL}/api/stats?period=${activityPeriod}`, {
        headers: {
          Authorization: `Bearer ${resolvedToken}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        console.error('Failed to fetch stats:', response.status)
        setStats(null)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      setStats(null)
    } finally {
      if (shouldShowSkeleton) {
        setLoading(false)
        isInitialLoad.current = false
      } else {
        setChartLoading(false)
      }
    }
  }, [activityPeriod, isAuthenticated, token])

  useEffect(() => {
    if (isAuthenticated) {
      fetchStats()
    } else {
      setStats(null)
      setLoading(false)
      setChartLoading(false)
      isInitialLoad.current = true
    }
  }, [fetchStats, isAuthenticated])

  const totalPomodoros = stats?.totalPomodoros || 0
  const totalHours = Math.floor((stats?.totalFocusMinutes || 0) / 60)
  const totalMinutesRemainder = (stats?.totalFocusMinutes || 0) % 60
  const focusTimeThisMonth = Math.floor((stats?.focusTimeThisMonth || 0) / 60)
  const focusTimeThisMonthMinutes = (stats?.focusTimeThisMonth || 0) % 60
  const avgMinutesPerDay = stats?.avgMinutesPerDay || 0
  const avgPomodorosPerDayRaw = avgMinutesPerDay / 25
  const avgPomodorosPerDay =
    avgPomodorosPerDayRaw > 0 ? (avgPomodorosPerDayRaw >= 10 ? avgPomodorosPerDayRaw.toFixed(0) : avgPomodorosPerDayRaw.toFixed(1)) : '0'
  const currentStreak = stats?.currentStreak || 0
  const yearlyHeatmap = stats?.yearlyHeatmap || []
  const heatmapMaxValue = yearlyHeatmap.length
    ? Math.max(...yearlyHeatmap.map((item) => item.pomodoros))
    : 1
  const activeDaysThisYear = yearlyHeatmap.filter((item) => item.pomodoros > 0).length
  const bestDailyPomodoros =
    stats?.weeklyActivity && stats.weeklyActivity.length > 0
      ? Math.max(...stats.weeklyActivity.map((item) => item.pomodoros))
      : 0
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

  const weeklyActivityData = useMemo(() => {
    if (stats?.weeklyActivity && stats.weeklyActivity.length > 0) {
      return stats.weeklyActivity
    }

    const now = new Date()
    if (activityPeriod === '365') {
      return Array.from({ length: 12 }).map((_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
        return {
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          pomodoros: 0,
        }
      })
    }

    const periodLength = Number(activityPeriod)
    return Array.from({ length: periodLength }).map((_, index) => {
      const date = new Date(now)
      date.setDate(now.getDate() - (periodLength - index - 1))
      return {
        date: date.toISOString().slice(0, 10),
        pomodoros: 0,
      }
    })
  }, [activityPeriod, stats?.weeklyActivity])

  const hasActivityData = Boolean(stats?.weeklyActivity?.some((item) => item.pomodoros > 0))

  const AverageIcon = () => {
    const barColor = isDark ? '#93c5fd' : '#3b82f6'
    const bgColor = isDark ? 'rgba(30, 64, 175, 0.35)' : '#dbeafe'
    return (
      <View style={[styles.averageIcon, { backgroundColor: bgColor }]}>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Rect x="2" y="11" width="4" height="11" rx="2" fill={barColor} />
          <Rect x="10" y="6" width="4" height="16" rx="2" fill={barColor} />
          <Rect x="18" y="2" width="4" height="20" rx="2" fill={barColor} />
        </Svg>
      </View>
    )
  }

  const StatCard = ({
    title,
    value,
    subtitle,
    gradientColors,
    icon,
    iconNode,
  }: {
    title: string
    value: string
    subtitle?: string
    gradientColors: [string, string]
    icon?: string
    iconNode?: React.ReactNode
  }) => (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.statCardHeader}>
        {iconNode ? (
          iconNode
        ) : (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <Text style={styles.iconText}>{icon}</Text>
          </LinearGradient>
        )}
        <Text style={[styles.statTitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      {subtitle && (
        <Text style={[styles.statSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
  )

  const BarChart = ({
    data,
    showEmptyState,
  }: {
    data: Array<{ date: string; pomodoros: number }>
    showEmptyState?: boolean
  }) => {
    if (!data || data.length === 0) return null

    const maxValue = Math.max(...data.map((d) => d.pomodoros), 1)
    const chartHeight = 200
    const barWidth = (chartWidth - 40) / data.length - 8
    const padding = 40
    const minBarHeight = 4

    return (
      <View style={[styles.chartContainer, { width: chartWidth }]}>
        <Svg width={chartWidth} height={chartHeight + padding}>
          {/* Y-axis labels */}
          {[0, maxValue / 2, maxValue].map((value, i) => (
            <SvgText
              key={i}
              x="5"
              y={chartHeight - (i * chartHeight) / 2}
              fontSize="10"
              fill={colors.textTertiary}
            >
              {Math.round(value)}
            </SvgText>
          ))}

          {/* Grid lines */}
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

          {/* Bars */}
          {data.map((item, index) => {
            const normalizedHeight = (item.pomodoros / maxValue) * chartHeight
            const barHeight = item.pomodoros > 0 ? Math.max(normalizedHeight, minBarHeight) : minBarHeight
            const x = 40 + index * (barWidth + 8)
            const y = chartHeight - barHeight

            return (
              <G key={`${item.date}-${index}`}>
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="#3b82f6"
                  rx="4"
                />
                {/* X-axis labels */}
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  fontSize="10"
                  fill={colors.textTertiary}
                  textAnchor="middle"
                >
                  {activityPeriod === '365'
                    ? (() => {
                        const [year, month] = item.date.split('-')
                        const date = new Date(parseInt(year), parseInt(month) - 1, 1)
                        return date.toLocaleDateString('en-US', { month: 'short' })
                      })()
                    : activityPeriod === '7'
                    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(item.date).getDay()]
                    : new Date(item.date).getDate().toString()}
                </SvgText>
              </G>
            )
          })}
        </Svg>
        {showEmptyState && (
          <View pointerEvents="none" style={styles.chartEmptyState}>
            <Text style={[styles.chartEmptyStateText, { color: colors.textTertiary }]}>
              No data for the selected period yet
            </Text>
          </View>
        )}
      </View>
    )
  }

  const LineChart = ({ data }: { data: Array<{ month: string; pomodoros: number }> }) => {
    if (!data || data.length === 0) return null

    const maxValue = Math.max(...data.map((d) => d.pomodoros), 1)
    const chartHeight = 200
    const padding = 40
    const pointSpacing = (chartWidth - 80) / (data.length - 1)

    const points = data.map((item, index) => ({
      x: 40 + index * pointSpacing,
      y: chartHeight - (item.pomodoros / maxValue) * chartHeight,
    }))

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return (
      <View style={[styles.chartContainer, { width: chartWidth }]}>
        <Svg width={chartWidth} height={chartHeight + padding}>
          {/* Y-axis labels */}
          {[0, maxValue / 2, maxValue].map((value, i) => (
            <SvgText
              key={i}
              x="5"
              y={chartHeight - (i * chartHeight) / 2}
              fontSize="10"
              fill={colors.textTertiary}
            >
              {Math.round(value)}
            </SvgText>
          ))}

          {/* Grid lines */}
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

          {/* Line path */}
          <Path d={pathData} stroke="#3b82f6" strokeWidth="3" fill="none" />

          {/* Points */}
          {points.map((point, index) => (
            <Circle key={index} cx={point.x} cy={point.y} r="4" fill="#3b82f6" />
          ))}

          {/* X-axis labels */}
          {data.map((item, index) => (
            <SvgText
              key={index}
              x={points[index].x}
              y={chartHeight + 20}
              fontSize="10"
              fill={colors.textTertiary}
              textAnchor="middle"
            >
              {item.month.slice(0, 3)}
            </SvgText>
          ))}
        </Svg>
      </View>
    )
  }

  const HeatmapChart = ({ data }: { data: Stats['yearlyHeatmap'] }) => {
    if (!data || data.length === 0) {
      return (
        <View style={styles.emptyHeatmapContainer}>
          <Text style={[styles.chartEmptyStateText, { color: colors.textTertiary }]}>
            No yearly activity data yet
          </Text>
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
          style={styles.heatmapScroll}
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
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
                      style={[
                        styles.heatmapCell,
                        { backgroundColor: getHeatmapColor(cellValue) },
                      ]}
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

  const SkeletonCard = () => (
    <View style={[styles.statCard, styles.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statCardHeader, styles.skeletonHeader]}>
        <View style={[styles.skeletonBox, styles.iconContainer, { backgroundColor: colors.border }]} />
        <View style={[styles.skeletonBox, { flex: 1, height: 14, backgroundColor: colors.border }]} />
      </View>
      <View style={[styles.skeletonBox, { width: '60%', height: 28, backgroundColor: colors.border }]} />
      <View style={[styles.skeletonBox, { width: '40%', height: 16, backgroundColor: colors.border }]} />
    </View>
  )

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Stats</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Track your productivity
        </Text>
      </View>

      {loading ? (
        <>
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
            <View style={styles.statsRow}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          </View>
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.skeletonBox, { width: '100%', height: 200, backgroundColor: colors.border }]} />
          </View>
        </>
      ) : (
        <>
          {/* Overview Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="Pomodoros"
                value={totalPomodoros.toLocaleString()}
                subtitle="Total"
                gradientColors={['#fee2e2', '#fca5a5']}
                icon="🍅"
              />
              <StatCard
                title="Focus"
                value={`${totalHours}h ${totalMinutesRemainder}m`}
                subtitle="All time"
                gradientColors={['#dbeafe', '#93c5fd']}
                icon="⏱️"
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="This Month"
                value={`${focusTimeThisMonth}h ${focusTimeThisMonthMinutes}m`}
                subtitle="Focus"
                gradientColors={['#d1fae5', '#a7f3d0']}
                icon="📅"
              />
              <StatCard
                title="Average"
                value={avgPomodorosPerDay}
                subtitle="Pomodoros per day"
                gradientColors={['#ede9fe', '#c4b5fd']}
                iconNode={<AverageIcon />}
              />
            </View>
          </View>

          {/* Weekly Activity Chart */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>
                {activityPeriod === '7' && 'Weekly Activity'}
                {activityPeriod === '30' && 'Monthly Activity'}
                {activityPeriod === '365' && 'Yearly Activity'}
              </Text>
              <View style={styles.periodButtons}>
                {(['7', '30', '365'] as ActivityPeriod[]).map((period) => (
                  <TouchableOpacity
                    key={period}
                    onPress={() => setActivityPeriod(period)}
                    style={[
                      styles.periodButton,
                      activityPeriod === period && styles.periodButtonActive,
                      {
                        backgroundColor: activityPeriod === period ? '#3b82f6' : colors.inputBackground,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        {
                          color: activityPeriod === period ? '#ffffff' : colors.textSecondary,
                        },
                      ]}
                    >
                      {period === '7' ? '7d' : period === '30' ? '30d' : 'Year'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.chartBody}>
              <BarChart data={weeklyActivityData} showEmptyState={!hasActivityData} />
              {chartLoading && (
                <View
                  style={[
                    styles.chartLoadingOverlay,
                    { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.75)' },
                  ]}
                >
                  <ActivityIndicator color={isDark ? '#ffffff' : '#1f2937'} />
                </View>
              )}
            </View>
          </View>

          {/* Yearly Heatmap */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>Yearly Activity Map</Text>
              <Text style={[styles.heatmapYearLabel, { color: colors.textSecondary }]}>
                {new Date().getFullYear()}
              </Text>
            </View>
            <HeatmapChart data={yearlyHeatmap} />
            <View style={styles.heatmapLegend}>
              <Text style={[styles.heatmapLegendLabel, { color: colors.textTertiary }]}>Less</Text>
              <View style={styles.heatmapLegendScale}>
                {heatmapLegendColors.map((color, index) => (
                  <View key={`${color}-${index}`} style={[styles.heatmapLegendStep, { backgroundColor: color }]} />
                ))}
              </View>
              <Text style={[styles.heatmapLegendLabel, { color: colors.textTertiary }]}>More</Text>
            </View>
            <View style={[styles.heatmapStats, { borderTopColor: colors.border }]}>
              <View style={styles.heatmapStatItem}>
                <Text style={[styles.heatmapStatValue, { color: colors.text }]}>{bestDailyPomodoros}</Text>
                <Text style={[styles.heatmapStatLabel, { color: colors.textSecondary }]}>Best day</Text>
                <Text style={[styles.heatmapStatDescription, { color: colors.textTertiary }]}>pomodoros</Text>
              </View>
              <View style={styles.heatmapStatItem}>
                <Text style={[styles.heatmapStatValue, { color: colors.text }]}>{activeDaysThisYear}</Text>
                <Text style={[styles.heatmapStatLabel, { color: colors.textSecondary }]}>Active days</Text>
                <Text style={[styles.heatmapStatDescription, { color: colors.textTertiary }]}>this year</Text>
              </View>
              <View style={styles.heatmapStatItem}>
                <Text style={[styles.heatmapStatValue, { color: colors.text }]}>{currentStreak}</Text>
                <Text style={[styles.heatmapStatLabel, { color: colors.textSecondary }]}>Streak</Text>
                <Text style={[styles.heatmapStatDescription, { color: colors.textTertiary }]}>days in a row</Text>
              </View>
            </View>
          </View>

          {/* Productivity Trends & Monthly Breakdown */}
          <View style={styles.twoColumnGrid}>
            {/* Productivity Trends */}
            <View style={[styles.trendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>Productivity Trends</Text>

              <View style={styles.trendsList}>
                <View style={[styles.trendItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.trendItemLeft}>
                    <View style={[styles.trendIcon, { backgroundColor: isDark ? '#166534' : '#dcfce7' }]}>
                      <Text>📈</Text>
                    </View>
                    <View>
                      <Text style={[styles.trendItemTitle, { color: colors.text }]}>Best Time</Text>
                      <Text style={[styles.trendItemSubtitle, { color: colors.textTertiary }]}>
                        {stats?.productivityTrends?.bestTime?.start || '00:00'} -{' '}
                        {stats?.productivityTrends?.bestTime?.end || '00:00'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trendItemRight}>
                    <Text style={[styles.trendItemValue, { color: colors.text }]}>
                      {stats?.productivityTrends?.bestTime?.efficiency || 0}%
                    </Text>
                    <Text style={[styles.trendItemLabel, { color: colors.textTertiary }]}>efficiency</Text>
                  </View>
                </View>

                <View style={[styles.trendItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.trendItemLeft}>
                    <View style={[styles.trendIcon, { backgroundColor: isDark ? '#1e3a8a' : '#dbeafe' }]}>
                      <Text>📆</Text>
                    </View>
                    <View>
                      <Text style={[styles.trendItemTitle, { color: colors.text }]}>Best Day</Text>
                      <Text style={[styles.trendItemSubtitle, { color: colors.textTertiary }]}>
                        {stats?.productivityTrends?.bestDay?.name || 'No data'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trendItemRight}>
                    <Text style={[styles.trendItemValue, { color: colors.text }]}>
                      {stats?.productivityTrends?.bestDay?.avgPomodoros || '0'}
                    </Text>
                    <Text style={[styles.trendItemLabel, { color: colors.textTertiary }]}>avg pomodoros</Text>
                  </View>
                </View>

                <View style={[styles.trendItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.trendItemLeft}>
                    <View style={[styles.trendIcon, { backgroundColor: isDark ? '#581c87' : '#e9d5ff' }]}>
                      <Text>🎯</Text>
                    </View>
                    <View>
                      <Text style={[styles.trendItemTitle, { color: colors.text }]}>Focus Mode</Text>
                      <Text style={[styles.trendItemSubtitle, { color: colors.textTertiary }]}>
                        Average duration
                      </Text>
                    </View>
                  </View>
                  <View style={styles.trendItemRight}>
                    <Text style={[styles.trendItemValue, { color: colors.text }]}>
                      {stats?.productivityTrends?.avgSessionDuration || 0}m
                    </Text>
                    <Text style={[styles.trendItemLabel, { color: colors.textTertiary }]}>per session</Text>
                  </View>
                </View>

                <View style={[styles.trendItem, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.trendItemLeft}>
                    <View style={[styles.trendIcon, { backgroundColor: isDark ? '#92400e' : '#fed7aa' }]}>
                      <Text>✅</Text>
                    </View>
                    <View>
                      <Text style={[styles.trendItemTitle, { color: colors.text }]}>Tasks Done</Text>
                      <Text style={[styles.trendItemSubtitle, { color: colors.textTertiary }]}>This week</Text>
                    </View>
                  </View>
                  <View style={styles.trendItemRight}>
                    <Text style={[styles.trendItemValue, { color: colors.text }]}>
                      {stats?.productivityTrends?.weeklyTasks?.completed || 0}
                    </Text>
                    <Text style={[styles.trendItemLabel, { color: colors.textTertiary }]}>
                      of {stats?.productivityTrends?.weeklyTasks?.total || 0}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Monthly Breakdown */}
            <View style={[styles.trendCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.chartTitle, { color: colors.text }]}>Monthly Breakdown</Text>
              <LineChart data={stats?.monthlyBreakdown || []} />
            </View>
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  statsGrid: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  averageIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  statSubtitle: {
    fontSize: 11,
    marginTop: 4,
  },
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  chartBody: {
    position: 'relative',
    minHeight: 220,
    justifyContent: 'center',
  },
  chartHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  periodButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    flex: 1,
    minWidth: 220,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 68,
  },
  periodButtonActive: {
    borderWidth: 0,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  chartLoadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  chartEmptyState: {
    position: 'absolute',
    top: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  chartEmptyStateText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyHeatmapContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapYearLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  heatmapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  heatmapLegendLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  heatmapLegendScale: {
    flexDirection: 'row',
    gap: 4,
  },
  heatmapLegendStep: {
    width: 16,
    height: 12,
    borderRadius: 4,
  },
  heatmapWrapper: {
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  heatmapDayLabels: {
    justifyContent: 'flex-start',
    gap: 4,
    paddingRight: 8,
  },
  heatmapDayLabel: {
    fontSize: 10,
  },
  heatmapScroll: {
    flex: 1,
  },
  heatmapColumns: {
    flexDirection: 'row',
    gap: 4,
  },
  heatmapWeekColumn: {
    flexDirection: 'column',
    gap: 4,
  },
  heatmapCell: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  heatmapScrollContent: {
    paddingHorizontal: 4,
  },
  heatmapStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  heatmapStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heatmapStatValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  heatmapStatLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  heatmapStatDescription: {
    fontSize: 10,
    marginTop: 2,
  },
  twoColumnGrid: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 24,
  },
  trendCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  trendsList: {
    marginTop: 16,
    gap: 12,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  trendItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  trendIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendItemTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  trendItemSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  trendItemRight: {
    alignItems: 'flex-end',
  },
  trendItemValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  trendItemLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  skeleton: {
    alignItems: 'flex-start',
  },
  skeletonHeader: {
    width: '100%',
  },
  skeletonBox: {
    borderRadius: 8,
    marginBottom: 8,
  },
})
