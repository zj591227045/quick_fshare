import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Typography, Modal, Form, Input, Select, Collapse, App, Switch, Drawer } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined, FolderOutlined, DatabaseOutlined, CloudServerOutlined, SettingOutlined, ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import { SharePath, CreateShareRequest } from '@/types';
import { sharesApi, browseApi } from '@/services/api';
import IndexManagementPanel from '@/components/IndexManagementPanel';
import IncrementalConfigModal from '@/components/IncrementalConfigModal';

const { Title } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const SharesPage: React.FC = () => {
  const { message } = App.useApp();
  const [shares, setShares] = useState<SharePath[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShare, setEditingShare] = useState<SharePath | null>(null);
  const [form] = Form.useForm();
  const [shareType, setShareType] = useState<'local' | 'smb' | 'nfs'>('local');
  
  // 索引管理相关状态
  const [indexDrawerVisible, setIndexDrawerVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedShareIds, setSelectedShareIds] = useState<number[]>([]);
  const [batchOperating, setBatchOperating] = useState(false);

  // 加载分享列表
  const loadShares = async () => {
    setLoading(true);
    try {
      const response = await sharesApi.list();
      if (response.success && response.data) {
        setShares(response.data.shares);
      }
    } catch (error) {
      message.error('加载分享列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShares();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => {
        const typeConfig = {
          local: { icon: <FolderOutlined />, color: 'blue', text: '本地' },
          smb: { icon: <DatabaseOutlined />, color: 'green', text: 'SMB' },
          nfs: { icon: <CloudServerOutlined />, color: 'orange', text: 'NFS' }
        };
        const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.local;
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '分享名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
    },
    {
      title: '访问方式',
      dataIndex: 'accessType',
      key: 'accessType',
      render: (accessType: string) => (
        <Tag color={accessType === 'public' ? 'green' : 'orange'}>
          {accessType === 'public' ? '公开访问' : '密码访问'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'red'}>
          {enabled ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => {
        if (!time) return '-';
        try {
          return new Date(time).toLocaleString();
        } catch {
          return time; // 如果转换失败，直接显示原始字符串
        }
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_: any, record: SharePath) => (
        <Space size="small">
          <Button 
            type="link" 
            icon={<LinkOutlined />}
            size="small"
            onClick={() => handleCopyLink(record)}
          >
            复制链接
          </Button>
          <Button 
            type="link" 
            icon={<DatabaseOutlined />}
            size="small"
            onClick={() => handleOpenIndexDrawer(record)}
          >
            索引管理
          </Button>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const handleAdd = () => {
    setEditingShare(null);
    setShareType('local');
    form.resetFields();
    form.setFieldsValue({
      type: 'local',
      access_type: 'public',
      enabled: true,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (share: SharePath) => {
    setEditingShare(share);
    setShareType(share.type as 'local' | 'smb' | 'nfs');
    
    // 设置基本字段
    const formValues: any = {
      name: share.name,
      description: share.description || '',
      path: share.path,
      type: share.type,
      access_type: share.accessType,
      password: '', // 密码字段始终为空，出于安全考虑
      enabled: share.enabled,
    };

    // 设置SMB配置
    if (share.type === 'smb' && share.smbConfig) {
      formValues.smb_server_ip = share.smbConfig.server_ip;
      formValues.smb_share_name = share.smbConfig.share_name;
      formValues.smb_username = share.smbConfig.username;
      formValues.smb_password = ''; // 密码字段为空，出于安全考虑
      formValues.smb_domain = share.smbConfig.domain || 'WORKGROUP';
    }

    // 设置NFS配置
    if (share.type === 'nfs' && share.nfsConfig) {
      formValues.nfs_server_ip = share.nfsConfig.server_ip;
      formValues.nfs_export_path = share.nfsConfig.export_path;
      formValues.nfs_mount_options = share.nfsConfig.mount_options || 'ro,soft,intr';
    }

    form.setFieldsValue(formValues);
    setIsModalOpen(true);
  };

  const handleDelete = (share: SharePath) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分享 "${share.name}" 吗？此操作不可撤销。`,
      onOk: async () => {
        try {
          const response = await sharesApi.delete(share.id);
          if (response.success) {
            message.success('删除成功');
            loadShares();
          } else {
            message.error(response.message || '删除失败');
          }
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleCopyLink = (share: SharePath) => {
    const link = `${window.location.origin}/share/${share.id}`;
    navigator.clipboard.writeText(link);
    message.success('链接已复制到剪贴板');
  };

  const handleSave = async (values: any) => {
    try {
      const shareData: CreateShareRequest = {
        name: values.name,
        description: values.description || '',
        path: values.path,
        type: values.type,
        access_type: values.access_type,
        password: values.password || undefined,
        enabled: values.enabled !== undefined ? values.enabled : true,
      };

      // 添加SMB配置
      if (values.type === 'smb') {
        shareData.smb_config = {
          server_ip: values.smb_server_ip || '',
          share_name: values.smb_share_name || '',
          username: values.smb_username || '',
          password: values.smb_password || '',
          domain: values.smb_domain || 'WORKGROUP',
        };
      }

      // 添加NFS配置
      if (values.type === 'nfs') {
        shareData.nfs_config = {
          server_ip: values.nfs_server_ip || '',
          export_path: values.nfs_export_path || '',
          mount_options: values.nfs_mount_options || 'ro,soft,intr',
        };
      }

      let response;
      if (editingShare) {
        response = await sharesApi.update(editingShare.id, shareData);
      } else {
        response = await sharesApi.create(shareData);
      }

      if (response.success) {
        message.success(editingShare ? '更新成功' : '创建成功');
        setIsModalOpen(false);
        loadShares();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleTypeChange = (type: 'local' | 'smb' | 'nfs') => {
    setShareType(type);
    // 清除相关配置字段
    if (type !== 'smb') {
      form.setFieldsValue({
        smb_server_ip: undefined,
        smb_share_name: undefined,
        smb_username: undefined,
        smb_password: undefined,
        smb_domain: undefined,
      });
    }
    if (type !== 'nfs') {
      form.setFieldsValue({
        nfs_server_ip: undefined,
        nfs_export_path: undefined,
        nfs_mount_options: undefined,
      });
    }
  };

  // 索引管理相关处理函数
  const handleOpenIndexDrawer = (share: SharePath) => {
    setEditingShare(share);
    setIndexDrawerVisible(true);
  };

  const handleBatchRebuildIndex = async () => {
    if (selectedShareIds.length === 0) {
      message.warning('请先选择要重建索引的分享');
      return;
    }

    setBatchOperating(true);
    try {
      const response = await browseApi.batchRebuildIndex(selectedShareIds);
      if (response.success) {
        message.success(`已开始重建 ${selectedShareIds.length} 个分享的索引`);
        setSelectedShareIds([]);
      } else {
        message.error(response.message || '批量重建索引失败');
      }
    } catch (error) {
      message.error('批量重建索引失败');
    } finally {
      setBatchOperating(false);
    }
  };

  const handleCleanupIndexes = async () => {
    Modal.confirm({
      title: '确认清理索引',
      content: '确定要清理所有过期和无效的索引文件吗？此操作不可撤销。',
      onOk: async () => {
        try {
          const response = await browseApi.cleanupIndexes();
          if (response.success) {
            message.success('索引清理完成');
          } else {
            message.error(response.message || '索引清理失败');
          }
        } catch (error) {
          message.error('索引清理失败');
        }
      },
    });
  };

  const handleConfigIncrementalUpdate = () => {
    setConfigModalVisible(true);
  };

  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys: selectedShareIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedShareIds(selectedRowKeys as number[]);
    },
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>分享管理</Title>
        <Space>
          <Button icon={<SettingOutlined />} onClick={handleConfigIncrementalUpdate}>
            增量更新配置
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建分享
          </Button>
        </Space>
      </div>

      {/* 批量操作工具栏 */}
      {selectedShareIds.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <span>已选择 {selectedShareIds.length} 个分享</span>
            <Button
              type="primary"
              size="small"
              icon={<ReloadOutlined />}
              loading={batchOperating}
              onClick={handleBatchRebuildIndex}
            >
              批量重建索引
            </Button>
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={handleCleanupIndexes}
            >
              清理索引
            </Button>
            <Button size="small" onClick={() => setSelectedShareIds([])}>
              取消选择
            </Button>
          </Space>
        </Card>
      )}
      
      <Card variant="outlined">
        <Table
          columns={columns}
          dataSource={shares}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            total: shares.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingShare ? '编辑分享' : '新建分享'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            type: 'local',
            access_type: 'public',
            enabled: true,
          }}
        >
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
            name="type"
            label="分享类型"
            rules={[{ required: true, message: '请选择分享类型' }]}
          >
            <Select placeholder="请选择分享类型" onChange={handleTypeChange}>
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

          <Form.Item
            name="path"
            label={shareType === 'local' ? '本地路径' : '远程路径'}
            rules={[{ required: true, message: '请输入路径' }]}
          >
            <Input placeholder={shareType === 'local' ? '例如: /home/files' : '例如: /shared/files'} />
          </Form.Item>

          {/* SMB 配置 */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const currentType = getFieldValue('type');
              
              return currentType === 'smb' ? (
                <Collapse ghost defaultActiveKey={['smb']}>
                  <Panel header="SMB 连接配置" key="smb">
                    <Form.Item
                      name="smb_server_ip"
                      label="服务器地址"
                      rules={[{ required: true, message: '请输入SMB服务器地址' }]}
                    >
                      <Input placeholder="例如: 192.168.1.100" />
                    </Form.Item>

                    <Form.Item
                      name="smb_share_name"
                      label="共享名称"
                      rules={[{ required: true, message: '请输入SMB共享名称' }]}
                    >
                      <Input placeholder="例如: shared" />
                    </Form.Item>

                    <Form.Item
                      name="smb_username"
                      label="用户名"
                    >
                      <Input placeholder="SMB用户名（可选）" />
                    </Form.Item>

                    <Form.Item
                      name="smb_password"
                      label="密码"
                    >
                      <Input.Password placeholder="SMB密码（可选）" />
                    </Form.Item>

                    <Form.Item
                      name="smb_domain"
                      label="域"
                    >
                      <Input placeholder="域名（可选，默认: WORKGROUP）" />
                    </Form.Item>
                  </Panel>
                </Collapse>
              ) : null;
            }}
          </Form.Item>

          {/* NFS 配置 */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const currentType = getFieldValue('type');
              
              return currentType === 'nfs' ? (
                <Collapse ghost defaultActiveKey={['nfs']}>
                  <Panel header="NFS 连接配置" key="nfs">
                    <Form.Item
                      name="nfs_server_ip"
                      label="服务器地址"
                      rules={[{ required: true, message: '请输入NFS服务器地址' }]}
                    >
                      <Input placeholder="例如: 192.168.1.100" />
                    </Form.Item>

                    <Form.Item
                      name="nfs_export_path"
                      label="导出路径"
                      rules={[{ required: true, message: '请输入NFS导出路径' }]}
                    >
                      <Input placeholder="例如: /export/shared" />
                    </Form.Item>

                    <Form.Item
                      name="nfs_mount_options"
                      label="挂载选项"
                    >
                      <Input placeholder="例如: ro,soft,intr（可选）" />
                    </Form.Item>
                  </Panel>
                </Collapse>
              ) : null;
            }}
          </Form.Item>

          <Form.Item
            name="access_type"
            label="访问控制"
            rules={[{ required: true, message: '请选择访问控制类型' }]}
          >
            <Select placeholder="请选择访问控制类型">
              <Option value="public">公开访问</Option>
              <Option value="password">密码保护</Option>
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
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 索引管理抽屉 */}
      <Drawer
        title="索引管理"
        open={indexDrawerVisible}
        onClose={() => setIndexDrawerVisible(false)}
        width={900}
        placement="right"
      >
        {editingShare && (
          <IndexManagementPanel
            shareId={editingShare.id}
            shareName={editingShare.name}
            shareType={editingShare.type}
          />
        )}
      </Drawer>

      {/* 增量更新配置模态框 */}
      <IncrementalConfigModal
        visible={configModalVisible}
        onClose={() => setConfigModalVisible(false)}
        onSuccess={() => {
          message.success('配置已更新，将在下次检查时生效');
        }}
      />
    </div>
  );
};

export default SharesPage; 