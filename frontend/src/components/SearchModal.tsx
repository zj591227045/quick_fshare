import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Input, 
  Select, 
  Form, 
  Button, 
  Space, 
  List, 
  Empty, 
  Spin, 
  Tag, 
  Typography,
  Row,
  Col,
  Progress,
  Card,
  App
} from 'antd';
import { 
  SearchOutlined, 
  FileOutlined, 
  FolderOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { browseApi } from '@/services/api';
// import { useTheme } from '@/contexts/ThemeContext';

const { Text } = Typography;
const { Option } = Select;

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  path: string;
  extension?: string;
  relevance?: number;
}

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  shareId: string | number;
  shareName?: string;
  shareType?: string;
  token?: string;
  onFileSelect?: (file: FileItem) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  onClose,
  shareId,
  shareName,
  shareType,
  token,
  onFileSelect
}) => {
  // const { actualMode } = useTheme();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  
  // 搜索状态
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  
  // 索引状态
  const [indexStatus, setIndexStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [rebuildingIndex, setRebuildingIndex] = useState(false);

  // 搜索参数
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'file' | 'directory'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'name' | 'size' | 'modified'>('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [extensions, setExtensions] = useState<string>('');

  // 加载索引状态
  const loadIndexStatus = async () => {
    if (!visible) return;
    
    setLoadingStatus(true);
    try {
      const response = await browseApi.getSearchStatus(shareId, token);
      if (response.success) {
        setIndexStatus(response.data.indexStatus);
      }
    } catch (error) {
      console.error('获取索引状态失败:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  // 执行搜索
  const performSearch = async (reset = true) => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }

    setSearching(true);
    try {
      const offset = reset ? 0 : currentOffset;
      const response = await browseApi.search(shareId, {
        q: searchQuery.trim(),
        type: searchType,
        sort: sortBy,
        order: sortOrder,
        extensions: extensions || undefined,
        limit: 50,
        offset,
        token
      });

      if (response.success) {
        const newResults = response.data.results || [];
        
        if (reset) {
          setSearchResults(newResults);
          setCurrentOffset(50);
        } else {
          setSearchResults(prev => [...prev, ...newResults]);
          setCurrentOffset(prev => prev + 50);
        }
        
        setSearchTotal(response.data.total || 0);
        setSearchTime(response.data.searchTime || 0);
        setHasMore(response.data.pagination?.has_more || false);
      } else {
        message.error(response.message || '搜索失败');
      }
    } catch (error: any) {
      console.error('搜索失败:', error);
      message.error('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  // 重建索引
  const rebuildIndex = async () => {
    setRebuildingIndex(true);
    try {
      const response = await browseApi.rebuildIndex(shareId);
      if (response.success) {
        message.success('索引重建已开始');
        // 定期检查状态
        const checkStatus = setInterval(async () => {
          await loadIndexStatus();
          const currentStatus = indexStatus?.status;
          if (currentStatus === 'completed' || currentStatus === 'failed') {
            clearInterval(checkStatus);
            setRebuildingIndex(false);
          }
        }, 2000);
      } else {
        message.error(response.message || '重建索引失败');
        setRebuildingIndex(false);
      }
    } catch (error) {
      message.error('重建索引失败');
      setRebuildingIndex(false);
    }
  };

  // 处理文件点击
  const handleFileClick = (file: FileItem) => {
    if (onFileSelect) {
      onFileSelect(file);
      onClose();
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  // 获取文件图标
  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return <FolderOutlined style={{ color: 'var(--primary-color)', fontSize: '16px' }} />;
    }
    return <FileOutlined style={{ fontSize: '16px', color: 'var(--text-secondary)' }} />;
  };

  // 加载状态
  useEffect(() => {
    loadIndexStatus();
  }, [visible, shareId]);

  // 搜索表单提交
  const handleSearch = () => {
    performSearch(true);
  };

  // 加载更多
  const loadMore = () => {
    if (!hasMore || searching) return;
    performSearch(false);
  };

  // 渲染索引状态
  const renderIndexStatus = () => {
    if (loadingStatus) {
      return <Spin size="small" />;
    }

    if (!indexStatus) {
      return <Text type="secondary">未知状态</Text>;
    }

    const { status, progress, totalFiles, buildDuration } = indexStatus;

    switch (status) {
      case 'not_built':
        return (
          <Space>
            <Text type="warning">索引未构建</Text>
            <Button size="small" onClick={rebuildIndex} loading={rebuildingIndex}>
              构建索引
            </Button>
          </Space>
        );
      case 'building':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">正在构建索引...</Text>
            <Progress percent={progress} size="small" />
          </Space>
        );
      case 'completed':
        return (
          <Space>
            <Text type="success">
              索引已就绪 ({totalFiles?.toLocaleString()} 个文件)
            </Text>
            {buildDuration && (
              <Text type="secondary">
                构建耗时: {(buildDuration / 1000).toFixed(1)}s
              </Text>
            )}
            <Button 
              size="small" 
              icon={<ReloadOutlined />} 
              onClick={rebuildIndex}
              loading={rebuildingIndex}
            >
              重建
            </Button>
          </Space>
        );
      case 'failed':
        return (
          <Space>
            <Text type="danger">索引构建失败</Text>
            <Button size="small" onClick={rebuildIndex} loading={rebuildingIndex}>
              重试
            </Button>
          </Space>
        );
      default:
        return <Text type="secondary">未知状态: {status}</Text>;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <SearchOutlined />
          <span>搜索文件 - {shareName}</span>
          {shareType && (
            <Tag color={shareType === 'smb' ? 'green' : shareType === 'local' ? 'blue' : 'purple'}>
              {shareType === 'smb' ? 'SMB' : shareType === 'local' ? '本地' : 'NFS'}
            </Tag>
          )}
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
      style={{ top: 20 }}
    >
      {/* 索引状态 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <DatabaseOutlined />
              <Text strong>搜索索引状态:</Text>
            </Space>
          </Col>
          <Col>
            {renderIndexStatus()}
          </Col>
        </Row>
      </Card>

      {/* 搜索表单 */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSearch}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              label="搜索关键词"
              name="query"
              rules={[{ required: true, message: '请输入搜索关键词' }]}
            >
              <Input
                placeholder="输入文件名或关键词..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
                size="large"
              />
            </Form.Item>
          </Col>
        </Row>
        
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item label="文件类型">
              <Select
                value={searchType}
                onChange={setSearchType}
                size="small"
              >
                <Option value="all">全部</Option>
                <Option value="file">文件</Option>
                <Option value="directory">文件夹</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="排序方式">
              <Select
                value={sortBy}
                onChange={setSortBy}
                size="small"
              >
                <Option value="relevance">相关性</Option>
                <Option value="name">名称</Option>
                <Option value="size">大小</Option>
                <Option value="modified">修改时间</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="排序顺序">
              <Select
                value={sortOrder}
                onChange={setSortOrder}
                size="small"
              >
                <Option value="desc">降序</Option>
                <Option value="asc">升序</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="扩展名">
              <Input
                placeholder=".jpg,.pdf"
                value={extensions}
                onChange={(e) => setExtensions(e.target.value)}
                size="small"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={searching}
            disabled={!searchQuery.trim() || indexStatus?.status !== 'completed'}
          >
            搜索
          </Button>
        </Form.Item>
      </Form>

      {/* 搜索结果 */}
      <div style={{ maxHeight: 400, overflow: 'auto' }}>
        {searching && searchResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>搜索中...</div>
          </div>
        ) : searchResults.length === 0 && searchQuery ? (
          <Empty
            description="没有找到匹配的文件"
            style={{ padding: '40px 0' }}
          />
        ) : (
          <>
            {/* 搜索统计 */}
            {searchTotal > 0 && (
              <div style={{ 
                marginBottom: 16, 
                padding: '8px 0', 
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-secondary)'
              }}>
                找到 {searchTotal} 个结果，耗时 {searchTime}ms
              </div>
            )}

            {/* 结果列表 */}
            <List
              dataSource={searchResults}
              renderItem={(item) => (
                <List.Item
                  style={{ 
                    cursor: 'pointer',
                    padding: '12px 16px',
                    borderRadius: '6px',
                    marginBottom: '4px'
                  }}
                  className="search-result-item"
                  onClick={() => handleFileClick(item)}
                >
                  <List.Item.Meta
                    avatar={getFileIcon(item)}
                    title={
                      <Space>
                        <Text strong>{item.name}</Text>
                                                 {item.extension && (
                           <Tag color="blue">{item.extension}</Tag>
                         )}
                         {item.relevance && sortBy === 'relevance' && (
                           <Tag color="orange">
                             {item.relevance}分
                           </Tag>
                         )}
                      </Space>
                    }
                    description={
                      <Space split="|">
                        <Text type="secondary">{item.path}</Text>
                        {item.type === 'file' && (
                          <Text type="secondary">{formatFileSize(item.size)}</Text>
                        )}
                        <Text type="secondary">
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          {new Date(item.modified).toLocaleString()}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />

            {/* 加载更多 */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Button onClick={loadMore} loading={searching}>
                  加载更多
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SearchModal; 