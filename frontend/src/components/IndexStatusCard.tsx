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
  Col
} from 'antd';
import { 
  DatabaseOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  HistoryOutlined
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
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [updatingIncremental, setUpdatingIncremental] = useState(false);

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
      }
    } catch (error) {
      console.error('获取增量统计失败:', error);
    }
  };

  // 重建索引
  const handleRebuildIndex = async () => {
    setRebuilding(true);
    try {
      const response = await browseApi.rebuildIndex(shareId);
      if (response.success) {
        message.success('索引重建已开始');
        // 开始轮询状态
        const pollStatus = setInterval(async () => {
          await loadIndexStatus();
          const currentStatus = indexStatus?.status;
          if (currentStatus === 'completed' || currentStatus === 'failed') {
            clearInterval(pollStatus);
            setRebuilding(false);
            onStatusChange?.();
          }
        }, 2000);
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

  useEffect(() => {
    loadIndexStatus();
    loadIncrementalStats();
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
    </Card>
  );
};

export default IndexStatusCard; 