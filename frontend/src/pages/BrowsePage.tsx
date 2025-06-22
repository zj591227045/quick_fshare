import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Typography, 
  Breadcrumb, 
  Upload, 
  Spin, 
  App,
  Row,
  Col,
  Input,
  Select,
  Tooltip,
  Tag,
  Avatar,
  List,
  Switch
} from 'antd';
import { 
  FolderOutlined, 
  FileOutlined, 
  DownloadOutlined, 
  UploadOutlined,
  HomeOutlined,
  SearchOutlined,
  AppstoreOutlined,
  BarsOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  FileImageOutlined,
  VideoCameraOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  FileZipOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { browseApi } from '../services/api';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  path: string;
  extension?: string;
  mime_type?: string;
  has_thumbnail?: boolean;
}

interface ShareInfo {
  id: number;
  name: string;
  type: 'local' | 'smb' | 'nfs';
  access_type: string;
}

const BrowsePage: React.FC = () => {
  const { shareId } = useParams();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const { message } = App.useApp();

  // 获取文件图标
  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return <FolderOutlined style={{ color: '#1890ff', fontSize: '20px' }} />;
    }

    const ext = file.extension?.toLowerCase() || '';
    const iconStyle = { fontSize: '18px' };

    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
      return <FileImageOutlined style={{ ...iconStyle, color: '#52c41a' }} />;
    }
    if (['.mp4', '.avi', '.mkv', '.mov', '.wmv'].includes(ext)) {
      return <VideoCameraOutlined style={{ ...iconStyle, color: '#722ed1' }} />;
    }
    if (ext === '.pdf') {
      return <FilePdfOutlined style={{ ...iconStyle, color: '#f5222d' }} />;
    }
    if (['.doc', '.docx'].includes(ext)) {
      return <FileWordOutlined style={{ ...iconStyle, color: '#1890ff' }} />;
    }
    if (['.xls', '.xlsx'].includes(ext)) {
      return <FileExcelOutlined style={{ ...iconStyle, color: '#52c41a' }} />;
    }
    if (['.ppt', '.pptx'].includes(ext)) {
      return <FilePptOutlined style={{ ...iconStyle, color: '#fa8c16' }} />;
    }
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) {
      return <FileZipOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />;
    }
    if (['.txt', '.md', '.log'].includes(ext)) {
      return <FileTextOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />;
    }
    
    return <FileOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  // 加载文件列表
  const loadFiles = async (path = '/') => {
    if (!shareId) return;
    
    setLoading(true);
    try {
      const response = await browseApi.list(parseInt(shareId), { 
        path,
        sort: sortBy,
        order: sortOrder,
        search: searchQuery
      });
      
      if (response.success && response.data) {
        setFiles(response.data.files || []);
        setShareInfo(response.data.share_info);
      } else {
        message.error(response.message || '加载文件列表失败');
      }
    } catch (error) {
      message.error('加载文件列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取文件列表
  useEffect(() => {
    loadFiles(currentPath);
  }, [shareId, currentPath, sortBy, sortOrder]);

  // 搜索时重新加载
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== '') {
        loadFiles(currentPath);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleFolderClick = (folder: FileItem) => {
    const newPath = folder.path;
    setCurrentPath(newPath);
  };

  const handleDownload = async (file: FileItem) => {
    try {
      message.loading({ content: `正在下载 ${file.name}...`, key: 'download' });
      
      // 构建下载URL
      const downloadUrl = `/api/browse/${shareId}/download${file.path}`;
      
      // 创建隐藏的下载链接
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.name;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success({ content: `${file.name} 下载开始`, key: 'download' });
    } catch (error) {
      message.error({ content: `下载 ${file.name} 失败`, key: 'download' });
    }
  };

  const handleUpload = (info: any) => {
    if (info.file.status === 'done') {
      message.success(`${info.file.name} 上传成功`);
      loadFiles(currentPath); // 重新加载文件列表
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`);
    }
  };

  // 生成面包屑导航
  const pathSegments = currentPath.split('/').filter(Boolean);
  const breadcrumbItems = [
    {
      title: (
        <Tooltip title="返回根目录">
          <HomeOutlined 
            onClick={() => setCurrentPath('/')} 
            style={{ cursor: 'pointer', color: '#1890ff' }} 
          />
        </Tooltip>
      )
    },
    ...pathSegments.map((segment, index) => ({
      title: (
        <span
          style={{ cursor: 'pointer', color: '#1890ff' }}
          onClick={() => {
            const newPath = '/' + pathSegments.slice(0, index + 1).join('/');
            setCurrentPath(newPath);
          }}
        >
          {segment}
        </span>
      )
    }))
  ];

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FileItem) => (
        <Space>
          {getFileIcon(record)}
          <span
            style={{ 
              cursor: record.type === 'directory' ? 'pointer' : 'default',
              color: record.type === 'directory' ? '#1890ff' : 'inherit',
              fontWeight: record.type === 'directory' ? 500 : 'normal'
            }}
            onClick={() => record.type === 'directory' && handleFolderClick(record)}
          >
            {text}
          </span>
          {record.extension && (
            <Tag size="small" color="blue">{record.extension}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '修改时间',
      dataIndex: 'modified',
      key: 'modified',
      width: 180,
      render: (time: string) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: FileItem) => (
        <Space size="small">
          {record.type === 'file' && (
            <Tooltip title="下载文件">
              <Button 
                type="text" 
                icon={<DownloadOutlined />}
                size="small"
                onClick={() => handleDownload(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 网格视图渲染
  const renderGridView = () => (
    <List
      grid={{ 
        gutter: 16, 
        xs: 2, 
        sm: 3, 
        md: 4, 
        lg: 5, 
        xl: 6, 
        xxl: 8 
      }}
      dataSource={files}
      renderItem={(item) => (
        <List.Item>
          <Card
            hoverable
            size="small"
            style={{ textAlign: 'center' }}
            bodyStyle={{ padding: '12px 8px' }}
            onClick={() => item.type === 'directory' ? handleFolderClick(item) : handleDownload(item)}
          >
            <div style={{ marginBottom: 8 }}>
              {getFileIcon(item)}
            </div>
            <div style={{ fontSize: '12px' }}>
              <Text ellipsis={{ tooltip: item.name }} style={{ display: 'block' }}>
                {item.name}
              </Text>
              {item.type === 'file' && (
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  {formatFileSize(item.size)}
                </Text>
              )}
            </div>
          </Card>
        </List.Item>
      )}
    />
  );

  return (
    <div style={{ padding: '16px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 头部区域 */}
      <div style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between" style={{ marginBottom: 16 }}>
          <Col>
            <Space align="center">
              <Avatar 
                icon={
                  shareInfo?.type === 'local' ? <FolderOutlined /> :
                  shareInfo?.type === 'smb' ? <DatabaseOutlined /> :
                  <CloudServerOutlined />
                } 
                style={{ backgroundColor: '#1890ff' }}
              />
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {shareInfo?.name || `分享 ${shareId}`}
                </Title>
                <Text type="secondary">
                  {shareInfo?.type === 'local' && '本地分享'}
                  {shareInfo?.type === 'smb' && 'SMB网络分享'}
                  {shareInfo?.type === 'nfs' && 'NFS网络分享'}
                </Text>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Tooltip title="刷新">
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => loadFiles(currentPath)}
                />
              </Tooltip>
              <Switch
                checkedChildren={<AppstoreOutlined />}
                unCheckedChildren={<BarsOutlined />}
                checked={viewMode === 'grid'}
                onChange={(checked) => setViewMode(checked ? 'grid' : 'table')}
              />
            </Space>
          </Col>
        </Row>

        {/* 工具栏 */}
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Breadcrumb items={breadcrumbItems} />
          </Col>
          <Col>
            <Space>
              <Search
                placeholder="搜索文件..."
                allowClear
                style={{ width: 200 }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                prefix={<SearchOutlined />}
              />
              <Select
                value={`${sortBy}-${sortOrder}`}
                style={{ width: 120 }}
                onChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field);
                  setSortOrder(order as 'asc' | 'desc');
                }}
              >
                <Option value="name-asc">名称 ↑</Option>
                <Option value="name-desc">名称 ↓</Option>
                <Option value="size-asc">大小 ↑</Option>
                <Option value="size-desc">大小 ↓</Option>
                <Option value="modified-asc">时间 ↑</Option>
                <Option value="modified-desc">时间 ↓</Option>
              </Select>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 主内容区域 */}
      <Card 
        style={{ flex: 1, overflow: 'hidden' }}
        bodyStyle={{ padding: '16px', height: '100%', overflow: 'auto' }}
      >
        <Spin spinning={loading}>
          {files.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <FolderOutlined style={{ fontSize: '48px', color: '#d9d9d9' }} />
              <div style={{ marginTop: 16, color: '#8c8c8c' }}>
                {searchQuery ? '没有找到匹配的文件' : '此文件夹为空'}
              </div>
            </div>
          ) : viewMode === 'table' ? (
            <Table
              columns={columns}
              dataSource={files}
              rowKey="path"
              pagination={{
                total: files.length,
                pageSize: 50,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 项`
              }}
              size="small"
            />
          ) : (
            renderGridView()
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default BrowsePage; 