import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Tag, 
  Typography, 
  Progress, 
  Tooltip, 
  App,
  Spin,
  Statistic,
  Row,
  Col,
  Modal,
  Form,
  Switch,
  InputNumber,
  Slider
} from 'antd';
import { 
  DatabaseOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  HistoryOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { browseApi } from '@/services/api';

const { Text } = Typography;

interface IndexStatusCardProps {
  shareId: number;
  shareName: string;
  shareType: string;
  onStatusChange?: () => void;
}

const IndexStatusCard: React.FC<IndexStatusCardProps> = ({
  shareId,
  shareName,
  shareType,
  onStatusChange
}) => {
  const { message } = App.useApp();
  const [indexStatus, setIndexStatus] = useState<any>(null);
  const [incrementalStats, setIncrementalStats] = useState<any>(null);
  const [shareConfig, setShareConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [updatingIncremental, setUpdatingIncremental] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 加载索引状态
  const loadIndexStatus = async () => {
    setLoading(true);
    try {
      const response = await browseApi.getSearchStatus(shareId);
      if (response.success) {
        setIndexStatus(response.data.indexStatus);
      }
    } catch (error) {
      console.error('获取索引状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载增量更新统计
  const loadIncrementalStats = async () => {
    try {
      const response = await browseApi.getIncrementalStats(shareId);
      if (response.success) {
        setIncrementalStats(response.data);
        if (response.data.config) {
          setShareConfig(response.data.config);
        }
      }
    } catch (error) {
      console.error('获取增量统计失败:', error);
    }
  };

  // 加载分享配置
  const loadShareConfig = async () => {
    try {
      const response = await browseApi.getShareConfig(shareId);
      if (response.success) {
        setShareConfig(response.data);
      }
    } catch (error) {
      console.error('获取分享配置失败:', error);
    }
  };

  // 重建索引
  const handleRebuildIndex = async () => {
    setRebuilding(true);
    try {
      const response = await browseApi.rebuildIndex(shareId);
      if (response.success) {
        message.success('索引重建已开始');
        // 开始轮询状态，使用更长的间隔减少频率限制触发
        const pollStatus = setInterval(async () => {
          await loadIndexStatus();
          const currentStatus = indexStatus?.status;
          if (currentStatus === 'completed' || currentStatus === 'failed') {
            clearInterval(pollStatus);
            setRebuilding(false);
            onStatusChange?.();
          }
        }, 5000); // 改为5秒间隔，减少请求频率
      } else {
        message.error(response.message || '重建索引失败');
        setRebuilding(false);
      }
    } catch (error) {
      message.error('重建索引失败');
      setRebuilding(false);
    }
  };

  // 触发增量更新
  const handleIncrementalUpdate = async () => {
    setUpdatingIncremental(true);
    try {
      const response = await browseApi.triggerIncrementalUpdate(shareId);
      if (response.success) {
        message.success('增量更新已完成');
        await loadIndexStatus();
        await loadIncrementalStats();
        onStatusChange?.();
      } else {
        message.error(response.message || '增量更新失败');
      }
    } catch (error) {
      message.error('增量更新失败');
    } finally {
      setUpdatingIncremental(false);
    }
  };

  // 打开配置对话框
  const handleOpenConfig = () => {
    if (shareConfig) {
      form.setFieldsValue({
        incrementalUpdateEnabled: shareConfig.incrementalUpdateEnabled,
        incrementalCheckInterval: Math.round(shareConfig.incrementalCheckInterval / 1000 / 60), // 转换为分钟
        fullRebuildThreshold: Math.round(shareConfig.fullRebuildThreshold * 100) // 转换为百分比
      });
    }
    setConfigModalVisible(true);
  };

  // 保存配置
  const handleSaveConfig = async (values: any) => {
    try {
      const config = {
        incrementalUpdateEnabled: values.incrementalUpdateEnabled,
        incrementalCheckInterval: values.incrementalCheckInterval * 60 * 1000, // 转换为毫秒
        fullRebuildThreshold: values.fullRebuildThreshold / 100 // 转换为小数
      };
      
      const response = await browseApi.setShareConfig(shareId, config);
      if (response.success) {
        message.success('配置已保存');
        setShareConfig(response.data);
        setConfigModalVisible(false);
        await loadIncrementalStats(); // 重新加载统计信息
      } else {
        message.error(response.message || '保存配置失败');
      }
    } catch (error) {
      message.error('保存配置失败');
    }
  };

  useEffect(() => {
    loadIndexStatus();
    loadIncrementalStats();
    loadShareConfig();
  }, [shareId]);

  // 渲染索引状态
  const renderIndexStatus = () => {
    if (loading) {
      return <Spin size="small" />;
    }

    if (!indexStatus) {
      return <Text type="secondary">未知状态</Text>;
    }

    const { status, progress, totalFiles, buildDuration, lastUpdated } = indexStatus;

    switch (status) {
      case 'not_built':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <ExclamationCircleOutlined style={{ color: '#faad14' }} />
              <Text type="warning">索引未构建</Text>
            </Space>
            <Button size="small" onClick={handleRebuildIndex} loading={rebuilding}>
              构建索引
            </Button>
          </Space>
        );
      case 'building':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <SyncOutlined spin style={{ color: '#1890ff' }} />
              <Text>正在构建索引...</Text>
            </Space>
            <Progress percent={progress} size="small" />
          </Space>
        );
      case 'completed':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <Text type="success">索引已就绪</Text>
            </Space>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="文件数量"
                  value={totalFiles?.toLocaleString()}
                  valueStyle={{ fontSize: '14px' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="构建耗时"
                  value={buildDuration ? `${(buildDuration / 1000).toFixed(1)}s` : '-'}
                  valueStyle={{ fontSize: '14px' }}
                />
              </Col>
            </Row>
            {lastUpdated && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                更新时间: {new Date(lastUpdated).toLocaleString()}
              </Text>
            )}
          </Space>
        );
      case 'failed':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              <Text type="danger">索引构建失败</Text>
            </Space>
            <Button size="small" onClick={handleRebuildIndex} loading={rebuilding}>
              重试
            </Button>
          </Space>
        );
      default:
        return <Text type="secondary">未知状态: {status}</Text>;
    }
  };

  // 渲染增量更新信息
  const renderIncrementalInfo = () => {
    if (!incrementalStats) {
      return null;
    }

    const {
      isIncrementalEnabled,
      hasIncrementalTimer,
      lastIncrementalUpdate,
      changesApplied,
      checkInterval
    } = incrementalStats;

    if (!isIncrementalEnabled) {
      return (
        <div>
          <Text type="secondary">增量更新已禁用</Text>
        </div>
      );
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Tag color="green">增量更新已启用</Tag>
          <Tag color={hasIncrementalTimer ? 'blue' : 'orange'}>
            {hasIncrementalTimer ? '监控中' : '未监控'}
          </Tag>
        </Space>
        
        <Text type="secondary" style={{ fontSize: '12px' }}>
          检查间隔: {Math.round(checkInterval / 1000 / 60)}分钟
        </Text>
        
        {lastIncrementalUpdate && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            上次增量更新: {new Date(lastIncrementalUpdate).toLocaleString()}
          </Text>
        )}
        
        {changesApplied && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            最近变更: +{changesApplied.added || 0} ~{changesApplied.modified || 0} -{changesApplied.deleted || 0}
          </Text>
        )}
      </Space>
    );
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <DatabaseOutlined />
          <span>搜索索引 - {shareName}</span>
          <Tag color={shareType === 'smb' ? 'green' : shareType === 'local' ? 'blue' : 'purple'}>
            {shareType === 'smb' ? 'SMB' : shareType === 'local' ? '本地' : 'NFS'}
          </Tag>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="增量更新配置">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={handleOpenConfig}
            />
          </Tooltip>
          <Tooltip title="触发增量更新">
            <Button
              type="text"
              size="small"
              icon={<HistoryOutlined />}
              onClick={handleIncrementalUpdate}
              loading={updatingIncremental}
              disabled={indexStatus?.status !== 'completed'}
            />
          </Tooltip>
          <Tooltip title="重建索引">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRebuildIndex}
              loading={rebuilding}
            />
          </Tooltip>
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <div>
            <Text strong>索引状态</Text>
            <div style={{ marginTop: 8 }}>
              {renderIndexStatus()}
            </div>
          </div>
        </Col>
        <Col span={12}>
          <div>
            <Text strong>增量更新</Text>
            <div style={{ marginTop: 8 }}>
              {renderIncrementalInfo()}
            </div>
          </div>
        </Col>
      </Row>

      {/* 配置对话框 */}
      <Modal
        title={`${shareName} - 增量更新配置`}
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveConfig}
          initialValues={{
            incrementalUpdateEnabled: true,
            incrementalCheckInterval: 10,
            fullRebuildThreshold: 80
          }}
        >
          <Form.Item
            name="incrementalUpdateEnabled"
            label="启用增量更新"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="incrementalCheckInterval"
            label="检查间隔（分钟）"
            rules={[
              { required: true, message: '请设置检查间隔' },
              { type: 'number', min: 1, max: 1440, message: '间隔必须在1-1440分钟之间' }
            ]}
          >
            <div>
              <div style={{ marginBottom: 16 }}>
                <Slider
                  min={1}
                  max={120}
                  marks={{
                    1: '1分',
                    5: '5分',
                    10: '10分',
                    30: '30分',
                    60: '1小时',
                    120: '2小时'
                  }}
                  tooltip={{
                    formatter: (value) => `${value}分钟`
                  }}
                />
              </div>
              <InputNumber
                min={1}
                max={1440}
                style={{ width: '100%' }}
                addonAfter="分钟"
                placeholder="或直接输入数值"
              />
            </div>
          </Form.Item>

          <Form.Item
            name="fullRebuildThreshold"
            label="全量重建阈值（%）"
            rules={[
              { required: true, message: '请设置重建阈值' },
              { type: 'number', min: 10, max: 100, message: '阈值必须在10%-100%之间' }
            ]}
          >
            <div>
              <div style={{ marginBottom: 16 }}>
                <Slider
                  min={10}
                  max={100}
                  marks={{
                    10: '10%',
                    30: '30%',
                    50: '50%',
                    80: '80%',
                    100: '100%'
                  }}
                  tooltip={{
                    formatter: (value) => `${value}%`
                  }}
                />
              </div>
              <InputNumber
                min={10}
                max={100}
                style={{ width: '100%' }}
                addonAfter="%"
                placeholder="或直接输入数值"
              />
            </div>
          </Form.Item>

          <div style={{ 
            marginTop: 16, 
            padding: 16, 
            backgroundColor: '#fafafa', 
            borderRadius: 6,
            border: '1px solid #f0f0f0'
          }}>
            <Typography.Text type="secondary" style={{ fontSize: '12px', lineHeight: '1.6' }}>
              <div style={{ marginBottom: 8 }}>
                <strong>配置说明：</strong>
              </div>
              <div style={{ marginBottom: 4 }}>
                • <strong>检查间隔</strong>：系统多久检查一次文件变更，建议根据文件变更频率设置
              </div>
              <div style={{ marginBottom: 4 }}>
                • <strong>全量重建阈值</strong>：当变更文件超过该比例时，执行完整重建而非增量更新
              </div>
              <div>
                • <strong>性能建议</strong>：检查间隔过短可能会影响系统性能，建议不少于1分钟
              </div>
            </Typography.Text>
          </div>
        </Form>
      </Modal>
    </Card>
  );
};

export default IndexStatusCard; 