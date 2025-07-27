// Common types used across the application
// This file consolidates duplicate type definitions to prevent import conflicts

export interface User {
  id: number
  name: string
  email: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
  userRoles?: Array<{
    id: number
    role: {
      id: number
      name: string
      description: string
    }
    assignedAt: string
    expiresAt?: string
    isActive: boolean
  }>
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export interface ChartData {
  title: string
  value: number
  subtitle: string
  percentage: number
  color: string
}

export interface ChartOptions {
  width?: string | number
  height?: string | number
  theme?: string
}

export interface FormField<T = any> {
  value: T
  error?: string
  required?: boolean
  validator?: (value: T) => string | null
  touched?: boolean
  dirty?: boolean
}

export interface FormState {
  [key: string]: FormField
}

export interface FormConfig {
  id: string
  name: string
  autoValidate?: boolean
  validateOnBlur?: boolean
  validateOnChange?: boolean
  submitOnEnter?: boolean
}
