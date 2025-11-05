import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTimerStore } from '@/stores/useTimerStore'
import type { ActiveSession, ChatMessage, User } from '@/types'
import { SOCKET_URL } from '@/config/constants'

let sharedSocket: Socket | null = null
let initialized = false
const connectionListeners = new Set<(status: boolean) => void>()

const notifyConnectionListeners = (status: boolean) => {
  connectionListeners.forEach((listener) => {
    try {
      listener(status)
    } catch (error) {
      console.error('[Socket] Connection listener error', error)
    }
  })
}

const buildPresencePayload = (user: User | null | undefined) => {
  if (user?.id) {
    return {
      userId: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl ?? null,
      anonymousId: null,
    }
  }

  return {
    userId: null,
    username: 'Guest',
    avatarUrl: null,
    anonymousId: null,
  }
}

const initSocketOnce = () => {
  if (initialized) return
  initialized = true

  console.log('[Socket] Initializing connection to', SOCKET_URL)

  sharedSocket = io(SOCKET_URL, {
    path: '/socket',
    transports: ['websocket', 'polling'],
    timeout: 5000,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 5,
    withCredentials: true,
  })

  const socket = sharedSocket
  if (!socket) return

  const setActiveSessions = useTimerStore.getState().setActiveSessions

  socket.on('connect', () => {
    console.log('[Socket] Connected to server')
    notifyConnectionListeners(true)

    socket.emit('get-active-sessions')
    socket.emit('get-online-users')

    const user = useAuthStore.getState().user ?? null
    socket.emit('join-presence', buildPresencePayload(user))
  })

  socket.on('reconnect', () => {
    console.log('[Socket] Reconnected to server')
    socket.emit('get-online-users')
    const user = useAuthStore.getState().user ?? null
    socket.emit('join-presence', buildPresencePayload(user))
  })

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from server')
    notifyConnectionListeners(false)
  })

  socket.on('session-update', (sessions: ActiveSession[]) => {
    setActiveSessions(sessions)
  })

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error?.message || error)
  })

  socket.on('reconnect_attempt', (attempt) => {
    console.log('[Socket] Reconnect attempt', attempt)
  })

  socket.on('reconnect_failed', () => {
    console.error('[Socket] Reconnect failed – giving up')
  })
}

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(sharedSocket)
  const [isConnected, setIsConnected] = useState<boolean>(sharedSocket?.connected ?? false)
  const { user } = useAuthStore()

  useEffect(() => {
    initSocketOnce()

    socketRef.current = sharedSocket

    const handleStatus = (status: boolean) => setIsConnected(status)
    connectionListeners.add(handleStatus)

    if (sharedSocket?.connected) {
      setIsConnected(true)
    }

    return () => {
      connectionListeners.delete(handleStatus)
    }
  }, [])

  useEffect(() => {
    if (!sharedSocket || !sharedSocket.connected) return

    sharedSocket.emit('join-presence', buildPresencePayload(user))
  }, [user])

  const emitSessionStart = (sessionData: any) => {
    sharedSocket?.emit('session-start', sessionData)
  }

  const emitSessionSync = (sessionData: any) => {
    sharedSocket?.emit('session-sync', sessionData)
  }

  const emitSessionPause = (sessionId: string) => {
    sharedSocket?.emit('session-pause', sessionId)
  }

  const emitSessionEnd = (
    sessionId: string,
    reason: 'manual' | 'completed' | 'reset' = 'manual',
    options?: { removeActivity?: boolean }
  ) => {
    sharedSocket?.emit('session-end', {
      sessionId,
      reason,
      ...(options?.removeActivity ? { removeActivity: true } : {}),
    })
  }

  const emitTimerTick = (sessionId: string, timeRemaining: number) => {
    sharedSocket?.emit('timer-tick', { sessionId, timeRemaining })
  }

  const sendChatMessage = (text: string) => {
    sharedSocket?.emit('chat-send', { text })
  }

  const requestChatHistory = () => {
    sharedSocket?.emit('chat-history')
  }

  const emitChatTyping = (isTyping: boolean) => {
    sharedSocket?.emit('chat-typing', { isTyping })
  }

  const onChatMessage = (callback: (message: ChatMessage) => void) => {
    sharedSocket?.on('chat-new', callback)
  }

  const offChatMessage = (callback: (message: ChatMessage) => void) => {
    sharedSocket?.off('chat-new', callback)
  }

  const onChatHistory = (callback: (messages: ChatMessage[]) => void) => {
    sharedSocket?.on('chat-history', callback)
  }

  const offChatHistory = (callback: (messages: ChatMessage[]) => void) => {
    sharedSocket?.off('chat-history', callback)
  }

  const onChatRemove = (callback: (messageId: string) => void) => {
    sharedSocket?.on('chat-remove', callback)
  }

  const offChatRemove = (callback: (messageId: string) => void) => {
    sharedSocket?.off('chat-remove', callback)
  }

  const onChatTyping = (callback: (payload: { username: string; isTyping: boolean }) => void) => {
    sharedSocket?.on('chat-typing', callback)
  }

  const offChatTyping = (callback: (payload: { username: string; isTyping: boolean }) => void) => {
    sharedSocket?.off('chat-typing', callback)
  }

  return {
    socket: socketRef.current,
    isConnected,
    emitSessionStart,
    emitSessionSync,
    emitSessionPause,
    emitSessionEnd,
    emitTimerTick,
    sendChatMessage,
    requestChatHistory,
    emitChatTyping,
    onChatMessage,
    offChatMessage,
    onChatHistory,
    offChatHistory,
    onChatRemove,
    offChatRemove,
    onChatTyping,
    offChatTyping,
  }
}
