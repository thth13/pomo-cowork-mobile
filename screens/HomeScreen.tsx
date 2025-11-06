import React from 'react'
import { View, StyleSheet, Text, TouchableOpacity, Modal, FlatList, ListRenderItemInfo, ActivityIndicator, TouchableWithoutFeedback, ScrollView } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import PomodoroTimer from '@/components/PomodoroTimer'
import { useTimerStore } from '@/stores/useTimerStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { API_URL } from '@/config/constants'
import { Task } from '@/types'
import { ActiveSessions } from '@/components/ActiveSessions'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import TaskList, { TaskListRef } from '@/components/TaskList'

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
  const { user } = useAuthStore()
  const [taskModalVisible, setTaskModalVisible] = React.useState(false)
  const [isLoadingTasks, setIsLoadingTasks] = React.useState(false)
  const insets = useSafeAreaInsets()
  const taskListRef = React.useRef<TaskListRef>(null)

  const bottomInset = React.useMemo(() => Math.max(insets.bottom, 16), [insets.bottom])
  const listBottomPadding = React.useMemo(
    () => TAB_BAR_HEIGHT + bottomInset,
    [bottomInset]
  )

  const loadTasks = React.useCallback(async () => {
    if (!user) {
      setTaskOptions([])
      return
    }

    setIsLoadingTasks(true)
    try {
      const token = await AsyncStorage.getItem('token')
      if (!token) {
        setTaskOptions([])
        return
      }

      const response = await fetch(`${API_URL}/api/tasks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data: Task[] = await response.json()
        setTaskOptions(
          data.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
          }))
        )
      } else {
        setTaskOptions([])
      }
    } catch (error) {
      console.error('Failed to load tasks for selector:', error)
      setTaskOptions([])
    } finally {
      setIsLoadingTasks(false)
    }
  }, [setTaskOptions, user])

  React.useEffect(() => {
    loadTasks()
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
    await taskListRef.current?.refreshTasks()
  }, [loadTasks])

  const handleOpenTaskModal = () => {
    if (isRunning) return
    setTaskModalVisible(true)
  }

  const handleSelectTask = (taskId: string | null) => {
    if (taskId === null) {
      setSelectedTask(null)
    } else {
      const task = taskOptions.find((option) => option.id === taskId)
      if (task) {
        setSelectedTask({
          id: task.id,
          title: task.title,
          description: task.description,
        })
      }
    }
    setTaskModalVisible(false)
  }

  const renderTaskOption = ({
    item,
  }: ListRenderItemInfo<{ id: string; title: string }>) => {
    const isActive = selectedTask?.id === item.id

    return (
      <TouchableOpacity
        style={[styles.taskOption, isActive && styles.taskOptionActive]}
        onPress={() => handleSelectTask(item.id)}
      >
        <Text style={styles.taskOptionText}>{item.title}</Text>
      </TouchableOpacity>
    )
  }

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
            <Text style={styles.sectionLabel}>My Tasks</Text>
            <TouchableOpacity
              style={[
                styles.taskSelector,
                isRunning && styles.taskSelectorDisabled,
              ]}
              onPress={handleOpenTaskModal}
              activeOpacity={isRunning ? 1 : 0.7}
            >
              <Text style={styles.taskSelectorText}>
                {selectedTask ? selectedTask.title : 'Select a task'}
              </Text>
              <Text style={styles.taskSelectorCaret}>{isRunning ? '—' : '⌄'}</Text>
            </TouchableOpacity>
          </View>

          <PomodoroTimer onSessionComplete={handleSessionComplete} />
        </View>

        <View style={styles.sessionsWrapper}>
          <ActiveSessions sessions={activeSessions} currentUserId={user?.id} />
        </View>

        <View style={styles.taskListWrapper}>
          <TaskList ref={taskListRef} />
        </View>
      </ScrollView>

      <Modal
        visible={taskModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTaskModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setTaskModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Task</Text>
                <TouchableOpacity
                  style={styles.taskOption}
                  onPress={() => handleSelectTask(null)}
                >
                  <Text style={styles.taskOptionText}>No task</Text>
                </TouchableOpacity>
                {isLoadingTasks ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <FlatList
                    data={taskOptions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderTaskOption}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    keyboardShouldPersistTaps="handled"
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
  },
  taskSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
  },
  taskSelectorDisabled: {
    opacity: 0.6,
  },
  taskSelectorText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
  },
  taskSelectorCaret: {
    fontSize: 14,
    color: '#94a3b8',
  },
  sessionsWrapper: {
    marginBottom: 0,
  },
  taskListWrapper: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  taskOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  taskOptionActive: {
    backgroundColor: '#fee2e2',
  },
  taskOptionText: {
    fontSize: 16,
    color: '#1f2937',
  },
  separator: {
    height: 8,
  },
})
