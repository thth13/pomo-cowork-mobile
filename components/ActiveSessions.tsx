import React from 'react'
import { View, StyleSheet, Text, Image } from 'react-native'
import { ActiveSession, SessionStatus, SessionType } from '@/types'
import { useThemeStore } from '@/stores/useThemeStore'
import { getTheme } from '@/config/theme'

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`
}

const formatClockTime = (dateString?: string): string => {
  if (!dateString) return 'time unavailable'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return 'time unavailable'
  }

  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12

  return `${hour12.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')} ${period}`
}

const getSessionTypeLabel = (type: SessionType): string => {
  switch (type) {
    case SessionType.WORK:
      return 'Working'
    case SessionType.SHORT_BREAK:
      return 'Short break'
    case SessionType.LONG_BREAK:
      return 'Long break'
    default:
      return 'Working'
  }
}

type SessionTypeStyle = {
  badgeBackground: string
  badgeBorder: string
  badgeText: string
  progressColor: string
}

const SESSION_TYPE_STYLES: Record<SessionType, SessionTypeStyle> = {
  [SessionType.WORK]: {
    badgeBackground: '#fee2e2',
    badgeBorder: '#fecdd3',
    badgeText: '#b91c1c',
    progressColor: '#ef4444',
  },
  [SessionType.SHORT_BREAK]: {
    badgeBackground: '#dcfce7',
    badgeBorder: '#bbf7d0',
    badgeText: '#15803d',
    progressColor: '#22c55e',
  },
  [SessionType.LONG_BREAK]: {
    badgeBackground: '#dbeafe',
    badgeBorder: '#bfdbfe',
    badgeText: '#1d4ed8',
    progressColor: '#3b82f6',
  },
}

type SessionCardProps = {
  session: ActiveSession
  isCurrentUser: boolean
}

function SessionCard({ session, isCurrentUser }: SessionCardProps) {
  const theme = useThemeStore((state) => state.theme)
  const colors = getTheme(theme)
  const sessionStatus = session.status ?? SessionStatus.ACTIVE
  const fallbackDurationSeconds = Math.max(1, (session.duration || 25) * 60)
  const storedRemainingSeconds =
    typeof session.timeRemaining === 'number'
      ? session.timeRemaining
      : fallbackDurationSeconds

  const [timeRemaining, setTimeRemaining] = React.useState(() => {
    if (!session.startedAt) {
      return storedRemainingSeconds
    }
    const startTime = new Date(session.startedAt).getTime()
    if (Number.isNaN(startTime)) {
      return storedRemainingSeconds
    }
    const now = Date.now()
    const elapsed = Math.floor((now - startTime) / 1000)
    return Math.max(0, fallbackDurationSeconds - elapsed)
  })

  React.useEffect(() => {
    if (sessionStatus === SessionStatus.PAUSED) {
      setTimeRemaining(Math.max(0, storedRemainingSeconds))
      return
    }

    const updateTime = () => {
      const now = Date.now()
      if (!session.startedAt) {
        const explicitRemaining =
          typeof session.timeRemaining === 'number'
            ? Math.floor(session.timeRemaining)
            : storedRemainingSeconds
        setTimeRemaining(Math.max(0, explicitRemaining))
        return
      }

      const startTime = new Date(session.startedAt).getTime()
      if (Number.isNaN(startTime)) {
        const explicitRemaining =
          typeof session.timeRemaining === 'number'
            ? Math.floor(session.timeRemaining)
            : storedRemainingSeconds
        setTimeRemaining(Math.max(0, explicitRemaining))
        return
      }

      const elapsed = Math.floor((now - startTime) / 1000)
      const fallbackRemaining = Math.max(0, fallbackDurationSeconds - elapsed)

      if (typeof session.timeRemaining === 'number') {
        const syncedRemaining = Math.max(0, Math.floor(session.timeRemaining))
        setTimeRemaining(Math.min(fallbackRemaining, syncedRemaining))
        return
      }

      setTimeRemaining(fallbackRemaining)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [
    fallbackDurationSeconds,
    session.startedAt,
    sessionStatus,
    storedRemainingSeconds,
  ])

  if (timeRemaining <= 0) {
    return null
  }

  const typeStyles = SESSION_TYPE_STYLES[session.type] ?? SESSION_TYPE_STYLES[SessionType.WORK]
  const typeLabel = getSessionTypeLabel(session.type)
  const progressPercent = Math.max(
    0,
    Math.min(100, (timeRemaining / fallbackDurationSeconds) * 100)
  )
  const statusLabel = sessionStatus === SessionStatus.PAUSED ? 'Paused' : 'Remaining'
  const statusDotColor = sessionStatus === SessionStatus.PAUSED ? '#f59e0b' : '#34d399'
  const usernameInitial = session.username?.charAt(0)?.toUpperCase() ?? '?'
  const startTimeLabel = session.startedAt
    ? formatClockTime(session.startedAt)
    : 'time unavailable'

  return (
    <View style={[
      styles.sessionItem, 
      { backgroundColor: colors.backgroundTertiary, borderColor: colors.border },
      isCurrentUser && { borderColor: colors.primary }
    ]}>
      <View style={styles.sessionRow}>
        <View style={styles.sessionAvatarWrapper}>
          {session.avatarUrl ? (
            <Image source={{ uri: session.avatarUrl }} style={styles.sessionAvatar} />
          ) : (
            <View style={[styles.sessionAvatarFallback, { backgroundColor: colors.border }]}>
              <Text style={[styles.sessionAvatarInitial, { color: colors.text }]}>
                {usernameInitial}
              </Text>
            </View>
          )}
          <View style={[
            styles.sessionStatusDot, 
            { 
              backgroundColor: statusDotColor,
              borderColor: colors.card,
            }
          ]} />
        </View>

        <View style={styles.sessionInfo}>
          <View style={styles.sessionInfoHeader}>
            <Text style={[styles.sessionUsername, { color: colors.text }]} numberOfLines={1}>
              {session.username}
            </Text>
            <View
              style={[
                styles.sessionBadge,
                {
                  backgroundColor: typeStyles.badgeBackground,
                  borderColor: typeStyles.badgeBorder,
                },
              ]}
            >
              <Text style={[styles.sessionBadgeText, { color: typeStyles.badgeText }]}>
                {typeLabel}
              </Text>
            </View>
            {sessionStatus === SessionStatus.PAUSED && (
              <View style={[styles.sessionBadge, styles.sessionPausedBadge]}>
                <Text style={[styles.sessionBadgeText, styles.sessionPausedBadgeText]}>
                  Paused
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.sessionTask, { color: colors.textSecondary }]} numberOfLines={1}>
            Task: {session.task || 'Focus session'}
          </Text>
          <Text style={[styles.sessionStartTime, { color: colors.textTertiary }]}>
            Started at {startTimeLabel}
          </Text>
        </View>

        <View style={styles.sessionRight}>
          <Text style={[styles.sessionTime, { color: colors.text }]}>
            {formatTime(timeRemaining)}
          </Text>
          <View style={[styles.sessionProgressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.sessionProgressFill,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: typeStyles.progressColor,
                },
              ]}
            />
          </View>
          <Text style={[styles.sessionStatusLabel, { color: colors.textTertiary }]}>
            {statusLabel.toLowerCase()}
          </Text>
        </View>
      </View>
    </View>
  )
}

type ActiveSessionsProps = {
  sessions: ActiveSession[]
  currentUserId?: string
}

export function ActiveSessions({ sessions, currentUserId }: ActiveSessionsProps) {
  const theme = useThemeStore((state) => state.theme)
  const colors = getTheme(theme)
  const activeSessions = React.useMemo(() => {
    return sessions.filter((session) => {
      const status = session.status ?? SessionStatus.ACTIVE

      if (status === SessionStatus.PAUSED) {
        const remaining =
          typeof session.timeRemaining === 'number'
            ? session.timeRemaining
            : (session.duration || 25) * 60
        return remaining > 0
      }

      const fallbackSeconds = (session.duration || 25) * 60
      const storedRemaining =
        typeof session.timeRemaining === 'number'
          ? session.timeRemaining
          : fallbackSeconds

      if (!session.startedAt) {
        return storedRemaining > 0
      }

      const startTime = new Date(session.startedAt).getTime()
      if (Number.isNaN(startTime)) {
        return storedRemaining > 0
      }

      const now = Date.now()
      const elapsed = Math.floor((now - startTime) / 1000)
      const timeRemaining = fallbackSeconds - elapsed

      return timeRemaining > 0
    })
  }, [sessions])

  const hasVisibleSessions = activeSessions.length > 0

  return (
    <View style={[
      styles.sessionsCard,
      { 
        backgroundColor: colors.card, 
        shadowColor: colors.shadow,
        borderWidth: 1,
        borderColor: colors.border,
      }
    ]}>
      <View style={styles.sessionsHeader}>
        <View>
          <Text style={[styles.sectionLabel, styles.sessionsTitle, { color: colors.textSecondary }]}>
            Currently Working
          </Text>
          <Text style={[styles.sessionsSubtitle, { color: colors.textTertiary }]}>
            Live sessions from your workspace
          </Text>
        </View>
        <View style={styles.sessionsIndicator}>
          <View style={styles.sessionsIndicatorDot} />
          <Text style={[styles.sessionsIndicatorText, { color: colors.textSecondary }]}>
            {activeSessions.length} online
          </Text>
        </View>
      </View>

      {hasVisibleSessions ? (
        <View style={styles.sessionsList}>
          {activeSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              isCurrentUser={session.userId === currentUserId}
            />
          ))}
        </View>
      ) : (
        <View style={[
          styles.sessionsEmpty,
          { backgroundColor: colors.backgroundSecondary }
        ]}>
          <Text style={[styles.sessionsEmptyTitle, { color: colors.text }]}>
            No active sessions yet
          </Text>
          <Text style={[styles.sessionsEmptySubtitle, { color: colors.textTertiary }]}>
            Start a Pomodoro to appear here or invite teammates to join.
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  sessionsCard: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  sessionsTitle: {
    marginBottom: 0,
  },
  sessionsSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  sessionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sessionsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionsIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399',
  },
  sessionsIndicatorText: {
    fontSize: 13,
    fontWeight: '500',
  },
  sessionsList: {
    gap: 12,
  },
  sessionsEmpty: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sessionsEmptyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionsEmptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  sessionItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sessionAvatarWrapper: {
    position: 'relative',
  },
  sessionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
  },
  sessionAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionAvatarInitial: {
    fontSize: 18,
    fontWeight: '600',
  },
  sessionStatusDot: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  sessionInfo: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  sessionInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sessionUsername: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  sessionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sessionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sessionPausedBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  sessionPausedBadgeText: {
    color: '#b45309',
  },
  sessionTask: {
    fontSize: 13,
  },
  sessionStartTime: {
    fontSize: 12,
  },
  sessionRight: {
    alignItems: 'flex-end',
    gap: 8,
    marginLeft: 8,
    flexShrink: 0,
  },
  sessionTime: {
    fontSize: 20,
    fontWeight: '700',
  },
  sessionProgressTrack: {
    width: 88,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sessionProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  sessionStatusLabel: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
})
