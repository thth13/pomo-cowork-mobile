import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTimerStore } from '@/stores/useTimerStore'
import { ActiveSession, ChatMessage, SessionStatus } from '@/types'
import { SOCKET_URL } from '@/config/constants'

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { user } = useAuthStore()
  const { setActiveSessions } = useTimerStore()

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected')
      setIsConnected(true)
      
      if (user) {
        socket.emit('user:join', {
          userId: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
        })
      }
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
    })

    socket.on('sessions:list', (sessions: ActiveSession[]) => {
      setActiveSessions(sessions)
    })

    return () => {
      socket.disconnect()
    }
  }, [user])

  const emitSessionStart = (sessionData: any) => {
    socketRef.current?.emit('session:start', sessionData)
  }

  const emitSessionSync = (sessionData: any) => {
    socketRef.current?.emit('session:sync', sessionData)
  }

  const emitSessionPause = (sessionId: string) => {
    socketRef.current?.emit('session:pause', sessionId)
  }

  const emitSessionEnd = (sessionId: string, reason: string, options?: any) => {
    socketRef.current?.emit('session:end', { sessionId, reason, ...options })
  }

  const emitTimerTick = (sessionId: string, timeRemaining: number) => {
    socketRef.current?.emit('session:tick', { sessionId, timeRemaining })
  }

  const sendChatMessage = (text: string) => {
    socketRef.current?.emit('chat:message', { text })
  }

  const requestChatHistory = () => {
    socketRef.current?.emit('chat:history')
  }

  const emitChatTyping = (isTyping: boolean) => {
    socketRef.current?.emit('chat:typing', { isTyping })
  }

  const onChatMessage = (callback: (message: ChatMessage) => void) => {
    socketRef.current?.on('chat:message', callback)
  }

  const offChatMessage = (callback: (message: ChatMessage) => void) => {
    socketRef.current?.off('chat:message', callback)
  }

  const onChatHistory = (callback: (messages: ChatMessage[]) => void) => {
    socketRef.current?.on('chat:history', callback)
  }

  const offChatHistory = (callback: (messages: ChatMessage[]) => void) => {
    socketRef.current?.off('chat:history', callback)
  }

  const onChatRemove = (callback: (messageId: string) => void) => {
    socketRef.current?.on('chat:remove', callback)
  }

  const offChatRemove = (callback: (messageId: string) => void) => {
    socketRef.current?.off('chat:remove', callback)
  }

  const onChatTyping = (callback: (payload: { username: string; isTyping: boolean }) => void) => {
    socketRef.current?.on('chat:typing', callback)
  }

  const offChatTyping = (callback: (payload: { username: string; isTyping: boolean }) => void) => {
    socketRef.current?.off('chat:typing', callback)
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
