import { API_URL } from '@/config/constants'
import { useAuthStore } from '@/stores/useAuthStore'
import * as authService from './authService'

interface RequestOptions extends RequestInit {
  skipAuth?: boolean
}

/**
 * HTTP клиент с автоматическим добавлением токена авторизации
 * и обработкой истекших токенов (401)
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestOptions = {}
): Promise<Response> {
  const { skipAuth = false, ...fetchOptions } = options
  
  // Получаем токен и anonymousId из стора
  const { token, anonymousId } = useAuthStore.getState()
  
  // Добавляем токен в заголовки
  const headers = new Headers(fetchOptions.headers)
  
  if (!skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  // Устанавливаем Content-Type по умолчанию
  if (!headers.has('Content-Type') && fetchOptions.body) {
    headers.set('Content-Type', 'application/json')
  }
  
  // Добавляем anonymousId в body для анонимных пользователей
  let body = fetchOptions.body
  if (!skipAuth && !token && anonymousId && fetchOptions.body) {
    try {
      const bodyObj = JSON.parse(fetchOptions.body as string)
      bodyObj.anonymousId = anonymousId
      body = JSON.stringify(bodyObj)
    } catch {
      // Если body не JSON, оставляем как есть
    }
  }
  
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}/${endpoint}`
  
  let response = await fetch(url, {
    ...fetchOptions,
    headers,
    body,
  })
  
  // Обработка 401 (неавторизован или токен истек)
  if (response.status === 401 && !skipAuth) {
    console.log('[HttpClient] Received 401 - unauthorized')
    // Для анонимных пользователей повторных попыток не делаем
    // Они работают через anonymousId без токена
  }
  
  return response
}

/**
 * Удобные методы для разных типов запросов
 */
export const httpClient = {
  get: (endpoint: string, options?: RequestOptions) =>
    fetchWithAuth(endpoint, { ...options, method: 'GET' }),
  
  post: (endpoint: string, body?: any, options?: RequestOptions) =>
    fetchWithAuth(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  put: (endpoint: string, body?: any, options?: RequestOptions) =>
    fetchWithAuth(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  patch: (endpoint: string, body?: any, options?: RequestOptions) =>
    fetchWithAuth(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  
  delete: (endpoint: string, options?: RequestOptions) =>
    fetchWithAuth(endpoint, { ...options, method: 'DELETE' }),
}
