import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Descriptions, Tag, Progress, Button, Space, Spin, Alert } from 'antd';
import { 
  DatabaseOutlined, 
  CloudServerOutlined, 
  SecurityScanOutlined,
  ReloadOutlined,
  SettingOutlined 
} from '@ant-design/icons';
import apiClient from '../services/api';

const { Title } = Typography;

interface SystemInfo {
  cpu?: {
    usage: number;
    count: number;
    model: string;
  };
  memory?: {
    usage_percentage: number;
    total: number;
    used: number;
    free: number;
  };
  disk?: {
    usage_percentage: number;
    total: string;
    used: string;
    available: string;
  };
  system?: {
    platform: string;
    hostname: string;
    uptime: number;
  };
  application?: {
    node_version: string;
    pid: number;
    uptime: number;
    memory: {
      heap_used: number;
      heap_total: number;
    };
  };
  database?: {
    connection_healthy: boolean;
    size_mb: number;
  };
}

const SystemPage: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 格式化运行时间
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}天${hours}小时${minutes}分钟`;
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  };

  // 格式化内存大小
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取系统状态数据
  const fetchSystemStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.system.getStats();
      
      if (response.success && response.data) {
        setSystemInfo(response.data.system || null);
      } else {
        setError(response.message || '获取系统信息失败');
      }
    } catch (error) {
      console.error('获取系统状态失败:', error);
      setError('无法连接到服务器');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    fetchSystemStats();
  }, []);

  // 自动刷新数据（每30秒）
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSystemStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading && !systemInfo) {
    return (
      <div style={{ padding: '24px', background: 'var(--bg-color)', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: 'var(--text-secondary)' }}>正在加载系统信息...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', background: 'var(--bg-color)' }}>
        <Alert
          message="系统信息加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={fetchSystemStats}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: 'var(--bg-color)' }}>
      <Title level={2} style={{ marginBottom: 24, color: 'var(--text-primary)' }}>
        系统管理
      </Title>
      
      <Row gutter={[16, 16]}>
        {/* 系统状态 */}
        <Col span={24}>
          <Card 
            title={
              <Space>
                <CloudServerOutlined style={{ color: 'var(--text-primary)' }} />
                <span style={{ color: 'var(--text-primary)' }}>系统状态</span>
              </Space>
            }
            extra={
              <Button 
                icon={<ReloadOutlined />} 
                type="text" 
                style={{ color: 'var(--text-primary)' }}
                onClick={fetchSystemStats}
                loading={loading}
              >
                刷新
              </Button>
            }
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Card 
                  size="small" 
                  title={<span style={{ color: 'var(--text-primary)' }}>CPU 使用率</span>}
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}
                >
                  <Progress 
                    percent={Math.round(systemInfo?.cpu?.usage || 0)} 
                    status="active" 
                    strokeColor={{ from: 'var(--primary-color)', to: 'var(--success-color)' }}
                  />
                  <div style={{ marginTop: 8, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {systemInfo?.cpu?.count || 0} 核心 - {systemInfo?.cpu?.model || 'Unknown'}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card 
                  size="small" 
                  title={<span style={{ color: 'var(--text-primary)' }}>内存使用率</span>}
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}
                >
                  <Progress 
                    percent={Math.round(systemInfo?.memory?.usage_percentage || 0)} 
                    status="active"
                    strokeColor={{ from: 'var(--primary-color)', to: 'var(--success-color)' }}
                  />
                  <div style={{ marginTop: 8, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatBytes(systemInfo?.memory?.used || 0)} / {formatBytes(systemInfo?.memory?.total || 0)}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card 
                  size="small" 
                  title={<span style={{ color: 'var(--text-primary)' }}>磁盘使用率</span>}
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}
                >
                  <Progress 
                    percent={Math.round(systemInfo?.disk?.usage_percentage || 0)} 
                    status="active"
                    strokeColor={{ from: 'var(--primary-color)', to: 'var(--success-color)' }}
                  />
                  <div style={{ marginTop: 8, fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {systemInfo?.disk?.used || '0'} / {systemInfo?.disk?.total || '0'}
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 服务信息 */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <DatabaseOutlined style={{ color: 'var(--text-primary)' }} />
                <span style={{ color: 'var(--text-primary)' }}>服务信息</span>
              </Space>
            }
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>系统版本</span>}
                contentStyle={{ color: 'var(--text-primary)' }}
              >
                Quick FShare v1.0.0
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>Node.js 版本</span>}
                contentStyle={{ color: 'var(--text-primary)' }}
              >
                {systemInfo?.application?.node_version || 'Unknown'}
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>运行时间</span>}
                contentStyle={{ color: 'var(--text-primary)' }}
              >
                {formatUptime(systemInfo?.application?.uptime || 0)}
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>服务状态</span>}
              >
                <Tag color="green">运行中</Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>数据库连接</span>}
              >
                <Tag color={systemInfo?.database?.connection_healthy ? "green" : "red"}>
                  {systemInfo?.database?.connection_healthy ? "正常" : "异常"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>端口监听</span>}
                contentStyle={{ color: 'var(--text-primary)' }}
              >
                3001
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>主机名称</span>}
                contentStyle={{ color: 'var(--text-primary)' }}
              >
                {systemInfo?.system?.hostname || 'Unknown'}
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>系统平台</span>}
                contentStyle={{ color: 'var(--text-primary)' }}
              >
                {systemInfo?.system?.platform || 'Unknown'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* 安全信息 */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <SecurityScanOutlined style={{ color: 'var(--text-primary)' }} />
                <span style={{ color: 'var(--text-primary)' }}>安全信息</span>
              </Space>
            }
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>认证状态</span>}
              >
                <Tag color="green">已启用</Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>HTTPS</span>}
              >
                <Tag color="orange">未配置</Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>防火墙</span>}
              >
                <Tag color="green">已启用</Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>访问控制</span>}
              >
                <Tag color="green">正常</Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>日志记录</span>}
              >
                <Tag color="green">已启用</Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>备份状态</span>}
              >
                <Tag color="orange">未配置</Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>数据库大小</span>}
                contentStyle={{ color: 'var(--text-primary)' }}
              >
                {systemInfo?.database?.size_mb ? `${systemInfo.database.size_mb} MB` : 'Unknown'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* 系统操作 */}
        <Col span={24}>
          <Card 
            title={
              <Space>
                <SettingOutlined style={{ color: 'var(--text-primary)' }} />
                <span style={{ color: 'var(--text-primary)' }}>系统操作</span>
              </Space>
            }
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}
          >
            <Space wrap>
              <Button type="primary">重启服务</Button>
              <Button style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>清理缓存</Button>
              <Button style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>导出日志</Button>
              <Button style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>系统备份</Button>
              <Button danger>关闭服务</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SystemPage; 