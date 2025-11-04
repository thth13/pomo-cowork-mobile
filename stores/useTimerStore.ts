import { create } from 'zustand'
import { PomodoroSession, SessionType, SessionStatus, ActiveSession } from '@/types'

interface TimerTaskOption {
  id: string
  title: string
  description?: string
  completed?: boolean
}

interface TimerState {
  isRunning: boolean
  timeRemaining: number
  currentSession: PomodoroSession | null
  completedSessions: number
  pausedAt: number | null
  activeSessions: ActiveSession[]
  selectedTask: {
    id: string
    title: string
    description?: string
  } | null
  taskOptions: TimerTaskOption[]

  startSession: (task: string, duration: number, type: SessionType, sessionId?: string) => void
  pauseSession: () => void
  resumeSession: () => void
  completeSession: () => void
  cancelSession: () => void
  tick: () => void
  setActiveSessions: (sessions: ActiveSession[]) => void
  updateActiveSessionTime: (sessionId: string, timeRemaining: number) => void
  restoreSession: (session: PomodoroSession) => void
  previewSessionType: (type: SessionType) => void
  setSelectedTask: (task: { id: string; title: string; description?: string } | null) => void
  setTaskOptions: (tasks: TimerTaskOption[]) => void

  workDuration: number
  shortBreak: number
  longBreak: number
  longBreakAfter: number
  setTimerSettings: (settings: {
    workDuration: number
    shortBreak: number
    longBreak: number
    longBreakAfter: number
  }) => void
  initializeWithSettings: (settings: {
    workDuration: number
    shortBreak: number
    longBreak: number
    longBreakAfter: number
  }) => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  isRunning: false,
  timeRemaining: 25 * 60,
  currentSession: null,
  completedSessions: 0,
  pausedAt: null,
  activeSessions: [],
  selectedTask: null,
  taskOptions: [],

  workDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakAfter: 4,

  startSession: (task: string, duration: number, type: SessionType, sessionId?: string) => {
    const session: PomodoroSession = {
      id: sessionId || Date.now().toString(),
      userId: 'current-user',
      task,
      duration,
      type,
      status: SessionStatus.ACTIVE,
      startedAt: new Date().toISOString(),
      timeRemaining: duration * 60,
    }
    
    set({
      currentSession: session,
      timeRemaining: duration * 60,
      isRunning: true,
      pausedAt: null,
    })
  },

  restoreSession: (session: PomodoroSession) => {
    const startTime = new Date(session.startedAt).getTime()
    const now = Date.now()
    const elapsed = Math.floor((now - startTime) / 1000)
    const totalDuration = session.duration * 60
    const remaining = Math.max(0, totalDuration - elapsed)
    
    if (remaining > 0) {
      set({
        currentSession: {
          ...session,
          timeRemaining: remaining,
        },
        timeRemaining: remaining,
        isRunning: session.status === SessionStatus.ACTIVE,
        pausedAt: session.status === SessionStatus.PAUSED ? Date.now() : null,
      })
    }
  },

  pauseSession: () => {
    const { currentSession, timeRemaining } = get()
    if (currentSession) {
      set({
        isRunning: false,
        pausedAt: Date.now(),
        currentSession: {
          ...currentSession,
          status: SessionStatus.PAUSED,
          timeRemaining,
        },
      })
    }
  },

  resumeSession: () => {
    const { currentSession, pausedAt, timeRemaining } = get()
    if (currentSession && pausedAt) {
      const pauseDuration = Date.now() - pausedAt
      const newStartedAt = new Date(new Date(currentSession.startedAt).getTime() + pauseDuration).toISOString()
      
      set({
        isRunning: true,
        pausedAt: null,
        currentSession: {
          ...currentSession,
          status: SessionStatus.ACTIVE,
          startedAt: newStartedAt,
          timeRemaining,
        },
      })
    }
  },

  completeSession: () => {
    const { currentSession, completedSessions } = get()
    
    if (currentSession) {
      const nextType = getNextSessionType(completedSessions + 1, get().longBreakAfter)
      const nextDuration = getSessionDuration(nextType, get())
      
      set({
        isRunning: false,
        currentSession: null,
        completedSessions: completedSessions + 1,
        timeRemaining: nextDuration * 60,
        pausedAt: null,
      })
    }
  },

  cancelSession: () => {
    const state = get()
    const { currentSession } = state
    if (currentSession) {
      const fallbackDuration = getSessionDuration(currentSession.type, state)
      set({
        isRunning: false,
        currentSession: null,
        timeRemaining: fallbackDuration * 60,
        pausedAt: null,
      })
    }
  },

  tick: () => {
    const { isRunning, timeRemaining } = get()
    if (isRunning && timeRemaining > 0) {
      set({ timeRemaining: timeRemaining - 1 })
    }
  },

  setActiveSessions: (sessions: ActiveSession[]) => {
    set({ activeSessions: sessions })
  },

  updateActiveSessionTime: (sessionId, timeRemaining) => {
    set((state) => ({
      activeSessions: state.activeSessions.map((session) => (
        session.id === sessionId
          ? { ...session, timeRemaining }
          : session
      ))
    }))
  },

  previewSessionType: (type) => {
    const state = get()
    const { currentSession } = state
    if (currentSession) {
      return
    }

    const duration = getSessionDuration(type, state)
    set({
      timeRemaining: duration * 60,
    })
  },

  setTimerSettings: (settings) => {
    set({
      workDuration: settings.workDuration,
      shortBreak: settings.shortBreak,
      longBreak: settings.longBreak,
      longBreakAfter: settings.longBreakAfter,
    })
  },

  initializeWithSettings: (settings) => {
    set({
      workDuration: settings.workDuration,
      shortBreak: settings.shortBreak,
      longBreak: settings.longBreak,
      longBreakAfter: settings.longBreakAfter,
      timeRemaining: settings.workDuration * 60,
    })
  },

  setSelectedTask: (task) => {
    set({ selectedTask: task })
  },

  setTaskOptions: (tasks) => {
    set({ taskOptions: tasks })
  },
}))

function getNextSessionType(completedSessions: number, longBreakAfter: number): SessionType {
  if (completedSessions % longBreakAfter === 0) {
    return SessionType.LONG_BREAK
  }
  return completedSessions % 2 === 0 ? SessionType.WORK : SessionType.SHORT_BREAK
}

function getSessionDuration(type: SessionType, state: TimerState): number {
  switch (type) {
    case SessionType.WORK:
      return state.workDuration
    case SessionType.SHORT_BREAK:
      return state.shortBreak
    case SessionType.LONG_BREAK:
      return state.longBreak
    default:
      return state.workDuration
  }
}
