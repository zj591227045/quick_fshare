const express = require('express');
const BrowseController = require('../controllers/browseController');
const { browseRateLimit } = require('../middleware/rateLimit');
const { validateRequest } = require('../utils/validator');

const router = express.Router();
const browseController = new BrowseController();

// 浏览分享路径的文件列表
router.get('/:shareId', 
  browseRateLimit,
  validateRequest('browse.list'),
  browseController.browseFiles.bind(browseController)
);

// 验证分享密码
router.post('/verify-password',
  browseRateLimit, 
  validateRequest('browse.verifyPassword'),
  browseController.verifyPassword.bind(browseController)
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

// 搜索文件
router.get('/:shareId/search',
  browseRateLimit,
  validateRequest('browse.search'),
  browseController.searchFiles.bind(browseController)
);

// 获取文件信息
router.get('/:shareId/info/*',
  browseRateLimit,
  browseController.getFileInfo.bind(browseController)
);

module.exports = router; 