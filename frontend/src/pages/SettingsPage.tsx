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
  Divider,
  message,
  Tabs
} from 'antd';
import { 
  SettingOutlined, 
  SecurityScanOutlined, 
  DatabaseOutlined,
  BellOutlined
} from '@ant-design/icons';

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
          <SettingOutlined />
          <span>常规设置</span>
        </Space>
      ),
      children: (
        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={{
              systemName: 'Quick FShare',
              description: '局域网文件分享系统',
              maxFileSize: 100,
              allowUpload: true,
              enableThumbnails: true,
              defaultLanguage: 'zh-CN',
            }}
          >
            <Form.Item
              name="systemName"
              label="系统名称"
              rules={[{ required: true, message: '请输入系统名称' }]}
            >
              <Input placeholder="请输入系统名称" />
            </Form.Item>

            <Form.Item
              name="description"
              label="系统描述"
            >
              <Input.TextArea placeholder="请输入系统描述" rows={3} />
            </Form.Item>

            <Form.Item
              name="maxFileSize"
              label="最大文件大小 (MB)"
              rules={[{ required: true, message: '请输入最大文件大小' }]}
            >
              <InputNumber 
                min={1} 
                max={1024} 
                style={{ width: '100%' }}
                placeholder="请输入最大文件大小"
              />
            </Form.Item>

            <Form.Item
              name="allowUpload"
              label="允许上传文件"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="enableThumbnails"
              label="启用缩略图"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="defaultLanguage"
              label="默认语言"
              rules={[{ required: true, message: '请选择默认语言' }]}
            >
              <Select placeholder="请选择默认语言">
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
          <SecurityScanOutlined />
          <span>安全设置</span>
        </Space>
      ),
      children: (
        <Card>
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
              label="启用身份验证"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="sessionTimeout"
              label="会话超时时间 (小时)"
            >
              <InputNumber 
                min={1} 
                max={168} 
                style={{ width: '100%' }}
                placeholder="请输入会话超时时间"
              />
            </Form.Item>

            <Form.Item
              name="maxLoginAttempts"
              label="最大登录尝试次数"
            >
              <InputNumber 
                min={1} 
                max={10} 
                style={{ width: '100%' }}
                placeholder="请输入最大登录尝试次数"
              />
            </Form.Item>

            <Form.Item
              name="enableRateLimit"
              label="启用访问频率限制"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="enableHttps"
              label="启用 HTTPS"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit">
                保存安全设置
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
          <DatabaseOutlined />
          <span>数据库设置</span>
        </Space>
      ),
      children: (
        <Card>
          <Form
            layout="vertical"
            initialValues={{
              dbHost: 'localhost',
              dbPort: 5432,
              dbName: 'quick_fshare',
              enableBackup: true,
              backupFrequency: 'daily',
            }}
          >
            <Form.Item
              name="dbHost"
              label="数据库主机"
            >
              <Input placeholder="请输入数据库主机地址" />
            </Form.Item>

            <Form.Item
              name="dbPort"
              label="数据库端口"
            >
              <InputNumber 
                min={1} 
                max={65535} 
                style={{ width: '100%' }}
                placeholder="请输入数据库端口"
              />
            </Form.Item>

            <Form.Item
              name="dbName"
              label="数据库名称"
            >
              <Input placeholder="请输入数据库名称" />
            </Form.Item>

            <Form.Item
              name="enableBackup"
              label="启用自动备份"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="backupFrequency"
              label="备份频率"
            >
              <Select placeholder="请选择备份频率">
                <Option value="hourly">每小时</Option>
                <Option value="daily">每天</Option>
                <Option value="weekly">每周</Option>
                <Option value="monthly">每月</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit">
                保存数据库设置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: 'notifications',
      label: (
        <Space>
          <BellOutlined />
          <span>通知设置</span>
        </Space>
      ),
      children: (
        <Card>
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
              label="启用邮件通知"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="emailServer"
              label="邮件服务器"
            >
              <Input placeholder="请输入邮件服务器地址" />
            </Form.Item>

            <Form.Item
              name="enableSystemAlerts"
              label="启用系统警报"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="alertThreshold"
              label="警报阈值 (%)"
            >
              <InputNumber 
                min={1} 
                max={100} 
                style={{ width: '100%' }}
                placeholder="请输入警报阈值"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit">
                保存通知设置
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        系统设置
      </Title>
      
      <Tabs 
        defaultActiveKey="general" 
        items={items}
        tabPosition="left"
        style={{ minHeight: '600px' }}
      />
    </div>
  );
};

export default SettingsPage; 