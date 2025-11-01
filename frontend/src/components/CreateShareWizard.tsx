import React, { useState } from 'react';
import { Modal, Steps, Form, Input, Select, Button, Card, Space, Typography, Spin, message, List, Tree, Switch, Divider } from 'antd';
import { FolderOutlined, DatabaseOutlined, CloudServerOutlined, UserOutlined, LockOutlined, GlobalOutlined, CheckOutlined } from '@ant-design/icons';
import { sharesApi } from '@/services/api';
import { CreateShareRequest, SMBConfig } from '@/types';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;

interface CreateShareWizardProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

interface WizardData {
  type: 'local' | 'smb' | 'nfs';
  name: string;
  description: string;
  path: string;
  access_type: 'public' | 'password';
  password?: string;
  enabled: boolean;
  smb_config?: SMBConfig;
}

interface SMBShareItem {
  name: string;
  type: string;
  comment?: string;
}

interface DirectoryItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  path: string;
}

const CreateShareWizard: React.FC<CreateShareWizardProps> = ({ visible, onCancel, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  
  // 向导数据
  const [wizardData, setWizardData] = useState<WizardData>({
    type: 'local',
    name: '',
    description: '',
    path: '',
    access_type: 'public',
    enabled: true,
  });

  // SMB相关状态
  const [smbConfig, setSmbConfig] = useState({
    server_ip: '',
    port: 445,
    username: '',
    password: '',
    domain: 'WORKGROUP',
  });
  const [smbShares, setSmbShares] = useState<SMBShareItem[]>([]);
  const [selectedShare, setSelectedShare] = useState<string>('');
  const [directoryTree, setDirectoryTree] = useState<any[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('/');

  const steps = [
    {
      title: '选择类型',
      icon: <FolderOutlined />,
    },
    {
      title: '配置连接',
      icon: <DatabaseOutlined />,
    },
    {
      title: '选择共享',
      icon: <CloudServerOutlined />,
    },
    {
      title: '浏览目录',
      icon: <FolderOutlined />,
    },
    {
      title: '分享设置',
      icon: <GlobalOutlined />,
    },
  ];

  const handleNext = async () => {
    if (currentStep === 0) {
      // 类型选择步骤
      const type = form.getFieldValue('type');
      if (!type) {
        message.error('请选择分享类型');
        return;
      }
      setWizardData({ ...wizardData, type });
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // SMB配置步骤
      if (wizardData.type === 'smb') {
        await handleSMBConfig();
      } else {
        setCurrentStep(wizardData.type === 'local' ? 4 : 4); // 跳转到分享设置
      }
    } else if (currentStep === 2) {
      // 共享选择步骤
      if (!selectedShare) {
        message.error('请选择一个共享');
        return;
      }
      await loadDirectoryTree(selectedShare, '/');
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // 目录浏览步骤
      if (!selectedPath) {
        message.error('请选择一个目录');
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      // 分享设置步骤
      await handleCreateShare();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSMBConfig = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields(['server_ip', 'port', 'username', 'password', 'domain']);
      
      const config = {
        server_ip: values.server_ip,
        port: values.port || 445,
        username: values.username || '',
        password: values.password || '',
        domain: values.domain || 'WORKGROUP',
      };
      
      setSmbConfig(config);
      
      // 枚举SMB共享
      const response = await sharesApi.enumerateSMBShares(config);
      if (response.success && response.data) {
        setSmbShares(response.data.shares);
        if (response.data.shares.length === 0) {
          message.warning('未找到可用的共享');
          return;
        }
        setCurrentStep(2);
      } else {
        message.error(response.message || '获取SMB共享失败');
      }
    } catch (error: any) {
      message.error(error.message || '连接SMB服务器失败');
    } finally {
      setLoading(false);
    }
  };

  const loadDirectoryTree = async (shareName: string, path: string) => {
    try {
      setLoading(true);
      const response = await sharesApi.browseSMBDirectory({
        ...smbConfig,
        share_name: shareName,
        path,
      });
      
      if (response.success && response.data) {
        console.log('目录数据:', response.data); // 调试日志
        
        const treeData = response.data.files
          .filter(file => file.type === 'directory')
          .map(dir => ({
            title: dir.name,
            key: dir.path,
            isLeaf: false,
            children: [], // 初始为空，点击时再加载
          }));
        
        console.log('转换后的树数据:', treeData); // 调试日志
        setDirectoryTree(treeData);
      } else {
        message.error(response.message || '获取目录内容失败');
      }
    } catch (error: any) {
      console.error('加载目录树失败:', error); // 调试日志
      message.error(error.message || '浏览目录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectorySelect = async (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      const path = selectedKeys[0] as string;
      setSelectedPath(path);
      
      // 加载子目录
      if (info.node.children.length === 0) {
        try {
          const response = await sharesApi.browseSMBDirectory({
            ...smbConfig,
            share_name: selectedShare,
            path,
          });
          
          if (response.success && response.data) {
            const childData = response.data.files
              .filter(file => file.type === 'directory')
              .map(dir => ({
                title: dir.name,
                key: dir.path,
                isLeaf: false,
                children: [],
              }));
            
            info.node.children = childData;
            setDirectoryTree([...directoryTree]);
          }
        } catch (error) {
          console.error('加载子目录失败:', error);
        }
      }
    }
  };

  const handleCreateShare = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields(['name', 'description', 'access_type', 'password', 'enabled']);
      
      const shareData: CreateShareRequest = {
        name: values.name,
        description: values.description || '',
        path: wizardData.type === 'smb' ? selectedPath : values.path || '',
        type: wizardData.type,
        access_type: values.access_type,
        password: values.access_type === 'password' ? values.password : undefined,
        enabled: values.enabled !== undefined ? values.enabled : true,
      };

      if (wizardData.type === 'smb') {
        shareData.smb_config = {
          server_ip: smbConfig.server_ip,
          share_name: selectedShare,
          username: smbConfig.username,
          password: smbConfig.password,
          domain: smbConfig.domain,
        };
      }

      const response = await sharesApi.create(shareData);
      if (response.success) {
        message.success('分享创建成功');
        onSuccess();
        handleReset();
      } else {
        message.error(response.message || '创建分享失败');
      }
    } catch (error: any) {
      message.error(error.message || '创建分享失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setWizardData({
      type: 'local',
      name: '',
      description: '',
      path: '',
      access_type: 'public',
      enabled: true,
    });
    setSmbConfig({
      server_ip: '',
      port: 445,
      username: '',
      password: '',
      domain: 'WORKGROUP',
    });
    setSmbShares([]);
    setSelectedShare('');
    setDirectoryTree([]);
    setSelectedPath('/');
    form.resetFields();
  };

  const handleCancel = () => {
    handleReset();
    onCancel();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card title="选择分享类型">
            <Form.Item
              name="type"
              label="分享类型"
              rules={[{ required: true, message: '请选择分享类型' }]}
            >
              <Select placeholder="请选择分享类型" size="large">
                <Option value="local">
                  <Space>
                    <FolderOutlined />
                    本地目录
                  </Space>
                </Option>
                <Option value="smb">
                  <Space>
                    <DatabaseOutlined />
                    SMB/CIFS 共享
                  </Space>
                </Option>
                <Option value="nfs">
                  <Space>
                    <CloudServerOutlined />
                    NFS 共享
                  </Space>
                </Option>
              </Select>
            </Form.Item>
          </Card>
        );

      case 1:
        if (wizardData.type === 'smb') {
          return (
            <Card title="配置SMB连接">
              <Form.Item
                name="server_ip"
                label="服务器地址"
                rules={[{ required: true, message: '请输入SMB服务器地址' }]}
              >
                <Input placeholder="例如: 192.168.1.100" />
              </Form.Item>

              <Form.Item
                name="port"
                label="端口"
                initialValue={445}
              >
                <Input type="number" placeholder="默认: 445" />
              </Form.Item>

              <Form.Item
                name="username"
                label="用户名"
              >
                <Input placeholder="SMB用户名（可选）" />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
              >
                <Input.Password placeholder="SMB密码（可选）" />
              </Form.Item>

              <Form.Item
                name="domain"
                label="域"
                initialValue="WORKGROUP"
              >
                <Input placeholder="域名（可选，默认: WORKGROUP）" />
              </Form.Item>
            </Card>
          );
        } else if (wizardData.type === 'local') {
          return (
            <Card title="配置本地目录">
              <Form.Item
                name="path"
                label="本地路径"
                rules={[{ required: true, message: '请输入本地路径' }]}
              >
                <Input placeholder="例如: /home/files" />
              </Form.Item>
            </Card>
          );
        } else {
          return (
            <Card title="配置NFS连接">
              <Text>NFS配置功能开发中...</Text>
            </Card>
          );
        }

      case 2:
        return (
          <Card title="选择SMB共享">
            <List
              dataSource={smbShares}
              renderItem={(share) => (
                <List.Item
                  onClick={() => setSelectedShare(share.name)}
                  className={selectedShare === share.name ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  <List.Item.Meta
                    avatar={<DatabaseOutlined />}
                    title={share.name}
                    description={share.comment || share.type}
                  />
                  {selectedShare === share.name && <CheckOutlined style={{ color: '#52c41a' }} />}
                </List.Item>
              )}
            />
          </Card>
        );

      case 3:
        return (
          <Card title="浏览目录">
            <div style={{ marginBottom: 16 }}>
              <Text strong>当前路径: {selectedPath}</Text>
            </div>
            <Tree
              treeData={directoryTree}
              onSelect={handleDirectorySelect}
              selectedKeys={selectedPath ? [selectedPath] : []}
              showLine
              showIcon
              expandedKeys={directoryTree.map(item => item.key)}
              onExpand={async (expandedKeys, { node }) => {
                if (node.children.length === 0) {
                  // 动态加载子目录
                  try {
                    const response = await sharesApi.browseSMBDirectory({
                      ...smbConfig,
                      share_name: selectedShare,
                      path: node.key,
                    });
                    
                    if (response.success && response.data) {
                      const childData = response.data.files
                        .filter(file => file.type === 'directory')
                        .map(dir => ({
                          title: dir.name,
                          key: dir.path,
                          isLeaf: false,
                          children: [],
                        }));
                      
                      // 更新节点
                      const updateTreeData = (nodes: any[], targetKey: string, children: any[]): any[] => {
                        return nodes.map(node => {
                          if (node.key === targetKey) {
                            return { ...node, children };
                          }
                          if (node.children && node.children.length > 0) {
                            return {
                              ...node,
                              children: updateTreeData(node.children, targetKey, children)
                            };
                          }
                          return node;
                        });
                      };
                      
                      const newTreeData = updateTreeData(directoryTree, node.key, childData);
                      setDirectoryTree([...newTreeData]);
                    }
                  } catch (error) {
                    console.error('动态加载子目录失败:', error);
                  }
                }
              }}
            />
            <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
              <Text>目录数量: {directoryTree.length}</Text>
              {directoryTree.length === 0 && (
                <Text type="warning">没有找到子目录，请检查SMB服务器权限和路径</Text>
              )}
            </div>
          </Card>
        );

      case 4:
        return (
          <Card title="分享设置">
            <Form.Item
              name="name"
              label="分享名称"
              rules={[{ required: true, message: '请输入分享名称' }]}
            >
              <Input placeholder="请输入分享名称" />
            </Form.Item>

            <Form.Item
              name="description"
              label="分享描述"
            >
              <Input.TextArea placeholder="请输入分享描述（可选）" rows={3} />
            </Form.Item>

            <Form.Item
              name="access_type"
              label="访问控制"
              rules={[{ required: true, message: '请选择访问控制类型' }]}
            >
              <Select placeholder="请选择访问控制类型">
                <Option value="public">
                  <Space>
                    <GlobalOutlined />
                    公开访问
                  </Space>
                </Option>
                <Option value="password">
                  <Space>
                    <LockOutlined />
                    密码保护
                  </Space>
                </Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.access_type !== currentValues.access_type}
            >
              {({ getFieldValue }) => {
                return getFieldValue('access_type') === 'password' ? (
                  <Form.Item
                    name="password"
                    label="访问密码"
                    rules={[{ required: true, message: '请输入访问密码' }]}
                  >
                    <Input.Password placeholder="请输入访问密码" />
                  </Form.Item>
                ) : null;
              }}
            </Form.Item>

            <Form.Item
              name="enabled"
              label="启用状态"
              valuePropName="checked"
              initialValue={true}
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title="新建分享"
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={null}
      destroyOnClose
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        {steps
          .filter((_, index) => {
            // 根据类型过滤步骤
            if (wizardData.type === 'local') {
              return index === 0 || index === 1 || index === 4;
            } else if (wizardData.type === 'smb') {
              return index < 5;
            } else {
              return index === 0 || index === 1 || index === 4;
            }
          })
          .map((step, index) => (
            <Step key={index} title={step.title} icon={step.icon} />
          ))}
      </Steps>

      <Spin spinning={loading}>
        <Form form={form} layout="vertical">
          {renderStepContent()}
        </Form>

        <Divider />

        <div style={{ textAlign: 'right' }}>
          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev}>
                上一步
              </Button>
            )}
            <Button onClick={handleCancel}>
              取消
            </Button>
            <Button type="primary" onClick={handleNext} loading={loading}>
              {currentStep === 4 ? '创建分享' : '下一步'}
            </Button>
          </Space>
        </div>
      </Spin>
    </Modal>
  );
};

export default CreateShareWizard;
