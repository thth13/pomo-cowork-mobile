import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTimerStore } from '@/stores/useTimerStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { getTheme } from '@/config/theme'

type TimerField = 'workDuration' | 'shortBreak' | 'longBreak' | 'longBreakAfter'

type FormState = Record<TimerField, string>

const STORAGE_KEY = 'timer_settings'

const MIN_DURATION_MINUTES = 1
const MIN_LONG_BREAK_AFTER = 1

function sanitizeNumberInput(value: string) {
  return value.replace(/[^0-9]/g, '')
}

function parseTimerValues(state: FormState) {
  const entries = Object.entries(state).map(([field, raw]) => {
    if (!raw) {
      return [field, NaN]
    }
    const parsed = Number(raw)
    return [field, Number.isFinite(parsed) ? parsed : NaN]
  }) as [TimerField, number][]

  return Object.fromEntries(entries) as Record<TimerField, number>
}

export default function SettingsScreen() {
  const {
    workDuration,
    shortBreak,
    longBreak,
    longBreakAfter,
    autoStartNextSession,
    setTimerSettings,
    setAutoStartNextSession,
  } = useTimerStore((state) => ({
    workDuration: state.workDuration,
    shortBreak: state.shortBreak,
    longBreak: state.longBreak,
    longBreakAfter: state.longBreakAfter,
    autoStartNextSession: state.autoStartNextSession,
    setTimerSettings: state.setTimerSettings,
    setAutoStartNextSession: state.setAutoStartNextSession,
  }))
  const { user, updateUserSettings } = useAuthStore((state) => ({
    user: state.user,
    updateUserSettings: state.updateUserSettings,
  }))
  const { theme, toggleTheme } = useThemeStore()
  const colors = getTheme(theme)

  const [formState, setFormState] = useState<FormState>({
    workDuration: String(workDuration),
    shortBreak: String(shortBreak),
    longBreak: String(longBreak),
    longBreakAfter: String(longBreakAfter),
  })
  const [autoStart, setAutoStart] = useState<boolean>(autoStartNextSession)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setFormState({
      workDuration: String(workDuration),
      shortBreak: String(shortBreak),
      longBreak: String(longBreak),
      longBreakAfter: String(longBreakAfter),
    })
  }, [workDuration, shortBreak, longBreak, longBreakAfter])

  useEffect(() => {
    setAutoStart(autoStartNextSession)
  }, [autoStartNextSession])

  useEffect(() => {
    if (!user?.settings) {
      return
    }

    const {
      workDuration: storedWork,
      shortBreak: storedShort,
      longBreak: storedLong,
      longBreakAfter: storedLongAfter,
    } = user.settings

    setFormState({
      workDuration: String(storedWork),
      shortBreak: String(storedShort),
      longBreak: String(storedLong),
      longBreakAfter: String(storedLongAfter),
    })
  }, [user?.settings])

  const parsedValues = useMemo(() => parseTimerValues(formState), [formState])

  const isValid = useMemo(() => {
    return (
      parsedValues.workDuration >= MIN_DURATION_MINUTES &&
      parsedValues.shortBreak >= MIN_DURATION_MINUTES &&
      parsedValues.longBreak >= MIN_DURATION_MINUTES &&
      parsedValues.longBreakAfter >= MIN_LONG_BREAK_AFTER &&
      Object.values(parsedValues).every((value) => Number.isFinite(value))
    )
  }, [parsedValues])

  const isDirty = useMemo(() => {
    if (autoStart !== autoStartNextSession) {
      return true
    }

    return (
      parsedValues.workDuration !== workDuration ||
      parsedValues.shortBreak !== shortBreak ||
      parsedValues.longBreak !== longBreak ||
      parsedValues.longBreakAfter !== longBreakAfter
    )
  }, [
    autoStart,
    autoStartNextSession,
    parsedValues.longBreak,
    parsedValues.longBreakAfter,
    parsedValues.shortBreak,
    parsedValues.workDuration,
    longBreak,
    longBreakAfter,
    shortBreak,
    workDuration,
  ])

  const handleChange = useCallback((field: TimerField, value: string) => {
    setError(null)
    setSuccess(null)
    setFormState((prev) => ({
      ...prev,
      [field]: sanitizeNumberInput(value),
    }))
  }, [])

  const handleToggleAutoStart = (value: boolean) => {
    setError(null)
    setSuccess(null)
    setAutoStart(value)
  }

  const handleReset = () => {
    setFormState({
      workDuration: String(workDuration),
      shortBreak: String(shortBreak),
      longBreak: String(longBreak),
      longBreakAfter: String(longBreakAfter),
    })
    setAutoStart(autoStartNextSession)
    setError(null)
    setSuccess(null)
  }

  const handleSave = async () => {
    if (!isValid) {
      setError('Please enter valid values (minimum 1 minute).')
      setSuccess(null)
      return
    }

    if (!isDirty) {
      setSuccess('Settings already up to date.')
      setError(null)
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      setTimerSettings({
        workDuration: parsedValues.workDuration,
        shortBreak: parsedValues.shortBreak,
        longBreak: parsedValues.longBreak,
        longBreakAfter: parsedValues.longBreakAfter,
      })

      setAutoStartNextSession(autoStart)

      if (user) {
        updateUserSettings({
          workDuration: parsedValues.workDuration,
          shortBreak: parsedValues.shortBreak,
          longBreak: parsedValues.longBreak,
          longBreakAfter: parsedValues.longBreakAfter,
        })
      }

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          workDuration: parsedValues.workDuration,
          shortBreak: parsedValues.shortBreak,
          longBreak: parsedValues.longBreak,
          longBreakAfter: parsedValues.longBreakAfter,
          autoStartNextSession: autoStart,
        })
      )

      setSuccess('Settings saved successfully.')
    } catch (err) {
      console.warn('Failed to save timer settings', err)
      setError('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Timer settings</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Adjust durations in minutes for each session type
        </Text>
      </View>

      {(error || success) && (
        <View style={[styles.feedback, error ? styles.feedbackError : styles.feedbackSuccess]}>
          <Text style={error ? styles.feedbackErrorText : styles.feedbackSuccessText}>
            {error ?? success}
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingInput
          label="Focus length"
          value={formState.workDuration}
          onChangeText={(value) => handleChange('workDuration', value)}
          colors={colors}
        />
        <SettingInput
          label="Short break"
          value={formState.shortBreak}
          onChangeText={(value) => handleChange('shortBreak', value)}
          colors={colors}
        />
        <SettingInput
          label="Long break"
          value={formState.longBreak}
          onChangeText={(value) => handleChange('longBreak', value)}
          colors={colors}
        />
        <SettingInput
          label="Long break after"
          caption="Number of focus sessions before a long break"
          value={formState.longBreakAfter}
          onChangeText={(value) => handleChange('longBreakAfter', value)}
          colors={colors}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleHeader}>
            <Text style={[styles.toggleTitle, { color: colors.text }]}>Dark theme</Text>
            <Text style={[styles.toggleCaption, { color: colors.textSecondary }]}>
              Switch between light and dark themes
            </Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.info }}
            thumbColor={theme === 'dark' ? colors.infoLight : '#f8fafc'}
            ios_backgroundColor={colors.border}
            style={styles.toggleSwitch}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleHeader}>
            <Text style={[styles.toggleTitle, { color: colors.text }]}>Auto start</Text>
            <Text style={[styles.toggleCaption, { color: colors.textSecondary }]}>
              Automatically begin the next session when the current one ends.
            </Text>
          </View>
          <Switch
            value={autoStart}
            onValueChange={handleToggleAutoStart}
            trackColor={{ false: colors.border, true: colors.success }}
            thumbColor={autoStart ? colors.successDark : '#f8fafc'}
            ios_backgroundColor={colors.border}
            style={styles.toggleSwitch}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleReset}
          style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.8}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary },
            (!isDirty || !isValid || isSaving) && { backgroundColor: colors.primaryLight },
          ]}
          disabled={!isDirty || !isValid || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Save changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function SettingInput({
  label,
  caption,
  value,
  onChangeText,
  colors,
}: {
  label: string
  caption?: string
  value: string
  onChangeText: (value: string) => void
  colors: ReturnType<typeof getTheme>
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: colors.text }]}>{label}</Text>
      {caption ? <Text style={[styles.inputCaption, { color: colors.textSecondary }]}>{caption}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.textPlaceholder}
        style={[styles.input, { 
          borderColor: colors.inputBorder, 
          backgroundColor: colors.inputBackground,
          color: colors.text,
        }]}
        maxLength={3}
        returnKeyType="done"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
  },
  feedback: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  feedbackError: {
    backgroundColor: '#fee2e2',
  },
  feedbackSuccess: {
    backgroundColor: '#dcfce7',
  },
  feedbackErrorText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackSuccessText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputCaption: {
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleHeader: {
    flex: 1,
    marginBottom: 0,
    paddingRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  toggleCaption: {
    fontSize: 13,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  toggleSwitch: {
    transform: [{ scale: 0.8 }],
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginLeft: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
})
