import React from 'react'
import { StyleSheet, View } from 'react-native'
import Chat from '@/components/Chat'

export default function UsersScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Chat />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-start',
  },
})
