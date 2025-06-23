const Admin = require('../models/Admin');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../middleware/auth');
const { logSecurity: logSecurityEvent } = require('../utils/logger');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * 管理员登录
 */
const login = asyncHandler(async (req, res) => {
  const { username, password, rememberMe } = req.body;
  
  try {
    // 验证用户凭据
    const admin = await Admin.authenticate(username, password);
    
    if (!admin) {
      logSecurityEvent('LOGIN_FAILED', req, { username, reason: 'invalid_credentials' });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误',
        },
      });
    }
    
    // 生成JWT token
    const tokenPayload = {
      id: admin.id,
      username: admin.username,
      type: 'access',
    };
    
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    // 这里可以添加更新最后登录时间的逻辑（暂时跳过）
    // await Admin.updateLastLogin(admin.id);
    
    // 记录登录成功日志
    logger.logAuth('管理员登录成功', admin.username, req.ip);
    logSecurityEvent('LOGIN_SUCCESS', req, { username: admin.username });
    
    // 设置cookie（如果选择记住登录）
    if (rememberMe) {
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
      });
    }
    
    res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
        },
        accessToken: accessToken,
        refreshToken: refreshToken,
        expiresIn: 3600, // 1小时
      },
      message: '登录成功',
    });
    
  } catch (error) {
    logger.error('登录过程中发生错误:', error);
    logSecurityEvent('LOGIN_ERROR', req, { username, error: error.message });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_ERROR',
        message: '登录过程中发生错误',
      },
    });
  }
});

/**
 * 刷新访问令牌
 */
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};
  const cookieRefreshToken = req.cookies?.refreshToken;
  
  const token = refreshToken || cookieRefreshToken;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_REFRESH_TOKEN',
        message: '刷新令牌缺失',
      },
    });
  }
  
  try {
    // 验证刷新令牌
    const { valid, decoded, error } = verifyToken(token, 'refresh');
    
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: '无效的刷新令牌',
        },
      });
    }
    
    // 验证用户是否仍然存在
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在',
        },
      });
    }
    
    // 生成新的访问令牌
    const newAccessToken = generateAccessToken({
      id: admin.id,
      username: admin.username,
      type: 'access',
    });
    
    logger.logAuth('令牌刷新成功', admin.username, req.ip);
    
    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        expiresIn: 3600, // 1小时
      },
      message: '令牌刷新成功',
    });
    
  } catch (error) {
    logger.logAuth('令牌刷新失败', null, req.ip);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_EXPIRED',
          message: '刷新令牌已过期，请重新登录',
        },
      });
    }
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: '无效的刷新令牌',
      },
    });
  }
});

/**
 * 验证当前令牌
 */
const verify = asyncHandler(async (req, res) => {
  // 如果能到达这里，说明token验证已通过（通过认证中间件）
  res.json({
    success: true,
    data: {
      valid: true,
      user: req.user,
    },
    message: '令牌有效',
  });
});

/**
 * 用户登出
 */
const logout = asyncHandler(async (req, res) => {
  try {
    // 清除cookie
    res.clearCookie('refreshToken');
    
    // 在实际应用中，可能需要将token加入黑名单
    // 目前使用短期token，到期自动失效
    
    logger.logAuth('管理员登出', req.user.username, req.ip);
    logSecurityEvent('LOGOUT', req, { username: req.user.username });
    
    res.json({
      success: true,
      message: '登出成功',
    });
    
  } catch (error) {
    logger.error('登出过程中发生错误:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_ERROR',
        message: '登出过程中发生错误',
      },
    });
  }
});

/**
 * 获取当前用户信息
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: '用户不存在',
        },
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          createdAt: admin.created_at,
          updatedAt: admin.updated_at,
        },
      },
    });
    
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_USER_ERROR',
        message: '获取用户信息失败',
      },
    });
  }
});

/**
 * 修改密码
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  // 基本参数验证（路由中间件已做详细验证）
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETERS',
        message: '缺少必需参数',
      },
    });
  }
  
  try {
    // 验证当前密码
    const admin = await Admin.authenticate(req.user.username, currentPassword);
    
    if (!admin) {
      logSecurityEvent('PASSWORD_CHANGE_FAILED', req, { 
        username: req.user.username, 
        reason: 'invalid_current_password' 
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CURRENT_PASSWORD',
          message: '当前密码错误',
        },
      });
    }
    
    // 更新密码
    await Admin.update(req.user.id, { password: newPassword });
    
    logger.logAuth('密码修改成功', req.user.username, req.ip);
    logSecurityEvent('PASSWORD_CHANGED', req, { username: req.user.username });
    
    res.json({
      success: true,
      message: '密码修改成功',
    });
    
  } catch (error) {
    logger.error('修改密码失败:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'CHANGE_PASSWORD_ERROR',
        message: '修改密码失败',
      },
    });
  }
});

/**
 * 更新用户信息
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { username, email } = req.body;
  
  try {
    const updateData = {};
    
    // 检查用户名是否已存在
    if (username && username !== req.user.username) {
      const usernameExists = await Admin.usernameExists(username, req.user.id);
      if (usernameExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'USERNAME_EXISTS',
            message: '用户名已存在',
          },
        });
      }
      updateData.username = username;
    }
    
    // 检查邮箱是否已存在
    if (email && email !== req.user.email) {
      const emailExists = await Admin.emailExists(email, req.user.id);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: '邮箱已存在',
          },
        });
      }
      updateData.email = email;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_CHANGES',
          message: '没有需要更新的内容',
        },
      });
    }
    
    // 更新用户信息
    await Admin.update(req.user.id, updateData);
    
    // 获取更新后的用户信息
    const updatedAdmin = await Admin.findById(req.user.id);
    
    logger.logAuth('用户信息更新成功', req.user.username, req.ip);
    
    res.json({
      success: true,
      data: {
        user: {
          id: updatedAdmin.id,
          username: updatedAdmin.username,
          email: updatedAdmin.email,
          createdAt: updatedAdmin.created_at,
          updatedAt: updatedAdmin.updated_at,
        },
      },
      message: '用户信息更新成功',
    });
    
  } catch (error) {
    logger.error('更新用户信息失败:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PROFILE_ERROR',
        message: '更新用户信息失败',
      },
    });
  }
});

module.exports = {
  login,
  refresh,
  verify,
  logout,
  getCurrentUser,
  changePassword,
  updateProfile,
}; 