import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { Feather } from '@expo/vector-icons'

export default function ProfileScreen() {
  const { user, isAuthenticated, logout, login, register } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [description, setDescription] = useState(user?.description || '')
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    await logout()
  }

  const handleSaveDescription = async () => {
    // TODO: Save to API
    setIsEditing(false)
  }

  const handleAuthChange = (field: 'email' | 'username' | 'password') => (value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    if (error) {
      setError('')
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
    if (isLoading) {
      return
    }

    setError('')
    setIsLoading(true)

    try {
      let success = false

      if (isLogin) {
        success = await login(formData.email.trim(), formData.password)
        if (!success) {
          setError('Invalid email or password')
        }
      } else {
        if (!formData.username.trim()) {
          setError('Username is required')
          setIsLoading(false)
          return
        }

        success = await register(
          formData.email.trim(),
          formData.username.trim(),
          formData.password,
        )

        if (!success) {
          setError('Registration error. Please try again.')
        }
      }

      if (success) {
        resetForm()
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAuthMode = () => {
    setIsLogin((prev) => !prev)
    setError('')
    resetForm()
  }

  if (!isAuthenticated || !user) {
    return (
      <KeyboardAvoidingView
        style={styles.authContainer}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView
          contentContainerStyle={styles.authContent}
          keyboardShouldPersistTaps="handled"
        >
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
                <Text
                  style={[
                    styles.toggleButtonText,
                    isLogin && styles.toggleButtonTextActive,
                  ]}
                >
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
                onPress={() => {
                  if (isLogin) toggleAuthMode()
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    !isLogin && styles.toggleButtonTextActive,
                  ]}
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
                  editable={!isLoading}
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
                    editable={!isLoading}
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
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.authPasswordToggle}
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#94a3b8"
                  />
                </TouchableOpacity>
              </View>
              {!isLogin && (
                <Text style={styles.passwordHint}>Minimum 6 characters</Text>
              )}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleAuthSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <View style={styles.loadingContent}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={[styles.submitButtonText, styles.loadingText]}>Loading...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>
                  {isLogin ? 'Login' : 'Register'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {user.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.username}>{user.username}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          {isEditing ? (
            <>
              <TextInput
                style={styles.profileInput}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                placeholder="Tell us about yourself..."
              />
              <TouchableOpacity style={styles.button} onPress={handleSaveDescription}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.buttonSecondary]} 
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.description}>
                {user.description || 'No description yet'}
              </Text>
              <TouchableOpacity 
                style={[styles.button, styles.buttonSecondary]} 
                onPress={() => setIsEditing(true)}
              >
                <Text style={styles.buttonSecondaryText}>Edit</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
  content: {
    padding: 16,
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
    right: 16,
    padding: 4,
  },
  passwordHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  },
  errorText: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  profileInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#dc2626',
  },
})
