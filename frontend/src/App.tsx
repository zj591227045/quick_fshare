import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Spin, App as AntdApp } from 'antd'
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
  const { mode } = useTheme()

  return (
    <AntdApp>
      <Layout style={{ minHeight: '100vh' }} className={`theme-${mode}`}>
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
                <h1>404</h1>
                <p>页面不存在</p>
              </div>
            </div>
          }
        />
      </Routes>
    </Layout>
    </AntdApp>
  )
}

export default App