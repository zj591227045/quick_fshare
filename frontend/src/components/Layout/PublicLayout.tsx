import React from 'react'
import { Layout, Typography, Button, Space } from 'antd'
import { HomeOutlined, LoginOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@/contexts/ThemeContext'

const { Header, Content, Footer } = Layout
const { Text, Title } = Typography

interface PublicLayoutProps {
  children: React.ReactNode
  showHeader?: boolean
  showFooter?: boolean
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ 
  children, 
  showHeader = true, 
  showFooter = true 
}) => {
  const navigate = useNavigate()
  const { mode, actualMode, toggleMode } = useTheme()

  // 获取主题按钮信息
  const getThemeButtonInfo = () => {
    switch (mode) {
      case 'light':
        return { icon: <MoonOutlined />, title: '切换到深色模式' }
      case 'dark':
        return { icon: <SunOutlined />, title: '切换到浅色模式' }
      case 'auto':
        return { 
          icon: actualMode === 'light' ? <MoonOutlined /> : <SunOutlined />, 
          title: `自动模式 (当前: ${actualMode === 'light' ? '浅色' : '深色'})` 
        }
      default:
        return { icon: <MoonOutlined />, title: '切换主题' }
    }
  }

  const themeButtonInfo = getThemeButtonInfo()

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      {showHeader && (
        <Header
          style={{
            background: 'var(--bg-color)',
            borderBottom: '1px solid var(--border-secondary)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo 和标题 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              minWidth: 0, // 允许收缩
              flex: '0 1 auto', // 不增长，允许收缩
            }}
            onClick={() => navigate('/shares')}
          >
            <div
              style={{
                width: 40,
                height: 40,
                background: 'var(--primary-color)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold',
                flexShrink: 0, // 图标不收缩
              }}
            >
              Q
            </div>
            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <Title 
                level={4} 
                style={{ 
                  margin: 0, 
                  color: 'var(--text-primary)',
                  fontSize: '16px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                Quick FShare
              </Title>
              <Text 
                style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                className="logo-subtitle"
              >
                私有文件分享
              </Text>
            </div>
          </div>

          {/* 导航按钮 */}
          <Space size="middle">
            <Button
              type="text"
              icon={<HomeOutlined />}
              onClick={() => navigate('/shares')}
            >
              首页
            </Button>

            <Button
              type="text"
              icon={themeButtonInfo.icon}
              onClick={toggleMode}
              title={themeButtonInfo.title}
            />

            <Button
              type="primary"
              icon={<LoginOutlined />}
              onClick={() => navigate('/login')}
            >
              管理员登录
            </Button>
          </Space>
        </Header>
      )}

      <Content
        style={{
          flex: 1,
          background: 'var(--bg-color)',
          position: 'relative',
        }}
      >
        {children}
      </Content>

      {showFooter && (
        <Footer
          style={{
            textAlign: 'center',
            background: 'var(--bg-color)',
            borderTop: '1px solid var(--border-secondary)',
            color: 'var(--text-secondary)',
            padding: '16px 24px',
          }}
        >
          <Text style={{ color: 'var(--text-secondary)' }}>
            Quick FShare ©2024 - 简单、安全、美观的私有文件分享系统
          </Text>
        </Footer>
      )}
    </Layout>
  )
}

export default PublicLayout 