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
              <Button icon={<ReloadOutlined />} type="text" style={{ color: 'var(--text-primary)' }}>
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
                    percent={45} 
                    status="active" 
                    strokeColor={{ from: 'var(--primary-color)', to: 'var(--success-color)' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card 
                  size="small" 
                  title={<span style={{ color: 'var(--text-primary)' }}>内存使用率</span>}
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}
                >
                  <Progress 
                    percent={67} 
                    status="active"
                    strokeColor={{ from: 'var(--primary-color)', to: 'var(--success-color)' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card 
                  size="small" 
                  title={<span style={{ color: 'var(--text-primary)' }}>磁盘使用率</span>}
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-secondary)' }}
                >
                  <Progress 
                    percent={23} 
                    status="active"
                    strokeColor={{ from: 'var(--primary-color)', to: 'var(--success-color)' }}
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
                v20.11.1
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>运行时间</span>}
                contentStyle={{ color: 'var(--text-primary)' }}
              >
                2小时15分钟
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>服务状态</span>}
              >
                <Tag color="green">运行中</Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>数据库连接</span>}
              >
                <Tag color="green">正常</Tag>
              </Descriptions.Item>
              <Descriptions.Item 
                label={<span style={{ color: 'var(--text-secondary)' }}>端口监听</span>}
                contentStyle={{ color: 'var(--text-primary)' }}
              >
                3001
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