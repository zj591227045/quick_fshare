import React from 'react';
import { Card, Row, Col, Typography, Descriptions, Tag, Progress, Button, Space } from 'antd';
import { 
  DatabaseOutlined, 
  CloudServerOutlined, 
  SecurityScanOutlined,
  ReloadOutlined,
  SettingOutlined 
} from '@ant-design/icons';

const { Title } = Typography;

const SystemPage: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        系统管理
      </Title>
      
      <Row gutter={[16, 16]}>
        {/* 系统状态 */}
        <Col span={24}>
          <Card 
            title={
              <Space>
                <CloudServerOutlined />
                <span>系统状态</span>
              </Space>
            }
            extra={
              <Button icon={<ReloadOutlined />} type="text">
                刷新
              </Button>
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Card size="small" title="CPU 使用率">
                  <Progress 
                    percent={45} 
                    status="active" 
                    strokeColor={{ from: '#108ee9', to: '#87d068' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small" title="内存使用率">
                  <Progress 
                    percent={67} 
                    status="active"
                    strokeColor={{ from: '#108ee9', to: '#87d068' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small" title="磁盘使用率">
                  <Progress 
                    percent={23} 
                    status="active"
                    strokeColor={{ from: '#108ee9', to: '#87d068' }}
                  />
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
                <DatabaseOutlined />
                <span>服务信息</span>
              </Space>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="系统版本">Quick FShare v1.0.0</Descriptions.Item>
              <Descriptions.Item label="Node.js 版本">v20.11.1</Descriptions.Item>
              <Descriptions.Item label="运行时间">2小时15分钟</Descriptions.Item>
              <Descriptions.Item label="服务状态">
                <Tag color="green">运行中</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="数据库连接">
                <Tag color="green">正常</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="端口监听">3001</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* 安全信息 */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <SecurityScanOutlined />
                <span>安全信息</span>
              </Space>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="认证状态">
                <Tag color="green">已启用</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="HTTPS">
                <Tag color="orange">未配置</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="防火墙">
                <Tag color="green">已启用</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="访问控制">
                <Tag color="green">正常</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="日志记录">
                <Tag color="green">已启用</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="备份状态">
                <Tag color="orange">未配置</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* 系统操作 */}
        <Col span={24}>
          <Card 
            title={
              <Space>
                <SettingOutlined />
                <span>系统操作</span>
              </Space>
            }
          >
            <Space wrap>
              <Button type="primary">重启服务</Button>
              <Button>清理缓存</Button>
              <Button>导出日志</Button>
              <Button>系统备份</Button>
              <Button danger>关闭服务</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SystemPage; 