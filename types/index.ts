export interface User {
  id: string
  email: string
  username: string
  avatarUrl?: string
  description?: string
  createdAt: string
  isAnonymous?: boolean
  settings?: UserSettings
}

export interface UserSettings {
  id: string
  userId: string
  workDuration: number
  shortBreak: number
  longBreak: number
  longBreakAfter: number
  soundEnabled: boolean
  soundVolume: number
  notificationsEnabled: boolean
}

export interface PomodoroSession {
  id: string
  userId: string
  user?: User
  task: string
  duration: number
  type: SessionType
  status: SessionStatus
  startedAt: string
  endedAt?: string
  completedAt?: string
  timeRemaining?: number
  pausedAt?: string
  remainingSeconds?: number
}

export enum SessionType {
  WORK = 'WORK',
  SHORT_BREAK = 'SHORT_BREAK',
  LONG_BREAK = 'LONG_BREAK'
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface ActiveSession {
  id: string
  userId: string
  username: string
  avatarUrl?: string
  task: string
  duration: number
  timeRemaining: number
  type: SessionType
  startedAt: string
  status?: SessionStatus
}

export interface Task {
  id: string
  title: string
  description?: string
  pomodoros: number
  completedPomodoros: number
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  completed: boolean
}

export interface ChatMessage {
  id: string
  userId: string | null
  username: string
  avatarUrl?: string
  text: string
  timestamp: number
  type?: 'message' | 'system'
  action?: {
    type: 'work_start' | 'break_start' | 'long_break_start' | 'timer_stop' | 'session_complete'
    duration?: number
    task?: string
  }
}

export interface SessionStats {
  totalSessions: number
  totalMinutes: number
  todaysSessions: number
  todaysMinutes: number
  weeklyStats: {
    date: string
    sessions: number
    minutes: number
  }[]
  monthlyStats: {
    date: string
    sessions: number
    minutes: number
  }[]
}
