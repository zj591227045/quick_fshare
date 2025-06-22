import React, { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button, Space, Badge, Typography } from 'antd'
import {
  DashboardOutlined,
  FolderOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MonitorOutlined,
  BellOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { MenuProps } from 'antd'

const { Header, Sider, Content } = Layout
const { Text } = Typography

interface AdminLayoutProps {
  children: React.ReactNode
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, logout } = useAuth()
  const { mode, toggleMode } = useTheme()

  // 菜单项配置
  const menuItems: MenuProps['items'] = [
    {
      key: '/admin',
      icon: <DashboardOutlined />,
      label: '仪表板',
    },
    {
      key: '/admin/shares',
      icon: <FolderOutlined />,
      label: '分享管理',
    },
    {
      key: '/admin/system',
      icon: <MonitorOutlined />,
      label: '系统监控',
    },
    {
      key: '/admin/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ]

  // 用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      key: 'theme',
      icon: mode === 'light' ? <MoonOutlined /> : <SunOutlined />,
      label: mode === 'light' ? '切换到深色模式' : '切换到浅色模式',
      onClick: toggleMode,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      handleLogout()
    } else if (key === 'profile') {
      // 处理个人资料点击
      console.log('Profile clicked')
    } else {
      navigate(key)
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        style={{
          background: 'var(--bg-color)',
          borderRight: '1px solid var(--border-secondary)',
        }}
      >
        {/* Logo 区域 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0' : '0 24px',
            borderBottom: '1px solid var(--border-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: 'var(--primary-color)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              Q
            </div>
            {!collapsed && (
              <Text
                strong
                style={{
                  fontSize: '18px',
                  color: 'var(--text-primary)',
                }}
              >
                Quick FShare
              </Text>
            )}
          </div>
        </div>

        {/* 导航菜单 */}
        <Menu
          theme={mode === 'dark' ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{
            borderRight: 0,
            background: 'transparent',
          }}
        />
      </Sider>

      <Layout>
        {/* 顶部栏 */}
        <Header
          style={{
            padding: '0 16px',
            background: 'var(--bg-color)',
            borderBottom: '1px solid var(--border-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 64,
                height: 64,
              }}
            />
          </div>

          <Space size="middle">
            {/* 通知铃铛 */}
            <Badge count={0} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Badge>

            {/* 主题切换 */}
            <Button
              type="text"
              icon={mode === 'light' ? <MoonOutlined /> : <SunOutlined />}
              onClick={toggleMode}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />

            {/* 用户信息 */}
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleMenuClick }}
              placement="bottomRight"
              arrow
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 6,
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Avatar size="small" icon={<UserOutlined />} />
                <Text style={{ color: 'var(--text-primary)' }}>
                  {admin?.username || '管理员'}
                </Text>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* 主内容区域 */}
        <Content
          style={{
            margin: '16px',
            padding: '24px',
            background: 'var(--bg-color)',
            borderRadius: 8,
            border: '1px solid var(--border-secondary)',
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  )
}

export default AdminLayout 