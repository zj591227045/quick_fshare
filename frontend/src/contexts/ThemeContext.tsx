import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'

interface ThemeState {
  mode: 'light' | 'dark' | 'auto'
  primaryColor: string
  customColors: Record<string, string>
  autoSwitchTime: { light: string; dark: string }
  reducedMotion: boolean
}

type ThemeAction =
  | { type: 'TOGGLE_MODE' }
  | { type: 'SET_MODE'; payload: 'light' | 'dark' | 'auto' }
  | { type: 'SET_PRIMARY_COLOR'; payload: string }
  | { type: 'SET_CUSTOM_COLORS'; payload: Record<string, string> }
  | { type: 'SET_AUTO_SWITCH_TIME'; payload: { light: string; dark: string } }
  | { type: 'SET_REDUCED_MOTION'; payload: boolean }
  | { type: 'LOAD_THEME'; payload: ThemeState }

interface ThemeContextType extends ThemeState {
  actualMode: 'light' | 'dark' // 实际显示的模式
  toggleMode: () => void
  setMode: (mode: 'light' | 'dark' | 'auto') => void
  setPrimaryColor: (color: string) => void
  setCustomColors: (colors: Record<string, string>) => void
  setAutoSwitchTime: (times: { light: string; dark: string }) => void
  setReducedMotion: (reduced: boolean) => void
  resetTheme: () => void
}

const defaultTheme: ThemeState = {
  mode: 'auto',
  primaryColor: '#1890ff',
  customColors: {},
  autoSwitchTime: { light: '08:00', dark: '20:00' },
  reducedMotion: false,
}

const themeReducer = (state: ThemeState, action: ThemeAction): ThemeState => {
  switch (action.type) {
    case 'TOGGLE_MODE':
      const nextMode = state.mode === 'light' ? 'dark' : state.mode === 'dark' ? 'auto' : 'light'
      return { ...state, mode: nextMode }
    case 'SET_MODE':
      return { ...state, mode: action.payload }
    case 'SET_PRIMARY_COLOR':
      return { ...state, primaryColor: action.payload }
    case 'SET_CUSTOM_COLORS':
      return { ...state, customColors: action.payload }
    case 'SET_AUTO_SWITCH_TIME':
      return { ...state, autoSwitchTime: action.payload }
    case 'SET_REDUCED_MOTION':
      return { ...state, reducedMotion: action.payload }
    case 'LOAD_THEME':
      return action.payload
    default:
      return state
  }
}

// 判断当前时间应该使用哪个主题
const getCurrentThemeByTime = (autoSwitchTime: { light: string; dark: string }): 'light' | 'dark' => {
  const now = new Date()
  const currentTime = now.getHours() * 60 + now.getMinutes()
  
  const [lightHour, lightMin] = autoSwitchTime.light.split(':').map(Number)
  const [darkHour, darkMin] = autoSwitchTime.dark.split(':').map(Number)
  
  const lightTime = lightHour * 60 + lightMin
  const darkTime = darkHour * 60 + darkMin
  
  if (lightTime < darkTime) {
    // 正常情况：白天时间 < 夜晚时间
    return currentTime >= lightTime && currentTime < darkTime ? 'light' : 'dark'
  } else {
    // 跨夜情况：夜晚时间 < 白天时间（例如：20:00 - 08:00）
    return currentTime >= lightTime || currentTime < darkTime ? 'light' : 'dark'
  }
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(themeReducer, defaultTheme)

  // 计算实际显示的主题模式
  const getActualMode = (): 'light' | 'dark' => {
    if (state.mode === 'auto') {
      // 首先检查系统偏好
      // const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      // 然后检查时间设置
      const timeBasedMode = getCurrentThemeByTime(state.autoSwitchTime)
      // 系统偏好优先，但如果用户设置了自动切换时间，则使用时间判断
      return timeBasedMode
    }
    return state.mode as 'light' | 'dark'
  }

  const actualMode = getActualMode()

  // 从本地存储加载主题设置
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme_config')
    if (savedTheme) {
      try {
        const themeConfig: ThemeState = JSON.parse(savedTheme)
        dispatch({ type: 'LOAD_THEME', payload: { ...defaultTheme, ...themeConfig } })
      } catch (error) {
        console.error('Failed to load theme config:', error)
      }
    } else {
      // 检查系统主题偏好
      // const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      dispatch({ type: 'SET_REDUCED_MOTION', payload: reducedMotion })
    }
  }, [])

  // 应用主题到DOM
  useEffect(() => {
    const root = document.documentElement
    
    // 添加过渡效果类
    if (!state.reducedMotion) {
      root.classList.add('theme-transition')
    } else {
      root.classList.remove('theme-transition')
    }
    
    // 设置主题属性
    root.setAttribute('data-theme', actualMode)
    
    // 设置CSS变量
    if (state.primaryColor !== defaultTheme.primaryColor) {
      root.style.setProperty('--primary-color', state.primaryColor)
      // 计算主色调的变体
      const primaryRgb = hexToRgb(state.primaryColor)
      if (primaryRgb) {
        root.style.setProperty('--primary-color-hover', lightenColor(state.primaryColor, 15))
        root.style.setProperty('--primary-color-active', darkenColor(state.primaryColor, 15))
      }
    }
    
    // 应用自定义颜色
    Object.entries(state.customColors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value)
    })
    
    // 保存主题设置到本地存储
    localStorage.setItem('theme_config', JSON.stringify(state))
  }, [state, actualMode])

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handleThemeChange = (_e: MediaQueryListEvent) => {
      if (state.mode === 'auto') {
        // 自动模式下跟随系统变化
        dispatch({ type: 'SET_MODE', payload: 'auto' })
      }
    }

    const handleMotionChange = (e: MediaQueryListEvent) => {
      dispatch({ type: 'SET_REDUCED_MOTION', payload: e.matches })
    }

    mediaQuery.addEventListener('change', handleThemeChange)
    motionQuery.addEventListener('change', handleMotionChange)
    
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange)
      motionQuery.removeEventListener('change', handleMotionChange)
    }
  }, [state.mode])

  // 自动切换定时器
  useEffect(() => {
    if (state.mode !== 'auto') return

    const checkTimeAndSwitch = () => {
      // 触发重新计算实际模式
      dispatch({ type: 'SET_MODE', payload: 'auto' })
    }

    // 每分钟检查一次
    const interval = setInterval(checkTimeAndSwitch, 60000)
    
    return () => clearInterval(interval)
  }, [state.mode, state.autoSwitchTime])

  const toggleMode = () => {
    dispatch({ type: 'TOGGLE_MODE' })
  }

  const setMode = (mode: 'light' | 'dark' | 'auto') => {
    dispatch({ type: 'SET_MODE', payload: mode })
  }

  const setPrimaryColor = (color: string) => {
    dispatch({ type: 'SET_PRIMARY_COLOR', payload: color })
  }

  const setCustomColors = (colors: Record<string, string>) => {
    dispatch({ type: 'SET_CUSTOM_COLORS', payload: colors })
  }

  const setAutoSwitchTime = (times: { light: string; dark: string }) => {
    dispatch({ type: 'SET_AUTO_SWITCH_TIME', payload: times })
  }

  const setReducedMotion = (reduced: boolean) => {
    dispatch({ type: 'SET_REDUCED_MOTION', payload: reduced })
  }

  const resetTheme = () => {
    localStorage.removeItem('theme_config')
    dispatch({ type: 'LOAD_THEME', payload: defaultTheme })
    
    // 清除CSS变量
    const root = document.documentElement
    root.style.removeProperty('--primary-color')
    root.style.removeProperty('--primary-color-hover')
    root.style.removeProperty('--primary-color-active')
    Object.keys(state.customColors).forEach(key => {
      root.style.removeProperty(`--${key}`)
    })
  }

  const value: ThemeContextType = {
    ...state,
    actualMode,
    toggleMode,
    setMode,
    setPrimaryColor,
    setCustomColors,
    setAutoSwitchTime,
    setReducedMotion,
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

// 辅助函数：将十六进制颜色转换为RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

// 辅助函数：使颜色变亮
const lightenColor = (hex: string, percent: number): string => {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  
  const { r, g, b } = rgb
  const amount = Math.round(2.55 * percent)
  
  const newR = Math.min(255, r + amount)
  const newG = Math.min(255, g + amount)
  const newB = Math.min(255, b + amount)
  
  return `rgb(${newR}, ${newG}, ${newB})`
}

// 辅助函数：使颜色变暗
const darkenColor = (hex: string, percent: number): string => {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  
  const { r, g, b } = rgb
  const amount = Math.round(2.55 * percent)
  
  const newR = Math.max(0, r - amount)
  const newG = Math.max(0, g - amount)
  const newB = Math.max(0, b - amount)
  
  return `rgb(${newR}, ${newG}, ${newB})`
} 