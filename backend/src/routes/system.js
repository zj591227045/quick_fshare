const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/systemController');
const { requireAuth } = require('../middleware/auth');

// 创建控制器实例
const systemController = new SystemController();

/**
 * @route   GET /api/system/stats
 * @desc    获取系统统计信息
 * @access  Private
 */
router.get('/stats', requireAuth, systemController.getSystemStats.bind(systemController));

/**
 * @route   GET /api/system/health
 * @desc    获取系统健康状态
 * @access  Public
 */
router.get('/health', systemController.getHealthCheck.bind(systemController));

/**
 * @route   GET /api/system/metrics
 * @desc    获取系统历史指标
 * @access  Private
 */
router.get('/metrics', requireAuth, systemController.getHistoricalMetrics.bind(systemController));

/**
 * @route   GET /api/system/logs
 * @desc    获取系统日志
 * @access  Private
 */
router.get('/logs', requireAuth, systemController.getSystemLogs.bind(systemController));

/**
 * @route   GET /api/system/access-logs
 * @desc    获取访问日志
 * @access  Private
 */
router.get('/access-logs', requireAuth, systemController.getAccessLogs.bind(systemController));

/**
 * @route   POST /api/system/cleanup-logs
 * @desc    清理过期日志
 * @access  Private
 */
router.post('/cleanup-logs', requireAuth, systemController.cleanupLogs.bind(systemController));

module.exports = router; 