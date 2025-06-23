const express = require('express');
const { validate, schemas } = require('../utils/validator');
const { requireAuth } = require('../middleware/auth');
const { loginRateLimit, strictRateLimit } = require('../middleware/rateLimit');
const authController = require('../controllers/authController');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    管理员登录
 * @access  Public
 */
router.post('/login', 
  loginRateLimit,
  validate.body(schemas.admin.login),
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    刷新访问令牌
 * @access  Public
 */
router.post('/refresh', authController.refresh);

/**
 * @route   GET /api/auth/verify
 * @desc    验证当前令牌
 * @access  Private
 */
router.get('/verify', requireAuth, authController.verify);

/**
 * @route   POST /api/auth/logout
 * @desc    用户登出
 * @access  Private
 */
router.post('/logout', requireAuth, authController.logout);

/**
 * @route   GET /api/auth/user
 * @desc    获取当前用户信息
 * @access  Private
 */
router.get('/user', requireAuth, authController.getCurrentUser);

/**
 * @route   PUT /api/auth/password
 * @desc    修改密码
 * @access  Private
 */
router.put('/password',
  requireAuth,
  strictRateLimit,
  // 暂时移除验证中间件，在控制器中直接验证
  authController.changePassword
);

/**
 * @route   PUT /api/auth/profile
 * @desc    更新用户信息
 * @access  Private
 */
router.put('/profile',
  requireAuth,
  validate.body(schemas.admin.update),
  authController.updateProfile
);

module.exports = router; 