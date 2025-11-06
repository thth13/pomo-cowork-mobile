import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from './stores/useAuthStore'

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

  useEffect(() => {
    checkAuth()
  }, [])

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
  focused: _focused,
}: {
  name: TabIconName
  color: string
  focused: boolean
}) => {
  const iconName = TAB_ICON_MAP[name]

  return <Feather name={iconName} size={24} color={color} />
}
