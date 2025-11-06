// Configuration constants for the mobile app
// Update these values according to your setup

// Backend API URL
// For local development use your computer's IP address: http://192.168.1.x:3000
// For production use your deployed backend URL: https://your-domain.com
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.101:3000'

// Socket.IO Server URL
// For local development use your computer's IP address: http://192.168.1.x:3001
// For production use your deployed socket server URL: wss://your-domain.com
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://192.168.0.101:4000'

// App Configuration
export const APP_CONFIG = {
  // Timer defaults (in minutes)
  DEFAULT_WORK_DURATION: 25,
  DEFAULT_SHORT_BREAK: 5,
  DEFAULT_LONG_BREAK: 15,
  DEFAULT_LONG_BREAK_AFTER: 4,
  
  // Chat configuration
  MAX_MESSAGES_HISTORY: 100,
  CHAT_LOAD_MORE_COUNT: 20,
  
  // Session configuration
  MIN_SESSION_DURATION: 1, // minutes
  MAX_SESSION_DURATION: 120, // minutes
  
  // Network configuration
  REQUEST_TIMEOUT: 30000, // 30 seconds
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000, // 1 second
}

// Theme colors
export const COLORS = {
  // Session type colors
  work: '#ef4444',
  shortBreak: '#22c55e',
  longBreak: '#3b82f6',
  
  // UI colors
  primary: '#ef4444',
  secondary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#dc2626',
  
  // Background colors
  background: '#f8fafc',
  surface: '#ffffff',
  
  // Text colors
  text: {
    primary: '#1f2937',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
    inverse: '#ffffff',
  },
  
  // Border colors
  border: '#e5e7eb',
  borderDark: '#d1d5db',
  
  // State colors
  active: '#dbeafe',
  disabled: '#f3f4f6',
}

// Typography
export const TYPOGRAPHY = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
}

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
}

// Border radius
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
}
