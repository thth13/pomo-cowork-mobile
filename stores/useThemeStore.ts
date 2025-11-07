import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

type ThemeMode = 'light' | 'dark'

interface ThemeStore {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  loadTheme: () => Promise<void>
}

const THEME_STORAGE_KEY = 'app_theme'

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'light',
  
  setTheme: async (theme: ThemeMode) => {
    set({ theme })
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  },
  
  toggleTheme: () => {
    const currentTheme = get().theme
    const newTheme: ThemeMode = currentTheme === 'light' ? 'dark' : 'light'
    get().setTheme(newTheme)
  },
  
  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') {
        set({ theme: stored })
      }
    } catch (error) {
      console.error('Failed to load theme:', error)
    }
  },
}))
