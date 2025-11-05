import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Svg, { Circle } from 'react-native-svg'
import { useTimerStore } from '@/stores/useTimerStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { SessionType, SessionStatus } from '@/types'
import { useSocket } from '@/hooks/useSocket'
import { API_URL } from '@/config/constants'

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
    selectedTask,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    cancelSession,
    tick,
    previewSessionType,
  } = useTimerStore()

  const { user } = useAuthStore()
  const {
    emitSessionStart,
    emitSessionSync,
    emitSessionEnd,
    emitTimerTick,
    isConnected,
  } = useSocket()
  const [sessionType, setSessionType] = useState<SessionType>(SessionType.WORK)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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

  const handleSessionComplete = async () => {
    if (!currentSession) return

    try {
      const token = await AsyncStorage.getItem('token')
      if (token) {
        await fetch(`${API_URL}/api/sessions/${currentSession.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: SessionStatus.COMPLETED,
            completedAt: new Date().toISOString(),
          }),
        })
      }
    } catch (error) {
      console.error('Failed to complete session:', error)
    }

    emitSessionEnd(currentSession.id, 'completed')
    completeSession()
    
    if (onSessionComplete) {
      await onSessionComplete()
    }
  }

  const handleStart = async () => {
    const duration = getSessionDuration(sessionType)
    const taskName = selectedTask?.title || getSessionTypeLabel(sessionType)

    try {
      const token = await AsyncStorage.getItem('token')
      if (token) {
        const response = await fetch(`${API_URL}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            task: taskName,
            duration,
            type: sessionType,
          }),
        })

        if (response.ok) {
          const dbSession = await response.json()
          startSession(taskName, duration, sessionType, dbSession.id)
          
          emitSessionStart({
            id: dbSession.id,
            task: taskName,
            duration,
            type: sessionType,
            userId: user?.id,
            username: user?.username,
            avatarUrl: user?.avatarUrl,
            timeRemaining: duration * 60,
            startedAt: dbSession.startedAt,
            status: SessionStatus.ACTIVE,
          })
        }
      }
    } catch (error) {
      console.error('Failed to start session:', error)
      startSession(taskName, duration, sessionType)
    }
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
        const token = await AsyncStorage.getItem('token')
        if (token) {
          await fetch(`${API_URL}/api/sessions/${currentSession.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              status: SessionStatus.CANCELLED,
              endedAt: new Date().toISOString(),
            }),
          })
        }
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
