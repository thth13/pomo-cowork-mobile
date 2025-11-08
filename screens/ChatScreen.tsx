import React from 'react'
import { StyleSheet, View } from 'react-native'
import Chat from '@/components/Chat'
import { useThemeStore } from '@/stores/useThemeStore'
import { getTheme } from '@/config/theme'

export default function ChatScreen() {
  const theme = useThemeStore((state) => state.theme)
  const colors = getTheme(theme)

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Chat />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-start',
  },
})
