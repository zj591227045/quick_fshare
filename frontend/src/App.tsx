import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Spin, App as AntdApp, ConfigProvider, theme } from 'antd'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

// 页面组件
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import SharesPage from '@/pages/SharesPage'
import BrowsePage from '@/pages/BrowsePage'
import SystemPage from '@/pages/SystemPage'
import SettingsPage from '@/pages/SettingsPage'
import PublicBrowsePage from '@/pages/PublicBrowsePage'

// 布局组件
import AdminLayout from '@/components/Layout/AdminLayout'
import PublicLayout from '@/components/Layout/PublicLayout'

// 路由保护组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex-center full-height">
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex-center full-height">
        <Spin size="large" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}

const App: React.FC = () => {
  const { actualMode, primaryColor } = useTheme()

  // Antd主题配置
  const antdTheme = {
    algorithm: actualMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: primaryColor,
      // 深色模式下的额外配置
      ...(actualMode === 'dark' && {
        colorBgContainer: '#1a1a1a',
        colorBgElevated: '#1f1f1f', 
        colorBgLayout: '#0f0f0f',
        colorBorder: '#434343',
        colorBorderSecondary: '#2a2a2a',
        colorText: 'rgba(255, 255, 255, 0.92)',
        colorTextSecondary: 'rgba(255, 255, 255, 0.72)',
        colorTextTertiary: 'rgba(255, 255, 255, 0.52)',
        colorTextQuaternary: 'rgba(255, 255, 255, 0.32)',
      })
    },
    components: {
      Layout: {
        bodyBg: actualMode === 'dark' ? '#0f0f0f' : '#ffffff',
        headerBg: actualMode === 'dark' ? '#0f0f0f' : '#ffffff',
        siderBg: actualMode === 'dark' ? '#0f0f0f' : '#ffffff',
      },
      Menu: {
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        itemHoverBg: actualMode === 'dark' ? '#2a2a2a' : '#f0f0f0',
        itemSelectedBg: primaryColor,
      },
      Card: {
        colorBgContainer: actualMode === 'dark' ? '#1a1a1a' : '#ffffff',
        colorBorderSecondary: actualMode === 'dark' ? '#2a2a2a' : '#f0f0f0',
      },
      Table: {
        colorBgContainer: actualMode === 'dark' ? '#1a1a1a' : '#ffffff',
        headerBg: actualMode === 'dark' ? '#262626' : '#f5f5f5',
        rowHoverBg: actualMode === 'dark' ? '#2a2a2a' : '#f0f0f0',
      },
      Input: {
        colorBgContainer: actualMode === 'dark' ? '#262626' : '#ffffff',
        colorBorder: actualMode === 'dark' ? '#434343' : '#d9d9d9',
        colorBgContainerDisabled: actualMode === 'dark' ? '#1a1a1a' : '#f5f5f5',
      },
      Button: {
        colorBgContainer: actualMode === 'dark' ? '#262626' : '#ffffff',
        colorBorder: actualMode === 'dark' ? '#434343' : '#d9d9d9',
      },
    }
  }

  return (
    <ConfigProvider theme={antdTheme}>
      <AntdApp>
        <Layout style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
          <Routes>
          {/* 公开访问路由 */}
          <Route path="/" element={<Navigate to="/shares" replace />} />
          <Route
            path="/shares"
            element={
              <PublicLayout>
                <PublicBrowsePage />
              </PublicLayout>
            }
          />
          <Route
            path="/shares/:shareId/*"
            element={
              <PublicLayout>
                <BrowsePage />
              </PublicLayout>
            }
          />

          {/* 登录页面 */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          {/* 管理员路由 */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <DashboardPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/shares"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <SharesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/system"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <SystemPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <SettingsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* 404 页面 */}
          <Route
            path="*"
            element={
              <div className="flex-center full-height">
                <div className="text-center">
                  <h1 style={{ color: 'var(--text-primary)' }}>404</h1>
                  <p style={{ color: 'var(--text-secondary)' }}>页面不存在</p>
                </div>
              </div>
            }
          />
        </Routes>
      </Layout>
      </AntdApp>
    </ConfigProvider>
  )
}

export default App