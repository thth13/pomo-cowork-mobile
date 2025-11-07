import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Image, View, Text as RNText } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'
import { useAuthStore } from './stores/useAuthStore'
import { useTimerStore } from './stores/useTimerStore'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Screens
import HomeScreen from './screens/HomeScreen'
import ProfileScreen from './screens/ProfileScreen'
import SettingsScreen from './screens/SettingsScreen'
import UsersScreen from './screens/UsersScreen'
import { Feather } from '@expo/vector-icons'

const Tab = createBottomTabNavigator()
const TAB_BAR_HEIGHT = 60

function AppTabs() {
  const insets = useSafeAreaInsets()

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <Tab.Navigator
        initialRouteName="Pomodoro"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#ef4444',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarStyle: {
            height: TAB_BAR_HEIGHT + insets.bottom,
            backgroundColor: '#ffffff',
            borderTopColor: '#e5e7eb',
            borderTopWidth: 1,
            elevation: 0,
            shadowOpacity: 0,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 12),
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          tabBarItemStyle: {
            paddingVertical: 0,
          },
        }}
      >
        <Tab.Screen 
          name="Pomodoro" 
          component={HomeScreen}
          options={{
            title: 'Pomodoro',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="pomodoro" color={color} focused={focused} />
            ),
          }}
        />
        <Tab.Screen 
          name="Chat" 
          component={UsersScreen}
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="chat" color={color} focused={focused} />
            ),
          }}
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="settings" color={color} focused={focused} />
            ),
          }}
        />
        <Tab.Screen 
          name="Profile" 
          component={ProfileScreen}
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="profile" color={color} focused={focused} />
            ),
          }}
        />
      </Tab.Navigator>
    </SafeAreaView>
  )
}

export default function App() {
  const { checkAuth, isLoading } = useAuthStore()
  const { setTimerSettings, setAutoStartNextSession } = useTimerStore((state) => ({
    setTimerSettings: state.setTimerSettings,
    setAutoStartNextSession: state.setAutoStartNextSession,
  }))
  const timerSettingsHydratedRef = React.useRef(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (timerSettingsHydratedRef.current) {
      return
    }

    const hydrateTimerSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem('timer_settings')
        if (!stored) {
          return
        }

        const parsed = JSON.parse(stored) as {
          workDuration?: unknown
          shortBreak?: unknown
          longBreak?: unknown
          longBreakAfter?: unknown
          autoStartNextSession?: unknown
        }

        const entries: Array<[keyof typeof parsed, unknown]> = [
          ['workDuration', parsed.workDuration],
          ['shortBreak', parsed.shortBreak],
          ['longBreak', parsed.longBreak],
          ['longBreakAfter', parsed.longBreakAfter],
        ]

        const hasInvalid = entries.some(([, value]) => {
          return typeof value !== 'number' || !Number.isFinite(value) || value < 1
        })

        if (hasInvalid) {
          return
        }

        setTimerSettings({
          workDuration: parsed.workDuration as number,
          shortBreak: parsed.shortBreak as number,
          longBreak: parsed.longBreak as number,
          longBreakAfter: parsed.longBreakAfter as number,
        })

        if (typeof parsed.autoStartNextSession === 'boolean') {
          setAutoStartNextSession(parsed.autoStartNextSession)
        }
      } catch (error) {
        console.warn('Failed to hydrate timer settings', error)
      } finally {
        timerSettingsHydratedRef.current = true
      }
    }

    hydrateTimerSettings()
  }, [setTimerSettings, setAutoStartNextSession])

  if (isLoading) {
    return null // Or a loading screen
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <AppTabs />
          <StatusBar style="auto" />
        </NavigationContainer>
        <Toast 
          config={{
            success: (props) => (
              <View
                style={{
                  backgroundColor: '#10b981',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderRadius: 12,
                  marginHorizontal: 16,
                  marginTop: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                {props.text1 && (
                  <RNText style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
                    {props.text1}
                  </RNText>
                )}
                {props.text2 && (
                  <RNText style={{ fontSize: 16, fontWeight: '500', color: '#f0fdf4' }}>
                    {props.text2}
                  </RNText>
                )}
              </View>
            ),
            error: (props) => (
              <View
                style={{
                  backgroundColor: '#ef4444',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderRadius: 12,
                  marginHorizontal: 16,
                  marginTop: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                {props.text1 && (
                  <RNText style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 }}>
                    {props.text1}
                  </RNText>
                )}
                {props.text2 && (
                  <RNText style={{ fontSize: 16, fontWeight: '500', color: '#fef2f2' }}>
                    {props.text2}
                  </RNText>
                )}
              </View>
            ),
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

type TabIconName = 'pomodoro' | 'chat' | 'settings' | 'profile'
type FeatherIconName = React.ComponentProps<typeof Feather>['name']

const TAB_ICON_MAP: Record<TabIconName, FeatherIconName> = {
  pomodoro: 'clock',
  chat: 'message-circle',
  settings: 'settings',
  profile: 'user',
}

const TabIcon = ({
  name,
  color,
  focused,
}: {
  name: TabIconName
  color: string
  focused: boolean
}) => {
  const avatarUrl = useAuthStore((state) => state.user?.avatarUrl)

  if (name === 'profile' && avatarUrl) {
    const AVATAR_SIZE = 28

    return (
      <View
        style={{
          width: AVATAR_SIZE + 6,
          height: AVATAR_SIZE + 6,
          borderRadius: (AVATAR_SIZE + 6) / 2,
          borderWidth: focused ? 2 : 1,
          borderColor: color,
          padding: 2,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
        }}
      >
        <Image
          source={{ uri: avatarUrl }}
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
          }}
        />
      </View>
    )
  }

  const iconName = TAB_ICON_MAP[name]

  return <Feather name={iconName} size={24} color={color} />
}
