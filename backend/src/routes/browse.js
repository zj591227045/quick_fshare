const express = require('express');
const BrowseController = require('../controllers/browseController');
const { browseRateLimit } = require('../middleware/rateLimit');
const { validateRequest, validate, schemas } = require('../utils/validator');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();
const browseController = new BrowseController();

// ====== 管理员路由 (必须在通用路由之前) ======

// 配置增量更新 - 需要管理员权限
router.post('/admin/configure-incremental',
  browseRateLimit,
  authenticateAdmin,
  browseController.configureIncrementalUpdate.bind(browseController)
);

// 获取增量更新配置 - 需要管理员权限
router.get('/admin/incremental-config',
  browseRateLimit,
  authenticateAdmin,
  browseController.getIncrementalConfig.bind(browseController)
);

// 索引管理 - 需要管理员权限
router.get('/admin/index-management',
  browseRateLimit,
  authenticateAdmin,
  browseController.getIndexManagement.bind(browseController)
);

// 批量重建索引 - 需要管理员权限
router.post('/admin/batch-rebuild-index',
  browseRateLimit,
  authenticateAdmin,
  browseController.batchRebuildIndex.bind(browseController)
);

// 清理索引 - 需要管理员权限
router.post('/admin/cleanup-indexes',
  browseRateLimit,
  authenticateAdmin,
  browseController.cleanupIndexes.bind(browseController)
);

// 管理员获取搜索索引状态 - 需要管理员权限
router.get('/admin/:shareId/search-status',
  browseRateLimit,
  authenticateAdmin,
  browseController.getSearchIndexStatus.bind(browseController)
);

// ====== 通用路由 ======

// 验证分享密码
router.post('/verify-password',
  browseRateLimit, 
  validate.body(schemas.browse.verifyPassword),
  browseController.verifyPassword.bind(browseController)
);

// 重建搜索索引 - 需要管理员权限
router.post('/:shareId/rebuild-index',
  browseRateLimit,
  authenticateAdmin,
  browseController.rebuildSearchIndex.bind(browseController)
);

// 触发增量更新 - 需要管理员权限
router.post('/:shareId/incremental-update',
  browseRateLimit,
  authenticateAdmin,
  browseController.triggerIncrementalUpdate.bind(browseController)
);

// 获取增量更新统计 - 需要管理员权限
router.get('/:shareId/incremental-stats',
  browseRateLimit,
  authenticateAdmin,
  browseController.getIncrementalUpdateStats.bind(browseController)
);

// 搜索文件
router.get('/:shareId/search',
  browseRateLimit,
  validateRequest('browse.search'),
  browseController.searchFiles.bind(browseController)
);

// 获取搜索索引状态
router.get('/:shareId/search-status',
  browseRateLimit,
  browseController.getSearchIndexStatus.bind(browseController)
);

// 获取文件信息
router.get('/:shareId/info/*',
  browseRateLimit,
  browseController.getFileInfo.bind(browseController)
);

// 下载文件
router.get('/:shareId/download/*',
  browseRateLimit,
  browseController.downloadFile.bind(browseController)
);

// 获取缩略图
router.get('/:shareId/thumbnail/*',
  browseRateLimit,
  browseController.getThumbnail.bind(browseController)
);

// 浏览分享路径的文件列表 (必须放在最后，因为是最通用的路由)
router.get('/:shareId', 
  browseRateLimit,
  validateRequest('browse.list'),
  browseController.browseFiles.bind(browseController)
);

module.exports = router; 