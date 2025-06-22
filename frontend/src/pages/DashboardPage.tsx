import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import { ShareAltOutlined, FileOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';

const { Title } = Typography;

const DashboardPage: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        仪表盘
      </Title>
      
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃分享"
              value={0}
              prefix={<ShareAltOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总文件数"
              value={0}
              prefix={<FileOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总访问量"
              value={0}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总下载量"
              value={0}
              prefix={<DownloadOutlined />}
              valueStyle={{ color: '#fa541c' }}
            />
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="系统状态" bordered={false}>
            <p>系统运行正常</p>
            <p>服务器状态：正常</p>
            <p>数据库连接：正常</p>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage; 