import React from 'react'
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import PomodoroTimer from '@/components/PomodoroTimer'
import { useTimerStore } from '@/stores/useTimerStore'
import { useAuthStore } from '@/stores/useAuthStore'
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
  const [taskModalVisible, setTaskModalVisible] = React.useState(false)
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
      return []
    }

    try {
      const resolvedToken = await resolveToken()
      if (!resolvedToken) {
        setTaskOptions([])
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
        return normalized
      } else {
        setTaskOptions([])
        return []
      }
    } catch (error) {
      console.error('Failed to load tasks for selector:', error)
      setTaskOptions([])
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
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: listBottomPadding, paddingTop: 16 },
        ]}
        showsVerticalScrollIndicator
      >
        <View style={styles.timerSection}>
          <View style={styles.taskSelectorContainer}>
            <Text style={styles.sectionLabel}>Task</Text>
            <TouchableOpacity
              onPress={handleOpenTaskModal}
              disabled={isRunning}
              style={[
                styles.taskSelectorButton,
                isRunning && styles.taskSelectorButtonDisabled,
              ]}
              activeOpacity={isRunning ? 1 : 0.7}
            >
              <Text style={styles.taskSelectorValue} numberOfLines={1}>
                {selectedTask ? selectedTask.title : 'Not selected'}
              </Text>
              <Text style={styles.taskSelectorCaret}>{isRunning ? '—' : '⌄'}</Text>
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
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
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
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  taskSelectorButtonDisabled: {
    opacity: 0.6,
  },
  taskSelectorValue: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },
  taskSelectorCaret: {
    fontSize: 16,
    color: '#94a3b8',
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
