import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { Admin, LoginRequest, LoginResponse } from '@/types'
import { authApi } from '@/services/api'

interface AuthState {
  isAuthenticated: boolean
  admin: Admin | null
  accessToken: string | null
  refreshToken: string | null
  loading: boolean
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { admin: Admin; accessToken: string; refreshToken: string } }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'TOKEN_REFRESH'; payload: { accessToken: string } }
  | { type: 'SET_LOADING'; payload: boolean }

interface AuthContextType extends AuthState {
  login: (credentials: LoginRequest) => Promise<LoginResponse>
  logout: () => void
  refreshToken: () => Promise<boolean>
}

const initialState: AuthState = {
  isAuthenticated: false,
  admin: null,
  accessToken: null,
  refreshToken: null,
  loading: true,
}

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true }
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        admin: action.payload.admin,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        loading: false,
      }
    case 'LOGIN_FAILURE':
      return { ...state, loading: false }
    case 'LOGOUT':
      return { ...initialState, loading: false }
    case 'TOKEN_REFRESH':
      return { ...state, accessToken: action.payload.accessToken }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    default:
      return state
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // 初始化时检查本地存储的token
  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('access_token')
      const refreshToken = localStorage.getItem('refresh_token')
      const adminData = localStorage.getItem('admin_data')

      if (accessToken && refreshToken && adminData) {
        try {
          const admin = JSON.parse(adminData)
          // 验证token是否有效
          const response = await authApi.verify(accessToken)
          if (response.success) {
            dispatch({
              type: 'LOGIN_SUCCESS',
              payload: { admin, accessToken, refreshToken },
            })
          } else {
            // token无效，清除本地存储
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')
            localStorage.removeItem('admin_data')
            dispatch({ type: 'SET_LOADING', payload: false })
          }
        } catch (error) {
          console.error('Auth initialization error:', error)
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('admin_data')
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    initAuth()
  }, [])

  const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
    dispatch({ type: 'LOGIN_START' })
    
    try {
      const response = await authApi.login(credentials)
      
      if (response.success && response.data) {
        const { admin, accessToken, refreshToken } = response.data
        
        // 保存到本地存储
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        localStorage.setItem('admin_data', JSON.stringify(admin))
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { admin, accessToken, refreshToken }
        })
      } else {
        dispatch({ type: 'LOGIN_FAILURE' })
      }
      
      return response
    } catch (error) {
      console.error('Login error:', error)
      dispatch({ type: 'LOGIN_FAILURE' })
      throw error
    }
  }

  const logout = async () => {
    try {
      if (state.refreshToken) {
        await authApi.logout(state.refreshToken)
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // 清除本地存储
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('admin_data')
      
      dispatch({ type: 'LOGOUT' })
    }
  }

  const refreshTokenAction = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) return false

      const response = await authApi.refresh(refreshToken)
      if (response.success && response.data?.accessToken) {
        const newAccessToken = response.data.accessToken
        localStorage.setItem('access_token', newAccessToken)
        
        dispatch({
          type: 'TOKEN_REFRESH',
          payload: { accessToken: newAccessToken }
        })
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    }
  }

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken: refreshTokenAction,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 