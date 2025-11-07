import React, { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSocket } from '@/hooks/useSocket'
import { ChatMessage } from '@/types'
import { API_URL } from '@/config/constants'

const SKELETON_PLACEHOLDERS = Array.from({ length: 10 }, (_, index) => index)

export default function Chat() {
  const { user } = useAuthStore()
  const {
    sendChatMessage,
    requestChatHistory,
    onChatMessage,
    offChatMessage,
    onChatHistory,
    offChatHistory,
    onChatRemove,
    offChatRemove,
    emitChatTyping,
  } = useSocket()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const flatListRef = useRef<FlatList>(null)

  useEffect(() => {
    const handleHistory = (history: ChatMessage[]) => {
      setMessages(history)
      setLoading(false)
    }

    const handleNew = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg])
    }

    const handleRemove = (messageId: string) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    }

    onChatHistory(handleHistory)
    onChatMessage(handleNew)
    onChatRemove(handleRemove)

    fetch(`${API_URL}/api/chat/messages?take=20`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.items) {
          setMessages(data.items)
          setLoading(false)
        } else {
          requestChatHistory()
        }
      })
      .catch(() => requestChatHistory())

    return () => {
      offChatHistory(handleHistory)
      offChatMessage(handleNew)
      offChatRemove(handleRemove)
    }
  }, [])

  const onSubmit = async () => {
    const text = input.trim()
    if (!text) return

    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      userId: user?.id || null,
      username: user?.username || 'Guest',
      avatarUrl: user?.avatarUrl,
      text,
      timestamp: Date.now(),
      type: 'message'
    }
    setMessages(prev => [...prev, optimisticMessage])
    setInput('')

    try {
      const response = await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || null,
          username: user?.username || 'Guest',
          avatarUrl: user?.avatarUrl,
          text
        })
      })

      if (response.ok) {
        const savedMessage = await response.json()
        setMessages(prev => prev.map(m => 
          m.id === optimisticMessage.id ? savedMessage : m
        ))
        sendChatMessage(text)
      }
    } catch (error) {
      console.error('Error saving message:', error)
      sendChatMessage(text)
    }
  }

  const renderAvatar = (message: ChatMessage) => {
    if (message.avatarUrl) {
      return <Image source={{ uri: message.avatarUrl }} style={styles.avatar} />
    }

    return (
      <View style={styles.avatarPlaceholder}>
        <Text style={styles.avatarText}>
          {message.username.charAt(0).toUpperCase()}
        </Text>
      </View>
    )
  }

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.type === 'system') {
      if (item.action?.type !== 'work_start') {
        return null
      }
      const actionTime = new Date(item.timestamp).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      })
      const taskLabel = item.action?.task?.trim()
      const durationText = item.action?.duration ? ` for ${item.action.duration} min` : ''

      return (
        <View style={styles.systemMessage}>
          {renderAvatar(item)}
          <View style={styles.messageContent}>
            <View style={styles.messageHeader}>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.timestamp}>{actionTime}</Text>
            </View>
            <Text style={styles.systemActionText}>
              started a{' '}
              <Text style={styles.systemActionTask}>
                {taskLabel || 'focus'}
              </Text>{' '}
              session{durationText}
            </Text>
          </View>
        </View>
      )
    }

    return (
      <View style={styles.message}>
        {renderAvatar(item)}
        <View style={styles.messageContent}>
          <View style={styles.messageHeader}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
          <Text style={styles.messageText}>{item.text}</Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>General Chat</Text>
          <View style={styles.onlineIndicator}>
            <View style={styles.onlineDot} />
          </View>
        </View>

        <View style={styles.messagesWrapper}>
          {loading ? (
            <View style={styles.skeletonList}>
              {SKELETON_PLACEHOLDERS.map((placeholder) => (
                <View key={`chat-skeleton-${placeholder}`} style={styles.skeletonMessage}>
                  <View style={styles.skeletonAvatar} />
                  <View style={styles.skeletonBubble}>
                    <View style={styles.skeletonLineLong} />
                    <View style={styles.skeletonLineShort} />
                  </View>
                </View>
              ))}
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No messages yet</Text>
              <Text style={styles.emptyStateSubtext}>Start the conversation below</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            />
          )}
        </View>

        <View style={styles.inputContainer}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.inputAvatar} />
          ) : (
            <View style={[styles.inputAvatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {(user?.username || 'G').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="Write a message..."
            value={input}
            onChangeText={(text) => {
              setInput(text)
              emitChatTyping(true)
            }}
            onSubmitEditing={onSubmit}
          />
          <TouchableOpacity style={styles.sendButton} onPress={onSubmit}>
            <Text style={styles.sendButtonText}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  messagesWrapper: {
    flex: 1,
    marginBottom: 12,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingBottom: 4,
  },
  message: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  systemMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  systemActionText: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
  systemActionTask: {
    fontWeight: '700',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  messageText: {
    fontSize: 14,
    color: '#4b5563',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  skeletonList: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 12,
  },
  skeletonMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  skeletonBubble: {
    flex: 1,
    paddingVertical: 2,
    gap: 6,
  },
  skeletonLineLong: {
    width: '80%',
    height: 12,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  skeletonLineShort: {
    width: '50%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#9ca3af',
  },
})
