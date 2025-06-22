import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { ThemeConfig } from '@/types'

interface ThemeState {
  mode: 'light' | 'dark'
  primaryColor: string
  customColors: Record<string, string>
}

type ThemeAction =
  | { type: 'TOGGLE_MODE' }
  | { type: 'SET_MODE'; payload: 'light' | 'dark' }
  | { type: 'SET_PRIMARY_COLOR'; payload: string }
  | { type: 'SET_CUSTOM_COLORS'; payload: Record<string, string> }
  | { type: 'LOAD_THEME'; payload: ThemeState }

interface ThemeContextType extends ThemeState {
  toggleMode: () => void
  setMode: (mode: 'light' | 'dark') => void
  setPrimaryColor: (color: string) => void
  setCustomColors: (colors: Record<string, string>) => void
  resetTheme: () => void
}

const defaultTheme: ThemeState = {
  mode: 'light',
  primaryColor: '#1890ff',
  customColors: {},
}

const themeReducer = (state: ThemeState, action: ThemeAction): ThemeState => {
  switch (action.type) {
    case 'TOGGLE_MODE':
      return { ...state, mode: state.mode === 'light' ? 'dark' : 'light' }
    case 'SET_MODE':
      return { ...state, mode: action.payload }
    case 'SET_PRIMARY_COLOR':
      return { ...state, primaryColor: action.payload }
    case 'SET_CUSTOM_COLORS':
      return { ...state, customColors: action.payload }
    case 'LOAD_THEME':
      return action.payload
    default:
      return state
  }
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(themeReducer, defaultTheme)

  // 从本地存储加载主题设置
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme_config')
    if (savedTheme) {
      try {
        const themeConfig: ThemeState = JSON.parse(savedTheme)
        dispatch({ type: 'LOAD_THEME', payload: themeConfig })
      } catch (error) {
        console.error('Failed to load theme config:', error)
      }
    } else {
      // 检查系统主题偏好
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        dispatch({ type: 'SET_MODE', payload: 'dark' })
      }
    }
  }, [])

  // 应用主题到DOM
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', state.mode)
    
    // 设置CSS变量
    if (state.primaryColor !== defaultTheme.primaryColor) {
      root.style.setProperty('--primary-color', state.primaryColor)
    }
    
    // 应用自定义颜色
    Object.entries(state.customColors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value)
    })
    
    // 保存主题设置到本地存储
    localStorage.setItem('theme_config', JSON.stringify(state))
  }, [state])

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      const savedTheme = localStorage.getItem('theme_config')
      if (!savedTheme) {
        // 只有在用户没有手动设置主题时才跟随系统
        dispatch({ type: 'SET_MODE', payload: e.matches ? 'dark' : 'light' })
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const toggleMode = () => {
    dispatch({ type: 'TOGGLE_MODE' })
  }

  const setMode = (mode: 'light' | 'dark') => {
    dispatch({ type: 'SET_MODE', payload: mode })
  }

  const setPrimaryColor = (color: string) => {
    dispatch({ type: 'SET_PRIMARY_COLOR', payload: color })
  }

  const setCustomColors = (colors: Record<string, string>) => {
    dispatch({ type: 'SET_CUSTOM_COLORS', payload: colors })
  }

  const resetTheme = () => {
    localStorage.removeItem('theme_config')
    dispatch({ type: 'LOAD_THEME', payload: defaultTheme })
    
    // 清除CSS变量
    const root = document.documentElement
    root.style.removeProperty('--primary-color')
    Object.keys(state.customColors).forEach(key => {
      root.style.removeProperty(`--${key}`)
    })
  }

  const value: ThemeContextType = {
    ...state,
    toggleMode,
    setMode,
    setPrimaryColor,
    setCustomColors,
    resetTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
} 