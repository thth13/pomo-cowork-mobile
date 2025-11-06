import { create } from 'zustand'
import { User, UserSettings } from '@/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_URL } from '@/config/constants'
import * as authService from '@/services/authService'

interface AuthState {
  user: User | null
  token: string | null
  anonymousId: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isGuest: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, username: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<void>
  ensureAnonymousId: () => Promise<string>
  updateUserSettings: (settings: Partial<UserSettings>) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  anonymousId: null,
  isAuthenticated: false,
  isLoading: true,
  isGuest: false,

  ensureAnonymousId: async () => {
    const currentId = get().anonymousId
    if (currentId) {
      return currentId
    }
    
    const anonymousId = await authService.ensureAnonymousId()
    set({ anonymousId, isGuest: true })
    return anonymousId
  },

  login: async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (response.ok) {
        const { user, token } = await response.json()
        
        // Сохраняем через authService
        await authService.saveAuth(token, user)
        
        // Очищаем anonymousId при логине
        await authService.clearAnonymousId()
        
        set({ 
          user, 
          token,
          anonymousId: null,
          isAuthenticated: true,
          isGuest: false,
        })
        return true
      }
      return false
    } catch (error) {
      console.error('[Auth] Login error:', error)
      return false
    }
  },

  register: async (email: string, username: string, password: string) => {
    try {
      const anonymousId = await authService.getAnonymousId()
      
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password, anonymousId }),
      })

      if (response.ok) {
        const { user, token } = await response.json()
        
        // Сохраняем через authService
        await authService.saveAuth(token, user)
        
        // Очищаем anonymousId при регистрации
        await authService.clearAnonymousId()
        
        set({ 
          user, 
          token,
          anonymousId: null,
          isAuthenticated: true,
          isGuest: false,
        })
        return true
      }
      return false
    } catch (error) {
      console.error('[Auth] Register error:', error)
      return false
    }
  },

  logout: async () => {
    await authService.clearStoredAuth()
    
    // Генерируем новый anonymousId для следующей сессии
    const anonymousId = await authService.ensureAnonymousId()
    
    set({ 
      user: null, 
      token: null,
      anonymousId,
      isAuthenticated: false,
      isGuest: true,
    })
  },

  checkAuth: async () => {
    try {
      // Сначала проверяем сохраненный токен
      const stored = await authService.getStoredAuth()
      
      if (!stored) {
        // Если нет токена, получаем/создаем anonymousId
        const anonymousId = await authService.ensureAnonymousId()
        set({ 
          anonymousId,
          isGuest: true,
          isLoading: false,
        })
        return
      }

      // Валидируем токен
      const user = await authService.validateToken(stored.token)

      if (user) {
        set({ 
          user, 
          token: stored.token, 
          isAuthenticated: true, 
          isGuest: false,
          isLoading: false,
        })
      } else {
        // Токен невалиден, получаем anonymousId
        await authService.clearStoredAuth()
        const anonymousId = await authService.ensureAnonymousId()
        set({
          anonymousId,
          isGuest: true,
          isLoading: false,
        })
      }
    } catch (error) {
      console.error('[Auth] Check error:', error)
      // При ошибке получаем anonymousId
      const anonymousId = await authService.ensureAnonymousId()
      set({
        anonymousId,
        isGuest: true,
        isLoading: false,
      })
    }
  },

  updateUserSettings: (settings) => {
    set((state) => {
      if (!state.user) {
        return {}
      }

      const existingSettings = state.user.settings

      const nextSettings: UserSettings = existingSettings
        ? { ...existingSettings, ...settings }
        : {
            id: settings.id ?? state.user.id,
            userId: state.user.id,
            workDuration: settings.workDuration ?? 25,
            shortBreak: settings.shortBreak ?? 5,
            longBreak: settings.longBreak ?? 15,
            longBreakAfter: settings.longBreakAfter ?? 4,
            soundEnabled: settings.soundEnabled ?? true,
            soundVolume: settings.soundVolume ?? 0.5,
            notificationsEnabled: settings.notificationsEnabled ?? true,
          }

      return {
        user: {
          ...state.user,
          settings: nextSettings,
        },
      }
    })
  },
}))
