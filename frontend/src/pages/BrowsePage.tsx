import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Typography, 
  Breadcrumb, 
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
  Switch,
  Modal
} from 'antd';
import { 
  FolderOutlined, 
  FileOutlined, 
  DownloadOutlined, 
  HomeOutlined,
  SearchOutlined,
  AppstoreOutlined,
  BarsOutlined,
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
  ReloadOutlined,
  LockOutlined
} from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { browseApi } from '../services/api';
import { useTheme } from '@/contexts/ThemeContext';
import SearchModal from '@/components/SearchModal';

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

interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
  current_page: number;
  total_pages: number;
}

const BrowsePage: React.FC = () => {
  const { shareId } = useParams();
  const { actualMode } = useTheme();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { message } = App.useApp();

  // 验证分享密码
  const verifySharePassword = async (password: string) => {
    if (!shareId) return false;
    
    setPasswordLoading(true);
    try {
      const response = await browseApi.verifyPassword({
        share_id: shareId,
        password
      });
      
      if (response.success && response.data?.token) {
        setAccessToken(response.data.token);
        setPasswordModalVisible(false);
        
        // 验证成功后重新加载文件列表，直接传递token
        await loadFiles(currentPath, true, 0, response.data.token);
        return true;
      } else {
        message.error(response.message || '密码错误');
        return false;
      }
    } catch (error) {
      message.error('密码验证失败');
      return false;
    } finally {
      setPasswordLoading(false);
    }
  };

  // 获取文件图标
  const getFileIcon = (file: FileItem) => {
    if (file.type === 'directory') {
      return <FolderOutlined style={{ color: 'var(--primary-color)', fontSize: '20px' }} />;
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
      return <FileZipOutlined style={{ ...iconStyle, color: actualMode === 'dark' ? '#bfbfbf' : '#8c8c8c' }} />;
    }
    if (['.txt', '.md', '.log'].includes(ext)) {
      return <FileTextOutlined style={{ ...iconStyle, color: actualMode === 'dark' ? '#bfbfbf' : '#8c8c8c' }} />;
    }
    
    return <FileOutlined style={{ ...iconStyle, color: actualMode === 'dark' ? '#bfbfbf' : '#8c8c8c' }} />;
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
  const loadFiles = async (path = '/', reset = true, offset = 0, token?: string) => {
    if (!shareId) return;
    
    // console.log('=== loadFiles 开始 ===');
    // console.log('shareId:', shareId);
    // console.log('path:', path);
    // console.log('accessToken:', accessToken);
    
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const params: any = { 
        path,
        sort: sortBy as 'name' | 'size' | 'modified',
        order: sortOrder,
        search: searchQuery,
        limit: 200,
        offset
      };

      // 如果有访问令牌，添加到请求中
      const finalToken = token || accessToken;
      if (finalToken) {
        params.token = finalToken;
        // console.log('=== 添加token到请求参数 ===');
        // console.log('params.token:', params.token);
      }
      // else {
      //   console.log('=== 没有token ===');
      // }

      // console.log('=== 发送API请求 ===');
      // console.log('请求参数:', params);
      
      const response = await browseApi.list(shareId, params);
      
      if (response.success && response.data) {
        let newFiles = response.data.files || [];
        
        // 前端排序优化
        newFiles.sort((a, b) => {
          let comparison = 0;
          
          // 文件夹优先
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          
          switch (sortBy) {
            case 'name':
              comparison = a.name.localeCompare(b.name, 'zh', { numeric: true });
              break;
            case 'size':
              comparison = a.size - b.size;
              break;
            case 'modified':
              comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
              break;
            default:
              comparison = a.name.localeCompare(b.name, 'zh', { numeric: true });
          }
          
          return sortOrder === 'desc' ? -comparison : comparison;
        });
        
        if (reset) {
          setFiles(newFiles);
        } else {
          // 追加新文件，避免重复
          setFiles(prevFiles => {
            const existingPaths = new Set(prevFiles.map(f => f.path));
            const uniqueNewFiles = newFiles.filter(f => !existingPaths.has(f.path));
            const allFiles = [...prevFiles, ...uniqueNewFiles];
            
            // 重新排序所有文件
            return allFiles.sort((a, b) => {
              let comparison = 0;
              
              if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
              }
              
              switch (sortBy) {
                case 'name':
                  comparison = a.name.localeCompare(b.name, 'zh', { numeric: true });
                  break;
                case 'size':
                  comparison = a.size - b.size;
                  break;
                case 'modified':
                  comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
                  break;
                default:
                  comparison = a.name.localeCompare(b.name, 'zh', { numeric: true });
              }
              
              return sortOrder === 'desc' ? -comparison : comparison;
            });
          });
        }
        
        if (response.data.share_info) {
          setShareInfo({
            ...response.data.share_info,
            type: response.data.share_info.type as 'local' | 'smb' | 'nfs',
            access_type: response.data.share_info.access_type || 'public'
          });
        }
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      } else if (response.message === '需要密码验证' || (response as any).require_password) {
        // 需要密码验证
        setPasswordModalVisible(true);
      } else {
        message.error(response.message || '加载文件列表失败');
      }
    } catch (error: any) {
      // 检查是否是401错误（需要密码验证）
      if (error.response?.status === 401) {
        setPasswordModalVisible(true);
      } else if (error.response?.data?.require_password) {
        setPasswordModalVisible(true);
      } else {
        message.error('加载文件列表失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // 加载更多文件
  const loadMoreFiles = async () => {
    if (!pagination || !pagination.has_more || loadingMore) return;
    
    const nextOffset = pagination.offset + pagination.limit;
    await loadFiles(currentPath, false, nextOffset, accessToken || undefined);
  };

  // 组件加载时获取文件列表
  useEffect(() => {
    loadFiles(currentPath, true, 0);
  }, [shareId, currentPath, sortBy, sortOrder]);

  // 搜索时重新加载
  useEffect(() => {
    const timer = setTimeout(() => {
      loadFiles(currentPath, true, 0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 无限滚动检测
  useEffect(() => {
    const handleScroll = () => {
      // 检查是否接近页面底部
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.offsetHeight;
      
      // 当滚动到距离底部200px时开始加载更多
      if (scrollTop + windowHeight >= documentHeight - 200) {
        loadMoreFiles();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pagination, loadingMore]);

  const handleFolderClick = (folder: FileItem) => {
    const newPath = folder.path;
    setCurrentPath(newPath);
  };

  const handleDownload = async (file: FileItem) => {
    try {
      message.loading({ content: `正在下载 ${file.name}...`, key: 'download' });
      
      // 使用API服务构建下载URL，正确传递token
      const downloadUrl = browseApi.download(shareId!, file.path, accessToken || undefined);
      
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

  // const handleUpload = (info: any) => {
  //   if (info.file.status === 'done') {
  //     message.success(`${info.file.name} 上传成功`);
  //     loadFiles(currentPath); // 重新加载文件列表
  //   } else if (info.file.status === 'error') {
  //     message.error(`${info.file.name} 上传失败`);
  //   }
  // };

  // 生成面包屑导航
  const pathSegments = currentPath.split('/').filter(Boolean);
  const breadcrumbItems = [
    {
      title: (
        <Tooltip title="返回根目录">
          <HomeOutlined 
            onClick={() => setCurrentPath('/')} 
            style={{ cursor: 'pointer', color: 'var(--primary-color)' }} 
          />
        </Tooltip>
      )
    },
    ...pathSegments.map((segment, index) => ({
      title: (
        <span
          style={{ cursor: 'pointer', color: 'var(--primary-color)' }}
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
              color: record.type === 'directory' ? 'var(--primary-color)' : 'var(--text-primary)',
              fontWeight: record.type === 'directory' ? 500 : 'normal'
            }}
            onClick={() => record.type === 'directory' && handleFolderClick(record)}
          >
            {text}
          </span>
          {record.extension && (
            <Tag color="blue">{record.extension}</Tag>
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
    <div style={{ 
      padding: '16px', 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--bg-color)',
      color: 'var(--text-primary)'
    }}>
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
                style={{ backgroundColor: 'var(--primary-color)' }}
              />
              <div>
                <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
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
              <Tooltip title="高级搜索">
                <Button 
                  icon={<SearchOutlined />}
                  onClick={() => setSearchModalVisible(true)}
                  type="dashed"
                >
                  高级搜索
                </Button>
              </Tooltip>
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
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { padding: '16px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
      >
        {/* 分页信息 */}
        {pagination && (
          <div style={{ 
            marginBottom: 16, 
            padding: '8px 0', 
            borderBottom: '1px solid var(--border-color)',
            color: 'var(--text-secondary)'
          }}>
            显示 {files.length} / {pagination.total} 个文件
            {pagination.has_more && (
              <Text type="secondary"> · 还有更多文件，向下滚动加载</Text>
            )}
          </div>
        )}

        {/* 文件列表 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Spin spinning={loading}>
            {files.length === 0 && !loading ? (
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <FolderOutlined style={{ 
                  fontSize: '48px', 
                  color: actualMode === 'dark' ? '#4a4a4a' : '#d9d9d9' 
                }} />
                <div style={{ 
                  marginTop: 16, 
                  color: 'var(--text-secondary)' 
                }}>
                  {searchQuery ? '没有找到匹配的文件' : '此文件夹为空'}
                </div>
              </div>
            ) : viewMode === 'table' ? (
              <Table
                columns={columns}
                dataSource={files}
                rowKey="path"
                pagination={false}
                size="small"
              />
            ) : (
              renderGridView()
            )}
          </Spin>

          {/* 加载更多区域 */}
          {pagination && pagination.has_more && (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px',
              borderTop: files.length > 0 ? '1px solid var(--border-color)' : 'none'
            }}>
              {loadingMore ? (
                <Space>
                  <Spin size="small" />
                  <Text type="secondary">正在加载更多文件...</Text>
                </Space>
              ) : (
                <Button 
                  type="link" 
                  onClick={loadMoreFiles}
                  icon={<ReloadOutlined />}
                >
                  点击加载更多 ({pagination.total - files.length} 个剩余)
                </Button>
              )}
            </div>
          )}

          {/* 完成提示 */}
          {pagination && !pagination.has_more && files.length > 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px',
              color: 'var(--text-secondary)',
              borderTop: '1px solid var(--border-color)'
            }}>
              <Text type="secondary">已显示全部 {pagination.total} 个文件</Text>
            </div>
          )}
        </div>
      </Card>

      {/* 搜索模态框 */}
      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
        shareId={shareId!}
        shareName={shareInfo?.name}
        shareType={shareInfo?.type}
        token={accessToken || undefined}
        onFileSelect={(file) => {
          // 如果选中文件，导航到该文件的父目录
          const pathParts = file.path.split('/').filter(Boolean);
          if (pathParts.length > 1) {
            const parentPath = '/' + pathParts.slice(0, -1).join('/');
            setCurrentPath(parentPath);
          } else {
            setCurrentPath('/');
          }
          message.success(`已导航到文件: ${file.name}`);
        }}
      />

      {/* 密码验证模态框 */}
      <Modal
        title={
          <Space>
            <LockOutlined />
            输入访问密码
          </Space>
        }
        open={passwordModalVisible}
        onCancel={() => setPasswordModalVisible(false)}
        footer={null}
        width={400}
        centered
      >
        <div style={{ padding: '20px 0' }}>
          <Input.Password
            placeholder="请输入访问密码"
            size="large"
            onPressEnter={(e) => {
              const value = (e.target as HTMLInputElement).value;
              if (value.trim()) {
                verifySharePassword(value.trim());
              }
            }}
            suffix={
              <Button
                type="primary"
                loading={passwordLoading}
                onClick={() => {
                  const input = document.querySelector('.ant-input[type="password"]') as HTMLInputElement;
                  const value = input?.value;
                  if (value?.trim()) {
                    verifySharePassword(value.trim());
                  }
                }}
              >
                验证
              </Button>
            }
          />
          <div style={{ 
            marginTop: 16, 
            color: 'var(--text-secondary)', 
            fontSize: '14px' 
          }}>
            此分享需要密码才能访问，请输入正确的访问密码。
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BrowsePage;