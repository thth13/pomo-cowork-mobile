import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useTimerStore } from '@/stores/useTimerStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { SessionType, SessionStatus } from '@/types'
import { useSocket } from '@/hooks/useSocket'
import { API_URL } from '@/config/constants'

const START_THROTTLE_MS = 750

type ServiceWorkerMessage = {
  type: string
  payload?: Record<string, unknown>
}

const sendMessageToServiceWorker = (message: ServiceWorkerMessage) => {
  const nav = typeof navigator !== 'undefined'
    ? (navigator as typeof navigator & {
        serviceWorker?: {
          controller?: { postMessage: (data: ServiceWorkerMessage) => void }
        }
      })
    : null

  nav?.serviceWorker?.controller?.postMessage(message)
}

interface PomodoroTimerProps {
  onSessionComplete?: () => void
}

export default function PomodoroTimer({ onSessionComplete }: PomodoroTimerProps) {
  const {
    isRunning,
    timeRemaining,
    currentSession,
    workDuration,
    shortBreak,
    longBreak,
    longBreakAfter,
    selectedTask,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    cancelSession,
    tick,
    previewSessionType,
    updateCurrentSession,
    setTimerSettings,
  } = useTimerStore()

  const { user, token, anonymousId, ensureAnonymousId } = useAuthStore((state) => ({
    user: state.user,
    token: state.token,
    anonymousId: state.anonymousId,
    ensureAnonymousId: state.ensureAnonymousId,
  }))
  const {
    emitSessionStart,
    emitSessionSync,
    emitSessionEnd,
    emitTimerTick,
    isConnected,
  } = useSocket()
  const [sessionType, setSessionType] = useState<SessionType>(SessionType.WORK)
  const [isStarting, setIsStarting] = useState(false)
  const startRequestIdRef = useRef<string | null>(null)
  const lastStartAtRef = useRef<number>(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const settings = user?.settings
    if (!settings) {
      return
    }

    const {
      workDuration: userWorkDuration,
      shortBreak: userShortBreak,
      longBreak: userLongBreak,
      longBreakAfter: userLongBreakAfter,
    } = settings

    const alreadySynced =
      userWorkDuration === workDuration &&
      userShortBreak === shortBreak &&
      userLongBreak === longBreak &&
      userLongBreakAfter === longBreakAfter

    if (alreadySynced) {
      return
    }

    setTimerSettings({
      workDuration: userWorkDuration,
      shortBreak: userShortBreak,
      longBreak: userLongBreak,
      longBreakAfter: userLongBreakAfter,
    })
  }, [
    user?.settings?.workDuration,
    user?.settings?.shortBreak,
    user?.settings?.longBreak,
    user?.settings?.longBreakAfter,
    workDuration,
    shortBreak,
    longBreak,
    longBreakAfter,
    setTimerSettings,
  ])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick()
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, tick])

  useEffect(() => {
    if (timeRemaining === 0 && currentSession) {
      handleSessionComplete()
    }
  }, [timeRemaining, currentSession])

  useEffect(() => {
    if (!currentSession) {
      previewSessionType(sessionType)
    }
  }, [sessionType, currentSession, previewSessionType])

  const resolveAuthContext = useCallback(async (): Promise<{
    token: string | null
    anonymousId: string | null
  }> => {
    if (token) {
      return { token, anonymousId: null }
    }

    const ensuredAnonymousId = anonymousId ?? (await ensureAnonymousId())
    return { token: null, anonymousId: ensuredAnonymousId }
  }, [token, anonymousId, ensureAnonymousId])

  const handleSessionComplete = async () => {
    if (!currentSession) return

    try {
      const { token: authToken, anonymousId: resolvedAnonymousId } = await resolveAuthContext()

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`
      }

      const body: Record<string, unknown> = {
        status: SessionStatus.COMPLETED,
        completedAt: new Date().toISOString(),
      }

      if (!authToken && resolvedAnonymousId) {
        body.anonymousId = resolvedAnonymousId
      }

      await fetch(`${API_URL}/api/sessions/${currentSession.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      })
    } catch (error) {
      console.error('Failed to complete session:', error)
    }

    emitSessionEnd(currentSession.id, 'completed')
    completeSession()
    
    if (onSessionComplete) {
      await onSessionComplete()
    }
  }

  const mutateSessions = useCallback(async () => Promise.resolve(), [])

  const handleStart = () => {
    const now = Date.now()

    if (isStarting) {
      return
    }

    if (now - lastStartAtRef.current < START_THROTTLE_MS) {
      return
    }

    lastStartAtRef.current = now

    const requestId = `${now}-${Math.random().toString(36).slice(2)}`
    startRequestIdRef.current = requestId

    setIsStarting(true)

    if (currentSession) {
      cancelSession()
    }

    const duration = getSessionDuration(sessionType)
    const taskName = selectedTask?.title || getSessionTypeLabel(sessionType)
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const tempStartedAt = new Date().toISOString()

    startSession(taskName, duration, sessionType, tempId)
    updateCurrentSession(tempId, { startedAt: tempStartedAt })

    sendMessageToServiceWorker({
      type: 'START_TIMER',
      payload: {
        sessionId: tempId,
        duration,
        timeRemaining: duration * 60,
        startedAt: tempStartedAt,
      },
    })

    const sessionPayload = {
      task: taskName,
      duration,
      type: sessionType,
    }

    void (async () => {
      try {
        const { token: authToken, anonymousId: resolvedAnonymousId } = await resolveAuthContext()

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`
        }

        const body: Record<string, unknown> = { ...sessionPayload }

        if (!authToken && resolvedAnonymousId) {
          body.anonymousId = resolvedAnonymousId
        }

        const response = await fetch(`${API_URL}/api/sessions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorMessage = await response.text().catch(() => null)
          throw new Error(errorMessage || 'Failed to create session')
        }

        const dbSession = await response.json()
        void mutateSessions()

        if (requestId !== startRequestIdRef.current) {
          return
        }

        const persistedStartedAt = dbSession.startedAt ?? tempStartedAt
        const newSessionId: string | undefined = dbSession.id

        if (!newSessionId) {
          throw new Error('Server response missing session id')
        }

        const elapsedSeconds = Math.max(
          0,
          Math.floor((Date.now() - new Date(persistedStartedAt).getTime()) / 1000)
        )
        const syncedRemaining = Math.max(0, duration * 60 - elapsedSeconds)

        updateCurrentSession(tempId, {
          id: newSessionId,
          startedAt: persistedStartedAt,
          timeRemaining: syncedRemaining,
        })

        sendMessageToServiceWorker({
          type: 'UPDATE_SESSION_ID',
          payload: {
            oldSessionId: tempId,
            newSessionId,
            startedAt: persistedStartedAt,
            duration,
            timeRemaining: syncedRemaining,
          },
        })

        const sessionData = {
          id: newSessionId,
          task: taskName,
          duration,
          type: sessionType,
          userId: user?.id,
          username: user?.username,
          avatarUrl: user?.avatarUrl,
          timeRemaining: syncedRemaining,
          startedAt: persistedStartedAt,
          status: SessionStatus.ACTIVE,
        }

        emitSessionStart(sessionData)
      } catch (error) {
        console.error('Failed to start session:', error)
      } finally {
        setTimeout(() => {
          if (startRequestIdRef.current === requestId) {
            startRequestIdRef.current = null
            setIsStarting(false)
          }
        }, 300)
      }
    })()
  }

  const handlePause = () => {
    pauseSession()
    if (currentSession) {
      emitSessionSync({
        ...currentSession,
        status: SessionStatus.PAUSED,
      })
    }
  }

  const handleResume = () => {
    resumeSession()
    if (currentSession) {
      emitSessionSync({
        ...currentSession,
        status: SessionStatus.ACTIVE,
      })
    }
  }

  const handleStop = async () => {
    if (currentSession) {
      try {
        const { token: authToken, anonymousId: resolvedAnonymousId } = await resolveAuthContext()

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`
        }

        const body: Record<string, unknown> = {
          status: SessionStatus.CANCELLED,
          endedAt: new Date().toISOString(),
        }

        if (!authToken && resolvedAnonymousId) {
          body.anonymousId = resolvedAnonymousId
        }

        await fetch(`${API_URL}/api/sessions/${currentSession.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        })
      } catch (error) {
        console.error('Failed to stop session:', error)
      }

      emitSessionEnd(currentSession.id, 'manual')
    }
    
    cancelSession()
  }

  const getSessionDuration = (type: SessionType): number => {
    switch (type) {
      case SessionType.WORK:
        return workDuration
      case SessionType.SHORT_BREAK:
        return shortBreak
      case SessionType.LONG_BREAK:
        return longBreak
      default:
        return workDuration
    }
  }

  const getSessionTypeLabel = (type: SessionType): string => {
    switch (type) {
      case SessionType.WORK:
        return 'Work'
      case SessionType.SHORT_BREAK:
        return 'Short Break'
      case SessionType.LONG_BREAK:
        return 'Long Break'
      default:
        return 'Work'
    }
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const progress = currentSession 
    ? ((currentSession.duration * 60 - timeRemaining) / (currentSession.duration * 60))
    : 0

  const circumference = 2 * Math.PI * 54
  const offset = circumference * (1 - progress)

  const activeSessionType = currentSession?.type ?? sessionType
  const isPaused = currentSession?.status === SessionStatus.PAUSED
  const cycleSessionType = useCallback(() => {
    if (currentSession) return
    setSessionType((prev) => {
      switch (prev) {
        case SessionType.WORK:
          return SessionType.SHORT_BREAK
        case SessionType.SHORT_BREAK:
          return SessionType.LONG_BREAK
        case SessionType.LONG_BREAK:
        default:
          return SessionType.WORK
      }
    })
  }, [currentSession, setSessionType])

  return (
    <View style={styles.container}>
      <View style={styles.connectionStatus}>
        <View
          style={[
            styles.statusDot,
            isConnected ? styles.statusDotOnline : styles.statusDotOffline,
          ]}
        />
        <Text style={styles.statusText}>
          {isConnected ? 'Online' : 'Offline'}
        </Text>
      </View>
      <View style={styles.timerContainer}>
        <Svg width={220} height={220} viewBox="0 0 120 120">
          <Circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <Circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={
              activeSessionType === SessionType.WORK 
                ? '#ef4444' 
                : activeSessionType === SessionType.SHORT_BREAK 
                ? '#22c55e' 
                : '#3b82f6'
            }
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </Svg>
        
        <View style={styles.timerContent}>
          <Text style={[
            styles.time,
            activeSessionType === SessionType.WORK && styles.timeWork,
            activeSessionType === SessionType.SHORT_BREAK && styles.timeBreak,
            activeSessionType === SessionType.LONG_BREAK && styles.timeLongBreak,
          ]}>
            {formatTime(timeRemaining)}
          </Text>
          <TouchableOpacity
            onPress={cycleSessionType}
            activeOpacity={currentSession ? 1 : 0.7}
            disabled={!!currentSession}
            style={[
              styles.labelButton,
              currentSession && styles.labelButtonDisabled,
            ]}
          >
            <Text style={[
              styles.label,
              activeSessionType === SessionType.SHORT_BREAK && styles.labelShortBreak,
              activeSessionType === SessionType.LONG_BREAK && styles.labelLongBreak,
            ]}>
              {getSessionTypeLabel(activeSessionType)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.controls}>
        {!currentSession ? (
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>Start</Text>
          </TouchableOpacity>
        ) : (
          <>
            {isPaused ? (
              <TouchableOpacity style={styles.resumeButton} onPress={handleResume}>
                <Text style={styles.buttonText}>Resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
                <Text style={styles.buttonText}>Pause</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
              <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  connectionStatus: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusDotOnline: {
    backgroundColor: '#22c55e',
  },
  statusDotOffline: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  timerContainer: {
    position: 'relative',
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  timerContent: {
    position: 'absolute',
    alignItems: 'center',
  },
  time: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  timeWork: {
    color: '#ef4444',
  },
  timeBreak: {
    color: '#22c55e',
  },
  timeLongBreak: {
    color: '#3b82f6',
  },
  labelButton: {
    marginTop: 2,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
  },
  labelButtonDisabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  labelShortBreak: {
    color: '#16a34a',
  },
  labelLongBreak: {
    color: '#2563eb',
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  startButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pauseButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  resumeButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  stopButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
})
