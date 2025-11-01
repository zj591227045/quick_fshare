const express = require('express');
const { validate, schemas } = require('../utils/validator');
const { requireAuth, optionalAuthenticateAdmin } = require('../middleware/auth');
const { adminRateLimit, browseRateLimit } = require('../middleware/rateLimit');
const shareController = require('../controllers/shareController');

const router = express.Router();

/**
 * @route   GET /api/shares
 * @desc    获取分享路径列表（管理员）
 * @access  Private
 */
router.get('/',
  requireAuth,
  adminRateLimit,
  validate.query(schemas.share.list),
  shareController.getShares
);

/**
 * @route   GET /api/shares/enabled
 * @desc    获取启用的分享路径（公开）
 * @access  Public
 */
router.get('/enabled',
  browseRateLimit,
  shareController.getEnabledShares
);

/**
 * @route   GET /api/shares/stats
 * @desc    获取分享路径统计信息
 * @access  Private
 */
router.get('/stats',
  requireAuth,
  shareController.getShareStats
);

/**
 * @route   POST /api/shares
 * @desc    创建分享路径
 * @access  Private
 */
router.post('/',
  requireAuth,
  adminRateLimit,
  validate.body(schemas.share.create),
  shareController.createShare
);

/**
 * @route   POST /api/shares/validate-password
 * @desc    验证分享路径访问密码
 * @access  Public
 */
router.post('/validate-password',
  browseRateLimit,
  shareController.validateSharePassword
);

/**
 * @route   POST /api/shares/enumerate-smb-shares
 * @desc    枚举SMB共享
 * @access  Private
 */
router.post('/enumerate-smb-shares',
  requireAuth,
  adminRateLimit,
  shareController.enumerateSMBShares
);

/**
 * @route   POST /api/shares/browse-smb-directory
 * @desc    浏览SMB共享目录
 * @access  Private
 */
router.post('/browse-smb-directory',
  requireAuth,
  adminRateLimit,
  shareController.browseSMBDirectory
);

/**
 * @route   GET /api/shares/:id
 * @desc    获取单个分享路径
 * @access  Private
 */
router.get('/:id',
  requireAuth,
  shareController.getShare
);

/**
 * @route   PUT /api/shares/:id
 * @desc    更新分享路径
 * @access  Private
 */
router.put('/:id',
  requireAuth,
  adminRateLimit,
  validate.body(schemas.share.update),
  shareController.updateShare
);

/**
 * @route   PUT /api/shares/:id/toggle
 * @desc    切换分享路径启用状态
 * @access  Private
 */
router.put('/:id/toggle',
  requireAuth,
  adminRateLimit,
  shareController.toggleShareStatus
);

/**
 * @route   DELETE /api/shares/:id
 * @desc    删除分享路径
 * @access  Private
 */
router.delete('/:id',
  requireAuth,
  adminRateLimit,
  shareController.deleteShare
);

module.exports = router;
