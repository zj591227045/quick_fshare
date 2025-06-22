const rateLimit = require('express-rate-limit');
const config = require('../config/server');
const logger = require('../utils/logger');
const { logSecurity: logSecurityEvent } = require('../utils/logger');

/**
 * 获取客户端标识符
 */
function getClientIdentifier(req) {
  // 使用IP地址作为客户端标识符
  return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}

/**
 * 创建基础速率限制器
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = config.security.rateLimitWindowMs,
    max = config.security.rateLimitMax,
    message = '请求过于频繁，请稍后再试',
    keyGenerator,
    onLimitReached,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  const limiter = rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyGenerator || ((req) => getClientIdentifier(req)),
    skipSuccessfulRequests,
    skipFailedRequests,
    handler: (req, res) => {
      logger.warn('频率限制触发', {
        ip: req.ip,
        user: req.user ? req.user.username : null,
        url: req.url,
        method: req.method,
        limit: max,
        window: windowMs,
      });

      logSecurityEvent('RATE_LIMIT_EXCEEDED', req, {
        limit: max,
        window: windowMs,
      });

      if (onLimitReached) {
        onLimitReached(req, res);
      }

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
        },
      });
    },
  });

  return limiter;
}

/**
 * 通用API速率限制
 */
const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每15分钟最多100个请求
  message: '请求过于频繁，请在15分钟后重试',
});

/**
 * 严格的速率限制（用于敏感操作）
 */
const strictRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每15分钟最多5个请求
  message: '敏感操作请求过于频繁，请在15分钟后重试',
});

/**
 * 登录速率限制
 */
const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 每15分钟最多5次登录尝试
  message: '登录尝试过于频繁，请在15分钟后重试',
  skipSuccessfulRequests: true, // 成功的登录不计入限制
});

/**
 * 文件下载速率限制
 */
const downloadRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 每分钟最多10个下载请求
  message: '下载请求过于频繁，请稍后重试',
});

/**
 * 文件浏览速率限制
 */
const browseRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  max: 30, // 每分钟最多30个浏览请求
  message: '浏览请求过于频繁，请稍后重试',
});

/**
 * 缩略图生成速率限制
 */
const thumbnailRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  max: 20, // 每分钟最多20个缩略图请求
  message: '缩略图请求过于频繁，请稍后重试',
});

/**
 * 管理员操作速率限制
 */
const adminRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  max: 50, // 每分钟最多50个管理员操作
  message: '管理员操作过于频繁，请稍后重试',
});

/**
 * 搜索速率限制
 */
const searchRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  max: 15, // 每分钟最多15个搜索请求
  message: '搜索请求过于频繁，请稍后重试',
});

/**
 * 动态速率限制（根据用户类型调整）
 */
function dynamicRateLimit(options = {}) {
  return (req, res, next) => {
    let limitOptions = { ...options };

    // 已认证用户享受更宽松的限制
    if (req.user) {
      limitOptions.max = Math.floor((limitOptions.max || 100) * 1.5);
    }

    // 本地IP享受更宽松的限制
    const ip = req.ip || req.connection.remoteAddress;
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      limitOptions.max = Math.floor((limitOptions.max || 100) * 2);
    }

    const limiter = createRateLimiter(limitOptions);
    return limiter(req, res, next);
  };
}

/**
 * IP黑名单检查中间件
 */
function ipBlacklist(blacklistedIPs = []) {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (blacklistedIPs.includes(clientIP)) {
      logSecurityEvent('BLACKLISTED_IP_ACCESS', req, { ip: clientIP });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_BLACKLISTED',
          message: '访问被拒绝',
        },
      });
    }
    
    next();
  };
}

/**
 * 可疑活动检测中间件
 */
function suspiciousActivityDetector(req, res, next) {
  const userAgent = req.get('User-Agent');
  const ip = req.ip || req.connection.remoteAddress;
  
  // 检测可疑的User-Agent
  const suspiciousUserAgents = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
  ];
  
  if (userAgent && suspiciousUserAgents.some(pattern => pattern.test(userAgent))) {
    logSecurityEvent('SUSPICIOUS_USER_AGENT', req, { 
      userAgent,
      ip,
    });
    
    // 对可疑请求应用更严格的限制
    req.suspiciousActivity = true;
  }
  
  next();
}

module.exports = {
  createRateLimiter,
  generalRateLimit,
  strictRateLimit,
  loginRateLimit,
  downloadRateLimit,
  browseRateLimit,
  thumbnailRateLimit,
  adminRateLimit,
  searchRateLimit,
  dynamicRateLimit,
  ipBlacklist,
  suspiciousActivityDetector,
}; 