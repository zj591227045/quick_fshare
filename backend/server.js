const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// API路由 - 暂时简化
app.get('/api/shares', (req, res) => {
  res.json({
    message: 'Shares API endpoint',
    data: []
  });
});

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
app.listen(PORT, () => {
  console.log(`🚀 Quick FShare Backend 服务器运行在端口 ${PORT}`);
  console.log(`📝 API 文档: http://localhost:${PORT}/`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app; 