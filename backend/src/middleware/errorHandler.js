const { logError, logSecurity } = require('../utils/logger');
const config = require('../config/server');

/**
 * 开发环境错误处理
 */
function developmentErrorHandler(err, req, res, next) {
    const error = {
        message: err.message,
        stack: err.stack,
        status: err.status || err.statusCode || 500,
        name: err.name,
        code: err.code
    };

    // 记录详细错误信息
    logError(err, {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        user: req.user?.username || 'anonymous',
        params: req.params,
        query: req.query,
        body: req.body
    });

    res.status(error.status).json({
        success: false,
        message: error.message,
        error: error
    });
}

/**
 * 生产环境错误处理
 */
function productionErrorHandler(err, req, res, next) {
    const status = err.status || err.statusCode || 500;
    
    // 记录错误但不暴露敏感信息
    logError(err, {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        user: req.user?.username || 'anonymous'
    });

    // 安全的错误响应
    const response = {
        success: false,
        message: status === 500 ? '服务器内部错误' : err.message,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            status: status
        }
    };

    // 客户端错误(4xx)可以显示详细信息
    if (status >= 400 && status < 500) {
        response.message = err.message;
        if (err.details) {
            response.error.details = err.details;
        }
    }

    res.status(status).json(response);
}

/**
 * 主错误处理中间件
 */
function errorHandler(err, req, res, next) {
    // 如果响应已经发送，交给Express默认处理
    if (res.headersSent) {
        return next(err);
    }

    // 设置默认状态码
    if (!err.status && !err.statusCode) {
        err.status = 500;
    }

    // 安全相关错误特殊处理
    if (err.name === 'UnauthorizedError' || err.code === 'UNAUTHORIZED') {
        logSecurity('UNAUTHORIZED_ACCESS', {
            error: err.message,
            url: req.originalUrl,
            method: req.method
        }, req);
        
        return res.status(401).json({
            success: false,
            message: '未授权访问',
            error: {
                code: 'UNAUTHORIZED',
                status: 401
            }
        });
    }

    // JWT错误处理
    if (err.name === 'JsonWebTokenError') {
        logSecurity('INVALID_TOKEN', { error: err.message }, req);
        
        return res.status(401).json({
            success: false,
            message: '无效的访问令牌',
            error: {
                code: 'INVALID_TOKEN',
                status: 401
            }
        });
    }

    if (err.name === 'TokenExpiredError') {
        logSecurity('TOKEN_EXPIRED', { error: err.message }, req);
        
        return res.status(401).json({
            success: false,
            message: '访问令牌已过期',
            error: {
                code: 'TOKEN_EXPIRED',
                status: 401
            }
        });
    }

    // 验证错误处理
    if (err.name === 'ValidationError' || err.code === 'VALIDATION_ERROR') {
        return res.status(400).json({
            success: false,
            message: '数据验证失败',
            error: {
                code: 'VALIDATION_ERROR',
                status: 400,
                details: err.details || err.message
            }
        });
    }

    // 文件系统错误处理
    if (err.code === 'ENOENT') {
        return res.status(404).json({
            success: false,
            message: '文件或目录不存在',
            error: {
                code: 'FILE_NOT_FOUND',
                status: 404
            }
        });
    }

    if (err.code === 'EACCES' || err.code === 'EPERM') {
        logSecurity('FILE_PERMISSION_DENIED', {
            path: err.path,
            operation: err.syscall
        }, req);
        
        return res.status(403).json({
            success: false,
            message: '文件访问权限不足',
            error: {
                code: 'PERMISSION_DENIED',
                status: 403
            }
        });
    }

    // 数据库错误处理
    if (err.code === 'SQLITE_CONSTRAINT' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({
            success: false,
            message: '数据已存在或违反唯一性约束',
            error: {
                code: 'CONSTRAINT_VIOLATION',
                status: 409
            }
        });
    }

    // 网络错误处理
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        return res.status(503).json({
            success: false,
            message: '外部服务不可用',
            error: {
                code: 'SERVICE_UNAVAILABLE',
                status: 503
            }
        });
    }

    // 根据环境选择错误处理方式
    if (config.server.env === 'development') {
        developmentErrorHandler(err, req, res, next);
    } else {
        productionErrorHandler(err, req, res, next);
    }
}

/**
 * 404处理中间件
 */
function notFoundHandler(req, res, next) {
    const error = {
        success: false,
        message: `路由 ${req.method} ${req.originalUrl} 不存在`,
        error: {
            code: 'NOT_FOUND',
            status: 404
        }
    };

    logSecurity('NOT_FOUND_ACCESS', {
        url: req.originalUrl,
        method: req.method
    }, req);

    res.status(404).json(error);
}

/**
 * 异步错误包装器
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 创建自定义错误
 */
class AppError extends Error {
    constructor(message, statusCode, code = null, details = null) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.status = statusCode;
        this.code = code || 'APP_ERROR';
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 创建验证错误
 */
class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

/**
 * 创建认证错误
 */
class AuthenticationError extends AppError {
    constructor(message = '认证失败') {
        super(message, 401, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

/**
 * 创建授权错误
 */
class AuthorizationError extends AppError {
    constructor(message = '权限不足') {
        super(message, 403, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

/**
 * 创建资源未找到错误
 */
class NotFoundError extends AppError {
    constructor(message = '资源未找到') {
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

/**
 * 创建冲突错误
 */
class ConflictError extends AppError {
    constructor(message = '资源冲突') {
        super(message, 409, 'CONFLICT');
        this.name = 'ConflictError';
    }
}

/**
 * 全局未捕获异常处理
 */
function setupGlobalErrorHandlers() {
    // 捕获未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        logError(new Error('Unhandled Promise Rejection'), {
            reason: reason,
            promise: promise
        });
        
        // 优雅关闭应用
        process.exit(1);
    });

    // 捕获未捕获的异常
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
        logError(error, { type: 'uncaughtException' });
        
        // 优雅关闭应用
        process.exit(1);
    });

    // 进程退出处理
    process.on('SIGTERM', () => {
        console.log('SIGTERM received. Shutting down gracefully...');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        console.log('SIGINT received. Shutting down gracefully...');
        process.exit(0);
    });
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    setupGlobalErrorHandlers,
    
    // 错误类
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError
}; 