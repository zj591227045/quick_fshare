import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { ShareAltOutlined, FileOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';

const { Title } = Typography;

const DashboardPage: React.FC = () => {
  return (
    <div style={{ padding: '24px', background: 'var(--bg-color)' }}>
      <Title level={2} style={{ marginBottom: 24, color: 'var(--text-primary)' }}>
        仪表盘
      </Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
            <Statistic
              title="活跃分享"
              value={0}
              prefix={<ShareAltOutlined />}
              valueStyle={{ color: 'var(--success-color)' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
            <Statistic
              title="总文件数"
              value={0}
              prefix={<FileOutlined />}
              valueStyle={{ color: 'var(--primary-color)' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
            <Statistic
              title="总访问量"
              value={0}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
            <Statistic
              title="总下载量"
              value={0}
              prefix={<DownloadOutlined />}
              valueStyle={{ color: 'var(--warning-color)' }}
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
          >
            <p style={{ color: 'var(--text-primary)' }}>系统运行正常</p>
            <p style={{ color: 'var(--text-primary)' }}>服务器状态：正常</p>
            <p style={{ color: 'var(--text-primary)' }}>数据库连接：正常</p>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage; 