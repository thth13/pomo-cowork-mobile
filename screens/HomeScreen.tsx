import React from 'react'
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import PomodoroTimer from '@/components/PomodoroTimer'
import { useTimerStore } from '@/stores/useTimerStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { getTheme } from '@/config/theme'
import { API_URL } from '@/config/constants'
import { Task } from '@/types'
import { ActiveSessions } from '@/components/ActiveSessions'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import TaskManagementModal from '@/components/TaskManagementModal'

const TAB_BAR_HEIGHT = 60

export default function HomeScreen() {
  const {
    activeSessions,
    selectedTask,
    setSelectedTask,
    setTaskOptions,
    taskOptions,
    isRunning,
  } = useTimerStore()
  const { user, token } = useAuthStore()
  const theme = useThemeStore((state) => state.theme)
  const colors = getTheme(theme)
  const [taskModalVisible, setTaskModalVisible] = React.useState(false)
  const [cachedTasks, setCachedTasks] = React.useState<Task[]>([])
  const insets = useSafeAreaInsets()

  const bottomInset = React.useMemo(() => Math.max(insets.bottom, 16), [insets.bottom])
  const listBottomPadding = React.useMemo(
    () => TAB_BAR_HEIGHT + bottomInset,
    [bottomInset]
  )

  const resolveToken = React.useCallback(async () => {
    if (token) {
      return token
    }
    const storedToken = await AsyncStorage.getItem('auth_token')
    return storedToken
  }, [token])

  const loadTasks = React.useCallback(async (): Promise<Task[]> => {
    if (!user) {
      setTaskOptions([])
      setCachedTasks([])
      return []
    }

    try {
      const resolvedToken = await resolveToken()
      if (!resolvedToken) {
        setTaskOptions([])
        setCachedTasks([])
        return []
      }

      const response = await fetch(`${API_URL}/api/tasks`, {
        headers: {
          Authorization: `Bearer ${resolvedToken}`,
        },
      })

      if (response.ok) {
        const data: Task[] = await response.json()
        const normalized = data.map((task) => ({
          ...task,
          description: task.description ?? '',
          completed: task.completed ?? false,
          priority: task.priority ?? 'Medium',
          pomodoros: task.pomodoros ?? 0,
          completedPomodoros: task.completedPomodoros ?? 0,
        }))
        setTaskOptions(
          normalized.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            completed: task.completed,
            priority: task.priority,
            pomodoros: task.pomodoros,
            completedPomodoros: task.completedPomodoros,
          }))
        )
        setCachedTasks(normalized)
        return normalized
      } else {
        setTaskOptions([])
        setCachedTasks([])
        return []
      }
    } catch (error) {
      console.error('Failed to load tasks for selector:', error)
      setTaskOptions([])
      setCachedTasks([])
      return []
    }
  }, [resolveToken, setTaskOptions, user])

  React.useEffect(() => {
    void loadTasks()
  }, [loadTasks])

  React.useEffect(() => {
    if (!user) {
      setSelectedTask(null)
    }
  }, [setSelectedTask, user])

  React.useEffect(() => {
    if (
      selectedTask &&
      !taskOptions.some((option) => option.id === selectedTask.id)
    ) {
      setSelectedTask(null)
    }
  }, [selectedTask, setSelectedTask, taskOptions])

  const handleSessionComplete = React.useCallback(async () => {
    await loadTasks()
  }, [loadTasks])

  const handleOpenTaskModal = () => {
    if (isRunning) return
    void loadTasks()
    setTaskModalVisible(true)
  }

  const handleSelectTask = React.useCallback((task: Task | null) => {
    if (!task) {
      setSelectedTask(null)
      return
    }

    setSelectedTask({
      id: task.id,
      title: task.title,
      description: task.description,
    })
  }, [setSelectedTask])

  const handleModalSelectTask = React.useCallback(
    (task: Task | null) => {
      handleSelectTask(task)
    },
    [handleSelectTask]
  )

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: listBottomPadding, paddingTop: 16 },
        ]}
        showsVerticalScrollIndicator
      >
        <View style={styles.timerSection}>
          <View style={[
            styles.taskSelectorContainer,
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Task</Text>
            <TouchableOpacity
              onPress={handleOpenTaskModal}
              disabled={isRunning}
              style={[
                styles.taskSelectorButton,
                { 
                  borderColor: colors.inputBorder, 
                  backgroundColor: colors.inputBackground 
                },
                isRunning && styles.taskSelectorButtonDisabled,
              ]}
              activeOpacity={isRunning ? 1 : 0.7}
            >
              <Text style={[styles.taskSelectorValue, { color: colors.text }]} numberOfLines={1}>
                {selectedTask ? selectedTask.title : 'Not selected'}
              </Text>
              <Text style={[styles.taskSelectorCaret, { color: colors.textTertiary }]}>
                {isRunning ? '—' : '⌄'}
              </Text>
            </TouchableOpacity>

          </View>

          <PomodoroTimer onSessionComplete={handleSessionComplete} />
        </View>

        <View style={styles.sessionsWrapper}>
          <ActiveSessions sessions={activeSessions} currentUserId={user?.id} />
        </View>

      </ScrollView>

      <TaskManagementModal
        visible={taskModalVisible}
        onClose={() => setTaskModalVisible(false)}
        selectedTaskId={selectedTask?.id ?? null}
        onSelectTask={handleModalSelectTask}
        resolveToken={resolveToken}
        loadTasks={loadTasks}
        user={user}
        isSelectionLocked={isRunning}
        prefetchedTasks={cachedTasks}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  timerSection: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  taskSelectorContainer: {
    width: '100%',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  taskSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  taskSelectorButtonDisabled: {
    opacity: 0.6,
  },
  taskSelectorValue: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  taskSelectorCaret: {
    fontSize: 16,
  },
  manageLink: {
    alignSelf: 'flex-start',
  },
  manageLinkText: {
    fontSize: 12,
    color: '#64748b',
  },
  manageLinkTextDisabled: {
    color: '#cbd5f5',
  },
  sessionsWrapper: {
    marginBottom: 0,
  },
})
