require('dotenv').config();
const path = require('path');

const config = {
  // 服务器配置
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'your-refresh-token-secret',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  // 数据库配置
  database: {
    path: process.env.DATABASE_PATH || path.join(__dirname, '../../../database/quickfshare.db'),
  },

  // 文件上传配置
  upload: {
    path: process.env.UPLOAD_PATH || path.join(__dirname, '../../../uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600, // 100MB
    allowedExtensions: (process.env.ALLOWED_EXTENSIONS || 'jpg,jpeg,png,gif,pdf,txt,doc,docx,xls,xlsx,ppt,pptx,mp3,mp4,avi,mov,zip,rar').split(','),
  },

  // 缩略图配置
  thumbnail: {
    path: process.env.THUMBNAIL_PATH || path.join(__dirname, '../../../data/thumbnails'),
    quality: parseInt(process.env.THUMBNAIL_QUALITY) || 80,
    maxSize: parseInt(process.env.THUMBNAIL_MAX_SIZE) || 200,
    cacheTTL: parseInt(process.env.THUMBNAIL_CACHE_TTL) || 86400, // 24小时
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    path: process.env.LOG_PATH || path.join(__dirname, '../../../data/logs'),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 10,
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
    enableConsole: process.env.NODE_ENV === 'development',
  },

  // 安全配置
  security: {
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001').split(','),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15分钟
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  },

  // SMB配置
  smb: {
    timeout: parseInt(process.env.SMB_TIMEOUT) || 30000,
    packetConcurrency: parseInt(process.env.SMB_PACKET_CONCURRENCY) || 20,
    autoCloseTimeout: parseInt(process.env.SMB_AUTO_CLOSE_TIMEOUT) || 30000,
  },

  // NFS配置
  nfs: {
    timeout: parseInt(process.env.NFS_TIMEOUT) || 30000,
    mountOptions: process.env.NFS_MOUNT_OPTIONS || 'ro,soft,intr',
    version: process.env.NFS_VERSION || 'v3',
  },

  // 缓存配置
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1小时
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 600, // 10分钟
  },

  // 监控配置
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    statsUpdateInterval: parseInt(process.env.STATS_UPDATE_INTERVAL) || 60000, // 1分钟
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30秒
  },

  // 清理配置
  cleanup: {
    autoCleanupEnabled: process.env.AUTO_CLEANUP_ENABLED === 'true',
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 86400, // 24小时
    logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS) || 30,
    thumbnailRetentionDays: parseInt(process.env.THUMBNAIL_RETENTION_DAYS) || 7,
    sessionCleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL) || 3600, // 1小时
  },

  // 开发环境特殊配置
  development: {
    enableDevRoutes: process.env.NODE_ENV === 'development',
    mockData: process.env.NODE_ENV === 'development',
    verboseLogging: process.env.NODE_ENV === 'development',
  },
};

// 验证必要的配置
function validateConfig() {
  const requiredEnvVars = [
    'JWT_SECRET',
    'SESSION_SECRET',
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn('⚠️  警告: 以下环境变量未设置:', missing.join(', '));
    console.warn('请复制 env.example 到 .env 并设置相应的值');
  }

  // 在生产环境中确保安全配置
  if (config.server.env === 'production') {
    if (config.jwt.secret.length < 32) {
      throw new Error('生产环境JWT密钥长度必须至少32个字符');
    }
    
    if (config.security.sessionSecret.length < 32) {
      throw new Error('生产环境会话密钥长度必须至少32个字符');
    }
  }
}

// 创建必要的目录
function createDirectories() {
  const fs = require('fs');
  const directories = [
    config.upload.path,
    config.thumbnail.path,
    config.logging.path,
    path.dirname(config.database.path),
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// 初始化配置
validateConfig();
createDirectories();

module.exports = config; 