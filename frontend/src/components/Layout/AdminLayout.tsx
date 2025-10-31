import React, { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button, Space, Badge, Typography, Modal, Form, Input, App } from 'antd'
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
  LockOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { MenuProps } from 'antd'
import api from '@/services/api'

const { Header, Sider, Content } = Layout
const { Text, Title } = Typography

interface AdminLayoutProps {
  children: React.ReactNode
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const [profileModalVisible, setProfileModalVisible] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordChangeForm] = Form.useForm()
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, logout } = useAuth()
  const { mode, actualMode, toggleMode } = useTheme()
  const { message: messageApi } = App.useApp()

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

  // 获取主题图标和文本
  const getThemeInfo = () => {
    switch (mode) {
      case 'light':
        return { icon: <MoonOutlined />, text: '切换到深色模式' }
      case 'dark':
        return { icon: <SunOutlined />, text: '切换到浅色模式' }
      case 'auto':
        return { 
          icon: actualMode === 'light' ? <MoonOutlined /> : <SunOutlined />, 
          text: `自动模式 (当前: ${actualMode === 'light' ? '浅色' : '深色'})` 
        }
      default:
        return { icon: <MoonOutlined />, text: '切换主题' }
    }
  }

  const themeInfo = getThemeInfo()

  // 处理密码修改
  const handleChangePassword = async (values: any) => {
    try {
      setProfileLoading(true)
      await api.auth.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      messageApi.success('密码修改成功')
      passwordChangeForm.resetFields()
      setProfileModalVisible(false)
    } catch (error: any) {
      messageApi.error(error.response?.data?.error?.message || error.response?.data?.message || '密码修改失败')
    } finally {
      setProfileLoading(false)
    }
  }

  // 用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      key: 'theme',
      icon: themeInfo.icon,
      label: themeInfo.text,
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
      // 显示个人资料模态框
      setProfileModalVisible(true)
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
          theme={actualMode === 'dark' ? 'dark' : 'light'}
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
              icon={themeInfo.icon}
              onClick={toggleMode}
              title={themeInfo.text}
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
            background: 'var(--bg-elevated)',
            borderRadius: 8,
            border: '1px solid var(--border-secondary)',
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          {children}
        </Content>
      </Layout>

      {/* 个人资料模态框 */}
      <Modal
        title={
          <Space>
            <UserOutlined style={{ color: 'var(--primary-color)' }} />
            <span style={{ color: 'var(--text-primary)' }}>个人资料</span>
          </Space>
        }
        open={profileModalVisible}
        onCancel={() => {
          setProfileModalVisible(false)
          passwordChangeForm.resetFields()
        }}
        footer={null}
        width={500}
        style={{
          top: 100,
        }}
      >
        <div style={{ padding: '20px 0' }}>
          {/* 用户信息 */}
          <div style={{ 
            background: 'var(--bg-secondary)', 
            padding: '16px', 
            borderRadius: 8, 
            marginBottom: 24,
            border: '1px solid var(--border-secondary)'
          }}>
            <Space align="start" size={16}>
              <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: 'var(--primary-color)' }} />
              <div>
                <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
                  {admin?.username || '管理员'}
                </Title>
                <Text style={{ color: 'var(--text-secondary)' }}>
                  系统管理员
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    创建时间：{admin?.created_at ? new Date(admin.created_at).toLocaleDateString() : '未知'}
                  </Text>
                </div>
              </div>
            </Space>
          </div>

          {/* 密码修改表单 */}
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              marginBottom: 16,
              padding: '0 0 8px 0',
              borderBottom: '1px solid var(--border-secondary)'
            }}>
              <LockOutlined style={{ color: 'var(--primary-color)' }} />
              <Text strong style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
                修改密码
              </Text>
            </div>
            
            <Form
              form={passwordChangeForm}
              layout="vertical"
              onFinish={handleChangePassword}
              size="large"
            >
              <Form.Item
                name="currentPassword"
                label={<span style={{ color: 'var(--text-primary)' }}>当前密码</span>}
                rules={[
                  { required: true, message: '请输入当前密码' }
                ]}
              >
                <Input.Password
                  placeholder="请输入当前密码"
                  autoComplete="new-password"
                  style={{
                    backgroundColor: 'var(--bg-color)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label={<span style={{ color: 'var(--text-primary)' }}>新密码</span>}
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '密码长度至少6位' },
                  {
                    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                    message: '密码必须包含大小写字母和数字'
                  }
                ]}
              >
                <Input.Password
                  placeholder="请输入新密码"
                  autoComplete="new-password"
                  style={{
                    backgroundColor: 'var(--bg-color)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label={<span style={{ color: 'var(--text-primary)' }}>确认新密码</span>}
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: '请确认新密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password
                  placeholder="请再次输入新密码"
                  autoComplete="new-password"
                  style={{
                    backgroundColor: 'var(--bg-color)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)'
                  }}
                />
              </Form.Item>

              <Form.Item style={{ marginTop: 24, marginBottom: 0 }}>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button 
                    onClick={() => {
                      setProfileModalVisible(false)
                      passwordChangeForm.resetFields()
                    }}
                    style={{
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    取消
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={profileLoading}
                    icon={<EditOutlined />}
                  >
                    修改密码
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}

export default AdminLayout 