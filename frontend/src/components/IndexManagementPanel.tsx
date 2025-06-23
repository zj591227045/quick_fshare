import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Tag, 
  Typography, 
  Progress, 
  App,
  Spin,
  Statistic,
  Row,
  Col,
  Alert,
  Descriptions
} from 'antd';
import { 
  DatabaseOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  HistoryOutlined,
  FileOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { browseApi } from '@/services/api';

const { Text, Title } = Typography;

interface IndexManagementPanelProps {
  shareId: number;
  shareName: string;
  shareType: string;
}

const IndexManagementPanel: React.FC<IndexManagementPanelProps> = ({
  shareId,
  shareName,
  shareType
}) => {
  const { message } = App.useApp();
  const [indexStatus, setIndexStatus] = useState<any>(null);
  const [incrementalStats, setIncrementalStats] = useState<any>(null);
  const [indexManagement, setIndexManagement] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [updatingIncremental, setUpdatingIncremental] = useState(false);

  // 加载所有数据
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [statusResponse, statsResponse, managementResponse] = await Promise.all([
        browseApi.getAdminSearchStatus(shareId),
        browseApi.getIncrementalStats(shareId),
        browseApi.getIndexManagement()
      ]);

      if (statusResponse.success) {
        setIndexStatus(statusResponse.data.indexStatus);
      }

      if (statsResponse.success) {
        setIncrementalStats(statsResponse.data);
      }

      if (managementResponse.success) {
        const shareIndexInfo = managementResponse.data.indexInfo.find(
          (info: any) => info.shareId === shareId
        );
        setIndexManagement(shareIndexInfo);
      }
    } catch (error) {
      console.error('加载索引数据失败:', error);
    } finally {
      setLoading(false);
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
          await loadAllData();
          if (indexStatus?.status === 'completed' || indexStatus?.status === 'failed') {
            clearInterval(pollStatus);
            setRebuilding(false);
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
        await loadAllData();
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
    loadAllData();
  }, [shareId]);

  // 渲染索引状态卡片
  const renderIndexStatusCard = () => {
    if (!indexStatus) {
      return <Spin />;
    }

    const { status, progress, totalFiles, buildDuration, lastUpdated } = indexStatus;

    let statusIcon, statusColor, statusText;
    switch (status) {
      case 'not_built':
        statusIcon = <ExclamationCircleOutlined />;
        statusColor = 'warning';
        statusText = '索引未构建';
        break;
      case 'building':
        statusIcon = <SyncOutlined spin />;
        statusColor = 'processing';
        statusText = '正在构建索引';
        break;
      case 'completed':
        statusIcon = <CheckCircleOutlined />;
        statusColor = 'success';
        statusText = '索引已就绪';
        break;
      case 'failed':
        statusIcon = <ExclamationCircleOutlined />;
        statusColor = 'error';
        statusText = '索引构建失败';
        break;
      default:
        statusIcon = <ExclamationCircleOutlined />;
        statusColor = 'default';
        statusText = '未知状态';
    }

    return (
      <Card title="索引状态" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="状态"
              value={statusText}
              prefix={statusIcon}
              valueStyle={{ color: statusColor === 'success' ? '#52c41a' : statusColor === 'error' ? '#ff4d4f' : '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="文件数量"
              value={totalFiles?.toLocaleString() || 0}
              prefix={<FileOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="构建耗时"
              value={buildDuration ? `${(buildDuration / 1000).toFixed(1)}s` : '-'}
              prefix={<ClockCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="进度"
              value={progress || 0}
              suffix="%"
            />
          </Col>
        </Row>

        {status === 'building' && (
          <Progress percent={progress} style={{ marginTop: 16 }} />
        )}

        {lastUpdated && (
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              最后更新: {new Date(lastUpdated).toLocaleString()}
            </Text>
          </div>
        )}
      </Card>
    );
  };

  // 渲染增量更新信息
  const renderIncrementalCard = () => {
    if (!incrementalStats) {
      return <Spin />;
    }

    const {
      isIncrementalEnabled,
      hasIncrementalTimer,
      lastIncrementalUpdate,
      changesApplied,
      checkInterval,
      fullRebuildThreshold
    } = incrementalStats;

    return (
      <Card title="增量更新" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="状态">
            <Tag color={isIncrementalEnabled ? 'green' : 'red'}>
              {isIncrementalEnabled ? '已启用' : '已禁用'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="监控状态">
            <Tag color={hasIncrementalTimer ? 'blue' : 'orange'}>
              {hasIncrementalTimer ? '监控中' : '未监控'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="检查间隔">
            {Math.round(checkInterval / 1000 / 60)}分钟
          </Descriptions.Item>
          <Descriptions.Item label="重建阈值">
            {Math.round(fullRebuildThreshold * 100)}%
          </Descriptions.Item>
          <Descriptions.Item label="上次增量更新">
            {lastIncrementalUpdate 
              ? new Date(lastIncrementalUpdate).toLocaleString()
              : '从未更新'
            }
          </Descriptions.Item>
          <Descriptions.Item label="最近变更">
            {changesApplied 
              ? `+${changesApplied.added || 0} ~${changesApplied.modified || 0} -${changesApplied.deleted || 0}`
              : '无变更'
            }
          </Descriptions.Item>
        </Descriptions>
      </Card>
    );
  };

  // 渲染磁盘信息
  const renderDiskInfoCard = () => {
    if (!indexManagement) {
      return <Spin />;
    }

    const { fileExists, humanFileSize, indexPath } = indexManagement;

    return (
      <Card title="磁盘信息" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="索引文件">
            <Space>
              {fileExists ? (
                <Tag color="green" icon={<CheckCircleOutlined />}>文件存在</Tag>
              ) : (
                <Tag color="red" icon={<WarningOutlined />}>文件不存在</Tag>
              )}
              <Text type="secondary">{humanFileSize}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="文件路径">
            <Text code style={{ fontSize: '12px' }}>{indexPath}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载索引信息中...</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4}>
          <Space>
            <DatabaseOutlined />
            {shareName} 索引管理
            <Tag color={shareType === 'smb' ? 'green' : shareType === 'local' ? 'blue' : 'purple'}>
              {shareType === 'smb' ? 'SMB' : shareType === 'local' ? '本地' : 'NFS'}
            </Tag>
          </Space>
        </Title>
        
        <Space style={{ marginTop: 8 }}>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRebuildIndex}
            loading={rebuilding}
          >
            重建索引
          </Button>
          <Button
            icon={<HistoryOutlined />}
            onClick={handleIncrementalUpdate}
            loading={updatingIncremental}
            disabled={indexStatus?.status !== 'completed'}
          >
            触发增量更新
          </Button>
        </Space>
      </div>

      {renderIndexStatusCard()}
      {renderIncrementalCard()}
      {renderDiskInfoCard()}

      {indexStatus?.status === 'failed' && (
        <Alert
          message="索引构建失败"
          description="请检查分享路径是否可访问，或查看系统日志获取详细错误信息。"
          type="error"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}

      {!incrementalStats?.isIncrementalEnabled && (
        <Alert
          message="增量更新已禁用"
          description="启用增量更新可以自动检测文件变更并更新索引，提高搜索结果的实时性。"
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

export default IndexManagementPanel; 