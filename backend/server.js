const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// 导入数据库管理器
const dbManager = require('./src/config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));



// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 基础路由
app.get('/', (req, res) => {
  res.json({
    message: 'Quick FShare Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 路由配置
const authRoutes = require('./src/routes/auth');
const sharesRoutes = require('./src/routes/shares');
const browseRoutes = require('./src/routes/browse');
const systemRoutes = require('./src/routes/system');

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/shares', sharesRoutes);
app.use('/api/browse', browseRoutes);
app.use('/api/system', systemRoutes);

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

// 启动服务器
async function startServer() {
  try {
    // 连接数据库
    await dbManager.connect();
    console.log('✅ 数据库连接成功');
    
    // 初始化搜索索引服务
    const { getSearchIndexService } = require('./src/services/SearchIndexService');
    const searchIndexService = getSearchIndexService();
    await searchIndexService.init();
    console.log('✅ 搜索索引服务初始化成功');
    
    // 启动监控服务
    try {
      const MonitoringService = require('./src/services/MonitoringService');
      const monitoringService = new MonitoringService();
      monitoringService.startCollection();
      console.log('✅ 系统监控服务已启动');
    } catch (error) {
      console.error('❌ 启动监控服务失败:', error.message);
    }
    
    // 启动HTTP服务器
    app.listen(PORT, () => {
      console.log(`🚀 Quick FShare Backend 服务器运行在端口 ${PORT}`);
      console.log(`📝 API 文档: http://localhost:${PORT}/`);
      console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();

module.exports = app; 