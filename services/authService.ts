import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_URL } from '@/config/constants'
import type { User } from '@/types'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'
const ANONYMOUS_ID_KEY = 'anonymous_user_id'

interface StoredAuth {
  token: string
  user: User
}

/**
 * Генерирует UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Получить или создать anonymousId
 */
export async function ensureAnonymousId(): Promise<string> {
  try {
    let anonymousId = await AsyncStorage.getItem(ANONYMOUS_ID_KEY)
    
    if (!anonymousId) {
      anonymousId = generateUUID()
      await AsyncStorage.setItem(ANONYMOUS_ID_KEY, anonymousId)
      console.log('[AuthService] Generated new anonymousId:', anonymousId)
    } else {
      console.log('[AuthService] Found existing anonymousId:', anonymousId)
    }
    
    return anonymousId
  } catch (error) {
    console.error('[AuthService] Failed to ensure anonymousId:', error)
    // Fallback: генерируем временный ID без сохранения
    return generateUUID()
  }
}

/**
 * Получить текущий anonymousId (если есть)
 */
export async function getAnonymousId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ANONYMOUS_ID_KEY)
  } catch (error) {
    console.error('[AuthService] Failed to get anonymousId:', error)
    return null
  }
}

/**
 * Удалить anonymousId (при конвертации в полноценный аккаунт)
 */
export async function clearAnonymousId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ANONYMOUS_ID_KEY)
    console.log('[AuthService] Cleared anonymousId')
  } catch (error) {
    console.error('[AuthService] Failed to clear anonymousId:', error)
  }
}

/**
 * Получить сохраненные данные авторизации из хранилища
 */
export async function getStoredAuth(): Promise<StoredAuth | null> {
  try {
    const [token, userJson] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(USER_KEY),
    ])

    if (!token || !userJson) {
      return null
    }

    const user = JSON.parse(userJson)
    return { token, user }
  } catch (error) {
    console.error('[AuthService] Failed to get stored auth:', error)
    return null
  }
}

/**
 * Очистить сохраненные данные авторизации
 */
export async function clearStoredAuth(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY])
    console.log('[AuthService] Cleared stored auth')
  } catch (error) {
    console.error('[AuthService] Failed to clear stored auth:', error)
  }
}

/**
 * Сохранить данные авторизации в хранилище
 */
export async function saveAuth(token: string, user: User): Promise<void> {
  try {
    const items: [string, string][] = [
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(user)],
    ]

    await AsyncStorage.multiSet(items)
    console.log('[AuthService] Saved auth for user:', user.id)
  } catch (error) {
    console.error('[AuthService] Failed to save auth:', error)
    throw error
  }
}

/**
 * Проверить токен на сервере
 */
export async function validateToken(token: string): Promise<User | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      return null
    }

    const user = await response.json()
    return user
  } catch (error) {
    console.error('[AuthService] Failed to validate token:', error)
    return null
  }
}
