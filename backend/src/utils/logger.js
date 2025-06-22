const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const config = require('../config/server');

// 确保日志目录存在
const logDir = path.resolve(config.logging.path);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        if (Object.keys(meta).length > 0) {
            try {
                // 安全的JSON序列化，处理循环引用
                const seen = new Set();
                const safeString = JSON.stringify(meta, (key, value) => {
                    if (typeof value === 'object' && value !== null) {
                        if (seen.has(value)) {
                            return '[Circular]';
                        }
                        seen.add(value);
                    }
                    return value;
                });
                log += ` ${safeString}`;
            } catch (error) {
                log += ` [Serialization Error]`;
            }
        }
        
        if (stack) {
            log += `\n${stack}`;
        }
        
        return log;
    })
);

// 控制台格式
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} ${level}: ${message}`;
        
        if (Object.keys(meta).length > 0) {
            try {
                // 安全的JSON序列化，处理循环引用
                const seen = new Set();
                const safeString = JSON.stringify(meta, (key, value) => {
                    if (typeof value === 'object' && value !== null) {
                        if (seen.has(value)) {
                            return '[Circular]';
                        }
                        seen.add(value);
                    }
                    return value;
                }, 2);
                log += ` ${safeString}`;
            } catch (error) {
                log += ` [Serialization Error]`;
            }
        }
        
        return log;
    })
);

// 创建传输器
const transports = [];

// 文件传输器 - 所有日志
transports.push(
    new DailyRotateFile({
        filename: path.join(logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: config.logging.maxSize,
        maxFiles: config.logging.maxFiles,
        format: logFormat
    })
);

// 文件传输器 - 错误日志
transports.push(
    new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: config.logging.maxSize,
        maxFiles: config.logging.maxFiles,
        format: logFormat
    })
);

// 控制台传输器
if (config.logging.enableConsole) {
    transports.push(
        new winston.transports.Console({
            format: consoleFormat
        })
    );
}

// 创建主logger
const logger = winston.createLogger({
    level: config.logging.level,
    transports,
    exitOnError: false
});

// 创建专用logger
const accessLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new DailyRotateFile({
            filename: path.join(logDir, 'access-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
        })
    ]
});

const securityLogger = winston.createLogger({
    level: 'warn',
    format: logFormat,
    transports: [
        new DailyRotateFile({
            filename: path.join(logDir, 'security-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
        })
    ]
});

const performanceLogger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new DailyRotateFile({
            filename: path.join(logDir, 'performance-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
        })
    ]
});

/**
 * 记录访问日志
 */
function logAccess(req, res, responseTime) {
    const logData = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        responseTime: responseTime,
        contentLength: res.get('Content-Length'),
        referer: req.get('Referer')
    };

    if (req.user) {
        logData.userId = req.user.id;
        logData.username = req.user.username;
    }

    accessLogger.info('HTTP Request', logData);
}

/**
 * 记录认证事件
 */
function logAuth(message, username, ip) {
    logger.info('Auth Event', {
        message,
        username,
        ip,
        timestamp: new Date().toISOString()
    });
}

/**
 * 记录安全事件
 */
function logSecurity(event, details, req = null) {
    const logData = {
        event,
        details,
        timestamp: new Date().toISOString()
    };

    if (req) {
        logData.ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
        logData.userAgent = req.get ? req.get('User-Agent') : (req.headers && req.headers['user-agent']) || 'unknown';
        logData.url = req.originalUrl || req.url;
        
        if (req.user) {
            logData.userId = req.user.id;
            logData.username = req.user.username;
        }
    }

    securityLogger.warn('Security Event', logData);
}

/**
 * 记录性能指标
 */
function logPerformance(operation, duration, details = {}) {
    performanceLogger.info('Performance Metric', {
        operation,
        duration,
        details,
        timestamp: new Date().toISOString()
    });
}

/**
 * 记录数据库操作
 */
function logDatabase(operation, table, duration, params = {}) {
    logger.debug('Database Operation', {
        operation,
        table,
        duration,
        params
    });
}

/**
 * 记录文件操作
 */
function logFileOperation(operation, filePath, details = {}) {
    logger.info('File Operation', {
        operation,
        filePath,
        details,
        timestamp: new Date().toISOString()
    });
}

/**
 * 记录系统事件
 */
function logSystem(event, details = {}) {
    logger.info('System Event', {
        event,
        details,
        timestamp: new Date().toISOString()
    });
}

/**
 * 结构化错误日志
 */
function logError(error, context = {}) {
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
    };

    if (error.code) errorInfo.code = error.code;
    if (error.errno) errorInfo.errno = error.errno;
    if (error.syscall) errorInfo.syscall = error.syscall;
    if (error.path) errorInfo.path = error.path;

    logger.error('Application Error', errorInfo);
}

/**
 * 清理旧日志文件
 */
async function cleanupLogs(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
        const files = fs.readdirSync(logDir);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(logDir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.mtime < cutoffDate) {
                fs.unlinkSync(filePath);
                deletedCount++;
                logger.info(`Deleted old log file: ${file}`);
            }
        }

        logger.info(`Log cleanup completed. Deleted ${deletedCount} files older than ${retentionDays} days.`);
        return deletedCount;
    } catch (error) {
        logger.error('Log cleanup failed:', error);
        throw error;
    }
}

/**
 * 获取日志统计信息
 */
async function getLogStats() {
    try {
        const files = fs.readdirSync(logDir);
        let totalSize = 0;
        const logFiles = [];

        for (const file of files) {
            const filePath = path.join(logDir, file);
            const stats = fs.statSync(filePath);
            
            totalSize += stats.size;
            logFiles.push({
                name: file,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
            });
        }

        return {
            totalFiles: files.length,
            totalSize,
            files: logFiles.sort((a, b) => b.modified - a.modified)
        };
    } catch (error) {
        logger.error('Failed to get log stats:', error);
        throw error;
    }
}

/**
 * 搜索日志
 */
async function searchLogs(query, options = {}) {
    const {
        level = 'all',
        startDate,
        endDate,
        limit = 100
    } = options;

    try {
        // 这里简化实现，实际项目中可能需要更复杂的日志搜索
        const files = fs.readdirSync(logDir);
        const results = [];

        for (const file of files) {
            if (level !== 'all' && !file.includes(level)) continue;
            
            const filePath = path.join(logDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');

            for (const line of lines) {
                if (line.includes(query)) {
                    try {
                        const logEntry = JSON.parse(line);
                        
                        if (startDate && new Date(logEntry.timestamp) < startDate) continue;
                        if (endDate && new Date(logEntry.timestamp) > endDate) continue;
                        
                        results.push(logEntry);
                        
                        if (results.length >= limit) break;
                    } catch (e) {
                        // 跳过无法解析的行
                    }
                }
            }
            
            if (results.length >= limit) break;
        }

        return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        logger.error('Log search failed:', error);
        throw error;
    }
}

// 导出logger实例和工具函数
module.exports = {
    // 主logger
    logger,
    
    // 专用logger
    accessLogger,
    securityLogger,
    performanceLogger,
    
    // 便捷方法
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    
    // 专门的日志记录函数
    logAccess,
    logAuth,
    logSecurity,
    logPerformance,
    logDatabase,
    logFileOperation,
    logSystem,
    logError,
    
    // 管理功能
    cleanupLogs,
    getLogStats,
    searchLogs
}; 