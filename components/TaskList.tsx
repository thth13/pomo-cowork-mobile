import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native'
import { useTimerStore } from '@/stores/useTimerStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { Task } from '@/types'
import { API_URL } from '@/config/constants'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface TaskListRef {
  refreshTasks: () => Promise<void>
}

const TaskList = forwardRef<TaskListRef>((props, ref) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const { selectedTask, setSelectedTask, isRunning } = useTimerStore()
  const { user } = useAuthStore()

  useImperativeHandle(ref, () => ({
    refreshTasks: loadTasks
  }))

  useEffect(() => {
    if (user) {
      loadTasks()
    } else {
      setTasks([])
      setIsLoading(false)
    }
  }, [user])

  const loadTasks = async () => {
    try {
      const token = await AsyncStorage.getItem('token')
      if (!token) return

      const response = await fetch(`${API_URL}/api/tasks`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTasks(data)
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addTask = async () => {
    if (!newTaskTitle.trim()) return

    const tempId = `temp_${Date.now()}`
    const optimisticTask: Task = {
      id: tempId,
      title: newTaskTitle.trim(),
      description: '',
      pomodoros: 1,
      completedPomodoros: 0,
      priority: 'Medium',
      completed: false,
    }

    setTasks(prev => [...prev, optimisticTask])
    setNewTaskTitle('')

    try {
      const token = await AsyncStorage.getItem('token')
      if (!token) {
        setTasks(prev => prev.filter(t => t.id !== tempId))
        return
      }

      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: optimisticTask.title,
          description: optimisticTask.description,
          pomodoros: optimisticTask.pomodoros,
          priority: optimisticTask.priority
        })
      })

      if (response.ok) {
        const createdTask = await response.json()
        setTasks(prev => prev.map(task => 
          task.id === tempId ? { ...createdTask } : task
        ))
      } else {
        setTasks(prev => prev.filter(t => t.id !== tempId))
      }
    } catch (error) {
      console.error('Failed to create task:', error)
      setTasks(prev => prev.filter(t => t.id !== tempId))
    }
  }

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return

    const newCompleted = !task.completed
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, completed: newCompleted } : t
    ))

    try {
      const token = await AsyncStorage.getItem('token')
      if (!token) return

      await fetch(`${API_URL}/api/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ completed: newCompleted })
      })
    } catch (error) {
      console.error('Failed to toggle task:', error)
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, completed: !newCompleted } : t
      ))
    }
  }

  const deleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return

    if (selectedTask?.id === id) {
      setSelectedTask(null)
    }

    setTasks(prev => prev.filter(t => t.id !== id))

    try {
      const token = await AsyncStorage.getItem('token')
      if (!token) return

      await fetch(`${API_URL}/api/tasks/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
    } catch (error) {
      console.error('Failed to delete task:', error)
      setTasks(prev => [...prev, task])
    }
  }

  const selectTask = (task: Task) => {
    if (isRunning) return

    if (selectedTask?.id === task.id) {
      setSelectedTask(null)
    } else {
      setSelectedTask({
        id: task.id,
        title: task.title,
        description: task.description,
      })
    }
  }

  const renderTask = ({ item }: { item: Task }) => {
    const isActive = selectedTask?.id === item.id

    return (
      <TouchableOpacity
        style={[
          styles.task,
          item.completed && styles.taskCompleted,
          isActive && styles.taskActive,
        ]}
        onPress={() => selectTask(item)}
        disabled={isRunning}
      >
        <TouchableOpacity
          style={[
            styles.checkbox,
            item.completed && styles.checkboxChecked,
          ]}
          onPress={() => toggleTask(item.id)}
        >
          {item.completed && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>

        <View style={styles.taskContent}>
          <Text style={[
            styles.taskTitle,
            item.completed && styles.taskTitleCompleted,
          ]}>
            {item.title}
          </Text>
          <Text style={styles.taskPomodoros}>
            {item.completedPomodoros} pomodoros
          </Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteTask(item.id)}
        >
          <Text style={styles.deleteButtonText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Tasks</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add new task..."
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          onSubmitEditing={addTask}
        />
        <TouchableOpacity style={styles.addButton} onPress={addTask}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : tasks.length === 0 ? (
        <Text style={styles.emptyText}>
          {user ? 'No tasks. Add a new task above.' : 'Login to manage tasks.'}
        </Text>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      )}
    </View>
  )
})

TaskList.displayName = 'TaskList'

export default TaskList

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  list: {
    maxHeight: 400,
  },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  taskCompleted: {
    opacity: 0.6,
  },
  taskActive: {
    backgroundColor: '#dbeafe',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  taskPomodoros: {
    fontSize: 12,
    color: '#6b7280',
  },
  deleteButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 24,
    color: '#ef4444',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    paddingVertical: 24,
  },
})
