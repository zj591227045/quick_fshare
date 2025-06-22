import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Switch, 
  Select, 
  InputNumber, 
  Typography, 
  Space,

  message,
  Tabs
} from 'antd';
import { 
  SettingOutlined, 
  SecurityScanOutlined, 
  DatabaseOutlined,
  BellOutlined,
  BgColorsOutlined
} from '@ant-design/icons';
import ThemeSettings from '@/components/ThemeSettings';

const { Title } = Typography;
const { Option } = Select;

const SettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      console.log('保存设置:', values);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 模拟API调用
      message.success('设置保存成功');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const items = [
    {
      key: 'general',
      label: (
        <Space>
          <SettingOutlined style={{ color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-primary)' }}>常规设置</span>
        </Space>
      ),
      children: (
        <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={{
              systemName: 'Quick FShare',
              description: '私有文件分享系统',
              maxFileSize: 100,
              allowUpload: true,
              enableThumbnails: true,
              defaultLanguage: 'zh-CN',
            }}
          >
            <Form.Item
              name="systemName"
              label={<span style={{ color: 'var(--text-primary)' }}>系统名称</span>}
              rules={[{ required: true, message: '请输入系统名称' }]}
            >
              <Input 
                placeholder="请输入系统名称" 
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }} 
              />
            </Form.Item>

            <Form.Item
              name="description"
              label={<span style={{ color: 'var(--text-primary)' }}>系统描述</span>}
            >
              <Input.TextArea 
                placeholder="请输入系统描述" 
                rows={3}
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }} 
              />
            </Form.Item>

            <Form.Item
              name="maxFileSize"
              label={<span style={{ color: 'var(--text-primary)' }}>最大文件大小 (MB)</span>}
              rules={[{ required: true, message: '请输入最大文件大小' }]}
            >
              <InputNumber 
                min={1} 
                max={1024} 
                style={{ 
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
                placeholder="请输入最大文件大小"
              />
            </Form.Item>

            <Form.Item
              name="allowUpload"
              label={<span style={{ color: 'var(--text-primary)' }}>允许上传文件</span>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="enableThumbnails"
              label={<span style={{ color: 'var(--text-primary)' }}>启用缩略图</span>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="defaultLanguage"
              label={<span style={{ color: 'var(--text-primary)' }}>默认语言</span>}
              rules={[{ required: true, message: '请选择默认语言' }]}
            >
              <Select 
                placeholder="请选择默认语言"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)'
                }}
              >
                <Option value="zh-CN">简体中文</Option>
                <Option value="en-US">English</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存设置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'security',
      label: (
        <Space>
          <SecurityScanOutlined style={{ color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-primary)' }}>安全设置</span>
        </Space>
      ),
      children: (
        <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
          <Form
            layout="vertical"
            initialValues={{
              enableAuth: true,
              sessionTimeout: 24,
              maxLoginAttempts: 5,
              enableRateLimit: true,
              enableHttps: false,
            }}
          >
            <Form.Item
              name="enableAuth"
              label={<span style={{ color: 'var(--text-primary)' }}>启用身份验证</span>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="sessionTimeout"
              label={<span style={{ color: 'var(--text-primary)' }}>会话超时时间 (小时)</span>}
            >
              <InputNumber 
                min={1} 
                max={168} 
                style={{ 
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
                placeholder="请输入会话超时时间"
              />
            </Form.Item>

            <Form.Item
              name="maxLoginAttempts"
              label={<span style={{ color: 'var(--text-primary)' }}>最大登录尝试次数</span>}
            >
              <InputNumber 
                min={1} 
                max={10} 
                style={{ 
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
                placeholder="请输入最大登录尝试次数"
              />
            </Form.Item>

            <Form.Item
              name="enableRateLimit"
              label={<span style={{ color: 'var(--text-primary)' }}>启用访问频率限制</span>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="enableHttps"
              label={<span style={{ color: 'var(--text-primary)' }}>启用 HTTPS</span>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存设置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'database',
      label: (
        <Space>
          <DatabaseOutlined style={{ color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-primary)' }}>数据库设置</span>
        </Space>
      ),
      children: (
        <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
          <Form
            layout="vertical"
            initialValues={{
              dbType: 'SQLite',
              dbPath: '/data/quickfshare.db',
              enableBackup: true,
              backupFrequency: 'daily',
              maxBackupFiles: 7,
              enableVacuum: true,
              vacuumFrequency: 'weekly',
            }}
          >
            <Form.Item
              label={<span style={{ color: 'var(--text-primary)' }}>数据库类型</span>}
            >
              <Input 
                value="SQLite" 
                disabled 
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)'
                }}
              />
            </Form.Item>

            <Form.Item
              name="dbPath"
              label={<span style={{ color: 'var(--text-primary)' }}>数据库文件路径</span>}
            >
              <Input 
                placeholder="数据库文件路径" 
                disabled
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)'
                }}
              />
            </Form.Item>

            <Form.Item
              name="enableBackup"
              label={<span style={{ color: 'var(--text-primary)' }}>启用自动备份</span>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="backupFrequency"
              label={<span style={{ color: 'var(--text-primary)' }}>备份频率</span>}
            >
              <Select 
                placeholder="请选择备份频率"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)'
                }}
              >
                <Option value="hourly">每小时</Option>
                <Option value="daily">每天</Option>
                <Option value="weekly">每周</Option>
                <Option value="monthly">每月</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="maxBackupFiles"
              label={<span style={{ color: 'var(--text-primary)' }}>最大备份文件数</span>}
            >
              <InputNumber 
                min={1} 
                max={30} 
                style={{ 
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
                placeholder="保留的备份文件数量"
              />
            </Form.Item>

            <Form.Item
              name="enableVacuum"
              label={<span style={{ color: 'var(--text-primary)' }}>启用数据库优化</span>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="vacuumFrequency"
              label={<span style={{ color: 'var(--text-primary)' }}>优化频率</span>}
            >
              <Select 
                placeholder="请选择优化频率"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)'
                }}
              >
                <Option value="daily">每天</Option>
                <Option value="weekly">每周</Option>
                <Option value="monthly">每月</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  保存数据库设置
                </Button>
                <Button 
                  style={{ 
                    borderColor: 'var(--border-color)', 
                    color: 'var(--text-primary)' 
                  }}
                >
                  立即备份
                </Button>
                <Button 
                  style={{ 
                    borderColor: 'var(--border-color)', 
                    color: 'var(--text-primary)' 
                  }}
                >
                  优化数据库
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'notifications',
      label: (
        <Space>
          <BellOutlined style={{ color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-primary)' }}>通知设置</span>
        </Space>
      ),
      children: (
        <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-secondary)' }}>
          <Form
            layout="vertical"
            initialValues={{
              enableEmailNotifications: false,
              enableSystemAlerts: true,
              alertThreshold: 80,
            }}
          >
            <Form.Item
              name="enableEmailNotifications"
              label={<span style={{ color: 'var(--text-primary)' }}>启用邮件通知</span>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="emailServer"
              label={<span style={{ color: 'var(--text-primary)' }}>邮件服务器</span>}
            >
              <Input 
                placeholder="请输入邮件服务器地址" 
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </Form.Item>

            <Form.Item
              name="enableSystemAlerts"
              label={<span style={{ color: 'var(--text-primary)' }}>启用系统警报</span>}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="alertThreshold"
              label={<span style={{ color: 'var(--text-primary)' }}>警报阈值 (%)</span>}
            >
              <InputNumber 
                min={1} 
                max={100} 
                style={{ 
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
                placeholder="请输入警报阈值"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存通知设置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'theme',
      label: (
        <Space>
          <BgColorsOutlined style={{ color: 'var(--text-primary)' }} />
          <span style={{ color: 'var(--text-primary)' }}>主题设置</span>
        </Space>
      ),
      children: <ThemeSettings />,
    },
  ];

  return (
    <div style={{ padding: '24px', background: 'var(--bg-color)' }}>
      <Title level={2} style={{ marginBottom: 24, color: 'var(--text-primary)' }}>
        系统设置
      </Title>
      
      <Tabs 
        defaultActiveKey="general" 
        items={items} 
        style={{ background: 'var(--bg-color)' }}
      />
    </div>
  );
};

export default SettingsPage; 