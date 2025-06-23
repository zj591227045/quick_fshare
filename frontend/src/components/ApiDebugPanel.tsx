import React, { useState, useEffect } from 'react'
import { Card, Button, Typography, Descriptions, Tag, Space, message, Modal } from 'antd'
import { apiConfigManager } from '@/utils/apiConfig'
import api from '@/services/api'

const { Title, Text, Paragraph } = Typography

interface ApiDebugPanelProps {
  visible?: boolean
  onClose?: () => void
}

const ApiDebugPanel: React.FC<ApiDebugPanelProps> = ({ visible = false, onClose }) => {
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)

  const loadDebugInfo = async () => {
    try {
      const info = apiConfigManager.getDebugInfo()
      const apiInfo = api.getApiInfo()
      setDebugInfo({ ...info, apiClient: apiInfo })
    } catch (error) {
      message.error('获取调试信息失败')
    }
  }

  const testApiConnection = async () => {
    setLoading(true)
    setTestResults(null)
    
    try {
      const startTime = Date.now()
      const response = await api.system.getStats()
      const endTime = Date.now()
      
      setTestResults({
        success: true,
        responseTime: endTime - startTime,
        data: response
      })
      
      message.success('API连接测试成功')
    } catch (error: any) {
      setTestResults({
        success: false,
        error: error.message || 'API连接测试失败'
      })
      
      message.error('API连接测试失败')
    } finally {
      setLoading(false)
    }
  }

  const reconfigureApi = async () => {
    try {
      await api.reconfigure()
      await loadDebugInfo()
      message.success('API重新配置成功')
    } catch (error: any) {
      message.error(`API重新配置失败: ${error.message}`)
    }
  }

  useEffect(() => {
    if (visible) {
      loadDebugInfo()
    }
  }, [visible])

  const getEnvironmentTag = (env: any) => {
    if (env?.isDevelopment) return <Tag color="blue">开发环境</Tag>
    if (env?.isProduction) return <Tag color="green">生产环境</Tag>
    if (env?.isContainer) return <Tag color="orange">容器环境</Tag>
    return <Tag>未知环境</Tag>
  }

  const getConnectionStatus = () => {
    if (testResults === null) return <Tag color="default">未测试</Tag>
    if (testResults.success) return <Tag color="success">连接正常</Tag>
    return <Tag color="error">连接失败</Tag>
  }

  return (
    <Modal
      title="API配置调试面板"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button key="refresh" onClick={loadDebugInfo}>
          刷新信息
        </Button>,
        <Button key="test" type="primary" loading={loading} onClick={testApiConnection}>
          测试连接
        </Button>,
        <Button key="reconfig" onClick={reconfigureApi}>
          重新配置
        </Button>
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 环境信息 */}
        <Card title="环境信息" size="small">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="当前环境">
              {debugInfo?.environment && getEnvironmentTag(debugInfo.environment)}
            </Descriptions.Item>
            <Descriptions.Item label="主机名">
              {debugInfo?.environment?.hostname || 'unknown'}
            </Descriptions.Item>
            <Descriptions.Item label="端口">
              {debugInfo?.environment?.port || 'default'}
            </Descriptions.Item>
            <Descriptions.Item label="协议">
              {debugInfo?.environment?.protocol || 'unknown'}
            </Descriptions.Item>
            <Descriptions.Item label="模式">
              {debugInfo?.environment?.mode || 'unknown'}
            </Descriptions.Item>
            <Descriptions.Item label="时间戳">
              <Text code>{debugInfo?.timestamp}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* API配置 */}
        <Card title="API配置" size="small">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="基础URL">
              <Text code>{debugInfo?.config?.baseURL || 'unknown'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="超时时间">
              {debugInfo?.config?.timeout || 'unknown'}ms
            </Descriptions.Item>
            <Descriptions.Item label="当前环境">
              {debugInfo?.config?.environment || 'unknown'}
            </Descriptions.Item>
            <Descriptions.Item label="配置状态">
              {debugInfo?.apiClient?.isConfigured ? 
                <Tag color="success">已配置</Tag> : 
                <Tag color="warning">未配置</Tag>
              }
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 连接测试 */}
        <Card title="连接测试" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>连接状态: {getConnectionStatus()}</span>
              {testResults?.responseTime && (
                <Text type="secondary">响应时间: {testResults.responseTime}ms</Text>
              )}
            </div>
            
            {testResults?.success && (
              <Paragraph>
                <Text type="success">✅ API服务连接正常</Text>
              </Paragraph>
            )}
            
            {testResults?.error && (
              <Paragraph>
                <Text type="danger">❌ {testResults.error}</Text>
              </Paragraph>
            )}
          </Space>
        </Card>

        {/* 调试信息 */}
        <Card title="完整调试信息" size="small">
          <Paragraph>
            <pre style={{ 
              background: '#f5f5f5', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '12px',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </Paragraph>
        </Card>
      </Space>
    </Modal>
  )
}

export default ApiDebugPanel 