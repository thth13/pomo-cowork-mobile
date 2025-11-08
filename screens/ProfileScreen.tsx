import React, { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Keyboard,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Notifications from 'expo-notifications'
import { useNavigation } from '@react-navigation/native'
import type { NavigationProp } from '@react-navigation/native'
import Toast from 'react-native-toast-message'

import { useAuthStore } from '@/stores/useAuthStore'
import { useTimerStore } from '@/stores/useTimerStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { getTheme } from '@/config/theme'
import { API_URL } from '@/config/constants'
import type { UserSettings } from '@/types'

const DEFAULT_SETTINGS: UserSettings = {
  id: '',
  userId: '',
  workDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  longBreakAfter: 4,
  soundEnabled: true,
  soundVolume: 0.5,
  notificationsEnabled: true,
}

let notificationHandlerConfigured = false

const PROFILE_SAVE_SUCCESS_MESSAGE = 'Profile updated successfully.'

type RootTabParamList = {
  Pomodoro: undefined
  Chat: undefined
  Settings: undefined
  Profile: undefined
}

function ensureNotificationHandler() {
  if (notificationHandlerConfigured) {
    return
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })

  notificationHandlerConfigured = true
}

export default function ProfileScreen() {
  ensureNotificationHandler()

  const navigation = useNavigation<NavigationProp<RootTabParamList>>()
  const showProfileSaveToast = (message: string, type: 'success' | 'error' = 'success') => {
    Toast.show({
      type,
      text1: type === 'success' ? 'Success' : 'Error',
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    })
  }
  const {
    user,
    token,
    isAuthenticated,
    logout,
    login,
    register,
    isLoading: authLoading,
  } = useAuthStore((state) => ({
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    logout: state.logout,
    login: state.login,
    register: state.register,
  }))
  const { setTimerSettings } = useTimerStore((state) => ({
    setTimerSettings: state.setTimerSettings,
  }))
  const theme = useThemeStore((state) => state.theme)
  const colors = getTheme(theme)

  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    description: '',
  })
  const [settingsState, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarAsset, setAvatarAsset] = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
  })
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)

  useEffect(() => {
    if (!user) {
      return
    }

    const nextSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      ...user.settings,
      id: user.settings?.id ?? user.id ?? '',
      userId: user.settings?.userId ?? user.id ?? '',
    }

    setProfileForm({
      username: user.username ?? '',
      email: user.email ?? '',
      description: user.description ?? '',
    })
    setSettingsState(nextSettings)
    setAvatarPreview(user.avatarUrl ?? null)
    setAvatarAsset(null)
    setSaveFeedback(null)
  }, [user])

  const baseProfile = useMemo(
    () => ({
      username: user?.username ?? '',
      email: user?.email ?? '',
      description: user?.description ?? '',
    }),
    [user?.username, user?.email, user?.description]
  )

  const baseSettings = useMemo<UserSettings>(
    () => ({
      ...DEFAULT_SETTINGS,
      ...user?.settings,
      id: user?.settings?.id ?? user?.id ?? '',
      userId: user?.settings?.userId ?? user?.id ?? '',
    }),
    [user?.settings, user?.id]
  )

  const isProfileDirty =
    profileForm.username !== baseProfile.username ||
    profileForm.email !== baseProfile.email ||
    profileForm.description !== baseProfile.description

  const isSettingsDirty =
    settingsState.workDuration !== baseSettings.workDuration ||
    settingsState.shortBreak !== baseSettings.shortBreak ||
    settingsState.longBreak !== baseSettings.longBreak ||
    settingsState.longBreakAfter !== baseSettings.longBreakAfter ||
    settingsState.soundEnabled !== baseSettings.soundEnabled ||
    settingsState.soundVolume !== baseSettings.soundVolume ||
    settingsState.notificationsEnabled !== baseSettings.notificationsEnabled

  const canSave = isProfileDirty || isSettingsDirty || Boolean(avatarAsset)

  const handleProfileChange = (field: keyof typeof profileForm, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }))
    setSaveFeedback(null)
  }

  const handleToggleSetting = (field: 'soundEnabled' | 'notificationsEnabled', value: boolean) => {
    setSettingsState((prev) => ({
      ...prev,
      [field]: value,
    }))
    setSaveFeedback(null)
    setTestMessage(null)
  }

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      showProfileSaveToast('Allow photo access to update your avatar.', 'error')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (result.canceled || !result.assets?.length) {
      return
    }

    const asset = result.assets[0]
    setAvatarAsset(asset)
    setAvatarPreview(asset.uri)
    setSaveFeedback(null)
  }

  const handleTestNotification = async () => {
    setTestMessage(null)

    if (!settingsState.notificationsEnabled) {
      setTestMessage('Enable notifications toggle first.')
      return
    }

    try {
      const currentPermission = await Notifications.getPermissionsAsync()
      let granted = currentPermission.granted

      if (!granted) {
        const request = await Notifications.requestPermissionsAsync()
        granted = request.granted
      }

      if (!granted) {
        setTestMessage('Allow notifications in system settings.')
        return
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test notification',
          body: 'Push notifications are good to go!',
        },
        trigger: null,
      })

      setTestMessage('Notification sent.')
    } catch (error) {
      console.warn('Failed to send notification', error)
      setTestMessage('Failed to send notification.')
    } finally {
      setTimeout(() => setTestMessage(null), 4000)
    }
  }

  const handleSave = async () => {
    if (!user || !token) {
      showProfileSaveToast('Please log in to update profile data.', 'error')
      return
    }

    setIsSaving(true)
    setSaveFeedback(null)

    try {
      let nextAvatar = user.avatarUrl ?? null

      if (avatarAsset) {
        const formData = new FormData()
        formData.append('avatar', {
          uri: avatarAsset.uri,
          name: avatarAsset.fileName ?? `avatar-${Date.now()}.jpg`,
          type: avatarAsset.mimeType ?? 'image/jpeg',
        } as any)

        const uploadResponse = await fetch(`${API_URL}/api/upload/avatar`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error('Не удалось загрузить аватар')
        }

        const uploadData = await uploadResponse.json()
        nextAvatar = uploadData.avatarUrl ?? nextAvatar
      }

      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...settingsState,
          username: profileForm.username.trim(),
          email: profileForm.email.trim(),
          description: profileForm.description.trim(),
          avatarUrl: nextAvatar,
        }),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(errorPayload?.error ?? 'Failed to save profile')
      }

      const updatedUser = await response.json()

      setTimerSettings({
        workDuration: settingsState.workDuration,
        shortBreak: settingsState.shortBreak,
        longBreak: settingsState.longBreak,
        longBreakAfter: settingsState.longBreakAfter,
      })

      useAuthStore.setState((state) => {
        if (!state.user) {
          return state
        }

        return {
          ...state,
          user: {
            ...state.user,
            ...updatedUser,
            avatarUrl: nextAvatar ?? state.user.avatarUrl,
            settings: {
              ...(state.user.settings ?? DEFAULT_SETTINGS),
              ...settingsState,
            },
          },
        }
      })

      setAvatarAsset(null)
      showProfileSaveToast(PROFILE_SAVE_SUCCESS_MESSAGE)
      navigation.navigate('Pomodoro')
    } catch (error) {
      console.error('Failed to save profile:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save profile.'
      showProfileSaveToast(errorMessage, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAuthChange =
    (field: 'email' | 'username' | 'password') =>
    (value: string) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
      if (authError) {
        setAuthError('')
      }
    }

  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      password: '',
    })
    setShowPassword(false)
  }

  const handleAuthSubmit = async () => {
    if (authSubmitting) {
      return
    }

    setAuthError('')
    setAuthSubmitting(true)

    try {
      let success = false

      if (isLogin) {
        success = await login(formData.email.trim(), formData.password)
        if (!success) {
          setAuthError('Invalid email or password')
        }
      } else {
        if (!formData.username.trim()) {
          setAuthError('Username is required')
          setAuthSubmitting(false)
          return
        }

        success = await register(formData.email.trim(), formData.username.trim(), formData.password)

        if (!success) {
          setAuthError('Registration error. Please try again.')
        }
      }

      if (success) {
        resetForm()
        navigation.navigate('Pomodoro')
      }
    } catch (err) {
      setAuthError('An error occurred. Please try again.')
    } finally {
      setAuthSubmitting(false)
    }
  }

  const toggleAuthMode = () => {
    setIsLogin((prev) => !prev)
    setAuthError('')
    resetForm()
  }

  if (!isAuthenticated || !user) {
    return (
      <KeyboardAvoidingView
        style={styles.authContainer}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled">
          <View style={styles.authCard}>
            <Text style={styles.authTitle}>{isLogin ? 'Login' : 'Registration'}</Text>

            <View style={styles.authToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
                onPress={() => {
                  if (!isLogin) toggleAuthMode()
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleButtonText, isLogin && styles.toggleButtonTextActive]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
                onPress={() => {
                  if (isLogin) toggleAuthMode()
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.toggleButtonText, !isLogin && styles.toggleButtonTextActive]}
                >
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <Feather name="mail" size={20} color="#94a3b8" style={styles.authInputIcon} />
                <TextInput
                  value={formData.email}
                  onChangeText={handleAuthChange('email')}
                  style={[styles.authInput, styles.authInputWithIcon]}
                  placeholder="your@email.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  editable={!authSubmitting}
                />
              </View>
            </View>

            {!isLogin && (
              <View style={styles.formField}>
                <Text style={styles.label}>Username</Text>
                <View style={styles.inputWrapper}>
                  <Feather name="user" size={20} color="#94a3b8" style={styles.authInputIcon} />
                  <TextInput
                    value={formData.username}
                    onChangeText={handleAuthChange('username')}
                    style={[styles.authInput, styles.authInputWithIcon]}
                    placeholder="Your name"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    editable={!authSubmitting}
                  />
                </View>
              </View>
            )}

            <View style={styles.formField}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={20} color="#94a3b8" style={styles.authInputIcon} />
                <TextInput
                  value={formData.password}
                  onChangeText={handleAuthChange('password')}
                  style={[styles.authInput, styles.authInputWithIcon, styles.authPasswordInput]}
                  placeholder="Your password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={handleAuthSubmit}
                  editable={!authSubmitting}
                />
                <TouchableOpacity
                  style={styles.authPasswordToggle}
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              {!isLogin && <Text style={styles.passwordHint}>Minimum 6 characters</Text>}
            </View>

            {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, authSubmitting && styles.submitButtonDisabled]}
              onPress={handleAuthSubmit}
              disabled={authSubmitting}
              activeOpacity={0.8}
            >
              {authSubmitting ? (
                <View style={styles.loadingContent}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={[styles.submitButtonText, styles.loadingText]}>Loading...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>{isLogin ? 'Login' : 'Register'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  const canGoBack = navigation.canGoBack()

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.profileContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.topBar}>
        <TouchableOpacity
          style={[
            styles.iconButton,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
            !canGoBack && styles.iconButtonDisabled,
          ]}
          onPress={() => {
            if (canGoBack) {
              navigation.goBack()
            }
          }}
          disabled={!canGoBack}
          activeOpacity={0.85}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Feather name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.contentStack}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
          </View>

          <View style={styles.avatarBlock}>
            <View style={styles.avatarWrapper}>
              {avatarPreview ? (
                <Image source={{ uri: avatarPreview }} style={styles.avatarImage} />
              ) : (
                <View
                  style={[
                    styles.avatarImage,
                    styles.avatarPlaceholder,
                    { backgroundColor: theme === 'dark' ? colors.errorLight : '#fee2e2' },
                  ]}
                >
                  <Text style={[styles.avatarPlaceholderText, { color: colors.error }]}>
                    {user.username?.charAt(0).toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.avatarFab}
                onPress={handlePickAvatar}
                activeOpacity={0.85}
              >
                <Feather name="camera" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputStack}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Username</Text>
              <TextInput
                value={profileForm.username}
                onChangeText={(value) => handleProfileChange('username', value)}
                placeholder="Your username"
                placeholderTextColor={colors.textPlaceholder}
                style={[
                  styles.fieldInput,
                  {
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                  },
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
              <TextInput
                value={profileForm.email}
                onChangeText={(value) => handleProfileChange('email', value)}
                placeholder="your@email.com"
                placeholderTextColor={colors.textPlaceholder}
                style={[
                  styles.fieldInput,
                  {
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                  },
                ]}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Description</Text>
              <TextInput
                value={profileForm.description}
                onChangeText={(value) => handleProfileChange('description', value)}
                placeholder="Tell us about yourself..."
                placeholderTextColor={colors.textPlaceholder}
                style={[
                  styles.fieldInput,
                  styles.textArea,
                  {
                    borderColor: colors.inputBorder,
                    backgroundColor: colors.inputBackground,
                    color: colors.text,
                  },
                ]}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.preferenceHeader}>
            <View
              style={[
                styles.preferenceIcon,
                { backgroundColor: theme === 'dark' ? colors.errorLight : '#fee2e2' },
              ]}
            >
              <Feather name="bell" size={18} color={colors.primary} />
            </View>
            <View style={styles.preferenceText}>
              <Text style={[styles.preferenceTitle, { color: colors.text }]}>Notifications</Text>
              <Text style={[styles.preferenceSubtitle, { color: colors.textSecondary }]}>
                Heads-up alerts when sessions flip.
              </Text>
            </View>
            <Switch
              value={settingsState.notificationsEnabled}
              onValueChange={(value) => handleToggleSetting('notificationsEnabled', value)}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={settingsState.notificationsEnabled ? colors.successDark : '#f8fafc'}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryGhostButton, { borderColor: colors.border }]}
            onPress={handleTestNotification}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryGhostText, { color: colors.primary }]}>Test notification</Text>
          </TouchableOpacity>
          {testMessage ? (
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>{testMessage}</Text>
          ) : null}
        </View>

        <View
          style={[styles.card, styles.syncCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sync changes</Text>
          <Text style={[styles.sectionCaption, { color: colors.textSecondary }]}>
            Saving pushes updates to any active sessions you have open.
          </Text>
          {saveFeedback ? (
            <Text
              style={[
                styles.feedbackText,
                saveFeedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess,
              ]}
            >
              {saveFeedback.message}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary },
              (!canSave || isSaving) && { backgroundColor: colors.primaryLight },
            ]}
            onPress={handleSave}
            disabled={!canSave || isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="save" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Save profile</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.85}>
            <Feather name="log-out" size={16} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileContent: {
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contentStack: {
    paddingHorizontal: 16,
    gap: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconButtonDisabled: {
    opacity: 0.4,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  syncCard: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionCaption: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    width: 108,
    height: 108,
    borderRadius: 999,
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 32,
    fontWeight: '700',
  },
  avatarFab: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  inputStack: {
    gap: 16,
  },
  fieldGroup: {
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  preferenceIcon: {
    width: 44,
    height: 44,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceText: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  preferenceSubtitle: {
    fontSize: 13,
  },
  primaryGhostButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  primaryGhostText: {
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackError: {
    color: '#b91c1c',
  },
  feedbackSuccess: {
    color: '#047857',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  logoutText: {
    fontWeight: '600',
    fontSize: 14,
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  authToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleButtonTextActive: {
    color: '#ef4444',
  },
  formField: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  authInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  authInputWithIcon: {
    paddingLeft: 44,
  },
  authPasswordInput: {
    paddingRight: 44,
  },
  authInputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  authPasswordToggle: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  passwordHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#94a3b8',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  submitButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContent: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
  },
})
