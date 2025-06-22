const jwt = require('jsonwebtoken');
const config = require('../config/server');
const Admin = require('../models/Admin');
const { logSecurity } = require('../utils/logger');

/**
 * 生成访问令牌
 */
function generateAccessToken(admin) {
    const payload = {
        id: admin.id,
        username: admin.username,
        type: 'access'
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
        issuer: 'quick-fshare',
        audience: 'quick-fshare-admin'
    });
}

/**
 * 生成刷新令牌
 */
function generateRefreshToken(admin) {
    const payload = {
        id: admin.id,
        username: admin.username,
        type: 'refresh'
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.refreshExpiresIn,
        issuer: 'quick-fshare',
        audience: 'quick-fshare-admin'
    });
}

/**
 * 生成临时访问令牌（用于分享访问）
 */
function generateTemporaryToken(shareId, clientIp) {
    const payload = {
        shareId,
        clientIp,
        type: 'temporary'
    };

    return jwt.sign(payload, config.jwt.secret, {
        expiresIn: '2h', // 临时令牌2小时有效
        issuer: 'quick-fshare',
        audience: 'quick-fshare-share'
    });
}

/**
 * 验证令牌
 */
function verifyToken(token, expectedType = null) {
    try {
        const decoded = jwt.verify(token, config.jwt.secret, {
            issuer: 'quick-fshare'
        });

        // 检查令牌类型
        if (expectedType && decoded.type !== expectedType) {
            throw new Error('Invalid token type');
        }

        return { valid: true, decoded };
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return { valid: false, error: 'Token expired', expired: true };
        } else if (error.name === 'JsonWebTokenError') {
            return { valid: false, error: 'Invalid token', invalid: true };
        } else {
            return { valid: false, error: error.message };
        }
    }
}

/**
 * 验证临时令牌（简化版本，用于分享访问）
 */
function verifyTemporaryToken(token, shareId) {
    try {
        const { valid, decoded } = verifyToken(token, 'temporary');
        
        if (!valid) {
            return false;
        }
        
        // 验证分享ID是否匹配
        if (decoded.shareId !== parseInt(shareId)) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 从请求中提取令牌
 */
function extractToken(req) {
    // 从Authorization头部提取
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // 从Cookie中提取
    if (req.cookies && req.cookies.access_token) {
        return req.cookies.access_token;
    }

    // 从查询参数中提取（仅用于下载等特殊场景）
    if (req.query && req.query.token) {
        return req.query.token;
    }

    return null;
}

/**
 * 管理员认证中间件
 */
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            logSecurity('AUTH_TOKEN_MISSING', null, req);
            return res.status(401).json({
                success: false,
                message: '访问令牌缺失',
                error: 'MISSING_TOKEN'
            });
        }

        const { valid, decoded, error, expired } = verifyToken(token, 'access');

        if (!valid) {
            logSecurity('AUTH_TOKEN_INVALID', { error, expired }, req);
            
            return res.status(401).json({
                success: false,
                message: expired ? '访问令牌已过期' : '访问令牌无效',
                error: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
            });
        }

        // 验证管理员是否仍然存在
        const admin = await Admin.findById(decoded.id);
        if (!admin) {
            logSecurity('AUTH_ADMIN_NOT_FOUND', { adminId: decoded.id }, req);
            
            return res.status(401).json({
                success: false,
                message: '管理员账户不存在',
                error: 'ADMIN_NOT_FOUND'
            });
        }

        // 将管理员信息添加到请求对象
        req.user = admin;
        req.tokenPayload = decoded;

        next();
    } catch (error) {
        logSecurity('AUTH_ERROR', { error: error.message }, req);
        
        return res.status(500).json({
            success: false,
            message: '认证过程发生错误',
            error: 'AUTH_ERROR'
        });
    }
};

/**
 * 可选的管理员认证中间件（不强制要求认证）
 */
const optionalAuthenticateAdmin = async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            return next(); // 无令牌时继续执行
        }

        const { valid, decoded } = verifyToken(token, 'access');

        if (valid) {
            const admin = await Admin.findById(decoded.id);
            if (admin) {
                req.user = admin;
                req.tokenPayload = decoded;
            }
        }

        next();
    } catch (error) {
        // 可选认证中间件不应该抛出错误，只是记录日志
        logSecurity('OPTIONAL_AUTH_ERROR', { error: error.message }, req);
        next();
    }
};

/**
 * 分享访问认证中间件
 */
const authenticateShare = (shareId) => {
    return async (req, res, next) => {
        try {
            const token = extractToken(req);

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: '分享访问令牌缺失',
                    error: 'MISSING_SHARE_TOKEN'
                });
            }

            const { valid, decoded, error, expired } = verifyToken(token, 'temporary');

            if (!valid) {
                logSecurity('SHARE_TOKEN_INVALID', { 
                    shareId, 
                    error, 
                    expired 
                }, req);
                
                return res.status(401).json({
                    success: false,
                    message: expired ? '分享访问令牌已过期' : '分享访问令牌无效',
                    error: expired ? 'SHARE_TOKEN_EXPIRED' : 'INVALID_SHARE_TOKEN'
                });
            }

            // 验证分享ID和客户端IP
            if (decoded.shareId !== parseInt(shareId)) {
                logSecurity('SHARE_TOKEN_MISMATCH', { 
                    expected: shareId, 
                    actual: decoded.shareId 
                }, req);
                
                return res.status(403).json({
                    success: false,
                    message: '分享访问令牌不匹配',
                    error: 'SHARE_TOKEN_MISMATCH'
                });
            }

            // 可选：验证客户端IP（严格模式）
            const clientIp = req.ip || req.connection.remoteAddress;
            if (config.security.strictIpCheck && decoded.clientIp !== clientIp) {
                logSecurity('SHARE_IP_MISMATCH', { 
                    expected: decoded.clientIp, 
                    actual: clientIp 
                }, req);
                
                return res.status(403).json({
                    success: false,
                    message: 'IP地址不匹配',
                    error: 'IP_MISMATCH'
                });
            }

            req.shareAccess = {
                shareId: decoded.shareId,
                clientIp: decoded.clientIp,
                token: token
            };

            next();
        } catch (error) {
            logSecurity('SHARE_AUTH_ERROR', { shareId, error: error.message }, req);
            
            return res.status(500).json({
                success: false,
                message: '分享认证过程发生错误',
                error: 'SHARE_AUTH_ERROR'
            });
        }
    };
};

/**
 * 刷新令牌中间件
 */
const refreshToken = async (req, res, next) => {
    try {
        const refreshTokenStr = req.cookies?.refresh_token || req.body?.refreshToken;

        if (!refreshTokenStr) {
            return res.status(401).json({
                success: false,
                message: '刷新令牌缺失',
                error: 'MISSING_REFRESH_TOKEN'
            });
        }

        const { valid, decoded, error, expired } = verifyToken(refreshTokenStr, 'refresh');

        if (!valid) {
            logSecurity('REFRESH_TOKEN_INVALID', { error, expired }, req);
            
            return res.status(401).json({
                success: false,
                message: expired ? '刷新令牌已过期' : '刷新令牌无效',
                error: expired ? 'REFRESH_TOKEN_EXPIRED' : 'INVALID_REFRESH_TOKEN'
            });
        }

        // 验证管理员是否仍然存在
        const admin = await Admin.findById(decoded.id);
        if (!admin) {
            logSecurity('REFRESH_ADMIN_NOT_FOUND', { adminId: decoded.id }, req);
            
            return res.status(401).json({
                success: false,
                message: '管理员账户不存在',
                error: 'ADMIN_NOT_FOUND'
            });
        }

        // 生成新的访问令牌
        const newAccessToken = generateAccessToken(admin);
        const newRefreshToken = generateRefreshToken(admin);

        logSecurity('TOKEN_REFRESHED', { adminId: admin.id, username: admin.username }, req);

        // 设置新令牌到响应
        res.cookie('access_token', newAccessToken, {
            httpOnly: true,
            secure: config.security.httpsOnly,
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24小时
        });

        res.cookie('refresh_token', newRefreshToken, {
            httpOnly: true,
            secure: config.security.httpsOnly,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
        });

        req.user = admin;
        req.newTokens = {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };

        next();
    } catch (error) {
        logSecurity('REFRESH_TOKEN_ERROR', { error: error.message }, req);
        
        return res.status(500).json({
            success: false,
            message: '令牌刷新过程发生错误',
            error: 'REFRESH_ERROR'
        });
    }
};

/**
 * 清除认证令牌
 */
const clearTokens = (res) => {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
};

/**
 * 设置认证令牌到Cookie
 */
const setTokenCookies = (res, accessToken, refreshToken) => {
    res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: config.security.httpsOnly,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    });

    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: config.security.httpsOnly,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
    });
};

/**
 * 验证令牌但不强制登录的中间件
 */
const verifyTokenOnly = async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            return res.status(400).json({
                success: false,
                message: '令牌缺失',
                error: 'MISSING_TOKEN'
            });
        }

        const { valid, decoded, error } = verifyToken(token);

        if (!valid) {
            return res.status(400).json({
                success: false,
                message: '令牌无效',
                error: 'INVALID_TOKEN',
                details: error
            });
        }

        req.tokenPayload = decoded;
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: '令牌验证过程发生错误',
            error: 'TOKEN_VERIFY_ERROR'
        });
    }
};

module.exports = {
    // 令牌生成函数
    generateAccessToken,
    generateRefreshToken,
    generateTemporaryToken,
    
    // 令牌验证函数
    verifyToken,
    verifyTemporaryToken,
    extractToken,
    
    // 认证中间件
    authenticateAdmin,
    requireAuth: authenticateAdmin, // 别名
    optionalAuthenticateAdmin,
    authenticateShare,
    refreshToken,
    verifyTokenOnly,
    
    // 工具函数
    clearTokens,
    setTokenCookies
}; 