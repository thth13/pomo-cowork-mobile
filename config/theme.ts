export interface ColorScheme {
  // Background colors
  background: string
  backgroundSecondary: string
  backgroundTertiary: string
  card: string
  
  // Text colors
  text: string
  textSecondary: string
  textTertiary: string
  textPlaceholder: string
  
  // Border colors
  border: string
  borderLight: string
  
  // Brand colors
  primary: string
  primaryLight: string
  primaryDark: string
  
  // State colors
  success: string
  successLight: string
  successDark: string
  warning: string
  warningLight: string
  error: string
  errorLight: string
  errorDark: string
  info: string
  infoLight: string
  infoDark: string
  
  // Timer specific
  work: string
  shortBreak: string
  longBreak: string
  
  // Status
  online: string
  offline: string
  
  // Tab bar
  tabBarBackground: string
  tabBarBorder: string
  tabBarActive: string
  tabBarInactive: string
  
  // Input
  inputBackground: string
  inputBorder: string
  
  // Shadow (for elevation)
  shadow: string
}

export const lightTheme: ColorScheme = {
  // Background colors
  background: '#f8fafc',
  backgroundSecondary: '#f9fafb',
  backgroundTertiary: '#ffffff',
  card: '#ffffff',
  
  // Text colors
  text: '#0f172a',
  textSecondary: '#475569',
  textTertiary: '#64748b',
  textPlaceholder: '#cbd5f5',
  
  // Border colors
  border: '#e2e8f0',
  borderLight: '#e5e7eb',
  
  // Brand colors
  primary: '#ef4444',
  primaryLight: '#fca5a5',
  primaryDark: '#dc2626',
  
  // State colors
  success: '#22c55e',
  successLight: '#dcfce7',
  successDark: '#16a34a',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
  errorDark: '#991b1b',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  infoDark: '#2563eb',
  
  // Timer specific
  work: '#ef4444',
  shortBreak: '#22c55e',
  longBreak: '#3b82f6',
  
  // Status
  online: '#22c55e',
  offline: '#ef4444',
  
  // Tab bar
  tabBarBackground: '#ffffff',
  tabBarBorder: '#e5e7eb',
  tabBarActive: '#ef4444',
  tabBarInactive: '#94a3b8',
  
  // Input
  inputBackground: '#ffffff',
  inputBorder: '#e2e8f0',
  
  // Shadow
  shadow: '#000000',
}

export const darkTheme: ColorScheme = {
  // Background colors
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
  backgroundTertiary: '#1e293b',
  card: '#1e293b',
  
  // Text colors
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textTertiary: '#94a3b8',
  textPlaceholder: '#475569',
  
  // Border colors
  border: '#334155',
  borderLight: '#475569',
  
  // Brand colors
  primary: '#ef4444',
  primaryLight: '#fca5a5',
  primaryDark: '#dc2626',
  
  // State colors
  success: '#22c55e',
  successLight: '#166534',
  successDark: '#16a34a',
  warning: '#f59e0b',
  warningLight: '#92400e',
  error: '#ef4444',
  errorLight: '#7f1d1d',
  errorDark: '#991b1b',
  info: '#3b82f6',
  infoLight: '#1e3a8a',
  infoDark: '#2563eb',
  
  // Timer specific
  work: '#ef4444',
  shortBreak: '#22c55e',
  longBreak: '#3b82f6',
  
  // Status
  online: '#22c55e',
  offline: '#ef4444',
  
  // Tab bar
  tabBarBackground: '#1e293b',
  tabBarBorder: '#334155',
  tabBarActive: '#ef4444',
  tabBarInactive: '#64748b',
  
  // Input
  inputBackground: '#0f172a',
  inputBorder: '#334155',
  
  // Shadow
  shadow: '#000000',
}

export const getTheme = (mode: 'light' | 'dark'): ColorScheme => {
  return mode === 'dark' ? darkTheme : lightTheme
}
