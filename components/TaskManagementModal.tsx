import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native'
import { Task, User } from '@/types'
import { API_URL } from '@/config/constants'

interface TaskManagementModalProps {
  visible: boolean
  onClose: () => void
  selectedTaskId: string | null
  onSelectTask: (task: Task | null) => void
  resolveToken: () => Promise<string | null>
  loadTasks: () => Promise<Task[]>
  user: User | null
  isSelectionLocked: boolean
  onTasksSynced?: () => Promise<void> | void
}

const priorityStyles = {
  Critical: {
    dot: '#ef4444',
  },
  High: {
    dot: '#f97316',
  },
  Medium: {
    dot: '#22c55e',
  },
  Low: {
    dot: '#3b82f6',
  },
} as const

const SKELETON_PLACEHOLDERS = [0, 1, 2, 3]

export function TaskManagementModal({
  visible,
  onClose,
  selectedTaskId,
  onSelectTask,
  resolveToken,
  loadTasks,
  user,
  isSelectionLocked,
  onTasksSynced,
}: TaskManagementModalProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isAuthenticated = Boolean(user)

  const syncTasks = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const loadedTasks = await loadTasks()
      setTasks(loadedTasks)
    } catch (error) {
      console.error('TaskManagementModal: failed to load tasks', error)
      setErrorMessage('Failed to load tasks. Please try again later.')
      setTasks([])
    } finally {
      setIsLoading(false)
    }
  }, [loadTasks])

  useEffect(() => {
    if (!visible) {
      return
    }
    syncTasks()
  }, [visible, syncTasks])

  const handleSelectTask = useCallback(
    (task: Task | null) => {
      if (isSelectionLocked) return
      onSelectTask(task)
      onClose()
    },
    [isSelectionLocked, onClose, onSelectTask]
  )

  const handleAddTask = useCallback(async () => {
    const trimmed = newTaskTitle.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const token = await resolveToken()
      if (!token) {
        setErrorMessage('Sign in to create tasks.')
        return
      }

      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: trimmed,
          description: '',
          pomodoros: 1,
          priority: 'Medium',
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.status}`)
      }

      const createdTask: Task = await response.json()
      setNewTaskTitle('')
      setTasks((prev) => [...prev, createdTask])
      await syncTasks()
      await onTasksSynced?.()
      handleSelectTask(createdTask)
    } catch (error) {
      console.error('TaskManagementModal: failed to create task', error)
      setErrorMessage('Failed to create a task. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [
    handleSelectTask,
    isSubmitting,
    newTaskTitle,
    onTasksSynced,
    resolveToken,
    syncTasks,
  ])

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (pendingDeleteId) return

      setPendingDeleteId(taskId)
      setErrorMessage(null)

      try {
        const token = await resolveToken()
        if (!token) {
          setErrorMessage('Sign in to delete tasks.')
          return
        }

        const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to delete task: ${response.status}`)
        }

        setTasks((prev) => prev.filter((task) => task.id !== taskId))
        if (selectedTaskId === taskId) {
          onSelectTask(null)
        }
        await syncTasks()
        await onTasksSynced?.()
      } catch (error) {
        console.error('TaskManagementModal: failed to delete task', error)
        setErrorMessage('Failed to delete the task. Please try again later.')
      } finally {
        setPendingDeleteId(null)
      }
    },
    [onSelectTask, onTasksSynced, pendingDeleteId, resolveToken, selectedTaskId, syncTasks]
  )

  const handleKeySubmit = useCallback(() => {
    if (newTaskTitle.trim() && !isSubmitting) {
      void handleAddTask()
    }
  }, [handleAddTask, isSubmitting, newTaskTitle])

  const taskOptions = useMemo<(Task | null)[]>(() => [null, ...tasks], [tasks])

  const renderTaskItem = useCallback(
    ({ item }: ListRenderItemInfo<Task | null>) => {
      if (!item) {
        const isActive = selectedTaskId === null
        return (
          <TouchableOpacity
            style={[
              styles.noTaskOption,
              isActive && styles.noTaskOptionActive,
              isSelectionLocked && styles.taskItemDisabled,
            ]}
            onPress={() => handleSelectTask(null)}
            disabled={isSelectionLocked}
            activeOpacity={isSelectionLocked ? 1 : 0.8}
          >
            <View style={styles.noTaskContent}>
              <View style={styles.noTaskTextGroup}>
                <Text style={[styles.noTaskTitle, isActive && styles.noTaskTitleActive]}>
                  No task selected
                </Text>
                <Text style={styles.noTaskDescription}>
                  Timer will run without task binding
                </Text>
              </View>
              {isActive && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )
      }

      const isActive = selectedTaskId === item.id
      const priority = priorityStyles[item.priority] ?? priorityStyles.Medium

      return (
        <TouchableOpacity
          style={[
            styles.taskItem,
            isActive && styles.taskItemActive,
            isSelectionLocked && styles.taskItemDisabled,
          ]}
          onPress={() => handleSelectTask(item)}
          disabled={isSelectionLocked}
          activeOpacity={isSelectionLocked ? 1 : 0.7}
        >
          <View style={styles.taskMain}>
            <View style={styles.taskInfo}>
              <View style={styles.taskTitleRow}>
                <Text
                  style={[styles.taskTitle, isActive && styles.taskTitleActive]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <View style={[styles.priorityDot, { backgroundColor: priority.dot }]} />
              </View>
              <Text style={styles.pomodoroStat}>
                Pomodoros: {item.completedPomodoros ?? 0}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteTask(item.id)}
            disabled={pendingDeleteId === item.id}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {pendingDeleteId === item.id ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <Text style={styles.deleteButtonText}>×</Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      )
    },
    [
      handleDeleteTask,
      handleSelectTask,
      isSelectionLocked,
      pendingDeleteId,
      selectedTaskId,
    ]
  )

  const emptyMessage = useMemo(() => {
    if (!isAuthenticated) {
      return 'Sign in to manage tasks.'
    }
    if (errorMessage) {
      return errorMessage
    }
    return 'No tasks yet. Add one above.'
  }, [errorMessage, isAuthenticated])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
              style={styles.keyboardAvoider}
            >
              <View style={styles.content}>
                <View style={styles.header}>
                  <Text style={styles.title}>My Tasks</Text>
                  <TouchableOpacity onPress={onClose}>
                    <Text style={styles.closeButton}>×</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="New task..."
                    value={newTaskTitle}
                    onChangeText={setNewTaskTitle}
                    editable={!isSubmitting}
                    returnKeyType="done"
                    onSubmitEditing={handleKeySubmit}
                  />
                  <TouchableOpacity
                    style={[
                      styles.addButton,
                      (!newTaskTitle.trim() || isSubmitting) && styles.addButtonDisabled,
                    ]}
                    onPress={() => void handleAddTask()}
                    disabled={!newTaskTitle.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.addButtonText}>+</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {errorMessage && isAuthenticated && !isLoading && (
                  <Text style={styles.errorText}>{errorMessage}</Text>
                )}

                {isLoading ? (
                  <View style={styles.skeletonList}>
                    {SKELETON_PLACEHOLDERS.map((placeholder) => (
                      <View key={`task-skeleton-${placeholder}`} style={styles.skeletonItem}>
                        <View style={styles.skeletonHeader}>
                          <View style={styles.skeletonTitle} />
                          <View style={styles.skeletonDot} />
                        </View>
                        <View style={styles.skeletonSubtitle} />
                      </View>
                    ))}
                  </View>
                ) : (
                  <>
                    <FlatList<Task | null>
                      data={taskOptions}
                      keyExtractor={(item, index) => item?.id ?? `no-task-${index}`}
                      renderItem={renderTaskItem}
                      contentContainerStyle={styles.list}
                      ItemSeparatorComponent={() => <View style={styles.separator} />}
                      keyboardShouldPersistTaps="handled"
                    />
                    {tasks.length === 0 && (
                      <Text style={styles.emptyText}>{emptyMessage}</Text>
                    )}
                  </>
                )}
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  keyboardAvoider: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  closeButton: {
    fontSize: 28,
    color: '#94a3b8',
    lineHeight: 28,
  },
  noTaskOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  noTaskOptionActive: {
    borderColor: '#60a5fa',
    backgroundColor: '#eff6ff',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  noTaskContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noTaskTextGroup: {
    flex: 1,
  },
  noTaskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  noTaskTitleActive: {
    color: '#1d4ed8',
  },
  noTaskDescription: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  activeBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#1d4ed8',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: '700',
  },
  skeletonList: {
    gap: 8,
  },
  skeletonItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  skeletonTitle: {
    width: '70%',
    height: 14,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  skeletonDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e2e8f0',
  },
  skeletonSubtitle: {
    width: '40%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
    paddingVertical: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
  },
  list: {
    paddingBottom: 4,
  },
  separator: {
    height: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  taskItemActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#e0f2fe',
  },
  taskItemDisabled: {
    opacity: 0.6,
  },
  taskMain: {
    flex: 1,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 6,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
    flexShrink: 1,
  },
  taskTitleActive: {
    color: '#1d4ed8',
  },
  pomodoroStat: {
    fontSize: 12,
    color: '#64748b',
  },
  deleteButton: {
    marginLeft: 12,
  },
  deleteButtonText: {
    fontSize: 24,
    color: '#ef4444',
    lineHeight: 24,
  },
})

export default TaskManagementModal
