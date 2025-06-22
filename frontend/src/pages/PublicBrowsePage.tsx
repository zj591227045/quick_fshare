import React, { useState, useEffect } from 'react';
import { 
  Card, 
  List, 
  Typography, 
  Empty, 
  Button, 
  Space, 
  Spin, 
  App,
  Row,
  Col,
  Input,
  Avatar,
  Tag,
  Tooltip
} from 'antd';
import { 
  ShareAltOutlined, 
  FolderOutlined, 
  EyeOutlined, 
  DatabaseOutlined, 
  CloudServerOutlined,
  SearchOutlined,
  GlobalOutlined,
  LockOutlined,
  UnlockOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { sharesApi } from '@/services/api';
import { useTheme } from '@/contexts/ThemeContext';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

interface PublicShare {
  id: number;
  name: string;
  description?: string;
  type: 'local' | 'smb' | 'nfs';
  access_type: 'public' | 'password';
  createdAt: string;
}

const PublicBrowsePage: React.FC = () => {
  const { message } = App.useApp();
  const { actualMode } = useTheme();
  const [shares, setShares] = useState<PublicShare[]>([]);
  const [filteredShares, setFilteredShares] = useState<PublicShare[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // 根据主题模式获取背景渐变
  const getBackgroundGradient = () => {
    if (actualMode === 'dark') {
      return 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
    }
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  };

  // 根据主题模式获取文字颜色
  const getTextColor = () => {
    return actualMode === 'dark' ? 'rgba(255,255,255,0.9)' : '#fff';
  };

  const getSecondaryTextColor = () => {
    return actualMode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.8)';
  };

  const getFooterTextColor = () => {
    return actualMode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.7)';
  };

  // 加载公开分享列表
  const loadPublicShares = async () => {
    setLoading(true);
    try {
      const response = await sharesApi.getEnabledShares();
      if (response.success && response.data) {
        setShares(response.data.shares);
        setFilteredShares(response.data.shares);
      }
    } catch (error) {
      message.error('加载分享列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublicShares();
  }, []);

  // 搜索过滤
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredShares(shares);
    } else {
      const filtered = shares.filter(share =>
        share.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (share.description && share.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredShares(filtered);
    }
  }, [searchQuery, shares]);

  const handleAccessShare = (share: PublicShare) => {
    navigate(`/shares/${share.id}`);
  };

  const getShareIcon = (share: PublicShare) => {
    const iconStyle = { fontSize: '28px' };
    
    switch (share.type) {
      case 'local':
        return <FolderOutlined style={{ ...iconStyle, color: '#1890ff' }} />;
      case 'smb':
        return <DatabaseOutlined style={{ ...iconStyle, color: '#52c41a' }} />;
      case 'nfs':
        return <CloudServerOutlined style={{ ...iconStyle, color: '#722ed1' }} />;
      default:
        return <ShareAltOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />;
    }
  };

  const getShareTypeText = (type: string) => {
    switch (type) {
      case 'local': return '本地文件';
      case 'smb': return 'SMB网络';
      case 'nfs': return 'NFS网络';
      default: return '未知类型';
    }
  };

  const getShareTypeColor = (type: string) => {
    switch (type) {
      case 'local': return 'blue';
      case 'smb': return 'green';
      case 'nfs': return 'purple';
      default: return 'default';
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: getBackgroundGradient(),
      padding: '24px',
      transition: 'background 0.3s ease'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* 头部区域 */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Avatar 
            size={80} 
            icon={<GlobalOutlined />} 
            style={{ 
              backgroundColor: actualMode === 'dark' ? 'rgba(255,255,255,0.15)' : '#fff', 
              color: actualMode === 'dark' ? '#fff' : '#1890ff',
              marginBottom: 24,
              boxShadow: actualMode === 'dark' 
                ? '0 4px 12px rgba(0,0,0,0.4)' 
                : '0 4px 12px rgba(0,0,0,0.15)',
              border: actualMode === 'dark' ? '2px solid rgba(255,255,255,0.2)' : 'none'
            }} 
          />
          <Title level={1} style={{ 
            color: getTextColor(), 
            marginBottom: 8, 
            fontSize: '3rem',
            textShadow: actualMode === 'dark' ? '0 2px 4px rgba(0,0,0,0.5)' : 'none'
          }}>
            Quick FShare
          </Title>
          <Paragraph style={{ 
            color: getSecondaryTextColor(), 
            fontSize: '18px', 
            marginBottom: 32,
            textShadow: actualMode === 'dark' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'
          }}>
            简单、安全、美观的私有文件分享系统
          </Paragraph>
          
          {/* 搜索框 */}
          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <Search
              placeholder="搜索分享列表..."
              allowClear
              size="large"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<SearchOutlined />}
              style={{
                borderRadius: '25px',
                boxShadow: actualMode === 'dark' 
                  ? '0 4px 12px rgba(0,0,0,0.4)' 
                  : '0 4px 12px rgba(0,0,0,0.15)'
              }}
            />
          </div>
        </div>

        {/* 主内容区域 */}
        <Card 
          style={{ 
            borderRadius: '16px',
            boxShadow: actualMode === 'dark' 
              ? '0 8px 24px rgba(0,0,0,0.4)' 
              : '0 8px 24px rgba(0,0,0,0.12)',
            border: actualMode === 'dark' 
              ? '1px solid rgba(255,255,255,0.1)' 
              : 'none',
            background: actualMode === 'dark' 
              ? 'rgba(255,255,255,0.05)' 
              : undefined,
            backdropFilter: actualMode === 'dark' ? 'blur(10px)' : undefined
          }}
          bodyStyle={{ padding: '32px' }}
        >
          <div style={{ marginBottom: 24 }}>
            <Row align="middle" justify="space-between">
              <Col>
                <Space align="center">
                  <ShareAltOutlined style={{ fontSize: '20px', color: 'var(--primary-color)' }} />
                  <Title level={3} style={{ margin: 0, color: 'var(--text-primary)' }}>
                    可用分享 ({filteredShares.length})
                  </Title>
                </Space>
              </Col>
              <Col>
                <Button 
                  type="text" 
                  icon={<ShareAltOutlined />}
                  onClick={loadPublicShares}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  刷新
                </Button>
              </Col>
            </Row>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: 'var(--text-secondary)' }}>加载中...</div>
            </div>
          ) : filteredShares.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <div style={{ marginBottom: 8, color: 'var(--text-secondary)' }}>
                    {searchQuery ? '没有找到匹配的分享' : '暂无可用的分享'}
                  </div>
                  {searchQuery && (
                    <Button type="link" onClick={() => setSearchQuery('')}>
                      清除搜索条件
                    </Button>
                  )}
                </div>
              }
              style={{ padding: '80px 0' }}
            />
          ) : (
            <List
              grid={{ 
                gutter: [24, 24], 
                xs: 1, 
                sm: 2, 
                md: 2, 
                lg: 3, 
                xl: 4, 
                xxl: 5 
              }}
              dataSource={filteredShares}
              renderItem={(item) => (
                <List.Item>
                  <Card
                    hoverable
                    style={{ 
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: actualMode === 'dark' 
                        ? '1px solid rgba(255,255,255,0.1)' 
                        : '1px solid #f0f0f0',
                      transition: 'all 0.3s ease',
                      background: actualMode === 'dark' 
                        ? 'rgba(255,255,255,0.05)' 
                        : undefined
                    }}
                    bodyStyle={{ padding: '20px' }}
                    actions={[
                      <Tooltip title="浏览文件">
                        <Button 
                          type="primary" 
                          icon={<EyeOutlined />}
                          onClick={() => handleAccessShare(item)}
                          style={{ borderRadius: '8px' }}
                        >
                          浏览
                        </Button>
                      </Tooltip>
                    ]}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ marginBottom: 16 }}>
                        {getShareIcon(item)}
                      </div>
                      
                      <div style={{ marginBottom: 12 }}>
                        <Title level={5} ellipsis={{ tooltip: item.name }} style={{ 
                          margin: 0, 
                          color: 'var(--text-primary)' 
                        }}>
                          {item.name}
                        </Title>
                      </div>
                      
                      <div style={{ marginBottom: 12 }}>
                        <Space size="small">
                          <Tag color={getShareTypeColor(item.type)}>
                            {getShareTypeText(item.type)}
                          </Tag>
                          <Tag 
                            color={item.access_type === 'public' ? 'green' : 'orange'}
                            icon={item.access_type === 'public' ? <UnlockOutlined /> : <LockOutlined />}
                          >
                            {item.access_type === 'public' ? '公开' : '密码'}
                          </Tag>
                        </Space>
                      </div>
                      
                      <div style={{ minHeight: '40px' }}>
                        <Text 
                          type="secondary" 
                          ellipsis={{ tooltip: item.description }}
                          style={{ fontSize: '13px' }}
                        >
                          {item.description || '暂无描述'}
                        </Text>
                      </div>
                      
                      {item.createdAt && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            创建于 {new Date(item.createdAt).toLocaleDateString()}
                          </Text>
                        </div>
                      )}
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          )}
        </Card>

        {/* 底部信息 */}
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <Text style={{ 
            color: getFooterTextColor(), 
            fontSize: '14px',
            textShadow: actualMode === 'dark' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none'
          }}>
            Powered by Quick FShare | 私有文件分享解决方案
          </Text>
        </div>
      </div>
    </div>
  );
};

export default PublicBrowsePage; 