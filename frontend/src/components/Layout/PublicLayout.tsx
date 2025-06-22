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
  const { mode, toggleMode } = useTheme()

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
              }}
            >
              Q
            </div>
            <div>
              <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
                Quick FShare
              </Title>
              <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                局域网文件快速分享
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
              icon={mode === 'light' ? <MoonOutlined /> : <SunOutlined />}
              onClick={toggleMode}
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
            Quick FShare ©2024 - 简单、安全、美观的局域网文件分享系统
          </Text>
        </Footer>
      )}
    </Layout>
  )
}

export default PublicLayout 