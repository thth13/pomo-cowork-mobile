import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList } from 'react-native'
import { useTimerStore } from '@/stores/useTimerStore'
import { ActiveSession } from '@/types'

export default function ActiveSessions() {
  const { activeSessions } = useTimerStore()

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const renderSession = ({ item }: { item: ActiveSession }) => (
    <View style={styles.session}>
      <View style={styles.sessionHeader}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {item.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.sessionInfo}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.task} numberOfLines={1}>{item.task}</Text>
        </View>
      </View>
      <Text style={styles.time}>{formatTime(item.timeRemaining)}</Text>
    </View>
  )

  if (activeSessions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Active Sessions</Text>
        <Text style={styles.emptyText}>No one is working right now</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Active Sessions ({activeSessions.length})
      </Text>
      <FlatList
        data={activeSessions}
        renderItem={renderSession}
        keyExtractor={(item) => item.id}
        style={styles.list}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  list: {
    maxHeight: 300,
  },
  session: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  sessionInfo: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  task: {
    fontSize: 12,
    color: '#6b7280',
  },
  time: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    paddingVertical: 24,
  },
})

import { Image } from 'react-native'
