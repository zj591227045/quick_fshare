const express = require('express');
const BrowseController = require('../controllers/browseController');
const { browseRateLimit } = require('../middleware/rateLimit');

const router = express.Router();
const browseController = new BrowseController();

// 缩略图路由 - 兼容前端API调用格式
router.get('/:shareId/*', 
  browseRateLimit,
  browseController.getThumbnail.bind(browseController)
);

module.exports = router; 