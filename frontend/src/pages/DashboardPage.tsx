import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, Alert } from 'antd';
import { ShareAltOutlined, FileOutlined, EyeOutlined, DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import apiClient from '../services/api';

const { Title } = Typography;

interface DashboardStats {
  shares: {
    total: number;
    enabled: number;
    disabled: number;
  };
  system: {
    status: 'healthy' | 'error';
    database: 'connected' | 'disconnected';
    server: 'running' | 'stopped';
  };
  access: {
    total_visits: number;
    total_downloads: number;
    daily_visits: number;
    daily_downloads: number;
  };
}

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 并行获取多个统计数据
      const [sharesResponse, systemResponse] = await Promise.all([
        apiClient.shares.getStats().catch(() => ({ success: false, data: { total: 0, enabled: 0, disabled: 0 } })),
        apiClient.system.getStats().catch(() => ({ success: false, data: null }))
      ]);

      // 处理分享统计数据
      const sharesData = sharesResponse.success ? sharesResponse.data : { total: 0, enabled: 0, disabled: 0 };

      // 处理系统统计数据
      const systemData = systemResponse.success && systemResponse.data ? systemResponse.data : null;

      setStats({
        shares: {
          total: sharesData.total || 0,
          enabled: sharesData.enabled || 0,
          disabled: sharesData.disabled || 0,
        },
        system: {
          status: systemData ? 'healthy' : 'error',
          database: systemData?.database?.connection_healthy ? 'connected' : 'disconnected',
          server: 'running', // 如果能请求成功说明服务器在运行
        },
        access: {
          total_visits: systemData?.access?.weekly?.access || 0,
          total_downloads: systemData?.access?.weekly?.downloads || 0,
          daily_visits: systemData?.access?.daily?.access || 0,
          daily_downloads: systemData?.access?.daily?.downloads || 0,
        },
      });
    } catch (err) {
      setError('获取仪表盘数据失败');
      console.error('Dashboard data fetch error:', err);
      // 设置默认值
      setStats({
        shares: { total: 0, enabled: 0, disabled: 0 },
        system: { status: 'error', database: 'disconnected', server: 'stopped' },
        access: { total_visits: 0, total_downloads: 0, daily_visits: 0, daily_downloads: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // 设置定时刷新（每30秒）
    const interval = setInterval(fetchDashboardData, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>正在加载仪表盘数据...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: 'var(--bg-color)' }}>
      <Title level={2} style={{ marginBottom: 24, color: 'var(--text-primary)' }}>
        仪表盘
      </Title>

      {error && (
        <Alert
          message="数据加载错误"
          description={error}
          type="warning"
          style={{ marginBottom: 24 }}
          showIcon
        />
      )}
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
            <Statistic
              title="活跃分享"
              value={stats?.shares.enabled || 0}
              prefix={<ShareAltOutlined />}
              valueStyle={{ color: 'var(--success-color)' }}
              loading={loading}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
            <Statistic
              title="总分享数"
              value={stats?.shares.total || 0}
              prefix={<FileOutlined />}
              valueStyle={{ color: 'var(--primary-color)' }}
              loading={loading}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
            <Statistic
              title="今日访问量"
              value={stats?.access.daily_visits || 0}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#722ed1' }}
              loading={loading}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
            <Statistic
              title="今日下载量"
              value={stats?.access.daily_downloads || 0}
              prefix={<DownloadOutlined />}
              valueStyle={{ color: 'var(--warning-color)' }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card 
            title="系统状态" 
            bordered={false}
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}
            loading={loading}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
                {stats?.system.status === 'healthy' ? (
                  <CheckCircleOutlined style={{ color: 'var(--success-color)', marginRight: 8 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: 'var(--error-color)', marginRight: 8 }} />
                )}
                系统运行{stats?.system.status === 'healthy' ? '正常' : '异常'}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
                {stats?.system.server === 'running' ? (
                  <CheckCircleOutlined style={{ color: 'var(--success-color)', marginRight: 8 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: 'var(--error-color)', marginRight: 8 }} />
                )}
                服务器状态：{stats?.system.server === 'running' ? '正常' : '停止'}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-primary)' }}>
                {stats?.system.database === 'connected' ? (
                  <CheckCircleOutlined style={{ color: 'var(--success-color)', marginRight: 8 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: 'var(--error-color)', marginRight: 8 }} />
                )}
                数据库连接：{stats?.system.database === 'connected' ? '正常' : '异常'}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card 
            title="访问统计" 
            bordered={false}
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}
            loading={loading}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="本周访问"
                  value={stats?.access.total_visits || 0}
                  valueStyle={{ color: 'var(--primary-color)' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="本周下载"
                  value={stats?.access.total_downloads || 0}
                  valueStyle={{ color: 'var(--warning-color)' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card 
            title="分享统计" 
            bordered={false}
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}
            loading={loading}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="启用分享"
                  value={stats?.shares.enabled || 0}
                  valueStyle={{ color: 'var(--success-color)' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="禁用分享"
                  value={stats?.shares.disabled || 0}
                  valueStyle={{ color: 'var(--error-color)' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage; 